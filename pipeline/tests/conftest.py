import polars as pl
import pytest


@pytest.fixture
def teams_map() -> dict[str, str]:
    return {"Patriots": "NE", "Packers": "GB", "Bengals": "CIN"}


def _season(year: str, team: str, cap: float, *, base: float = 1.0) -> dict:
    return {
        "year": year,
        "team": team,
        "base_salary": base,
        "prorated_bonus": (cap - base) if cap is not None else None,
        "option_bonus": 0.0,
        "roster_bonus": 0.0,
        "guaranteed_salary": base,
        "cap_number": cap,
        "cap_percent": None,
        "cash_paid": cap,
        "workout_bonus": None,
        "per_game_roster_bonus": None,
        "other_bonus": None,
    }


@pytest.fixture
def contracts_df() -> pl.DataFrame:
    """Four players: a QB, two WRs (one on IR) and a kicker, plus an inactive old deal."""
    rows = [
        {
            "player": "Star QB",
            "position": "QB",
            "team": "Patriots",
            "is_active": True,
            "year_signed": 2024,
            "years": 4,
            "value": 160.0,
            "apy": 40.0,
            "guaranteed": 100.0,
            "apy_cap_pct": 0.14,
            "gsis_id": "00-QB",
            "otc_id": 1,
            "player_page": "x",
            "season_history": [
                _season("2025", "Patriots", 30.0),
                _season("2026", "Patriots", 40.0),
                _season("Total", "Total", 70.0),
            ],
        },
        {
            "player": "WR One",
            "position": "WR",
            "team": "NE/PHI",
            "is_active": True,
            "year_signed": 2024,
            "years": 3,
            "value": 96.0,
            "apy": 32.0,
            "guaranteed": 50.0,
            "apy_cap_pct": 0.11,
            "gsis_id": "00-WR1",
            "otc_id": 2,
            "player_page": "x",
            "season_history": [_season("2026", "Patriots", 20.0)],
        },
        {
            "player": "WR Two",
            "position": "WR",
            "team": "Patriots",
            "is_active": True,
            "year_signed": 2026,
            "years": 4,
            "value": 68.0,
            "apy": 17.0,
            "guaranteed": 30.0,
            "apy_cap_pct": 0.06,
            "gsis_id": "00-WR2",
            "otc_id": 3,
            "player_page": "x",
            "season_history": [
                _season("2026", "Patriots", 10.0),
                _season("2027", "Patriots", None),
            ],
        },
        {
            "player": "Kicker",
            "position": "K",
            "team": "Patriots",
            "is_active": True,
            "year_signed": 2025,
            "years": 2,
            "value": 8.0,
            "apy": 4.0,
            "guaranteed": 2.0,
            "apy_cap_pct": 0.01,
            "gsis_id": "00-K",
            "otc_id": 4,
            "player_page": "x",
            "season_history": [_season("2026", "Patriots", 4.0)],
        },
        {
            "player": "Old Deal",
            "position": "QB",
            "team": "Patriots",
            "is_active": False,
            "year_signed": 2019,
            "years": 2,
            "value": 10.0,
            "apy": 5.0,
            "guaranteed": 0.0,
            "apy_cap_pct": 0.02,
            "gsis_id": "00-OLD",
            "otc_id": 5,
            "player_page": "x",
            "season_history": [_season("2026", "Patriots", 99.0)],
        },
    ]
    # A duplicated contract row, as the source sometimes ships.
    rows.append(rows[3])
    return pl.DataFrame(rows)


@pytest.fixture
def players_df() -> pl.DataFrame:
    ids = ["00-QB", "00-WR1", "00-WR2", "00-K", "00-OLD"]
    return pl.DataFrame(
        {
            "gsis_id": ids,
            "otc_id": [None, 2, None, 4, 5],
            "espn_id": [11, 12, 13, 14, 15],
            "pfr_id": [None] * 5,
            "pff_id": [None] * 5,
            "esb_id": [None] * 5,
            "smart_id": [None] * 5,
            "nfl_id": [None] * 5,
            "display_name": ["Star QB", "WR One", "WR Two", "Kicker", "Old Deal"],
            "position": ["QB", "WR", "WR", "K", "QB"],
            "position_group": ["QB", "WR", "WR", "SPEC", "QB"],
            "latest_team": ["NE"] * 5,
            "status": ["ACT", "ACT", "RES", "ACT", "RET"],
            "headshot": [None] * 5,
            "birth_date": [None] * 5,
            "rookie_season": [2020] * 5,
            "draft_year": [2020] * 5,
            "draft_round": [1] * 5,
            "draft_pick": [1] * 5,
        }
    )


@pytest.fixture
def rosters_df() -> pl.DataFrame:
    def row(week, gsis, name, pos, status):
        return {
            "season": 2026,
            "week": week,
            "game_type": "REG",
            "team": "NE",
            "gsis_id": gsis,
            "full_name": name,
            "position": pos,
            "depth_chart_position": pos,
            "status": status,
            "status_description_abbr": "A01",
        }

    return pl.DataFrame(
        [
            row(9, "00-QB", "Star QB", "QB", "ACT"),
            row(9, "00-WR1", "WR One", "WR", "INA"),
            row(9, "00-WR2", "WR Two", "WR", "RES"),
            row(9, "00-K", "Kicker", "K", "ACT"),
            row(8, "00-QB", "Star QB", "QB", "ACT"),
            row(8, "00-WR1", "WR One", "WR", "ACT"),
            row(8, "00-WR2", "WR Two", "WR", "ACT"),
            row(8, "00-K", "Kicker", "K", "ACT"),
        ]
    )


@pytest.fixture
def injuries_df() -> pl.DataFrame:
    return pl.DataFrame(
        [
            {
                "season": 2026,
                "week": 9,
                "game_type": "REG",
                "gsis_id": "00-WR1",
                "position": "WR",
                "report_status": "Out",
                "practice_status": "Did Not Participate",
                "report_primary_injury": "Hamstring",
            },
            {
                "season": 2026,
                "week": 8,
                "game_type": "REG",
                "gsis_id": "00-K",
                "position": "K",
                "report_status": "Questionable",
                "practice_status": "Limited",
                "report_primary_injury": "Quad",
            },
        ]
    )
