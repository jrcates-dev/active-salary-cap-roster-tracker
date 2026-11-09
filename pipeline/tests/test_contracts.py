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
