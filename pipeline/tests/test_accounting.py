"""Accounting rules added in Phase 1: rookie derivation, minimum estimates,
practice squad pay, off-roster rows and bye weeks."""

import polars as pl

from captracker import contracts, crosswalk, estimates, rollup, rosters


def _roster_row(week, team, gsis, name, pos, status, years_exp=0):
    return {
        "season": 2026,
        "week": week,
        "game_type": "REG",
        "team": team,
        "gsis_id": gsis,
        "full_name": name,
        "position": pos,
        "depth_chart_position": pos,
        "status": status,
        "status_description_abbr": "A01",
        "years_exp": years_exp,
    }


def test_derive_first_year_rookie_scale(teams_map):
    df = pl.DataFrame(
        [
            {
                "player": "Top Pick",
                "position": "QB",
                "team": "Patriots",
                "is_active": True,
                "year_signed": 2026,
                "years": 4,
                "value": 44.0,
                "apy": 11.0,
                "guaranteed": 44.0,
                "apy_cap_pct": 0.04,
                "gsis_id": "00-R1",
                "otc_id": 10,
                "player_page": "x",
                "draft_round": 1,
            },
            {
                "player": "Late Pick",
                "position": "WR",
                "team": "Patriots",
                "is_active": True,
                "year_signed": 2026,
                "years": 4,
                "value": 4.6,
                "apy": 1.15,
                "guaranteed": 0.1,
                "apy_cap_pct": 0.003,
                "gsis_id": "00-R6",
                "otc_id": 11,
                "player_page": "x",
                "draft_round": 6,
            },
            {
                "player": "Traded Vet",
                "position": "WR",
                "team": "NE/PHI",
                "is_active": True,
                "year_signed": 2026,
                "years": 1,
                "value": 1.0,
                "apy": 1.0,
                "guaranteed": 0.0,
                "apy_cap_pct": 0.003,
                "gsis_id": "00-TV",
                "otc_id": 12,
                "player_page": "x",
                "draft_round": None,
            },
            {
                "player": "Already Priced",
                "position": "K",
                "team": "Patriots",
                "is_active": True,
                "year_signed": 2026,
                "years": 1,
                "value": 1.0,
                "apy": 1.0,
                "guaranteed": 0.0,
                "apy_cap_pct": 0.003,
                "gsis_id": "00-K",
                "otc_id": 4,
                "player_page": "x",
                "draft_round": None,
            },
        ]
    )
    out = contracts.derive_first_year(df, 2026, {**teams_map}, have_otc_ids={4})
    by = {r["gsis_id"]: r for r in out.iter_rows(named=True)}
    assert set(by) == {"00-R1", "00-R6", "00-TV"}
    assert by["00-R1"]["cap_number"] == 8_000_000  # 8/11 of $11M
    assert by["00-R6"]["cap_number"] == 940_000  # $1.15M - $210K
    assert by["00-TV"]["cap_number"] == 885_000  # floored at the rookie minimum
    assert by["00-TV"]["team"] == "NE"
    assert set(out["cap_source"].to_list()) == {"derived_rookie_scale"}


def test_derive_first_year_counts_a_promoted_player_once(teams_map):
    base = {
        "player": "Promoted Rb",
        "position": "RB",
        "team": "Rams",
        "is_active": True,
        "year_signed": 2026,
        "years": 1,
        "guaranteed": 0.0,
        "apy_cap_pct": 0.003,
        "gsis_id": "00-PR",
        "otc_id": 20,
        "player_page": "x",
        "draft_round": None,
    }
    df = pl.DataFrame(
        [
            {**base, "value": 0.282917, "apy": 0.282917},  # practice squad deal
            {**base, "value": 0.885, "apy": 0.885},  # standard deal after promotion
        ]
    )
    out = contracts.derive_first_year(df, 2026, {**teams_map, "Rams": "LA"}, have_otc_ids=set())
    assert out.height == 1
    assert out["contract_apy"][0] == 885_000


def test_minimum_for():
    assert estimates.minimum_for(0, "ACT") == 885_000
    assert estimates.minimum_for(3, "RES") == 1_145_000
    assert estimates.minimum_for(9, "ACT") == 1_300_000
    assert estimates.minimum_for(None, "ACT") == 885_000
    assert estimates.minimum_for(5, "DEV") == 247_500


def test_estimate_missing_prorates_and_skips_known(contracts_df, teams_map):
    cy = contracts.contract_years(contracts_df, 2026, teams_map)
    roster = pl.DataFrame(
        [
            _roster_row(9, "NE", "00-QB", "Star QB", "QB", "ACT", 5),  # has a contract
            _roster_row(9, "NE", "00-UDFA", "Udfa Guy", "WR", "ACT", 0),  # all season
            _roster_row(1, "NE", "00-UDFA", "Udfa Guy", "WR", "ACT", 0),
            _roster_row(9, "NE", "00-LATE", "Late Signing", "CB", "ACT", 4),  # from week 7
            _roster_row(7, "NE", "00-LATE", "Late Signing", "CB", "ACT", 4),
            _roster_row(9, "NE", "00-PS", "Ps Guy", "LB", "DEV", 1),
            _roster_row(9, "NE", "00-SUS", "Suspended", "S", "SUS", 3),  # not paid
        ]
    )
    est = estimates.estimate_missing(cy, roster, 2026, 9)
    by = {r["gsis_id"]: r["cap_number"] for r in est.iter_rows(named=True)}
    assert set(by) == {"00-UDFA", "00-LATE", "00-PS"}
    assert by["00-UDFA"] == 885_000
    assert by["00-LATE"] == round(1_215_000 * 12 / 18)
    assert by["00-PS"] == round(247_500 * 10 / 18)  # first seen in week 9


def test_fill_gsis_by_name():
    cy = pl.DataFrame(
        {
            "team": ["NE", "NE"],
            "otc_id": [1, 2],
            "gsis_id": [None, "00-B"],
            "player_name": ["Willie Gay, Jr.", "Other"],
        }
    )
    roster = pl.DataFrame({"team": ["NE"], "gsis_id": ["00-WG"], "full_name": ["Willie Gay"]})
    out = crosswalk.fill_gsis_by_name(cy, roster)
    assert out.sort("otc_id")["gsis_id"].to_list() == ["00-WG", "00-B"]


def _grouped(rows):
    base = {
        "season": 2026,
        "otc_id": 1,
        "player_name": "x",
        "contract_position": "WR",
        "cap_source": "contract",
        "position_group": "WR",
        "unit": "offense",
        "players_status": "ACT",
        "latest_team": None,
    }
    return pl.DataFrame([{**base, **r} for r in rows])


def _status(rows):
    base = {
        "season": 2026,
        "report_status": None,
        "practice_status": None,
        "injury": None,
        "gameday_flag": "active",
        "inactive_reason": None,
    }
    return pl.DataFrame([{**base, **r} for r in rows])


def test_off_roster_practice_squad_and_bye():
    grouped = _grouped(
        [
            {"gsis_id": "A", "team": "NE", "cap_number": 5_000_000},  # active on NE
            {"gsis_id": "B", "team": "NE", "cap_number": 900_000},  # on PS -> PS pay
            {"gsis_id": "C", "team": "NE", "cap_number": 2_000_000},  # now on GB
            {
                "gsis_id": "D",
                "team": "NE",
                "cap_number": 3_000_000,  # no roster row, cut
                "players_status": "CUT",
            },
            {
                "gsis_id": "E",
                "team": "NE",
                "cap_number": 4_000_000,  # no roster row, RLS
                "players_status": "RLS",
            },
            {"gsis_id": "F", "team": "PIT", "cap_number": 6_000_000},  # PIT on bye in week 9
        ]
    )
    status = _status(
        [
            {"week": 9, "team": "NE", "gsis_id": "A", "roster_status": "ACT"},
            {
                "week": 9,
                "team": "NE",
                "gsis_id": "B",
                "roster_status": "DEV",
                "gameday_flag": "unknown",
            },
            {"week": 9, "team": "GB", "gsis_id": "C", "roster_status": "ACT"},
            {
                "week": 8,
                "team": "PIT",
                "gsis_id": "F",
                "roster_status": "RES",
                "gameday_flag": "inactive",
                "inactive_reason": "injured_reserve",
            },
        ]
    )
    fact = rollup.player_week_cap(grouped, status, 9)
    by = {r["gsis_id"]: r for r in fact.iter_rows(named=True)}
    assert by["A"]["counts_against_cap"] and by["A"]["gameday_flag"] == "active"
    assert by["B"]["cap_number"] == 247_500 and by["B"]["contract_cap_number"] == 900_000
    assert not by["C"]["counts_against_cap"] and by["C"]["gameday_flag"] == "off_roster"
    assert not by["D"]["counts_against_cap"]
    assert by["E"]["counts_against_cap"] and by["E"]["gameday_flag"] == "unknown"
    assert by["F"]["counts_against_cap"] and by["F"]["status_week"] == 8
    assert by["F"]["gameday_flag"] == "inactive"

    roll = rollup.rollup(fact)
    ne = roll.filter((pl.col("level") == "team") & (pl.col("team") == "NE")).row(0, named=True)
    assert ne["cap_total"] == 5_000_000 + 247_500 + 4_000_000
    assert ne["players"] == 3


def test_team_status_weeks():
    status = pl.DataFrame({"team": ["NE", "NE", "PIT"], "week": [8, 9, 8]})
    out = dict(rollup.team_status_weeks(status, 9).iter_rows())
    assert out == {"NE": 9, "PIT": 8}


def test_status_flags_still_work(rosters_df, injuries_df):
    status = rosters.player_week_status(rosters_df, injuries_df, 2026)
    assert set(status["gameday_flag"].unique().to_list()) <= {
        "active",
        "inactive",
        "questionable",
        "unknown",
    }
