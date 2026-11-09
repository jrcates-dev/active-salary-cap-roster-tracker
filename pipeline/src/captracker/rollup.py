"""Roll cap dollars up from players to position groups, units and teams."""

from __future__ import annotations

import polars as pl

from .positions import GROUP_BY_CODE, POSITION_GROUPS, assign_group, unit_for

FLAGS = ("active", "inactive", "questionable", "unknown")


def assign_groups(contract_years: pl.DataFrame, crosswalk: pl.DataFrame) -> pl.DataFrame:
    """Attach a position group and unit to every contract year row."""
    cw = crosswalk.select("gsis_id", "players_position", "name", "espn_id", "headshot")
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


def player_week_cap(
    grouped_contracts: pl.DataFrame,
    status: pl.DataFrame,
    week: int,
) -> pl.DataFrame:
    """The fact table for one week: each contract row tagged with that week's status.

    Cap dollars stay with the team that carries the contract. A player with a contract
    but no roster row that week (cut, retired, practice squad on a different file) is
    flagged `unknown`; the money still counts toward the team's total, just not toward
    active or inactive.
    """
    wk = status.filter(pl.col("week") == week).select(
        "gsis_id",
        pl.col("team").alias("roster_team"),
        "roster_status",
        "report_status",
        "practice_status",
        "injury",
        "gameday_flag",
        "inactive_reason",
    )
    df = grouped_contracts.join(wk, on="gsis_id", how="left")
    return df.with_columns(
        pl.lit(week).cast(pl.Int32).alias("week"),
        pl.col("gameday_flag").fill_null("unknown"),
    )


def _flag_sum(flag: str) -> pl.Expr:
    return (
        (pl.when(pl.col("gameday_flag") == flag).then(pl.col("cap_number")).otherwise(0))
        .sum()
        .alias(f"cap_{flag}")
    )


def rollup(fact: pl.DataFrame) -> pl.DataFrame:
    """Team x unit x position group totals, plus unit and team subtotals.

    `level` is one of team / unit / group so one table serves every view. At the team
    level `unit` and `position_group` are "all"; at the unit level `position_group` is
    "all" (never null, so the row key stays usable as a primary key).
    """
    base_aggs = [
        pl.col("cap_number").sum().alias("cap_total"),
        pl.len().alias("players"),
        *[_flag_sum(f) for f in FLAGS],
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
