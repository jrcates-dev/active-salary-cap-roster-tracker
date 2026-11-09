"""Weekly player status: roster status + injury report -> one row per player per week.

Gameday flag rules (from the accounting rules in PLAN.md):
  inactive     roster status RES / PUP / NFI / SUS / INA, or (before the game) report
               status Out / Doubtful
  questionable report status Questionable with an ACT roster status, before the game
  active       ACT roster status with no limiting designation, or any ACT player once
               the team's game is final (he dressed; INA marks the ones who did not)
  unknown      anything else (practice squad, cut, retired) - not counted toward a unit
Each inactive row carries a reason so the UI can say why, and an absence type:
  season       reserve lists (IR, PUP, NFI, suspension, other reserve) - out for weeks
  week         this game only: ruled Out, Doubtful, or on the gameday inactive list

The weekly roster file carries a week's rows from before kickoff (everyone ACT) and
adds the gameday inactives (INA) after the game. When the schedule has moved on to a
week the roster file does not have yet, `player_week_status(..., through_week=W)`
projects each team's latest roster forward to week W so that week's injury report
has something to attach to.
"""

from __future__ import annotations

import polars as pl

from . import sources
from .teams import LEGACY_ABBR

INACTIVE_ROSTER = {
    "RES": "injured_reserve",
    "PUP": "pup",
    "NFI": "nfi",
    "SUS": "suspended",
    "INA": "inactive_list",
    "RSN": "reserve_other",
    "RSR": "reserve_other",
}
ACTIVE_ROSTER = {"ACT"}
# Practice squad (DEV), cut, retired, exempt and trade codes never count toward a unit.

REPORT_INACTIVE = {"Out": "out", "Doubtful": "doubtful"}

# Reserve lists: the player is out for weeks, not just this game.
SEASON_LONG_ROSTER = {"RES", "PUP", "NFI", "SUS", "RSN", "RSR"}


def team_games(games: pl.DataFrame, season: int) -> pl.DataFrame:
    """One row per team per regular-season week it plays: opponent, home flag, final flag."""
    g = games.filter((pl.col("season") == season) & (pl.col("game_type") == "REG")).with_columns(
        (pl.col("away_score").is_not_null() & pl.col("home_score").is_not_null()).alias(
            "game_final"
        )
    )
    cols = ["game_id", "week", "gameday", "game_final"]
    home = g.select(
        *cols,
        _normalize_team("home_team").alias("team"),
        _normalize_team("away_team").alias("opponent"),
        pl.lit(True).alias("home"),
    )
    away = g.select(
        *cols,
        _normalize_team("away_team").alias("team"),
        _normalize_team("home_team").alias("opponent"),
        pl.lit(False).alias("home"),
    )
    return pl.concat([home, away]).with_columns(pl.col("week").cast(pl.Int32))


def current_week(games: pl.DataFrame, season: int) -> int:
    """The week to show: the earliest regular-season week with a game not yet final.

    On Monday morning that is still the week being finished (Monday night is left); from
    Tuesday it is the coming week. After the regular season it is the last week.
    """
    reg = games.filter((pl.col("season") == season) & (pl.col("game_type") == "REG"))
    if reg.is_empty():
        raise ValueError(f"no regular-season games for {season} in the schedule")
    open_ = reg.filter(pl.col("away_score").is_null() | pl.col("home_score").is_null())
    if open_.is_empty():
        return int(reg["week"].max())
    return int(open_["week"].min())


def _project_rosters(r: pl.DataFrame, through_week: int) -> pl.DataFrame:
    """Copy each team's latest roster (before `through_week`) forward to that week.

    Last week's gameday inactives (INA) were inactive for that game only, so they come
    forward as ACT; reserve lists and practice squad carry over as they are.
    """
    have = r.filter(pl.col("week") == through_week)["team"].unique().to_list()
    earlier = r.filter((pl.col("week") < through_week) & ~pl.col("team").is_in(have))
    if earlier.is_empty():
        return r.with_columns(pl.lit(False).alias("projected"))
    latest = earlier.group_by("team").agg(pl.col("week").max().alias("_w"))
    proj = (
        earlier.join(latest, on="team")
        .filter(pl.col("week") == pl.col("_w"))
        .drop("_w")
        .with_columns(
            pl.lit(through_week).cast(r.schema["week"]).alias("week"),
            pl.when(pl.col("roster_status") == "INA")
            .then(pl.lit("ACT"))
            .otherwise(pl.col("roster_status"))
            .alias("roster_status"),
            pl.lit(True).alias("projected"),
        )
    )
    return pl.concat([r.with_columns(pl.lit(False).alias("projected")), proj])


def _normalize_team(col: str) -> pl.Expr:
    return pl.col(col).replace(LEGACY_ABBR).alias(col)


def player_week_status(
    rosters: pl.DataFrame,
    injuries: pl.DataFrame,
    season: int,
    games: pl.DataFrame | None = None,
    through_week: int | None = None,
) -> pl.DataFrame:
    """Combine weekly rosters and the injury report for every week in the season.

    With `games`, a player on the active roster of a team whose game is final counts as
    active whatever his report said: the roster file's INA status is the official list
    of who sat. With `through_week`, rosters are projected forward to that week.
    """
    r = (
        rosters.filter((pl.col("season") == season) & (pl.col("game_type") == "REG"))
        .select(
            "season",
            "week",
            _normalize_team("team"),
            "gsis_id",
            pl.col("full_name").alias("player_name"),
            pl.col("position").alias("roster_position"),
            pl.col("depth_chart_position"),
            pl.col("status").alias("roster_status"),
            pl.col("status_description_abbr").alias("roster_status_detail"),
        )
        .filter(pl.col("gsis_id").is_not_null())
        .unique(subset=["season", "week", "gsis_id"], keep="last")
    )
    i = (
        injuries.filter((pl.col("season") == season) & (pl.col("game_type") == "REG"))
        .select(
            "season",
            "week",
            "gsis_id",
            pl.col("position").alias("injury_position"),
            "report_status",
            "practice_status",
            pl.col("report_primary_injury").alias("injury"),
        )
        .filter(pl.col("gsis_id").is_not_null())
        .unique(subset=["season", "week", "gsis_id"], keep="last")
    )
    if through_week is not None:
        r = _project_rosters(r, through_week)
    else:
        r = r.with_columns(pl.lit(False).alias("projected"))
    df = r.join(i, on=["season", "week", "gsis_id"], how="left")
    if games is not None:
        tg = team_games(games, season).select("team", "week", "game_final")
        df = df.join(tg, on=["team", "week"], how="left")
    else:
        df = df.with_columns(pl.lit(None, dtype=pl.Boolean).alias("game_final"))
    df = df.with_columns(pl.col("game_final").fill_null(False))

    roster_reason = pl.col("roster_status").replace_strict(INACTIVE_ROSTER, default=None)
    # Once the game is final the report no longer decides anything.
    report_reason = (
        pl.when(pl.col("game_final"))
        .then(pl.lit(None, dtype=pl.String))
        .otherwise(pl.col("report_status").replace_strict(REPORT_INACTIVE, default=None))
    )
    on_active = pl.col("roster_status").is_in(list(ACTIVE_ROSTER))

    out = df.with_columns(
        pl.when(roster_reason.is_not_null())
        .then(pl.lit("inactive"))
        .when(on_active & report_reason.is_not_null())
        .then(pl.lit("inactive"))
        .when(on_active & ~pl.col("game_final") & (pl.col("report_status") == "Questionable"))
        .then(pl.lit("questionable"))
        .when(on_active)
        .then(pl.lit("active"))
        .otherwise(pl.lit("unknown"))
        .alias("gameday_flag"),
        pl.coalesce(roster_reason, report_reason).alias("inactive_reason"),
    )
    return out.with_columns(
        pl.when(pl.col("gameday_flag") != "inactive")
        .then(pl.lit(None, dtype=pl.String))
        .when(pl.col("roster_status").is_in(list(SEASON_LONG_ROSTER)))
        .then(pl.lit("season"))
        .otherwise(pl.lit("week"))
        .alias("absence")
    ).sort(["week", "team", "player_name"])


def load_player_week_status(season: int, through_week: int | None = None) -> pl.DataFrame:
    return player_week_status(
        sources.read("rosters_weekly", season),
        sources.read("injuries", season),
        season,
        games=sources.read("games"),
        through_week=through_week,
    )


def latest_week(status: pl.DataFrame) -> int:
    return int(status["week"].max())
