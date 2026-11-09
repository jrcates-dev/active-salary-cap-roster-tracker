"""Estimated cap rows for rostered players the contracts file does not carry.

The nflverse contracts file covers stars, starters and most depth, but misses most
undrafted rookies and some veterans on minimum deals: 10 to 20 players per team,
mostly on the practice squad or the bottom of the 53. Their money is small per player
but adds up to 2-10% of a team's cap, which is why team totals fell short of
OverTheCap's published figures in Phase 0.

For each player on the latest weekly roster with a cap-counting status and no
contract row, this module adds one row at the league minimum for his experience
(or the practice squad rate), prorated from the first week he appeared on that
team's roster. Every such row is flagged `cap_source = "estimate_minimum"` so the UI
can label it.
"""

from __future__ import annotations

import polars as pl

from .teams import LEGACY_ABBR

REGULAR_SEASON_WEEKS = 18

# 2026 minimum base salaries by credited seasons (CBA Article 26). nflverse
# `years_exp` counts credited seasons, so a 2026 rookie is 0.
MINIMUM_SALARY_2026 = {
    0: 885_000,
    1: 1_005_000,
    2: 1_075_000,
    3: 1_145_000,
    4: 1_215_000,
    5: 1_215_000,
    6: 1_215_000,
}
MINIMUM_SALARY_2026_VETERAN = 1_300_000  # 7+ credited seasons

# Practice squad weekly minimum x 18 weeks; the most common practice squad cap
# number in the contracts file is exactly this.
PRACTICE_SQUAD_2026 = 247_500

# Roster statuses whose salary counts against the cap. Suspended players are not
# paid and do not count; cut, retired and exempt players are off the books.
CAP_COUNTING = {"ACT", "INA", "RES", "PUP", "NFI", "DEV"}


def minimum_for(years_exp: int | None, roster_status: str) -> int:
    if roster_status == "DEV":
        return PRACTICE_SQUAD_2026
    yrs = years_exp or 0
    return MINIMUM_SALARY_2026.get(yrs, MINIMUM_SALARY_2026_VETERAN)


def estimate_missing(
    contract_years: pl.DataFrame,
    rosters: pl.DataFrame,
    season: int,
    week: int,
) -> pl.DataFrame:
    """Rows shaped like `contract_years` for rostered players with no contract."""
    reg = rosters.filter(
        (pl.col("season") == season) & (pl.col("game_type") == "REG")
    ).with_columns(pl.col("team").replace(LEGACY_ABBR))
    team_week = (
        reg.filter(pl.col("week") <= week).group_by("team").agg(pl.col("week").max().alias("_w"))
    )
    current = (
        reg.join(team_week, on="team")
        .filter((pl.col("week") == pl.col("_w")) & pl.col("status").is_in(list(CAP_COUNTING)))
        .filter(pl.col("gsis_id").is_not_null())
        .unique(subset=["gsis_id"], keep="last")
    )
    have = contract_years.select("gsis_id").drop_nulls().unique()
    missing = current.join(have, on="gsis_id", how="anti")

    first_week = reg.group_by("gsis_id", "team").agg(pl.col("week").min().alias("first_week"))
    missing = missing.join(first_week, on=["gsis_id", "team"], how="left")

    if missing.is_empty():
        return contract_years.clear()

    full = [
        minimum_for(y, s)
        for y, s in zip(missing["years_exp"].to_list(), missing["status"].to_list(), strict=True)
    ]
    missing = missing.with_columns(pl.Series("_full", full, dtype=pl.Int64)).with_columns(
        (
            pl.col("_full")
            * (REGULAR_SEASON_WEEKS - pl.col("first_week").fill_null(1) + 1)
            / REGULAR_SEASON_WEEKS
        )
        .round(0)
        .cast(pl.Int64)
        .alias("cap_number")
    )

    rows = missing.select(
        pl.lit(season).cast(pl.Int32).alias("season"),
        "team",
        "gsis_id",
        pl.lit(None, dtype=pl.Int32).alias("otc_id"),
        pl.col("full_name").alias("player_name"),
        pl.coalesce("depth_chart_position", "position").alias("contract_position"),
        pl.lit(None, dtype=pl.String).alias("contract_team_label"),
        pl.lit(None, dtype=pl.String).alias("player_page"),
        pl.lit(None, dtype=pl.Int32).alias("year_signed"),
        pl.lit(None, dtype=pl.Int32).alias("contract_years"),
        pl.lit(None, dtype=pl.Int64).alias("contract_value"),
        pl.lit(None, dtype=pl.Int64).alias("contract_apy"),
        pl.lit(None, dtype=pl.Int64).alias("contract_guaranteed"),
        pl.lit(None, dtype=pl.Float64).alias("apy_cap_pct"),
        pl.col("cap_number").alias("base_salary"),
        *[
            pl.lit(0, dtype=pl.Int64).alias(c)
            for c in (
                "prorated_bonus",
                "option_bonus",
                "roster_bonus",
                "workout_bonus",
                "per_game_roster_bonus",
                "other_bonus",
                "guaranteed_salary",
            )
        ],
        pl.col("cap_number").alias("cash_paid"),
        "cap_number",
        pl.lit(None, dtype=pl.Float64).alias("cap_pct"),
        pl.lit("estimate_minimum").alias("cap_source"),
    )
    return rows.select(contract_years.columns).cast(contract_years.schema)
