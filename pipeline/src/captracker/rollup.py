"""Roll cap dollars up from players to position groups, units and teams."""

from __future__ import annotations

import polars as pl

from . import proration
from .contracts import IR_SPLIT_2026
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
        "birth_date",
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
# EXE is the exempt list (Brandon Aiyuk in 2026): off the 53, still on the cap, and
# OverTheCap counts him in active cap spending.
CAP_COUNTING_STATUS = ("ACT", "INA", "RES", "PUP", "NFI", "DEV", "EXE")

# 2026 practice squad minimum: $13,750 a week for 18 weeks. Veterans on the squad are
# paid more (up to about $30K a week), and the contracts file carries what each one is
# actually charged, elevations included, so this rate is only used for a practice squad
# player whose only deal in the file is a standard contract with no 2026 cap line.
PRACTICE_SQUAD_CAP = 247_500

# A deal whose value is under the rookie minimum is a practice squad deal.
STANDARD_MINIMUM = 885_000

# What a split rookie deal saves for a full season on injured reserve: the rookie
# minimum less the 2026 split salary (`contracts.IR_SPLIT_2026`).
IR_SPLIT_SAVING = STANDARD_MINIMUM - IR_SPLIT_2026


def _derived_cap() -> pl.Expr:
    """Season cap charge for rows whose cap number the pipeline worked out itself.

    Rows from the contracts file (`cap_source == "contract"`) already carry
    OverTheCap's charge for the season, prorated for mid-season signings and with
    practice squad pay and elevations in it, and are kept as they are. A derived row
    (`derived_rookie_scale`) holds a full season's figure, so it is prorated here:

    - a practice squad deal, at its rate, from the week he joined the squad (a
      player released and re-signed starts over; up to three elevations do not);
    - a practice squad player whose deal in the file is a standard contract, at the
      practice squad minimum, from the same week;
    - anyone else, at the derived figure, from the week he joined the roster (for a
      promoted player, the week of the promotion), less the split-salary saving for
      the weeks from his move to injured reserve to the end of the season when his
      rookie deal is split (`ir_split`). OverTheCap counts the rest of the season on
      the split, as it does any salary still to be paid.
    """
    derived = pl.col("cap_source") == "derived_rookie_scale"
    on_squad = pl.col("roster_status") == "DEV"
    squad_deal = (pl.col("contract_years") == 1) & (pl.col("contract_apy") < STANDARD_MINIMUM)
    from_squad_start = proration.prorate(
        pl.when(squad_deal).then(pl.col("contract_apy")).otherwise(pl.lit(PRACTICE_SQUAD_CAP)),
        pl.coalesce("squad_start", "stint_start"),
    )
    on_ir_split = pl.col("ir_split").fill_null(False) & pl.col("reserve_start").is_not_null()
    from_roster_start = proration.prorate(
        pl.col("cap_number"), pl.coalesce("roster_start", "stint_start")
    ) - pl.when(on_ir_split).then(
        proration.prorate(pl.lit(IR_SPLIT_SAVING), pl.col("reserve_start"))
    ).otherwise(0)
    return (
        pl.when(~derived | pl.col("stint_start").is_null())
        .then(pl.col("cap_number"))
        .when(on_squad | squad_deal)
        .then(from_squad_start)
        .otherwise(from_roster_start)
        .alias("cap_number")
    )


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
    Derived cap numbers are prorated for the weeks the player has been on the team
    (`_derived_cap`).
    """
    for c in ("absence", "outlook_basis", "outlook_note", "flag_source"):
        if c not in status.columns:
            status = status.with_columns(pl.lit(None, dtype=pl.String).alias(c))
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
            "outlook_basis",
            "outlook_note",
            "flag_source",
        )
        .unique(subset=["gsis_id"], keep="last")
    )
    defaults = {
        "cap_source": pl.lit("contract"),
        "contract_years": pl.lit(None, dtype=pl.Int32),
        "contract_apy": pl.lit(None, dtype=pl.Int64),
        "ir_split": pl.lit(False),
    }
    grouped_contracts = grouped_contracts.with_columns(
        e.alias(c) for c, e in defaults.items() if c not in grouped_contracts.columns
    )
    stints = proration.stints(status, week).rename({"team": "roster_team"})
    df = grouped_contracts.join(latest, on="gsis_id", how="left").join(
        stints, on=["gsis_id", "roster_team"], how="left"
    )
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
        _derived_cap(),
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


# week: this game only; season: a reserve list, can come back; year: out for the season.
ABSENCE_KINDS = ("week", "season", "year")
ABSENCE_COLUMNS = [f"cap_inactive_{k}" for k in ABSENCE_KINDS]


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
        *[_absence_sum(k) for k in ABSENCE_KINDS],
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
