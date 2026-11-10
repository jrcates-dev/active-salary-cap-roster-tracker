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
