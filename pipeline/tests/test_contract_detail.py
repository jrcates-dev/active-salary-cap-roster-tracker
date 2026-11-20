import polars as pl

from captracker import contract_detail as cd

M = 1_000_000


def _s(year, *, team="Bills", base=0.0, prorated=0.0, option=0.0, roster=0.0, workout=0.0,
       gtd=0.0, cap=None, cash=0.0):  # fmt: skip
    return {
        "year": str(year),
        "team": team,
        "base_salary": base,
        "prorated_bonus": prorated,
        "option_bonus": option,
        "roster_bonus": roster,
        "workout_bonus": workout,
        "per_game_roster_bonus": None,
        "other_bonus": None,
        "guaranteed_salary": gtd,
        "cap_number": base + prorated + option + roster + workout if cap is None else cap,
        "cap_percent": None,
        "cash_paid": cash,
    }


# Shaped on a real extension: an old option bonus that ends when the new deal is signed,
# then three option bonuses exercised in 2026, 2027 and 2028, a void year at the end
# (cap number = the option proration of 2031 and 2032 landing in 2031) and a Total row.
EXTENSION = [
    _s(2024, base=1.0, prorated=20.0, option=8.48, cash=36.5),
    _s(2025, base=1.255, prorated=35.08, gtd=1.255, cash=58.0),
    _s(2026, base=1.3, prorated=34.828, option=7.6, workout=0.5, gtd=1.3, cash=55.0),
    _s(2027, base=14.0, prorated=26.348, option=15.3, workout=0.5, gtd=52.5, cash=53.0),
    _s(2028, base=18.5, prorated=21.064, option=22.3, workout=0.5, cash=54.0),
    _s(2029, base=17.0, prorated=14.389, option=22.3, roster=35.0, workout=0.5, cash=52.5),
    _s(2030, base=27.0, prorated=3.04, option=22.3, roster=30.0, workout=0.5, cash=57.5),
    _s(2031, base=85.0, option=14.7, cap=21.7),
    _s(2032, base=85.0, option=7.0, cap=0.0),
    {"year": "Total", "team": "Total", "cap_number": 1.0},
]


def test_ledger_reads_whole_dollars_and_drops_the_total_row():
    by = cd.ledger(EXTENSION)
    assert sorted(by) == list(range(2024, 2033))
    assert by[2026]["option_bonus"] == 7_600_000
    assert by[2026]["per_game_roster_bonus"] == 0  # null reads as zero


def test_option_layers_split_the_proration_by_exercise_year():
    layers = cd.option_layers(cd.ledger(EXTENSION))
    # The 2022-era option ends early in 2024 when the 2025 deal replaces it.
    assert layers == [
        (8_480_000, 2024, 2024),
        (7_600_000, 2026, 2030),
        (7_700_000, 2027, 2031),
        (7_000_000, 2028, 2032),
    ]


def test_release_costs_count_paid_proration_and_guarantees():
    by = cd.ledger(EXTENSION)
    r = cd.release_costs(by, 2027)
    proration = (26.348 + 21.064 + 14.389 + 3.04) * M  # signing proration from 2027 on
    option_paid = 7.6 * M * 4  # the 2026 option, 2027-2030; later options not yet paid
    assert r["cut"]["dead"] == round(proration + option_paid + 52.5 * M)
    assert r["cut"]["savings"] == r["cap"] - r["cut"]["dead"]
    assert r["trade"]["dead"] == round(proration + option_paid)
    # After June 1: 2027 keeps its own share, the rest moves to 2028.
    assert r["june1"]["dead"] == round((26.348 + 7.6 + 52.5) * M)
    assert r["june1"]["dead"] + r["june1"]["dead_next"] == r["cut"]["dead"]


def test_season_rows_tag_past_paid_and_void_seasons():
    rows = cd.season_rows(cd.ledger(EXTENSION), 2025, 2026, {"Bills": "BUF"})
    kinds = {r["season"]: r["kind"] for r in rows}
    assert kinds == {
        2025: "past",
        2026: "counted",
        2027: "counted",
        2028: "counted",
        2029: "counted",
        2030: "counted",
        2031: "void",
    }  # 2032 carries no cap charge, so it is left out
    void = rows[-1]
    assert void["prorated"] == void["cap"] == 21_700_000 and void["base"] == 0
    assert rows[0]["team"] == "BUF"
    # Only future paid seasons carry release costs; zero bonuses are left out.
    assert "dead_cut" not in rows[1] and rows[2]["dead_cut"] > 0
    assert "roster" not in rows[1] and rows[4]["roster"] == 35_000_000


def test_signing_bonus_for_an_extension_comes_from_the_cash():
    by = cd.ledger(EXTENSION)
    assert cd.signing_bonus(by, 2025) == round((58.0 - 1.255) * M)


def test_signing_bonus_for_a_new_team_comes_from_the_proration():
    # A rookie deal: four seasons of proration, then a fifth-year option with none.
    rookie = [
        _s(2023, team="Texans", base=0.75, prorated=5.846, cash=24.135),
        _s(2024, team="Texans", base=0.915, prorated=5.846, cash=0.915),
        _s(2025, team="Texans", base=1.03, prorated=5.846, cash=1.03),
        _s(2026, team="Texans", base=1.145, prorated=5.846, cash=1.145),
        _s(2027, team="Texans", base=25.904, gtd=25.904, cash=25.904),
    ]
    by = cd.ledger(rookie)
    assert cd.signing_bonus(by, 2023) == 4 * 5_846_000
    # A free agent signing with a new team after a year elsewhere.
    moved = [
        _s(2024, team="Vikings", base=2.5, prorated=1.25, cash=10.0),
        _s(2025, team="Seahawks", base=5.3, prorated=6.4, cash=41.5),
        _s(2026, team="Seahawks", base=12.3, prorated=6.4, cash=27.5),
    ]
    assert cd.signing_bonus(cd.ledger(moved), 2025) == 2 * 6_400_000


def test_signing_bonus_is_blank_when_the_cash_does_not_fit():
    # Cash in the signing year far above what the proration could hold.
    odd = [
        _s(2025, base=1.0, prorated=1.0, cash=5.0),
        _s(2026, base=1.0, prorated=2.0, cash=60.0),
        _s(2027, base=20.0, prorated=2.0, cash=20.0),
    ]
    assert cd.signing_bonus(cd.ledger(odd), 2026) is None
    # No bonus at all: salary only, no new proration.
    plain = [_s(2025, base=1.0, cash=1.0), _s(2026, base=2.0, cash=2.0)]
    assert cd.signing_bonus(cd.ledger(plain), 2026) == 0


def _frames(cap_source="contract"):
    fact = pl.DataFrame(
        [
            {
                "player_key": "00-QB",
                "team": "BUF",
                "gsis_id": "00-QB",
                "otc_id": 1,
                "year_signed": 2025,
                "contract_value": 330 * M,
                "cap_source": cap_source,
                "roster_status": "ACT",
                "player_page": "https://example.test/qb",
                "counts_against_cap": True,
            }
        ]
    )
    history = [
        {"team": "Bills", "contract_type": "Drafted", "status": "Extended", "year_signed": 2018,
         "yrs": 4, "total": 21.2, "apy": 5.3, "guarantees": 21.2, "amount_earned": 17.9,
         "percent_earned": 0.845, "effective_apy": 6.0},
        {"team": "Bills", "contract_type": "Extension", "status": "Active", "year_signed": 2025,
         "yrs": 6, "total": 330.0, "apy": 55.0, "guarantees": 147.0, "amount_earned": 58.0,
         "percent_earned": 0.176, "effective_apy": 58.0},
    ]  # fmt: skip
    contracts = pl.DataFrame(
        [
            {
                "player": "QB",
                "team": "Bills",
                "is_active": True,
                "year_signed": 2025,
                "years": 6,
                "value": 330.0,
                "apy": 55.0,
                "guaranteed": 147.0,
                "apy_cap_pct": 0.197,
                "player_page": "https://example.test/qb",
                "otc_id": 1,
                "college": "Wyoming",
                "draft_year": 2018,
                "draft_round": 1,
                "draft_overall": 7,
                "draft_team": "Bills",
                "season_history": [s for s in EXTENSION if s["year"] != "Total"],
                "contract_history": history,
            }
        ]
    )
    players = pl.DataFrame(
        [
            {
                "gsis_id": "00-QB",
                "birth_date": "1996-05-21",
                "height": 77,
                "weight": 237,
                "college_name": "Wyoming",
                "jersey_number": "17",
                "years_of_experience": 9,
                "draft_year": 2018,
                "draft_round": 1,
                "draft_pick": 7,
                "draft_team": "BUF",
            }
        ]
    )
    return fact, contracts, players


def test_contract_details_put_the_deal_ledger_and_history_together():
    fact, contracts, players = _frames()
    [rec] = cd.contract_details(fact, contracts, players, 2026, {"Bills": "BUF"})
    assert rec["basis"] == "contract"
    assert rec["deal"]["type"] == "Extension"
    assert rec["deal"]["value"] == 330 * M and rec["deal"]["guaranteed"] == 147 * M
    assert rec["deal"]["last_season"] == 2030
    assert rec["deal"]["earned"] == 58 * M
    assert rec["release"]["season"] == 2027
    assert [h["signed"] for h in rec["history"]] == [2025, 2018]
    assert rec["bio"]["jersey"] == "17" and rec["bio"]["draft_team"] == "BUF"
    assert rec["years"][0]["season"] == 2025


def test_contract_details_without_a_contract_say_so():
    fact, contracts, players = _frames(cap_source="estimate_minimum")
    [rec] = cd.contract_details(fact, contracts, players, 2026, {"Bills": "BUF"})
    assert rec["basis"] == "minimum" and rec["deal"] is None and rec["years"] == []
    # A deal with no ledger for this season (a new rookie deal): terms only.
    fact, contracts, players = _frames()
    contracts = contracts.with_columns(
        pl.lit([], dtype=contracts.schema["season_history"]).alias("season_history")
    )
    [rec] = cd.contract_details(fact, contracts, players, 2026, {"Bills": "BUF"})
    assert rec["basis"] == "rookie_scale" and rec["years"] == [] and rec["release"] is None
    assert rec["deal"]["value"] == 330 * M and rec["deal"]["last_season"] == 2030
