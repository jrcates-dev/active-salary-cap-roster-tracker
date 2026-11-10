import polars as pl

from captracker import contracts


def test_contract_years_explodes_one_season_in_whole_dollars(contracts_df, teams_map):
    cy = contracts.contract_years(contracts_df, 2026, teams_map)
    assert cy.height == 4  # 4 active players; inactive deal dropped; duplicate collapsed
    qb = cy.filter(pl.col("gsis_id") == "00-QB").row(0, named=True)
    assert qb["team"] == "NE"
    assert qb["cap_number"] == 40_000_000
    assert qb["base_salary"] == 1_000_000
    assert qb["contract_apy"] == 40_000_000
    # the "Total" pseudo-year and other seasons are filtered out
    assert set(cy["season"].to_list()) == {2026}


def test_traded_player_uses_season_history_team(contracts_df, teams_map):
    cy = contracts.contract_years(contracts_df, 2026, teams_map)
    wr1 = cy.filter(pl.col("gsis_id") == "00-WR1").row(0, named=True)
    assert wr1["contract_team_label"] == "NE/PHI"
    assert wr1["team"] == "NE"


def test_null_cap_rows_are_dropped(contracts_df, teams_map):
    cy = contracts.contract_years(contracts_df, 2027, teams_map)
    assert cy.height == 0


def test_unmapped_team_label_raises(contracts_df):
    try:
        contracts.contract_years(contracts_df, 2026, {"Bengals": "CIN"})
    except ValueError as exc:
        assert "Patriots" in str(exc)
    else:
        raise AssertionError("expected ValueError for unmapped team label")


def test_describe_cap_fields(contracts_df):
    info = contracts.describe_cap_fields(contracts_df, 2026)
    assert info["has_per_year_cap_number"] is True
    assert info["season_rows_with_cap_number"] == 5  # 4 unique active + 1 duplicate
    assert "2026" in info["seasons_present"]


def _hist(year, cap, cash, *, prorated=0.0, gtd=0.0, team="Dolphins"):
    return {
        "year": str(year),
        "team": team,
        "prorated_bonus": prorated,
        "guaranteed_salary": gtd,
        "cap_number": cap,
        "cash_paid": cash,
    }


def _outlook(history, team="Dolphins"):
    df = pl.DataFrame(
        [{"otc_id": 1, "is_active": True, "season_history": history}],
        schema={
            "otc_id": pl.Int32,
            "is_active": pl.Boolean,
            "season_history": pl.List(
                pl.Struct(
                    {
                        "year": pl.String,
                        "team": pl.String,
                        "prorated_bonus": pl.Float64,
                        "guaranteed_salary": pl.Float64,
                        "cap_number": pl.Float64,
                        "cash_paid": pl.Float64,
                    }
                )
            ),
        },
    )
    out = contracts.contract_outlook(df, 2026, {"Dolphins": "MIA", "Rams": "LA"})
    assert out.height == 1
    return out.row(0, named=True)


def test_outlook_averages_cash_left_and_spots_void_years():
    # Malik Willis's 2026 deal: a $22.3M signing bonus spread over 3 real + 2 void years.
    row = _outlook(
        [
            _hist(2025, 1.4, 1.4, team="Packers"),
            _hist(2026, 5.672, 23.5, prorated=4.457, gtd=1.215),
            _hist(2027, 25.957, 21.5, prorated=4.457, gtd=21.5),
            _hist(2028, 26.957, 22.5, prorated=4.457),
            _hist(2029, 8.914, 0.0, prorated=4.457),
            _hist(2030, 0.0, 0.0, prorated=4.457),
            _hist("Total", 72.0, 72.0, team="Total"),
        ]
    )
    assert row["team"] == "MIA"
    assert row["per_year"] == 22_500_000
    assert row["deal_thru"] == 2028
    assert row["gtd_thru"] == 2027
    # bonus still to come (4 x 4.457M) plus the guaranteed 2027 salary
    assert row["dead_if_cut"] == 4 * 4_457_000 + 21_500_000
    kinds = [(y["season"], y["kind"], y["gtd"]) for y in row["money_years"]]
    assert kinds == [
        (2026, "counted", True),
        (2027, "counted", True),
        (2028, "counted", False),
        (2029, "void", False),
    ]


def test_outlook_leaves_a_token_tail_season_out_of_the_average():
    # A $5M placeholder year after two $40M+ seasons is listed but not averaged.
    row = _outlook(
        [
            _hist(2026, 48.3, 40.0, team="Rams", gtd=40.0),
            _hist(2027, 31.6, 50.0, team="Rams", gtd=50.0),
            _hist(2028, 23.0, 5.0, team="Rams"),
        ],
        team="Rams",
    )
    assert row["per_year"] == 45_000_000
    assert row["deal_thru"] == 2027
    assert [y["kind"] for y in row["money_years"]] == ["counted", "counted", "token"]


def test_outlook_final_year_has_no_future_guarantee():
    row = _outlook([_hist(2026, 17.56, 17.56, gtd=17.56)])
    assert row["per_year"] == 17_560_000
    assert row["deal_thru"] == 2026
    assert row["gtd_thru"] is None
    assert row["dead_if_cut"] == 0
