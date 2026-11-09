"""Download nflverse release files into the local raw cache."""

from __future__ import annotations

import logging
import time
from pathlib import Path

import httpx
import polars as pl

from .config import RAW_DIR, SOURCES, Source

log = logging.getLogger(__name__)


def fetch(source: Source, season: int | None = None, *, force: bool = False) -> Path:
    """Download one source file unless a cached copy already exists."""
    path = source.path(season)
    if path.exists() and not force:
        log.debug("cached %s", path)
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    url = source.resolved_url(season)
    log.info("downloading %s", url)
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            with httpx.Client(follow_redirects=True, timeout=120) as client:
                resp = client.get(url)
                resp.raise_for_status()
            tmp = path.with_suffix(path.suffix + ".part")
            tmp.write_bytes(resp.content)
            tmp.replace(path)
            return path
        except httpx.HTTPError as exc:  # network blip or GitHub hiccup
            last_error = exc
            time.sleep(2**attempt)
    raise RuntimeError(f"could not download {url}") from last_error


def fetch_all(season: int, *, force: bool = False) -> dict[str, Path]:
    """Download every source the pipeline needs for one season."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    return {
        name: fetch(src, season if src.per_season else None, force=force)
        for name, src in SOURCES.items()
    }


def read(name: str, season: int | None = None) -> pl.DataFrame:
    """Read a cached source as a DataFrame, downloading it first if needed."""
    src = SOURCES[name]
    path = fetch(src, season if src.per_season else None)
    if path.suffix == ".parquet":
        return pl.read_parquet(path)
    return pl.read_csv(path, infer_schema_length=10_000)
