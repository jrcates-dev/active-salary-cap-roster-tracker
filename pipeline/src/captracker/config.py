"""Paths, season defaults and nflverse release URLs."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("CAPTRACKER_DATA_DIR", PIPELINE_ROOT / "data"))
RAW_DIR = DATA_DIR / "raw"
OUT_DIR = DATA_DIR / "out"
PACKAGE_DATA = Path(__file__).resolve().parent / "data"
WEB_DATA = PIPELINE_ROOT.parent / "web" / "data"
WEB_PUBLIC = PIPELINE_ROOT.parent / "web" / "public"

DEFAULT_SEASON = int(os.environ.get("CAPTRACKER_SEASON", "2026"))

# Tolerance for the reconciliation gate: every team's active cap total must land
# within this fraction of the published OverTheCap figure.
RECONCILE_TOLERANCE = 0.01

NFLVERSE_RELEASES = "https://github.com/nflverse/nflverse-data/releases/download"
NFLVERSE_RAW = "https://raw.githubusercontent.com/nflverse"


@dataclass(frozen=True)
class Source:
    name: str
    url: str
    filename: str
    per_season: bool = False

    def path(self, season: int | None = None) -> Path:
        return RAW_DIR / self.filename.format(season=season)

    def resolved_url(self, season: int | None = None) -> str:
        return self.url.format(season=season)


SOURCES: dict[str, Source] = {
    "contracts": Source(
        "contracts",
        f"{NFLVERSE_RELEASES}/contracts/historical_contracts.parquet",
        "historical_contracts.parquet",
    ),
    "players": Source(
        "players",
        f"{NFLVERSE_RELEASES}/players/players.parquet",
        "players.parquet",
    ),
    "rosters_weekly": Source(
        "rosters_weekly",
        f"{NFLVERSE_RELEASES}/weekly_rosters/roster_weekly_{{season}}.parquet",
        "roster_weekly_{season}.parquet",
        per_season=True,
    ),
    "injuries": Source(
        "injuries",
        f"{NFLVERSE_RELEASES}/injuries/injuries_{{season}}.parquet",
        "injuries_{season}.parquet",
        per_season=True,
    ),
    "depth_charts": Source(
        "depth_charts",
        f"{NFLVERSE_RELEASES}/depth_charts/depth_charts_{{season}}.parquet",
        "depth_charts_{season}.parquet",
        per_season=True,
    ),
    "games": Source(
        "games",
        f"{NFLVERSE_RAW}/nfldata/master/data/games.csv",
        "games.csv",
    ),
    "teams": Source(
        "teams",
        f"{NFLVERSE_RAW}/nflverse-pbp/master/teams_colors_logos.csv",
        "teams_colors_logos.csv",
    ),
}
