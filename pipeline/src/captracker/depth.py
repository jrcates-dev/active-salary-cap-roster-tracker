"""Starters from the nflverse depth charts (ESPN's, one snapshot a day).

The file carries every team's chart as of each day of the season: one row per player
per slot (`pos_slot`) in three formations (an offense, a base defense and special
teams), ranked within the position (`pos_rank`, 1 = first team).

Starter rules:
  - a player is a starter when he is the top-ranked name in a slot. Ranks run across
    every slot of a position, so the three WR slots hold WR1, WR2 and WR3 at the top.
  - every offensive and defensive slot counts (the 11 on offense, the base defense
    plus the nickel back), and the kicker, punter and long snapper. A fullback, holder
    and the return men do not: the offense listed is three-receiver, with no fullback
    on the field, and the others are roles on top of a position.
  - `depth_role` names the player's most important spot on the chart: "LT1", "QB2",
    "WR4", "KR1". Starting slots come first, then offense and defense, then the lowest
    rank.

Which day's chart: an available player gets his team's chart as of this week's game
(the latest one when the game is still ahead). A player who is out gets the chart from
before he went out, so a starter on injured reserve still reads as a starter: the
chart on the day of the last game he was available for. A player out since before
week 1 counts as a starter if he held a starting slot at any point in training camp
(from `CAMP_DAYS` before the opener): teams move a player who will start the year on
a reserve list down the chart at the August cutdown. ESPN moves injured players down
the chart, which would otherwise hide exactly the players this site is about.
"""

from __future__ import annotations

import logging
from datetime import timedelta

import polars as pl

from . import sources
from .teams import LEGACY_ABBR

log = logging.getLogger(__name__)

# Slots on the chart that are not a starting job.
NON_STARTER_SLOTS = {"FB", "H", "KR", "PR"}
# Roles on top of a player's position: listed after his position slots.
EXTRA_ROLES = {"H", "KR", "PR"}
# Training camp opens about this long before the first regular-season game.
CAMP_DAYS = 60


def chart_entries(depth: pl.DataFrame) -> pl.DataFrame:
    """One row per team, chart date, player and slot, with a starter flag."""
    df = (
        depth.filter(pl.col("gsis_id").is_not_null() & (pl.col("gsis_id") != ""))
        .with_columns(
            pl.col("team").replace(LEGACY_ABBR),
            pl.col("dt").str.slice(0, 10).str.to_date().alias("chart_date"),
        )
        # Several snapshots in one day: keep the latest.
        .with_columns(pl.col("dt").max().over("team", "chart_date").alias("_last"))
        .filter(pl.col("dt") == pl.col("_last"))
        .drop("_last")
    )
    top = pl.col("pos_rank") == pl.col("pos_rank").min().over(
        "team", "chart_date", "pos_grp", "pos_slot"
    )
    return df.select(
        "team",
        "chart_date",
        "gsis_id",
        "pos_abb",
        "pos_rank",
        (top & ~pl.col("pos_abb").is_in(list(NON_STARTER_SLOTS))).alias("starter_slot"),
        pl.col("pos_abb").is_in(list(EXTRA_ROLES)).alias("extra_role"),
    )


def player_roles(entries: pl.DataFrame) -> pl.DataFrame:
    """Per team, chart date and player: starter?, and his main spot ("QB2")."""
    return (
        entries.sort(
            ["starter_slot", "extra_role", "pos_rank"],
            descending=[True, False, False],
        )
        .group_by("team", "chart_date", "gsis_id", maintain_order=True)
        .agg(
            pl.col("starter_slot").any().alias("starter"),
            (pl.col("pos_abb").first() + pl.col("pos_rank").first().cast(pl.String)).alias(
                "depth_role"
            ),
        )
    )


def _cutoffs(status: pl.DataFrame, games: pl.DataFrame, season: int, week: int) -> pl.DataFrame:
    """Per team and player this week: the last chart date to use (`cutoff`, null for
    the latest), and for a player out all season the first one (`since`).

    Available players: the team's gameday this week. Players out: the gameday of the
    last week they were available, or training camp up to the day before the opener.
    """
    from .rosters import team_games

    tg = team_games(games, season).select(
        "team", "week", pl.col("gameday").cast(pl.String).str.to_date().alias("gameday")
    )
    # Bye weeks have no team gameday; the week's last game stands in.
    week_end = tg.group_by("week").agg(pl.col("gameday").max().alias("week_end"))
    opener = tg["gameday"].min()
    season_start = opener - timedelta(days=1) if opener is not None else None
    camp = opener - timedelta(days=CAMP_DAYS) if opener is not None else None
    hist = (
        status.filter(pl.col("week") <= week)
        .join(tg, on=["team", "week"], how="left")
        .join(week_end, on="week", how="left")
        .with_columns(pl.coalesce("gameday", "week_end").alias("day"))
    )
    now = hist.filter(pl.col("week") == week).select(
        "team", "gsis_id", "gameday_flag", pl.col("gameday").alias("this_game")
    )
    last_ok = (
        hist.filter(pl.col("gameday_flag").is_in(["active", "questionable"]))
        .group_by("team", "gsis_id")
        .agg(pl.col("day").sort_by("week").last().alias("last_ok"))
    )
    start = pl.lit(season_start, dtype=pl.Date)
    return (
        now.join(last_ok, on=["team", "gsis_id"], how="left")
        .with_columns(
            pl.when(pl.col("gameday_flag") == "inactive")
            .then(pl.coalesce("last_ok", start))
            .otherwise(pl.col("this_game"))
            .alias("cutoff"),
            pl.when((pl.col("gameday_flag") == "inactive") & pl.col("last_ok").is_null())
            .then(pl.lit(camp, dtype=pl.Date))
            .otherwise(None)
            .alias("since"),
        )
        .select("team", "gsis_id", "cutoff", "since")
        .unique(subset=["team", "gsis_id"], keep="last")
    )


def week_roles(
    depth: pl.DataFrame,
    status: pl.DataFrame,
    games: pl.DataFrame,
    season: int,
    week: int,
) -> pl.DataFrame:
    """team, gsis_id, starter, depth_role for every player on a roster in `week`.

    `status` is `rosters.player_week_status` for the season (every week up to `week`).
    Players the chart does not list get no row.
    """
    roles = player_roles(chart_entries(depth))
    if roles.is_empty():
        return pl.DataFrame(
            schema={
                "team": pl.String,
                "gsis_id": pl.String,
                "starter": pl.Boolean,
                "depth_role": pl.String,
            }
        )
    cut = _cutoffs(status, games, season, week)
    joined = cut.join(roles, on=["team", "gsis_id"], how="inner").filter(
        pl.col("cutoff").is_null() | (pl.col("chart_date") <= pl.col("cutoff"))
    )
    # Out all season: prefer a camp chart, and on those one where he started.
    camp = pl.col("since").is_not_null()
    joined = joined.with_columns(
        pl.when(camp).then(pl.col("chart_date") >= pl.col("since")).otherwise(True).alias("_in"),
        pl.when(camp).then(pl.col("starter")).otherwise(False).alias("_start"),
    )
    # Out since before the first chart on file: use his earliest one.
    earliest = (
        cut.join(roles, on=["team", "gsis_id"], how="inner")
        .join(joined.select("team", "gsis_id").unique(), on=["team", "gsis_id"], how="anti")
        .sort("chart_date")
        .unique(subset=["team", "gsis_id"], keep="first")
        .with_columns(pl.lit(True).alias("_in"), pl.lit(False).alias("_start"))
    )
    return (
        pl.concat([joined, earliest])
        .sort("_in", "_start", "chart_date")
        .unique(subset=["team", "gsis_id"], keep="last")
        .select("team", "gsis_id", "starter", "depth_role")
    )


def load_chart(season: int) -> pl.DataFrame | None:
    """The season's depth chart file, or None when it cannot be read."""
    try:
        return sources.read("depth_charts", season)
    except Exception:  # noqa: BLE001 - a missing chart must not stop the daily build
        log.warning("no depth chart for %s; starters left blank", season)
        return None


def roles_for(
    chart: pl.DataFrame | None,
    status: pl.DataFrame,
    games: pl.DataFrame,
    season: int,
    week: int,
) -> pl.DataFrame | None:
    """`week_roles`, or None when there is no chart."""
    return None if chart is None else week_roles(chart, status, games, season, week)
