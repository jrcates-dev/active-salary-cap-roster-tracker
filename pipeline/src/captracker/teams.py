"""Team reference data: abbreviations, nicknames, colors."""

from __future__ import annotations

import polars as pl

from . import sources

# Abbreviations nflverse retired for franchises that moved or rebranded; map them to
# the current code so every season uses one key per team.
LEGACY_ABBR = {"OAK": "LV", "SD": "LAC", "STL": "LA", "LAR": "LA", "WSH": "WAS"}

TEAM_COLUMNS = [
    "team_abbr",
    "team_name",
    "team_nick",
    "team_conf",
    "team_division",
    "team_color",
    "team_color2",
    "team_color3",
    "team_color4",
    "team_logo_espn",
    "team_wordmark",
]


def load_teams() -> pl.DataFrame:
    """The 32 current teams with colors, one row each."""
    df = sources.read("teams").select(TEAM_COLUMNS)
    # The nflverse file keeps the retired codes as extra rows; the current 32 are the
    # ones whose abbreviation is not a legacy key.
    return (
        df.filter(~pl.col("team_abbr").is_in(list(LEGACY_ABBR)))
        .rename(
            {
                "team_abbr": "team",
                "team_name": "name",
                "team_nick": "nick",
                "team_conf": "conference",
                "team_division": "division",
                "team_color": "color_primary",
                "team_color2": "color_secondary",
                "team_color3": "color_3",
                "team_color4": "color_4",
                "team_logo_espn": "logo_url",
                "team_wordmark": "wordmark_url",
            }
        )
        .sort("team")
    )


def nick_to_abbr(teams: pl.DataFrame) -> dict[str, str]:
    """'Bengals' -> 'CIN'. The contracts file keys teams by nickname."""
    return dict(zip(teams["nick"].to_list(), teams["team"].to_list(), strict=True))


def normalize_abbr(abbr: str | None) -> str | None:
    if abbr is None:
        return None
    return LEGACY_ABBR.get(abbr, abbr)
