import polars as pl

from captracker import contracts, crosswalk, rollup, rosters


def _frames(contracts_df, players_df, rosters_df, injuries_df, teams_map, week):
    cy = contracts.contract_years(contracts_df, 2026, teams_map)
    cw = crosswalk.build_crosswalk(players_df, cy)
    status = rosters.player_week_status(rosters_df, injuries_df, 2026)
    grouped = rollup.assign_groups(cy, cw)
    fact = rollup.player_week_cap(grouped, status, week)
    return cy, cw, status, fact, rollup.rollup(fact)


def test_status_flags(rosters_df, injuries_df):
    status = rosters.player_week_status(rosters_df, injuries_df, 2026)
    wk9 = {r["gsis_id"]: r for r in status.filter(pl.col("week") == 9).iter_rows(named=True)}
    assert wk9["00-QB"]["gameday_flag"] == "active"
    assert wk9["00-WR1"]["gameday_flag"] == "inactive"
    assert wk9["00-WR1"]["inactive_reason"] == "inactive_list"  # roster INA beats report Out
    assert wk9["00-WR2"]["gameday_flag"] == "inactive"
    assert wk9["00-WR2"]["inactive_reason"] == "injured_reserve"
    wk8 = {r["gsis_id"]: r for r in status.filter(pl.col("week") == 8).iter_rows(named=True)}
    assert wk8["00-K"]["gameday_flag"] == "questionable"
    assert wk8["00-WR1"]["gameday_flag"] == "active"


def test_crosswalk_fills_otc_id_from_contracts(contracts_df, players_df, teams_map):
    cy = contracts.contract_years(contracts_df, 2026, teams_map)
    cw = crosswalk.build_crosswalk(players_df, cy)
    qb = cw.filter(pl.col("gsis_id") == "00-QB").row(0, named=True)
    assert qb["otc_id"] == 1
    assert qb["espn_id"] == 11


def test_rollup_week_nine(contracts_df, players_df, rosters_df, injuries_df, teams_map):
    _, _, _, fact, roll = _frames(contracts_df, players_df, rosters_df, injuries_df, teams_map, 9)
    team = roll.filter(pl.col("level") == "team").row(0, named=True)
    assert team["cap_total"] == 74_000_000
    assert team["cap_active"] == 44_000_000  # QB 40 + K 4
    assert team["cap_inactive"] == 30_000_000  # WR1 20 + WR2 10
    assert team["cap_questionable"] == 0

    wr = roll.filter((pl.col("level") == "group") & (pl.col("position_group") == "WR")).row(
        0, named=True
    )
    assert wr["unit"] == "offense"
    assert wr["cap_total"] == 30_000_000
    assert wr["cap_inactive"] == 30_000_000
    assert wr["players"] == 2

    offense = roll.filter((pl.col("level") == "unit") & (pl.col("unit") == "offense")).row(
        0, named=True
    )
    assert offense["cap_total"] == 70_000_000
    special = roll.filter((pl.col("level") == "unit") & (pl.col("unit") == "special_teams")).row(
        0, named=True
    )
    assert special["cap_total"] == 4_000_000


def test_rollup_week_eight_everyone_healthy(
    contracts_df, players_df, rosters_df, injuries_df, teams_map
):
    _, _, _, _, roll = _frames(contracts_df, players_df, rosters_df, injuries_df, teams_map, 8)
    team = roll.filter(pl.col("level") == "team").row(0, named=True)
    assert team["cap_active"] == 70_000_000
    assert team["cap_questionable"] == 4_000_000
    assert team["cap_inactive"] == 0


def test_player_without_roster_row_is_unknown(
    contracts_df, players_df, rosters_df, injuries_df, teams_map
):
    _, _, _, fact, roll = _frames(contracts_df, players_df, rosters_df, injuries_df, teams_map, 3)
    assert set(fact["gameday_flag"].to_list()) == {"unknown"}
    team = roll.filter(pl.col("level") == "team").row(0, named=True)
    assert team["cap_unknown"] == 74_000_000
