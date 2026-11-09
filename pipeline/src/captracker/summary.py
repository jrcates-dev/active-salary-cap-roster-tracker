"""Team-level summary: our rolled-up numbers next to the published team figures."""

from __future__ import annotations

import polars as pl


def team_summary(
    rollup: pl.DataFrame,
    fact: pl.DataFrame,
    reference: pl.DataFrame | None,
    status_weeks: pl.DataFrame,
) -> pl.DataFrame:
    """One row per team with active/inactive money, estimates, and dead money.

    Dead money and cap space are not in the contracts file. They come from the
    hand-entered reference table (OverTheCap's public team page), and the adjusted
    cap is reconstructed as active cap + dead money + cap space from that table.
    """
    team = rollup.filter(pl.col("level") == "team").select(
        "season",
        "week",
        "team",
        "cap_total",
        "players",
        "cap_active",
        "cap_inactive",
        "cap_questionable",
        "cap_unknown",
    )
    counted = pl.col("counts_against_cap")
    is_est = pl.col("cap_source") == "estimate_minimum"
    is_rookie = pl.col("cap_source") == "derived_rookie_scale"
    est = fact.group_by("team").agg(
        (counted & is_est).sum().alias("players_estimated"),
        pl.when(counted & is_est)
        .then(pl.col("cap_number"))
        .otherwise(0)
        .sum()
        .alias("cap_estimated"),
        (counted & is_rookie).sum().alias("players_rookie_derived"),
        pl.when(counted & is_rookie)
        .then(pl.col("cap_number"))
        .otherwise(0)
        .sum()
        .alias("cap_rookie_derived"),
        pl.when(~counted).then(pl.col("cap_number")).otherwise(0).sum().alias("cap_off_roster"),
    )
    out = (
        team.join(est, on="team", how="left")
        .join(status_weeks, on="team", how="left")
        .with_columns((pl.col("status_week") < pl.col("week")).alias("on_bye"))
    )
    if reference is None:
        return out.with_columns(
            pl.lit(None, dtype=pl.Int64).alias(c)
            for c in ("dead_money", "cap_space", "adjusted_cap", "ref_active_cap")
        ).with_columns(pl.lit(None, dtype=pl.String).alias("reference_as_of"))
    ref = reference.select(
        "team",
        pl.col("dead_money").cast(pl.Int64),
        pl.col("cap_space").cast(pl.Int64),
        pl.col("active_cap_spending").cast(pl.Int64).alias("ref_active_cap"),
        pl.col("as_of").cast(pl.String).alias("reference_as_of"),
    ).with_columns(
        (pl.col("ref_active_cap") + pl.col("dead_money") + pl.col("cap_space")).alias(
            "adjusted_cap"
        )
    )
    return out.join(ref, on="team", how="left").sort("team")
