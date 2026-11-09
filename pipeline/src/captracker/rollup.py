"""Roll cap dollars up from players to position groups, units and teams."""

from __future__ import annotations

import polars as pl

from .positions import GROUP_BY_CODE, POSITION_GROUPS, assign_group, unit_for

FLAGS = ("active", "inactive", "questionable", "unknown")


def assign_groups(contract_years: pl.DataFrame, crosswalk: pl.DataFrame) -> pl.DataFrame:
    """Attach a position group and unit to every contract year row."""
    cw = crosswalk.select(
        "gsis_id",
        "players_position",
        "name",
        "espn_id",
        "headshot",
        "players_status",
        "latest_team",
    ).unique(subset=["gsis_id"], keep="first")
    df = contract_years.join(cw, on="gsis_id", how="left")
    groups = [
        assign_group(g, cp, pp)
        for g, cp, pp in zip(
            df["gsis_id"].to_list(),
            df["contract_position"].to_list(),
            df["players_position"].to_list(),
            strict=True,
        )
    ]
    return df.with_columns(
        pl.Series("position_group", groups, dtype=pl.String),
    ).with_columns(
        pl.col("position_group").map_elements(unit_for, return_dtype=pl.String).alias("unit"),
    )


# Roster statuses whose salary counts against the cap (suspended players are unpaid).
CAP_COUNTING_STATUS = ("ACT", "INA", "RES", "PUP", "NFI", "DEV")

# A practice squad player's cap charge is his practice squad pay, not the NFL
# contract he may also hold (a drafted rookie stashed on the practice squad, for
# example). 2026 practice squad minimum: $13,750 a week for 18 weeks.
PRACTICE_SQUAD_CAP = 247_500


def team_status_weeks(status: pl.DataFrame, week: int) -> pl.DataFrame:
    """For each team, the latest roster week at or before `week`.

    A team on its bye has no roster rows that week, so its status comes from the
    week before.
    """
    return (
        status.filter(pl.col("week") <= week)
        .group_by("team")
        .agg(pl.col("week").max().alias("status_week"))
    )


def player_week_cap(
    grouped_contracts: pl.DataFrame,
    status: pl.DataFrame,
    week: int,
) -> pl.DataFrame:
    """The fact table for one week: each cap row tagged with that week's status.

    A row counts against its team's cap (`counts_against_cap`) when the player is on
    that team's roster in a cap-counting status, or when he is on no weekly roster at
    all but the players file still lists him with the team (reserve/left squad, a
    holdout; his flag is `unknown`). Rows for players who were released or retired, or who are on
    another team's roster, stay in the table for transparency but are left out of
    every total; that money is the team's dead money or another team's cap.
    Practice squad players count at practice squad pay.
    """
    if "absence" not in status.columns:
        status = status.with_columns(pl.lit(None, dtype=pl.String).alias("absence"))
    weeks = team_status_weeks(status, week)
    latest = (
        status.join(weeks, on="team")
        .filter(pl.col("week") == pl.col("status_week"))
        .select(
            "gsis_id",
            pl.col("team").alias("roster_team"),
            "status_week",
            "roster_status",
            "report_status",
            "practice_status",
            "injury",
            "gameday_flag",
            "inactive_reason",
            "absence",
        )
        .unique(subset=["gsis_id"], keep="last")
    )
    df = grouped_contracts.join(latest, on="gsis_id", how="left")
    on_own_roster = (pl.col("roster_team") == pl.col("team")) & pl.col("roster_status").is_in(
        list(CAP_COUNTING_STATUS)
    )
    # On no weekly roster: count it only if the players file still lists him with
    # this team and not as cut or retired (e.g. reserve/left squad).
    in_limbo = (
        pl.col("roster_team").is_null()
        & (pl.col("latest_team").fill_null(pl.col("team")) == pl.col("team"))
        & ~pl.col("players_status").fill_null("").is_in(["CUT", "RET"])
    )
    counts = on_own_roster | in_limbo
    return df.with_columns(
        pl.lit(week).cast(pl.Int32).alias("week"),
        counts.fill_null(False).alias("counts_against_cap"),
        pl.col("cap_number").alias("contract_cap_number"),
        pl.when(pl.col("roster_status") == "DEV")
        .then(pl.min_horizontal("cap_number", pl.lit(PRACTICE_SQUAD_CAP)))
        .otherwise(pl.col("cap_number"))
        .alias("cap_number"),
        pl.when(counts.fill_null(False))
        .then(pl.col("gameday_flag").fill_null("unknown"))
        .otherwise(pl.lit("off_roster"))
        .alias("gameday_flag"),
        pl.when(counts.fill_null(False))
        .then(pl.col("absence"))
        .otherwise(pl.lit(None, dtype=pl.String))
        .alias("absence"),
    )


def _flag_sum(flag: str) -> pl.Expr:
    return (
        (pl.when(pl.col("gameday_flag") == flag).then(pl.col("cap_number")).otherwise(0))
        .sum()
        .alias(f"cap_{flag}")
    )


def _absence_sum(kind: str) -> pl.Expr:
    return (
        (
            pl.when((pl.col("gameday_flag") == "inactive") & (pl.col("absence") == kind))
            .then(pl.col("cap_number"))
            .otherwise(0)
        )
        .sum()
        .alias(f"cap_inactive_{kind}")
    )


ABSENCE_COLUMNS = ["cap_inactive_week", "cap_inactive_season"]


def rollup(fact: pl.DataFrame) -> pl.DataFrame:
    """Team x unit x position group totals, plus unit and team subtotals.

    `level` is one of team / unit / group so one table serves every view. At the team
    level `unit` and `position_group` are "all"; at the unit level `position_group` is
    "all" (never null, so the row key stays usable as a primary key).
    """
    fact = fact.filter(pl.col("counts_against_cap"))
    base_aggs = [
        pl.col("cap_number").sum().alias("cap_total"),
        pl.len().alias("players"),
        *[_flag_sum(f) for f in FLAGS],
        _absence_sum("week"),
        _absence_sum("season"),
    ]
    by_group = (
        fact.filter(pl.col("position_group").is_not_null())
        .group_by("season", "week", "team", "unit", "position_group")
        .agg(base_aggs)
        .with_columns(pl.lit("group").alias("level"))
    )
    by_unit = (
        fact.filter(pl.col("unit").is_not_null())
        .group_by("season", "week", "team", "unit")
        .agg(base_aggs)
        .with_columns(pl.lit("unit").alias("level"), pl.lit("all").alias("position_group"))
    )
    by_team = (
        fact.group_by("season", "week", "team")
        .agg(base_aggs)
        .with_columns(
            pl.lit("team").alias("level"),
            pl.lit("all").alias("unit"),
            pl.lit("all").alias("position_group"),
        )
    )
    cols = [
        "season",
        "week",
        "team",
        "level",
        "unit",
        "position_group",
        "cap_total",
        "players",
        *[f"cap_{f}" for f in FLAGS],
        *ABSENCE_COLUMNS,
    ]
    out = pl.concat([by_team.select(cols), by_unit.select(cols), by_group.select(cols)])
    order = {g.code: (g.unit, g.order) for g in POSITION_GROUPS}
    return out.with_columns(
        pl.col("position_group")
        .map_elements(lambda c: order.get(c, ("", 0))[1], return_dtype=pl.Int32)
        .alias("group_order")
    ).sort(["team", "level", "unit", "group_order"])


def position_groups_table() -> pl.DataFrame:
    return pl.DataFrame(
        {
            "code": [g.code for g in POSITION_GROUPS],
            "label": [g.label for g in POSITION_GROUPS],
            "unit": [g.unit for g in POSITION_GROUPS],
            "display_order": [g.order for g in POSITION_GROUPS],
        }
    )


__all__ = ["assign_groups", "player_week_cap", "rollup", "position_groups_table", "GROUP_BY_CODE"]
