"""Player id crosswalk: one row per player with every id the feeds use."""

from __future__ import annotations

import polars as pl

from . import sources

ID_COLUMNS = ["gsis_id", "otc_id", "espn_id", "pfr_id", "pff_id", "esb_id", "smart_id", "nfl_id"]


def build_crosswalk(players: pl.DataFrame, contract_years: pl.DataFrame) -> pl.DataFrame:
    """Players file is the spine; contracts add OTC ids the players file lacks."""
    base = players.select(
        *ID_COLUMNS,
        pl.col("display_name").alias("name"),
        pl.col("position").alias("players_position"),
        pl.col("position_group").alias("players_position_group"),
        pl.col("latest_team").alias("latest_team"),
        pl.col("status").alias("players_status"),
        "headshot",
        "birth_date",
        "rookie_season",
        "draft_year",
        "draft_round",
        "draft_pick",
    )
    from_contracts = (
        contract_years.filter(pl.col("gsis_id").is_not_null())
        .select("gsis_id", pl.col("otc_id").alias("otc_id_contract"))
        .unique(subset=["gsis_id"])
    )
    out = base.join(from_contracts, on="gsis_id", how="left").with_columns(
        pl.coalesce(pl.col("otc_id"), pl.col("otc_id_contract")).alias("otc_id")
    )
    return out.drop("otc_id_contract")


def load_crosswalk(contract_years: pl.DataFrame) -> pl.DataFrame:
    return build_crosswalk(sources.read("players"), contract_years)
