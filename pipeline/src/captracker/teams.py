"""Team reference data: abbreviations, nicknames, colors."""

from __future__ import annotations

import polars as pl

from . import sources

# Abbreviations nflverse retired for franchises that moved or rebranded; map them to
# the current code so every season uses one key per team.
LEGACY_ABBR = {"OAK": "LV", "SD": "LAC", "STL": "LA", "LAR": "LA", "WSH": "WAS"}

# Where nflverse's first color is not the one the team leads with. nflverse gives the
# Buccaneers the Falcons' red (#A71930); the Bucs' own red is #D50A0A. It lists the
# Broncos' navy first, but the Broncos lead with orange. The site draws every team in
# its primary color, so the primary has to be the one fans know the team by.
COLOR_FIXES: dict[str, dict[str, str]] = {
    "TB": {"color_primary": "#D50A0A"},
    "DEN": {"color_primary": "#FB4F14", "color_secondary": "#002244"},
}

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
        .pipe(fix_colors)
    )


def fix_colors(teams: pl.DataFrame) -> pl.DataFrame:
    """Apply COLOR_FIXES over the nflverse colors."""
    for abbr, fixes in COLOR_FIXES.items():
        teams = teams.with_columns(
            pl.when(pl.col("team") == abbr).then(pl.lit(value)).otherwise(pl.col(col)).alias(col)
            for col, value in fixes.items()
        )
    return teams


def nick_to_abbr(teams: pl.DataFrame) -> dict[str, str]:
    """'Bengals' -> 'CIN'. The contracts file keys teams by nickname."""
    return dict(zip(teams["nick"].to_list(), teams["team"].to_list(), strict=True))


def normalize_abbr(abbr: str | None) -> str | None:
    if abbr is None:
        return None
    return LEGACY_ABBR.get(abbr, abbr)
