"""Contract years: one cap row per player per season, from the nflverse contracts file.

The nflverse `historical_contracts` release (sourced from OverTheCap) carries a nested
`season_history` list per contract with base salary, prorated bonus, cap number and
cap percent for every year of the deal. This module explodes that list for one season.
Dollar figures in the source are in millions; everything here is stored as whole dollars.
"""

from __future__ import annotations

import polars as pl

from . import sources, teams

MILLION = 1_000_000

SEASON_MONEY_COLUMNS = [
    "base_salary",
    "prorated_bonus",
    "option_bonus",
    "roster_bonus",
    "workout_bonus",
    "per_game_roster_bonus",
    "other_bonus",
    "guaranteed_salary",
    "cash_paid",
    "cap_number",
]


def _to_dollars(col: str) -> pl.Expr:
    return (pl.col(col).fill_null(0.0) * MILLION).round(0).cast(pl.Int64).alias(col)


def contract_years(
    contracts: pl.DataFrame,
    season: int,
    nick_to_abbr: dict[str, str],
    *,
    active_only: bool = True,
) -> pl.DataFrame:
    """Explode `season_history` to one row per (player, team, season).

    Rows with a null cap number are dropped: those are void years or future seasons the
    source has not priced yet. The handful of contracts the source lists twice are
    collapsed to one row.
    """
    df = contracts
    if active_only:
        df = df.filter(pl.col("is_active"))

    exploded = (
        df.select(
            pl.col("player").alias("player_name"),
            pl.col("position").alias("contract_position"),
            pl.col("team").alias("contract_team_label"),
            "is_active",
            "gsis_id",
            "otc_id",
            "player_page",
            "year_signed",
            pl.col("years").alias("contract_years"),
            (pl.col("value") * MILLION).round(0).cast(pl.Int64).alias("contract_value"),
            (pl.col("apy") * MILLION).round(0).cast(pl.Int64).alias("contract_apy"),
            (pl.col("guaranteed") * MILLION).round(0).cast(pl.Int64).alias("contract_guaranteed"),
            "apy_cap_pct",
            "season_history",
        )
        .explode("season_history")
        .unnest("season_history")
        .rename({"team": "season_team_label", "year": "season_str"})
        .filter(pl.col("season_str") == str(season))
        .filter(pl.col("cap_number").is_not_null())
        .with_columns(
            pl.lit(season).cast(pl.Int32).alias("season"),
            pl.col("season_team_label").replace_strict(nick_to_abbr, default=None).alias("team"),
            pl.col("cap_percent").alias("cap_pct"),
            *[_to_dollars(c) for c in SEASON_MONEY_COLUMNS],
        )
        .unique(subset=["otc_id", "season", "team"], keep="first", maintain_order=True)
    )

    unmapped = exploded.filter(pl.col("team").is_null())["season_team_label"].unique().to_list()
    if unmapped:
        raise ValueError(f"season_history team labels with no abbreviation: {unmapped}")

    return exploded.select(
        "season",
        "team",
        "gsis_id",
        "otc_id",
        "player_name",
        "contract_position",
        "contract_team_label",
        "player_page",
        "year_signed",
        "contract_years",
        "contract_value",
        "contract_apy",
        "contract_guaranteed",
        "apy_cap_pct",
        *SEASON_MONEY_COLUMNS,
        "cap_pct",
        pl.lit("contract").alias("cap_source"),
    ).sort(["team", "cap_number"], descending=[False, True])


# Year-one cap hit for rookie-scale contracts, calibrated on the 2024 and 2025 draft
# classes in the same file (whose season_history is filled in):
#   rounds 1-3: year-one cap is 8/11 of APY for every pick (exact in both classes)
#   rounds 4-7 and undrafted: APY minus about $210K (minimum-salary escalators push
#   later years up), never below the rookie minimum
ROOKIE_RATIO_EARLY_ROUNDS = 8 / 11
ROOKIE_LATE_ROUND_OFFSET = 210_000
ROOKIE_MINIMUM_2026 = 885_000


def derive_first_year(
    contracts: pl.DataFrame,
    season: int,
    nick_to_abbr: dict[str, str],
    have_otc_ids: set[int],
) -> pl.DataFrame:
    """Cap rows for active contracts signed this season that carry no season_history.

    The nflverse file ships the current draft class (and a few other new deals) with
    an empty season_history, so without this the whole 2026 rookie class would be
    missing or valued at the minimum. Rows are flagged `cap_source =
    "derived_rookie_scale"`.
    """
    abbrs = set(nick_to_abbr.values())
    # A player promoted from the practice squad can carry two active deals signed this
    # season (the practice deal and the standard one). Keep the richest, so he counts once.
    new = (
        contracts.filter(
            pl.col("is_active")
            & (pl.col("year_signed") == season)
            & ~pl.col("otc_id").is_in(list(have_otc_ids))
        )
        .sort("apy", descending=True, nulls_last=True)
        .unique("otc_id", keep="first", maintain_order=True)
    )
    if new.is_empty():
        return pl.DataFrame()

    def team_of(label: str | None) -> str | None:
        if label is None:
            return None
        if label in nick_to_abbr:
            return nick_to_abbr[label]
        first = label.split("/")[0]
        return first if first in abbrs else None

    apy = (pl.col("apy") * MILLION).round(0)
    cap = (
        pl.when(pl.col("draft_round").is_between(1, 3))
        .then(apy * ROOKIE_RATIO_EARLY_ROUNDS)
        .otherwise(pl.max_horizontal(apy - ROOKIE_LATE_ROUND_OFFSET, pl.lit(ROOKIE_MINIMUM_2026)))
        .round(0)
        .cast(pl.Int64)
    )
    return new.select(
        pl.lit(season).cast(pl.Int32).alias("season"),
        pl.col("team").map_elements(team_of, return_dtype=pl.String).alias("team"),
        "gsis_id",
        "otc_id",
        pl.col("player").alias("player_name"),
        pl.col("position").alias("contract_position"),
        pl.col("team").alias("contract_team_label"),
        "player_page",
        "year_signed",
        pl.col("years").alias("contract_years"),
        (pl.col("value") * MILLION).round(0).cast(pl.Int64).alias("contract_value"),
        apy.cast(pl.Int64).alias("contract_apy"),
        (pl.col("guaranteed") * MILLION).round(0).cast(pl.Int64).alias("contract_guaranteed"),
        "apy_cap_pct",
        pl.lit(ROOKIE_MINIMUM_2026, dtype=pl.Int64).alias("base_salary"),
        (cap - ROOKIE_MINIMUM_2026).clip(lower_bound=0).alias("prorated_bonus"),
        *[
            pl.lit(0, dtype=pl.Int64).alias(c)
            for c in (
                "option_bonus",
                "roster_bonus",
                "workout_bonus",
                "per_game_roster_bonus",
                "other_bonus",
                "guaranteed_salary",
                "cash_paid",
            )
        ],
        cap.alias("cap_number"),
        pl.lit(None, dtype=pl.Float64).alias("cap_pct"),
        pl.lit("derived_rookie_scale").alias("cap_source"),
    ).filter(pl.col("team").is_not_null())


def with_player_key(df: pl.DataFrame) -> pl.DataFrame:
    """A stable per-player key: gsis_id when known, else the OTC id."""
    return df.with_columns(
        pl.coalesce(
            pl.col("gsis_id"),
            pl.concat_str(pl.lit("otc-"), pl.col("otc_id").cast(pl.String)),
        ).alias("player_key")
    )


def load_contract_years(season: int) -> pl.DataFrame:
    contracts = sources.read("contracts")
    nick = teams.nick_to_abbr(teams.load_teams())
    cy = contract_years(contracts, season, nick)
    derived = derive_first_year(contracts, season, nick, set(cy["otc_id"].to_list()))
    if derived.is_empty():
        return cy
    return pl.concat([cy, derived.select(cy.columns).cast(cy.schema)])


def describe_cap_fields(contracts: pl.DataFrame, season: int) -> dict:
    """The day-one check: what does the contracts file actually carry per season?"""
    nested = contracts.schema["season_history"]
    inner_fields = [f.name for f in nested.inner.fields]  # type: ignore[attr-defined]
    active = contracts.filter(pl.col("is_active"))
    exploded = (
        active.select("otc_id", "season_history").explode("season_history").unnest("season_history")
    )
    this_season = exploded.filter(pl.col("year") == str(season))
    return {
        "rows": contracts.height,
        "active_contracts": active.height,
        "season_history_fields": inner_fields,
        "has_per_year_cap_number": "cap_number" in inner_fields,
        "season_rows": this_season.height,
        "season_rows_with_cap_number": this_season.filter(
            pl.col("cap_number").is_not_null()
        ).height,
        "seasons_present": sorted(
            y for y in exploded["year"].unique().to_list() if y and y.isdigit()
        ),
        "active_without_gsis_id": active.filter(pl.col("gsis_id").is_null()).height,
    }
