"""Write a week's snapshot to data/out/<season>/week_<n>/ as parquet plus a JSON summary."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import polars as pl

from .config import OUT_DIR


def snapshot_dir(season: int, week: int) -> Path:
    d = OUT_DIR / str(season) / f"week_{week:02d}"
    d.mkdir(parents=True, exist_ok=True)
    return d


def write_snapshot(
    season: int,
    week: int,
    *,
    teams: pl.DataFrame,
    position_groups: pl.DataFrame,
    crosswalk: pl.DataFrame,
    contract_years: pl.DataFrame,
    player_week_status: pl.DataFrame,
    fact: pl.DataFrame,
    rollup: pl.DataFrame,
    reconcile_report: dict | None,
) -> Path:
    d = snapshot_dir(season, week)
    tables = {
        "teams": teams,
        "position_groups": position_groups,
        "players": crosswalk,
        "contract_years": contract_years,
        "player_week_status": player_week_status,
        "player_week_cap": fact,
        "rollup": rollup,
    }
    for name, df in tables.items():
        df.write_parquet(d / f"{name}.parquet")
    # Small JSON files the web app can read directly before the database exists.
    rollup.write_json(d / "rollup.json")
    meta = {
        "season": season,
        "week": week,
        "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "rows": {name: df.height for name, df in tables.items()},
        "reconcile": reconcile_report,
    }
    (d / "meta.json").write_text(json.dumps(meta, indent=2))
    latest = OUT_DIR / str(season) / "latest.json"
    latest.write_text(json.dumps({"week": week, "path": str(d.relative_to(OUT_DIR))}))
    return d
