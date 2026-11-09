"""Weekly player status: roster status + injury report -> one row per player per week.

Gameday flag rules (from the accounting rules in PLAN.md):
  inactive     roster status RES / PUP / NFI / SUS / INA, or report status Out / Doubtful
  questionable report status Questionable with an ACT roster status
  active       ACT roster status with no limiting designation
  unknown      anything else (practice squad, cut, retired) - not counted toward a unit
Each inactive row carries a reason so the UI can say why.
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


def _normalize_team(col: str) -> pl.Expr:
    return pl.col(col).replace(LEGACY_ABBR).alias(col)


def player_week_status(
    rosters: pl.DataFrame,
    injuries: pl.DataFrame,
    season: int,
) -> pl.DataFrame:
    """Combine weekly rosters and the injury report for every week in the season."""
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
    df = r.join(i, on=["season", "week", "gsis_id"], how="left")

    roster_reason = pl.col("roster_status").replace_strict(INACTIVE_ROSTER, default=None)
    report_reason = pl.col("report_status").replace_strict(REPORT_INACTIVE, default=None)

    return df.with_columns(
        pl.when(roster_reason.is_not_null())
        .then(pl.lit("inactive"))
        .when(pl.col("roster_status").is_in(list(ACTIVE_ROSTER)) & report_reason.is_not_null())
        .then(pl.lit("inactive"))
        .when(
            pl.col("roster_status").is_in(list(ACTIVE_ROSTER))
            & (pl.col("report_status") == "Questionable")
        )
        .then(pl.lit("questionable"))
        .when(pl.col("roster_status").is_in(list(ACTIVE_ROSTER)))
        .then(pl.lit("active"))
        .otherwise(pl.lit("unknown"))
        .alias("gameday_flag"),
        pl.coalesce(roster_reason, report_reason).alias("inactive_reason"),
    ).sort(["week", "team", "player_name"])


def load_player_week_status(season: int) -> pl.DataFrame:
    return player_week_status(
        sources.read("rosters_weekly", season), sources.read("injuries", season), season
    )


def latest_week(status: pl.DataFrame) -> int:
    return int(status["week"].max())
