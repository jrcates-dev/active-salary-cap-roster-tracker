"""Starters from the depth chart: top of a slot starts, return roles do not, and a
player who is out keeps the role he had before he went out."""

import polars as pl

from captracker import depth


def _chart(rows):
    """rows: (date, team, gsis_id, pos_grp, pos_slot, pos_abb, pos_rank)"""
    return pl.DataFrame(
        [
            {
                "dt": f"{d}T17:00:00Z",
                "team": t,
                "player_name": g,
                "espn_id": None,
                "gsis_id": g,
                "pos_grp_id": None,
                "pos_grp": grp,
                "pos_id": None,
                "pos_name": None,
                "pos_abb": abb,
                "pos_slot": slot,
                "pos_rank": rank,
            }
            for d, t, g, grp, slot, abb, rank in rows
        ],
        schema_overrides={"pos_slot": pl.Int32, "pos_rank": pl.Int32, "espn_id": pl.String},
    )


OFF = "3WR 1TE"
ST = "Special Teams"


def _roles(chart):
    return {
        r["gsis_id"]: (r["starter"], r["depth_role"])
        for r in depth.player_roles(depth.chart_entries(chart)).iter_rows(named=True)
    }


def test_top_of_each_slot_starts_and_ranks_run_across_slots():
    d = "2026-11-01"
    chart = _chart(
        [
            # Three WR slots: ranks run across them, so WR1-3 start and WR4 does not.
            (d, "NE", "wr1", OFF, 1, "WR", 1),
            (d, "NE", "wr4", OFF, 1, "WR", 4),
            (d, "NE", "wr2", OFF, 2, "WR", 2),
            (d, "NE", "wr3", OFF, 8, "WR", 3),
            (d, "NE", "fb", OFF, 12, "FB", 1),
            (d, "NE", "qb1", OFF, 9, "QB", 1),
            (d, "NE", "qb2", OFF, 9, "QB", 2),
            # A backup receiver who returns kicks: his role is WR4, not KR1.
            (d, "NE", "wr4", ST, 5, "KR", 1),
            (d, "NE", "k", ST, 1, "PK", 1),
        ]
    )
    roles = _roles(chart)
    assert roles["wr1"] == (True, "WR1")
    assert roles["wr2"] == (True, "WR2")
    assert roles["wr3"] == (True, "WR3")
    assert roles["wr4"] == (False, "WR4")
    assert roles["fb"] == (False, "FB1")
    assert roles["qb2"] == (False, "QB2")
    assert roles["k"] == (True, "PK1")


def _games():
    return pl.DataFrame(
        [
            {
                "game_id": f"2026_{w:02d}",
                "season": 2026,
                "game_type": "REG",
                "week": w,
                "gameday": day,
                "away_team": "NE",
                "home_team": "GB",
                "away_score": s,
                "home_score": s,
            }
            for w, day, s in [(1, "2026-09-13", 1), (2, "2026-09-20", 1), (3, "2026-09-27", None)]
        ],
        schema_overrides={"away_score": pl.Int64, "home_score": pl.Int64},
    )


def _status(rows):
    """rows: (week, gsis_id, flag)"""
    return pl.DataFrame(
        [{"week": w, "team": "NE", "gsis_id": g, "gameday_flag": f} for w, g, f in rows],
        schema_overrides={"week": pl.Int32},
    )


def test_a_player_out_keeps_the_role_he_had_before_he_went_out():
    chart = _chart(
        [
            # Through week 2 the starter is "lt"; after his injury ESPN moves him down.
            ("2026-09-12", "NE", "lt", OFF, 3, "LT", 1),
            ("2026-09-12", "NE", "swing", OFF, 3, "LT", 2),
            ("2026-09-20", "NE", "lt", OFF, 3, "LT", 1),
            ("2026-09-20", "NE", "swing", OFF, 3, "LT", 2),
            ("2026-09-24", "NE", "swing", OFF, 3, "LT", 1),
            ("2026-09-24", "NE", "lt", OFF, 3, "LT", 3),
            # Out from week 1: he started in camp, then went down the chart at the
            # cutdown, so he still counts as a starter.
            ("2026-08-01", "NE", "pup", OFF, 7, "RT", 1),
            ("2026-08-01", "NE", "rt", OFF, 7, "RT", 2),
            ("2026-09-12", "NE", "rt", OFF, 7, "RT", 1),
            ("2026-09-12", "NE", "pup", OFF, 7, "RT", 2),
            # Out from week 1 and a backup all camp: not a starter.
            ("2026-08-01", "NE", "ir", OFF, 4, "LG", 2),
            ("2026-09-12", "NE", "ir", OFF, 4, "LG", 3),
            ("2026-08-01", "NE", "lg", OFF, 4, "LG", 1),
            ("2026-09-12", "NE", "lg", OFF, 4, "LG", 1),
            ("2026-09-12", "NE", "rg", OFF, 6, "RG", 1),
            # A starter last season, long before camp: that does not count.
            ("2026-03-01", "NE", "old", OFF, 6, "RG", 1),
            ("2026-09-12", "NE", "old", OFF, 6, "RG", 3),
            ("2026-09-24", "NE", "rt", OFF, 7, "RT", 1),
            ("2026-09-24", "NE", "pup", OFF, 7, "RT", 2),
        ]
    )
    status = _status(
        [
            (1, "lt", "active"),
            (2, "lt", "active"),
            (3, "lt", "inactive"),
            (1, "swing", "active"),
            (2, "swing", "active"),
            (3, "swing", "active"),
            (1, "pup", "inactive"),
            (2, "pup", "inactive"),
            (3, "pup", "inactive"),
            (3, "rt", "active"),
            (1, "ir", "inactive"),
            (3, "ir", "inactive"),
            (1, "old", "inactive"),
            (3, "old", "inactive"),
        ]
    )
    out = depth.week_roles(chart, status, _games(), 2026, 3)
    got = {r["gsis_id"]: (r["starter"], r["depth_role"]) for r in out.iter_rows(named=True)}
    assert got["lt"] == (True, "LT1")  # chart from his last game, week 2
    assert got["swing"] == (True, "LT1")  # available: this week's chart
    assert got["pup"] == (True, "RT1")  # out all season: started in camp
    assert got["rt"] == (True, "RT1")
    assert got["ir"] == (False, "LG3")
    assert got["old"] == (False, "RG3")
