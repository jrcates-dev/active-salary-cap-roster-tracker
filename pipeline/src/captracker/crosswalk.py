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


def _name_key(col: str) -> pl.Expr:
    """Lowercase, letters only, suffixes dropped: 'Willie Gay, Jr.' -> 'williegay'."""
    return (
        pl.col(col)
        .str.to_lowercase()
        .str.replace_all(r"\b(jr|sr|ii|iii|iv|v)\b\.?", "")
        .str.replace_all(r"[^a-z]", "")
        .alias("_name_key")
    )


def fill_gsis_by_name(contract_years: pl.DataFrame, rosters: pl.DataFrame) -> pl.DataFrame:
    """Give contract rows that lack a gsis_id one from the weekly roster, by team + name.

    A handful of contracts (mostly International Pathway players) ship without a
    gsis_id. Without this they would never match a roster status, and the
    minimum-salary estimate would count the same player a second time.
    """
    missing = contract_years.filter(pl.col("gsis_id").is_null())
    if missing.is_empty():
        return contract_years
    roster_names = (
        rosters.filter(pl.col("gsis_id").is_not_null())
        .select("team", "gsis_id", _name_key("full_name"))
        .unique(subset=["team", "_name_key"], keep="last")
    )
    matched = (
        missing.with_columns(_name_key("player_name"))
        .join(roster_names, on=["team", "_name_key"], how="left", suffix="_roster")
        .select("otc_id", "team", pl.col("gsis_id_roster").alias("_gsis_fill"))
    )
    return (
        contract_years.join(matched, on=["otc_id", "team"], how="left")
        .with_columns(pl.coalesce("gsis_id", "_gsis_fill").alias("gsis_id"))
        .drop("_gsis_fill")
    )
