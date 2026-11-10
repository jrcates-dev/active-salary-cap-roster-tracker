"""Weekly player status: roster status + injury report -> one row per player per week.

Gameday flag rules (from the accounting rules in PLAN.md):
  inactive     roster status RES / PUP / NFI / SUS / INA, or (before the game) report
               status Out / Doubtful, or (before the game) ruled Out for his team's last
               game with no game status yet on this week's report (`out_last_game`)
  questionable report status Questionable with an ACT roster status, before the game
  active       ACT roster status with no limiting designation, or any ACT player once
               the team's game is final (he dressed; INA marks the ones who did not)
  unknown      anything else (practice squad, cut, retired) - not counted toward a unit
Each inactive row carries a reason so the UI can say why, and an absence type:
  week         this game only: ruled Out, Doubtful, on the gameday inactive list, or
               still out from last game
  season       a reserve list (IR, PUP, NFI, suspension, other reserve): out for weeks,
               but able to come back this season
  year         a reserve list, and done for the season (see `season_outlook`)

Telling `season` from `year` is the hard part: no free feed says an injury ends a
season. Two roster codes do, and a hand-kept table covers the rest
(`data/season_outlook_<season>.csv`):
  - override row    the table says out for the season, or coming back   -> as listed
  - R48 / R49       designated for return, practice window open        -> season
  - window closed   back on IR or PUP after a return window without
                    being activated; league rules keep him out the year -> year
  - anything else   no signal; counted as able to come back             -> season
`outlook_basis` names which rule decided, and `outlook_note` carries the table's note.

The weekly roster file carries a week's rows from before kickoff (everyone ACT) and
adds the gameday inactives (INA) after the game. When the schedule has moved on to a
week the roster file does not have yet, `player_week_status(..., through_week=W)`
projects each team's latest roster forward to week W so that week's injury report
has something to attach to.

Between games a player ruled Out for his team's last game stays out (`out_last_game`)
rather than turning active while the new week's report is still to come. That ends when
the new report gives him a game status (Questionable, Doubtful, Out), when his team's
game-status report is out and he is not on it with one (cleared), or once the game is
played (the gameday inactive list decides).
"""

from __future__ import annotations

import polars as pl

from . import sources
from .config import PACKAGE_DATA
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
# Ruled Out for the team's last game, and the new week's report has no game status yet.
OUT_LAST_GAME = "out_last_game"

# Reserve lists: the player is out for weeks, not just this game.
SEASON_LONG_ROSTER = {"RES", "PUP", "NFI", "SUS", "RSN", "RSR"}

# Detail codes (`status_description_abbr`) for a reserve player whose 21-day return
# window is open: Reserve/Injured or Reserve/PUP, designated for return.
DESIGNATED_FOR_RETURN = {"R48", "R49"}
# Reserve/Injured, Reserve/PUP, Reserve/NFI. A player who goes back to one of these from
# a return window, without being activated, must stay there for the rest of the season.
RETURN_WINDOW_LISTS = {"R01", "R04", "R05"}

OUTLOOKS = {"out_for_season": "year", "returning": "season"}


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
    outlook: pl.DataFrame | None = None,
) -> pl.DataFrame:
    """Combine weekly rosters and the injury report for every week in the season.

    With `games`, a player on the active roster of a team whose game is final counts as
    active whatever his report said: the roster file's INA status is the official list
    of who sat. With `through_week`, rosters are projected forward to that week.
    `outlook` is the hand-kept out-for-season table (`load_season_outlook`).
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
        tg = team_games(games, season).select(
            "team", "week", "game_final", pl.lit(True).alias("_has_game")
        )
        df = df.join(tg, on=["team", "week"], how="left")
    else:
        # No schedule: treat every roster week as a game week.
        df = df.with_columns(
            pl.lit(None, dtype=pl.Boolean).alias("game_final"), pl.lit(True).alias("_has_game")
        )
    df = df.with_columns(
        pl.col("game_final").fill_null(False), pl.col("_has_game").fill_null(False)
    )
    df = _out_last_game(df)

    roster_reason = pl.col("roster_status").replace_strict(INACTIVE_ROSTER, default=None)
    # Once the game is final the report no longer decides anything.
    report_reason = (
        pl.when(pl.col("game_final"))
        .then(pl.lit(None, dtype=pl.String))
        .when(pl.col("_out_last_game"))
        .then(pl.lit(OUT_LAST_GAME))
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
    out = out.with_columns(
        pl.when(pl.col("gameday_flag") != "inactive")
        .then(pl.lit(None, dtype=pl.String))
        .when(pl.col("roster_status").is_in(list(SEASON_LONG_ROSTER)))
        .then(pl.lit("season"))
        .otherwise(pl.lit("week"))
        .alias("absence")
    ).drop("_has_game", "_out_last_game")
    return season_outlook(out, outlook).sort(["week", "team", "player_name"])


def _out_last_game(df: pl.DataFrame) -> pl.DataFrame:
    """Flag (`_out_last_game`) players still out from their team's last game.

    True on a row whose game is still to come when the player was ruled Out on the
    report for his team's most recent earlier game (a bye in between does not reset
    it) and this week's report has no game status for him yet. Once his team's
    game-status report is out (anyone on the team has a status), no status means he
    was cleared, and he is back to the roster's word.
    """
    by_player = {"partition_by": "gsis_id", "order_by": "week"}
    # Each game week's report status ("" when he was not on it); null on a bye.
    game_report = (
        pl.when(pl.col("_has_game")).then(pl.col("report_status").fill_null("")).otherwise(None)
    )
    last_game_report = game_report.shift(1).over(**by_player).forward_fill().over(**by_player)
    statuses_posted = pl.col("report_status").is_not_null().any().over("team", "week")
    return df.with_columns(
        (
            ~pl.col("game_final")
            & (last_game_report == "Out")
            & pl.col("report_status").is_null()
            & ~statuses_posted
        )
        .fill_null(False)
        .alias("_out_last_game")
    )


def _return_window_closed() -> pl.Expr:
    """True on a reserve row whose last different detail code was a return window.

    R48, R48, R01 means the window ran out (or the team shut him down) without an
    activation; R48, A01, R01 is a new injury after he came back, and stays open.
    """
    detail = pl.col("roster_status_detail")
    changed = detail.ne_missing(detail.shift(1).over("gsis_id", order_by="week"))
    # The code a player held before his current run of identical codes.
    prev_run = (
        pl.when(changed)
        .then(detail.shift(1).over("gsis_id", order_by="week"))
        .otherwise(None)
        .forward_fill()
        .over("gsis_id", order_by="week")
    )
    return detail.is_in(list(RETURN_WINDOW_LISTS)) & prev_run.is_in(list(DESIGNATED_FOR_RETURN))


def season_outlook(status: pl.DataFrame, outlook: pl.DataFrame | None = None) -> pl.DataFrame:
    """Split reserve-list absences into `season` (can come back) and `year` (done).

    `outlook` is the hand-kept table (gsis_id, outlook, from_week, note); a row applies
    from `from_week` on (every week when blank). See the module docstring for the rules.
    """
    detail = pl.col("roster_status_detail")
    df = status.with_columns(_return_window_closed().fill_null(False).alias("_closed"))
    if outlook is not None and outlook.height:
        o = outlook.select(
            "gsis_id",
            pl.col("outlook").alias("_outlook"),
            pl.col("from_week").cast(pl.Int32).fill_null(0).alias("_from"),
            pl.col("note").alias("_note"),
        )
        # Several rows for one player: the latest one in effect wins.
        df = (
            df.join(o, on="gsis_id", how="left")
            .with_columns((pl.col("week") >= pl.col("_from")).fill_null(False).alias("_eff"))
            .with_columns(
                pl.when(pl.col("_eff")).then(pl.col(c)).otherwise(None).alias(c)
                for c in ("_outlook", "_note", "_from")
            )
            .sort("_eff", "_from", nulls_last=False)
            .unique(subset=["season", "week", "gsis_id"], keep="last")
            .drop("_eff", "_from")
        )
    else:
        df = df.with_columns(
            pl.lit(None, dtype=pl.String).alias("_outlook"),
            pl.lit(None, dtype=pl.String).alias("_note"),
        )
    reserve = pl.col("absence").is_in(["season", "year"]).fill_null(False)
    override = pl.col("_outlook").replace_strict(OUTLOOKS, default=None, return_dtype=pl.String)
    return df.with_columns(
        pl.when(~reserve)
        .then(pl.col("absence"))
        .when(override.is_not_null())
        .then(override)
        .when(detail.is_in(list(DESIGNATED_FOR_RETURN)))
        .then(pl.lit("season"))
        .when(pl.col("_closed"))
        .then(pl.lit("year"))
        .otherwise(pl.lit("season"))
        .alias("absence"),
        pl.when(~reserve)
        .then(pl.lit(None, dtype=pl.String))
        .when(override.is_not_null())
        .then(pl.lit("table"))
        .when(detail.is_in(list(DESIGNATED_FOR_RETURN)))
        .then(pl.lit("designated_for_return"))
        .when(pl.col("_closed"))
        .then(pl.lit("return_window_closed"))
        .otherwise(pl.lit(None, dtype=pl.String))
        .alias("outlook_basis"),
        pl.when(reserve & override.is_not_null())
        .then(pl.col("_note"))
        .otherwise(pl.lit(None, dtype=pl.String))
        .alias("outlook_note"),
    ).drop("_closed", "_outlook", "_note")


def load_season_outlook(season: int) -> pl.DataFrame | None:
    """The hand-kept out-for-season / coming-back table, or None when there is none."""
    path = PACKAGE_DATA / f"season_outlook_{season}.csv"
    if not path.exists():
        return None
    df = pl.read_csv(
        path,
        comment_prefix="#",
        schema_overrides={"gsis_id": pl.String, "from_week": pl.Int32, "note": pl.String},
    )
    bad = set(df["outlook"].to_list()) - set(OUTLOOKS)
    if bad:
        raise ValueError(f"unknown outlook {sorted(bad)} in {path.name}")
    return df


def load_player_week_status(season: int, through_week: int | None = None) -> pl.DataFrame:
    return player_week_status(
        sources.read("rosters_weekly", season),
        sources.read("injuries", season),
        season,
        games=sources.read("games"),
        through_week=through_week,
        outlook=load_season_outlook(season),
    )


def latest_week(status: pl.DataFrame) -> int:
    return int(status["week"].max())
