from datetime import date

import polars as pl

from captracker import reconcile


def _ref():
    return pl.DataFrame(
        {
            "team": ["NE", "GB"],
            "nick": ["Patriots", "Packers"],
            "cap_space": [5_000_000, 6_000_000],
            "active_cap_spending": [300_000_000, 250_000_000],
            "dead_money": [47_000_000, 48_000_000],
            "players": [79, 80],
            "source": ["hand", "hand"],
            "as_of": ["2026-11-09", "2026-11-09"],
        }
    )


def test_reconcile_flags_drift():
    totals = pl.DataFrame(
        {"team": ["NE", "GB"], "cap_total": [298_000_000, 240_000_000], "players": [66, 70]}
    )
    rep = reconcile.reconcile(totals, _ref(), 2026)
    by = {t.team: t for t in rep.teams}
    assert by["NE"].ok  # -0.67%
    assert not by["GB"].ok  # -4%
    assert by["GB"].diff == -10_000_000
    assert not rep.passed  # also only 2 of 32 teams present
    text = reconcile.format_report(rep)
    assert "FAIL" in text and "GB" in text


def test_missing_team_counts_as_zero():
    totals = pl.DataFrame({"team": ["NE"], "cap_total": [300_000_000], "players": [66]})
    rep = reconcile.reconcile(totals, _ref(), 2026)
    gb = next(t for t in rep.teams if t.team == "GB")
    assert gb.nflverse_total == 0 and not gb.ok


def test_dead_charges_reference_file():
    charges = reconcile.load_dead_charges(2026)
    assert charges, "the 2026 dead money file should load"
    ref = reconcile.load_reference(2026)
    teams = set(ref["team"].to_list())
    assert {c["team"] for c in charges} == teams
    assert all(c["amount"] > 0 and c["name"] for c in charges)
    # OTC itemizes charges of $100K and up, so a team's rows never top its total by much.
    listed: dict[str, int] = {}
    for c in charges:
        listed[c["team"]] = listed.get(c["team"], 0) + c["amount"]
    for row in ref.iter_rows(named=True):
        assert listed[row["team"]] <= row["dead_money"] * 1.02, row["team"]
    # Largest first within a team.
    ne = [c["amount"] for c in charges if c["team"] == "NE"]
    assert ne == sorted(ne, reverse=True)


def test_dead_charges_missing_season():
    assert reconcile.load_dead_charges(1999) == []


# --- The gate once the reference ages: roster moves and the freshness window. ---


def _totals_gb_off():
    return pl.DataFrame(
        {"team": ["NE", "GB"], "cap_total": [298_000_000, 240_000_000], "players": [66, 70]}
    )


def test_fresh_reference_without_moves_still_fails():
    rep = reconcile.reconcile(_totals_gb_off(), _ref(), 2026, today=date(2026, 11, 12))
    gb = next(t for t in rep.teams if t.team == "GB")
    assert not gb.ok and not gb.moved
    assert rep.reference_age_days == 3 and rep.reference_fresh


def test_team_with_roster_moves_is_reported_not_failed():
    moves = {"GB": ["Star Safety (to NE)"], "NE": ["Backup (cut)"]}
    rep = reconcile.reconcile(
        _totals_gb_off(), _ref(), 2026, moves=moves, since_week=9, today=date(2026, 11, 12)
    )
    by = {t.team: t for t in rep.teams}
    assert by["GB"].ok and by["GB"].moved and by["GB"].moves == ["Star Safety (to NE)"]
    # NE is within 1%, so its moves do not matter and are not listed.
    assert by["NE"].ok and not by["NE"].moved and by["NE"].moves == []
    assert rep.failing == [] and [t.team for t in rep.moved] == ["GB"]
    d = rep.to_dict()
    assert d["teams_moved"] == 1 and d["teams_failing"] == 0 and d["reference_week"] == 9
    assert "moved" in reconcile.format_report(rep)


def test_stale_reference_reports_every_gap_as_moved():
    # Two weeks on, extensions and restructures leave no trace in the roster file, so a
    # gap with no visible move is reported, not failed.
    rep = reconcile.reconcile(_totals_gb_off(), _ref(), 2026, today=date(2026, 11, 23))
    gb = next(t for t in rep.teams if t.team == "GB")
    assert gb.ok and gb.moved and gb.moves == []
    assert not rep.reference_fresh and rep.failing == []


def test_reference_week_from_as_of():
    games = pl.DataFrame(
        {
            "season": [2026] * 4,
            "game_type": ["REG"] * 4,
            "week": [9, 9, 10, 10],
            "gameday": ["2026-11-05", "2026-11-09", "2026-11-12", "2026-11-15"],
        }
    )
    assert reconcile.reference_week(games, 2026, date(2026, 11, 9)) == 9
    assert reconcile.reference_week(games, 2026, date(2026, 11, 12)) == 10
    assert reconcile.reference_week(games, 2026, date(2026, 9, 1)) is None


def _status(rows):
    return pl.DataFrame(
        [
            {"week": w, "team": t, "gsis_id": g, "player_name": n, "roster_status": s}
            for w, t, g, n, s in rows
        ],
        schema_overrides={"week": pl.Int32},
    )


def test_roster_moves_lists_trades_cuts_and_arrivals():
    status = _status(
        [
            (9, "ATL", "00-S", "Star Safety", "ACT"),
            (9, "ATL", "00-PS", "Practice Guy", "DEV"),
            (9, "NO", "00-LB", "Cut Linebacker", "ACT"),
            (9, "NO", "00-QB", "Steady Qb", "ACT"),
            (10, "JAX", "00-S", "Star Safety", "ACT"),
            (10, "ATL", "00-WR", "New Receiver", "ACT"),
            (10, "NO", "00-LB", "Cut Linebacker", "CUT"),
            (10, "NO", "00-QB", "Steady Qb", "ACT"),
            # ATL's practice squad player left, but he is too small to explain anything.
        ]
    )
    fact = pl.DataFrame(
        {
            "team": ["JAX", "ATL", "NO", "NO", "ATL"],
            "gsis_id": ["00-S", "00-WR", "00-LB", "00-QB", "00-PS"],
            # A traded player's cap row only holds his new team's share; his contract's
            # average per year sizes the move.
            "contract_cap_number": [650_000, 3_000_000, 5_190_000, 40_000_000, 247_500],
            "contract_apy": [16_000_000, 3_000_000, 10_500_000, 40_000_000, 247_500],
            "cap_number": [650_000, 3_000_000, 5_190_000, 40_000_000, 247_500],
            "counts_against_cap": [True, True, False, True, False],
        }
    )
    moves = reconcile.roster_moves(status, fact, since_week=9, week=10)
    assert moves["ATL"] == ["Star Safety (to JAX)", "New Receiver (added)"]
    # JAX only takes on what is left of his salary ($650K), too little to explain a gap.
    assert "JAX" not in moves
    assert moves["NO"] == ["Cut Linebacker (cut)"]
