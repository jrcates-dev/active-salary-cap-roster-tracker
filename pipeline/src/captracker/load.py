"""Optional Postgres load. Table and column names match web/src/db/schema.ts.

Each table is replaced for the (season, week) being loaded so a re-run is idempotent.
Requires DATABASE_URL (a Neon connection string) in the environment.
"""

from __future__ import annotations

import os
from pathlib import Path

import polars as pl
import psycopg

TABLE_KEYS: dict[str, list[str]] = {
    "teams": [],
    "position_groups": [],
    "players": [],
    "contract_years": ["season"],
    "player_week_status": ["season", "week"],
    "player_week_cap": ["season", "week"],
    "rollup": ["season", "week"],
    "team_summary": ["season", "week"],
}


def _conn() -> psycopg.Connection:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(url)


def _replace(cur: psycopg.Cursor, table: str, df: pl.DataFrame, keys: list[str]) -> None:
    if keys:
        where = " AND ".join(f"{k} = %s" for k in keys)
        cur.execute(f"DELETE FROM {table} WHERE {where}", [df[k][0] for k in keys])
    else:
        cur.execute(f"TRUNCATE {table}")
    cols = df.columns
    placeholders = ", ".join(["%s"] * len(cols))
    sql = f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({placeholders})"
    cur.executemany(sql, df.rows())


def load_snapshot(snapshot: Path) -> dict[str, int]:
    loaded: dict[str, int] = {}
    with _conn() as conn, conn.cursor() as cur:
        for table, keys in TABLE_KEYS.items():
            path = snapshot / f"{table}.parquet"
            if not path.exists():
                continue
            df = pl.read_parquet(path)
            _replace(cur, table, df, keys)
            loaded[table] = df.height
        conn.commit()
    return loaded
