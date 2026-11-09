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
