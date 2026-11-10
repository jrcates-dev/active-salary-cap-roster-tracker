"""Export a compact JSON snapshot for the web app.

The site reads one file per build: `web/data/snapshot.json`. The real snapshot is
gitignored so it never enters the repository's history; the daily job builds it and
bakes it into the published static site. CI and fresh clones build against a
synthetic fixture (`web/data/fixture.json`) that `export --fixture` generates.
"""

from __future__ import annotations

import json
import random
from datetime import UTC, datetime
from pathlib import Path

import polars as pl

from .positions import POSITION_GROUPS

ROLLUP_FIELDS = [
    "team",
    "level",
    "unit",
    "position_group",
    "cap_total",
    "players",
    "cap_active",
    "cap_inactive",
    "cap_questionable",
    "cap_unknown",
    "cap_inactive_week",
    "cap_inactive_season",
    "cap_inactive_year",
]


def _records(df: pl.DataFrame) -> list[dict]:
    return df.to_dicts()


def _games(games: pl.DataFrame, season: int) -> list[dict]:
    """Every regular-season game, so the site can show any week's slate and preview
    future matchups with the current rosters."""
    g = games.filter((pl.col("season") == season) & (pl.col("game_type") == "REG"))
    return _records(
        g.select(
            "game_id",
            "week",
            "gameday",
            "gametime",
            "away_team",
            "home_team",
            "away_score",
            "home_score",
        ).sort(["week", "gameday", "gametime"])
    )


# What the site shows for a player in an earlier week: who he is, his cap number and
# why he was out. Contract terms and headshots come from the current week's rows.
HISTORY_PLAYER_FIELDS = [
    "week",
    "team",
    "key",
    "name",
    "pos",
    "group",
    "unit",
    "cap",
    "flag",
    "reason",
    "absence",
    "outlook_basis",
    "outlook_note",
    "report_status",
    "injury",
    "starter",
    "depth_role",
]


def player_records(
    fact: pl.DataFrame, season: int, depth_roles: pl.DataFrame | None = None
) -> pl.DataFrame:
    """One row per player counting against a team's cap, in the shape the site reads.

    `depth_roles` (`depth.week_roles`) adds starter and depth_role; without it they are
    left blank.
    """
    fact = fact.filter(pl.col("counts_against_cap"))
    if depth_roles is not None:
        fact = fact.join(depth_roles, on=["team", "gsis_id"], how="left")
    else:
        fact = fact.with_columns(
            pl.lit(None, dtype=pl.Boolean).alias("starter"),
            pl.lit(None, dtype=pl.String).alias("depth_role"),
        )
    return (
        fact.with_columns(
            pl.when(pl.col("year_signed").is_not_null() & pl.col("contract_years").is_not_null())
            .then(pl.col("year_signed") + pl.col("contract_years") - season)
            .otherwise(None)
            .alias("years_left")
        )
        .select(
            "week",
            "team",
            pl.col("player_key").alias("key"),
            pl.coalesce("name", "player_name").alias("name"),
            pl.coalesce("contract_position", "players_position").alias("pos"),
            pl.col("position_group").alias("group"),
            "unit",
            pl.col("cap_number").alias("cap"),
            pl.col("contract_cap_number").alias("contract_cap"),
            pl.col("cap_source").alias("source"),
            pl.col("gameday_flag").alias("flag"),
            pl.col("inactive_reason").alias("reason"),
            "absence",
            "outlook_basis",
            "outlook_note",
            "roster_status",
            "report_status",
            "injury",
            "years_left",
            "contract_apy",
            "headshot",
            "starter",
            "depth_role",
        )
        .sort(["team", "cap"], descending=[False, True])
    )


def week_out_players(
    fact: pl.DataFrame, season: int, depth_roles: pl.DataFrame | None = None
) -> list[dict]:
    """The players behind one week's money out: everyone out or questionable that week.

    These are the rows the "Money out by week" chart sums, so a week's bar on the
    site always matches the list it opens.
    """
    rows = player_records(fact, season, depth_roles).filter(
        pl.col("flag").is_in(["inactive", "questionable"])
    )
    return _records(rows.select(HISTORY_PLAYER_FIELDS))


def build_export(
    *,
    season: int,
    week: int,
    teams: pl.DataFrame,
    team_summary: pl.DataFrame,
    rollup: pl.DataFrame,
    fact: pl.DataFrame,
    games: pl.DataFrame,
    reconcile_report: dict | None,
    freshness: dict | None = None,
    history: list[dict] | None = None,
    history_players: list[dict] | None = None,
    depth_roles: pl.DataFrame | None = None,
) -> dict:
    players = player_records(fact, season, depth_roles)
    return {
        "season": season,
        "week": week,
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "fixture": False,
        "groups": [
            {"code": g.code, "label": g.label, "unit": g.unit, "order": g.order}
            for g in POSITION_GROUPS
        ],
        "teams": _records(teams),
        "summary": _records(team_summary.drop("season", "week")),
        "rollup": _records(rollup.select(ROLLUP_FIELDS)),
        "players": _records(players.drop("week")),
        "games": _games(games, season),
        "reconcile": reconcile_report,
        "freshness": freshness,
        "history": history or [],
        "history_players": history_players or [],
    }


def write_export(data: dict, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, separators=(",", ":"), default=str))
    return path


def build_fixture(real: dict, seed: int = 7) -> dict:
    """A synthetic snapshot with the real structure and no real player data.

    Team names and colors are kept (public reference data); every player is renamed
    and every dollar figure is replaced, so the fixture can live in a public repo.
    """
    rng = random.Random(seed)
    flags = ["active"] * 14 + ["inactive"] * 3 + ["questionable"] * 2 + ["unknown"]
    reasons = {"inactive": ["injured_reserve", "injured_reserve", "out", "inactive_list"]}
    absence_of = {"out": "week", "inactive_list": "week"}
    weights = {
        "QB": 3, "RB": 4, "WR": 6, "TE": 3, "OL": 9, "IDL": 6, "EDGE": 5,
        "LB": 5, "CB": 6, "S": 4, "K": 1, "P": 1, "LS": 1,
    }  # fmt: skip
    # The first n of each group start: 11 on offense, a base defense plus the nickel.
    starters = {
        "QB": 1, "RB": 1, "WR": 3, "TE": 1, "OL": 5, "IDL": 2, "EDGE": 2,
        "LB": 3, "CB": 3, "S": 2, "K": 1, "P": 1, "LS": 1,
    }  # fmt: skip
    group_unit = {g["code"]: g["unit"] for g in real["groups"]}
    players: list[dict] = []
    for t in real["teams"]:
        abbr = t["team"]
        for code, n in weights.items():
            for i in range(n):
                cap = int(rng.lognormvariate(14.2 if i else 15.6, 0.9))
                cap = max(247_500, min(cap, 55_000_000)) // 500 * 500
                flag = rng.choice(flags)
                reason = rng.choice(reasons.get(flag, [None]))
                # Reserve list: about a third of them done for the year.
                absence = absence_of.get(reason, "season") if reason else None
                if absence == "season" and rng.random() < 0.35:
                    absence = "year"
                basis = (
                    ("table" if absence == "year" else rng.choice([None, "designated_for_return"]))
                    if absence in ("season", "year")
                    else None
                )
                players.append(
                    {
                        "team": abbr,
                        "key": f"{abbr}-{code}-{i}",
                        "name": f"{abbr} {code} {i + 1}",
                        "pos": code,
                        "group": code,
                        "unit": group_unit[code],
                        "cap": cap,
                        "contract_cap": cap,
                        "source": "contract",
                        "flag": flag,
                        "reason": reason,
                        "absence": absence,
                        "outlook_basis": basis,
                        "outlook_note": "Season-ending injury (synthetic)"
                        if basis == "table"
                        else None,
                        "roster_status": "ACT",
                        "report_status": None,
                        "injury": None,
                        "years_left": rng.randint(0, 4),
                        "contract_apy": cap,
                        "headshot": None,
                        "starter": i < starters[code],
                        "depth_role": f"{code}{i + 1}",
                    }
                )
    pdf = pl.DataFrame(players)
    flag_cols = [
        pl.when(pl.col("flag") == f).then(pl.col("cap")).otherwise(0).sum().alias(f"cap_{f}")
        for f in ("active", "inactive", "questionable", "unknown")
    ]
    absence_cols = [
        pl.when((pl.col("flag") == "inactive") & (pl.col("absence") == a))
        .then(pl.col("cap"))
        .otherwise(0)
        .sum()
        .alias(f"cap_inactive_{a}")
        for a in ("week", "season", "year")
    ]
    aggs = [
        pl.col("cap").sum().alias("cap_total"),
        pl.len().alias("players"),
        *flag_cols,
        *absence_cols,
    ]
    by_group = pdf.group_by("team", "unit", "group").agg(aggs).rename({"group": "position_group"})
    by_unit = (
        pdf.group_by("team", "unit").agg(aggs).with_columns(pl.lit("all").alias("position_group"))
    )
    by_team = (
        pdf.group_by("team")
        .agg(aggs)
        .with_columns(pl.lit("all").alias("unit"), pl.lit("all").alias("position_group"))
    )
    cols = ROLLUP_FIELDS[:1] + ROLLUP_FIELDS[2:]
    rollup = pl.concat(
        [
            by_team.select(cols).with_columns(pl.lit("team").alias("level")),
            by_unit.select(cols).with_columns(pl.lit("unit").alias("level")),
            by_group.select(cols).with_columns(pl.lit("group").alias("level")),
        ]
    ).select(ROLLUP_FIELDS)
    summary = by_team.select(
        "team", "cap_total", "players", "cap_active", "cap_inactive", "cap_questionable",
        "cap_unknown", "cap_inactive_week", "cap_inactive_season", "cap_inactive_year",
    ).with_columns(
        pl.lit(0).alias("players_estimated"),
        pl.lit(0).alias("cap_estimated"),
        pl.lit(0).alias("players_rookie_derived"),
        pl.lit(0).alias("cap_rookie_derived"),
        pl.lit(0).alias("cap_off_roster"),
        pl.lit(real["week"]).alias("status_week"),
        pl.lit(False).alias("on_bye"),
        pl.lit("injury_report").alias("status_source"),
        pl.lit(20_000_000).alias("dead_money"),
        pl.lit(10_000_000).alias("cap_space"),
        pl.lit(None, dtype=pl.Int64).alias("ref_active_cap"),
        pl.lit("fixture").alias("reference_as_of"),
    ).with_columns(
        (pl.col("cap_total") + pl.col("dead_money") + pl.col("cap_space")).alias("adjusted_cap")
    )  # fmt: skip
    history, history_players = _fixture_history(players, real["week"], rng)
    return {
        **real,
        "generated_at": "fixture",
        "fixture": True,
        "summary": _records(summary.sort("team")),
        "rollup": _records(rollup),
        "players": players,
        "reconcile": None,
        "history": history,
        "history_players": history_players,
    }


def _fixture_history(
    players: list[dict], week: int, rng: random.Random
) -> tuple[list[dict], list[dict]]:
    """A synthetic season of weekly statuses, so the trend chart and the week rosters
    it links to agree. The current week is each player's flag as it stands. A player on
    a reserve list went on it some weeks back; anyone else misses the odd game or is
    listed questionable now and then.
    """
    weekly: dict[int, list[dict]] = {w: [] for w in range(1, week + 1)}
    for p in players:
        reserve = p["flag"] == "inactive" and p["absence"] in ("season", "year")
        since = rng.randint(1, week) if reserve else week + 1
        for w in range(1, week + 1):
            if w == week:
                row = p
            elif w >= since:
                # Done for the year only once the injury was known to end it.
                absence = "year" if p["absence"] == "year" and w >= (since + week) / 2 else "season"
                row = {**p, "flag": "inactive", "absence": absence}
            elif p["flag"] == "unknown":
                row = p
            else:
                roll = rng.random()
                if roll < 0.05:
                    row = {**p, "flag": "inactive", "reason": "out", "absence": "week"}
                elif roll < 0.09:
                    row = {**p, "flag": "questionable", "reason": None, "absence": None}
                else:
                    row = {**p, "flag": "active", "reason": None, "absence": None}
            if row["flag"] != "inactive" or row["absence"] not in ("season", "year"):
                row = {**row, "outlook_basis": None, "outlook_note": None}
            weekly[w].append({**row, "week": w})
    history: list[dict] = []
    history_players: list[dict] = []
    for w, rows in weekly.items():
        df = pl.DataFrame(rows, infer_schema_length=None)
        money = (
            df.group_by("team")
            .agg(
                pl.col("cap").sum().alias("cap_total"),
                *[
                    pl.when(pl.col("flag") == f)
                    .then(pl.col("cap"))
                    .otherwise(0)
                    .sum()
                    .alias(f"cap_{f}")
                    for f in ("active", "questionable", "unknown")
                ],
                *[
                    pl.when((pl.col("flag") == "inactive") & (pl.col("absence") == a))
                    .then(pl.col("cap"))
                    .otherwise(0)
                    .sum()
                    .alias(f"cap_inactive_{a}")
                    for a in ("week", "season", "year")
                ],
            )
            .sort("team")
        )
        for t in _records(money):
            history.append({"week": w, "unit": "all", **t})
        if w < week:
            out = df.filter(pl.col("flag").is_in(["inactive", "questionable"]))
            history_players.extend(_records(out.select(HISTORY_PLAYER_FIELDS)))
    return history, history_players
