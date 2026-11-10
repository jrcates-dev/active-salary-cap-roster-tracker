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


# A trailing season whose cash is under this share of the average of the seasons
# before it is a placeholder (a token roster bonus the deal is built to never reach,
# like Stafford's $5M 2028), not a year he will be paid for. It is listed but not
# counted in the per-year average.
TOKEN_TAIL_SHARE = 0.2

OUTLOOK_SCHEMA = {
    "otc_id": pl.Int32,
    "team": pl.String,
    "per_year": pl.Int64,
    "deal_thru": pl.Int32,
    "gtd_thru": pl.Int32,
    "dead_if_cut": pl.Int64,
    "money_years": pl.List(
        pl.Struct(
            {
                "season": pl.Int32,
                "cap": pl.Int64,
                "cash": pl.Int64,
                "gtd": pl.Boolean,
                "kind": pl.String,
            }
        )
    ),
}


def _dollars(x: float | None) -> int:
    return round((x or 0.0) * MILLION)


def _outlook_row(history: list[dict], season: int) -> dict | None:
    """Forward money for one contract, from `season` to the end of the deal.

    Each remaining season is tagged by kind: `counted` (a real season he is paid for),
    `token` (a placeholder tail season, see TOKEN_TAIL_SHARE) or `void` (no cash, only
    the cap charge of bonus proration accelerating). `per_year` is the average cash of
    the counted seasons. `gtd_thru` is the last season after this one with guaranteed
    salary. `dead_if_cut` is what releasing him after this season would leave on the
    cap: the bonus proration still to come plus the guaranteed salary still owed.
    """
    by_year: dict[int, dict] = {}
    for s in history:
        y = s.get("year")
        if y and y.isdigit() and int(y) >= season:
            by_year[int(y)] = s
    if season not in by_year:
        return None
    years = sorted(by_year)
    cash = {y: _dollars(by_year[y].get("cash_paid")) for y in years}
    paid = [y for y in years if y == season or cash[y] > 0]
    # Real seasons run without a gap from this one; anything after the first unpaid
    # season is void years (or bookkeeping rows that carry no money).
    counted: list[int] = []
    for y in paid:
        if counted and y != counted[-1] + 1:
            break
        counted.append(y)
    token: list[int] = []
    while len(counted) > 1:
        before = counted[:-1]
        avg = sum(cash[y] for y in before) / len(before)
        if cash[counted[-1]] < TOKEN_TAIL_SHARE * avg:
            token.insert(0, counted.pop())
        else:
            break
    last_money = max(counted + token)
    out_years = []
    for y in years:
        cap = _dollars(by_year[y].get("cap_number"))
        if y in counted:
            kind = "counted"
        elif y in token:
            kind = "token"
        elif y > last_money and cap > 0:
            kind = "void"
        else:
            continue
        out_years.append(
            {
                "season": y,
                "cap": cap,
                "cash": cash[y] if kind != "void" else 0,
                "gtd": _dollars(by_year[y].get("guaranteed_salary")) > 0,
                "kind": kind,
            }
        )
    gtd_future = [r["season"] for r in out_years if r["season"] > season and r["gtd"]]
    future = [by_year[y] for y in years if y > season]
    dead = sum(
        _dollars(s.get("prorated_bonus")) + _dollars(s.get("guaranteed_salary")) for s in future
    )
    return {
        "per_year": round(sum(cash[y] for y in counted) / len(counted)),
        "deal_thru": max(counted),
        "gtd_thru": max(gtd_future) if gtd_future else None,
        "dead_if_cut": dead,
        "money_years": out_years,
    }


def contract_outlook(
    contracts: pl.DataFrame, season: int, nick_to_abbr: dict[str, str]
) -> pl.DataFrame:
    """Per active contract with a priced `season`: what he is paid from here on.

    Keyed by (otc_id, team) like `contract_years`, so it joins straight onto the fact
    table. Contracts with no season_history (most of this year's rookies) are absent;
    the export falls back to APY for them, which is the right figure for a new deal.
    """
    rows: list[dict] = []
    seen: set[tuple[int, str]] = set()
    active = contracts.filter(pl.col("is_active")).select("otc_id", "season_history")
    for otc_id, history in active.iter_rows():
        if not history:
            continue
        this = next((s for s in history if s.get("year") == str(season)), None)
        if this is None or this.get("cap_number") is None:
            continue
        team = nick_to_abbr.get(this.get("team"))
        if team is None or (otc_id, team) in seen:
            continue
        out = _outlook_row(history, season)
        if out is None:
            continue
        seen.add((otc_id, team))
        rows.append({"otc_id": otc_id, "team": team, **out})
    return pl.DataFrame(rows, schema=OUTLOOK_SCHEMA)


def load_contract_outlook(season: int) -> pl.DataFrame:
    contracts = sources.read("contracts")
    return contract_outlook(contracts, season, teams.nick_to_abbr(teams.load_teams()))


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
