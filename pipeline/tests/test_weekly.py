"""Week handling: final games resolve Questionable, projection to the coming week,
this-week vs season-long vs out-for-season absences, the schedule-driven week, and health checks."""

from datetime import date

import polars as pl

from captracker import health, reconcile, rollup, rosters


def _games(rows):
    return pl.DataFrame(
        [
            {
                "game_id": f"2026_{w:02d}_{a}_{h}",
                "season": 2026,
                "game_type": "REG",
                "week": w,
                "gameday": "2026-11-08",
                "away_team": a,
                "home_team": h,
                "away_score": s,
                "home_score": s,
            }
            for w, a, h, s in rows
        ],
        schema_overrides={"away_score": pl.Int64, "home_score": pl.Int64},
    )


def test_questionable_resolves_once_the_game_is_final(rosters_df, injuries_df):
    # Week 8: the kicker was Questionable and the roster says ACT. Before the game he
    # is questionable; once the game is final he dressed, so he is active.
    pre = _games([(8, "GB", "NE", None), (9, "NE", "DET", None)])
    post = _games([(8, "GB", "NE", 20), (9, "NE", "DET", None)])
    k = lambda df: df.filter((pl.col("week") == 8) & (pl.col("gsis_id") == "00-K")).row(  # noqa: E731
        0, named=True
    )
    before = k(rosters.player_week_status(rosters_df, injuries_df, 2026, games=pre))
    after = k(rosters.player_week_status(rosters_df, injuries_df, 2026, games=post))
    assert before["gameday_flag"] == "questionable"
    assert after["gameday_flag"] == "active" and after["inactive_reason"] is None


def test_absence_types(rosters_df, injuries_df):
    status = rosters.player_week_status(rosters_df, injuries_df, 2026)
    wk9 = {r["gsis_id"]: r for r in status.filter(pl.col("week") == 9).iter_rows(named=True)}
    assert wk9["00-WR1"]["absence"] == "week"  # gameday inactive
    assert wk9["00-WR2"]["absence"] == "season"  # injured reserve
    assert wk9["00-QB"]["absence"] is None


def test_projection_to_the_coming_week(rosters_df, injuries_df):
    report = injuries_df.vstack(
        pl.DataFrame(
            [
                {
                    "season": 2026,
                    "week": 10,
                    "game_type": "REG",
                    "gsis_id": "00-QB",
                    "position": "QB",
                    "report_status": "Doubtful",
                    "practice_status": "Limited",
                    "report_primary_injury": "Ankle",
                }
            ]
        )
    )
    status = rosters.player_week_status(rosters_df, report, 2026, through_week=10)
    wk10 = {r["gsis_id"]: r for r in status.filter(pl.col("week") == 10).iter_rows(named=True)}
    assert all(r["projected"] for r in wk10.values())
    # Last week's gameday inactive is back on the active roster for the new week, but
    # he was ruled Out for that game and the team's statuses are out (the QB is
    # Doubtful) without him on it: he was cleared.
    assert wk10["00-WR1"]["roster_status"] == "ACT"
    assert wk10["00-WR1"]["gameday_flag"] == "active"
    # IR carries over; the new report attaches to the projected row.
    assert wk10["00-WR2"]["absence"] == "season"
    assert wk10["00-QB"]["gameday_flag"] == "inactive"
    assert wk10["00-QB"]["inactive_reason"] == "doubtful"
    assert wk10["00-QB"]["absence"] == "week"


def _report(week, gsis, status, practice="Did Not Participate"):
    return {
        "season": 2026,
        "week": week,
        "game_type": "REG",
        "gsis_id": gsis,
        "position": "WR",
        "report_status": status,
        "practice_status": practice,
        "report_primary_injury": "Knee",
    }


def _wr1_week10(rosters_df, injuries_df, extra, games=None):
    report = (
        injuries_df.vstack(pl.DataFrame(extra, schema=injuries_df.schema)) if extra else injuries_df
    )
    status = rosters.player_week_status(rosters_df, report, 2026, games=games, through_week=10)
    return status.filter((pl.col("week") == 10) & (pl.col("gsis_id") == "00-WR1")).row(
        0, named=True
    )


def test_out_last_game_stays_out_until_the_new_report(rosters_df, injuries_df):
    # WR1 was ruled Out for week 9 (not on IR). Before week 10's report he stays out.
    games = _games([(8, "GB", "NE", 20), (9, "NE", "DET", 17), (10, "NE", "MIA", None)])
    p = _wr1_week10(rosters_df, injuries_df, [], games)
    assert p["gameday_flag"] == "inactive"
    assert p["inactive_reason"] == "out_last_game"
    assert p["absence"] == "week"
    # Mid-week, on the practice report with no game status yet: still out.
    p = _wr1_week10(rosters_df, injuries_df, [_report(10, "00-WR1", None, "Limited")], games)
    assert p["inactive_reason"] == "out_last_game"
    # The new report lists him Questionable: he moves there.
    p = _wr1_week10(rosters_df, injuries_df, [_report(10, "00-WR1", "Questionable")], games)
    assert p["gameday_flag"] == "questionable" and p["inactive_reason"] is None
    # Ruled Out again: out, now for this week's report.
    p = _wr1_week10(rosters_df, injuries_df, [_report(10, "00-WR1", "Out")], games)
    assert p["gameday_flag"] == "inactive" and p["inactive_reason"] == "out"
    # The team's game statuses are out and he has none: cleared, active.
    p = _wr1_week10(rosters_df, injuries_df, [_report(10, "00-QB", "Questionable")], games)
    assert p["gameday_flag"] == "active" and p["inactive_reason"] is None
    # Once week 10 is played, the gameday inactive list decides.
    final = _games([(8, "GB", "NE", 20), (9, "NE", "DET", 17), (10, "NE", "MIA", 3)])
    assert _wr1_week10(rosters_df, injuries_df, [], final)["gameday_flag"] == "active"


def test_out_last_game_carries_over_a_bye(rosters_df, injuries_df):
    # Week 10 is NE's bye; week 11 still remembers he was ruled Out in week 9.
    games = _games([(8, "GB", "NE", 20), (9, "NE", "DET", 17), (11, "NE", "MIA", None)])
    status = rosters.player_week_status(rosters_df, injuries_df, 2026, games=games, through_week=10)
    wk10 = status.filter((pl.col("week") == 10) & (pl.col("gsis_id") == "00-WR1")).row(
        0, named=True
    )
    assert wk10["inactive_reason"] == "out_last_game"
    bye = rosters_df.filter(pl.col("week") == 9).with_columns(
        pl.lit(10, dtype=pl.Int64).alias("week"), pl.lit("ACT").alias("status")
    )
    status = rosters.player_week_status(
        pl.concat([rosters_df, bye]), injuries_df, 2026, games=games, through_week=11
    )
    wk11 = status.filter((pl.col("week") == 11) & (pl.col("gsis_id") == "00-WR1")).row(
        0, named=True
    )
    assert wk11["gameday_flag"] == "inactive" and wk11["inactive_reason"] == "out_last_game"


def _sat_week9(rosters_df, injuries_df, report_status, on_report=True):
    """The QB sat week 9 (INA) with the given report status; his week-10 row."""
    r = rosters_df.with_columns(
        pl.when((pl.col("week") == 9) & (pl.col("gsis_id") == "00-QB"))
        .then(pl.lit("INA"))
        .otherwise(pl.col("status"))
        .alias("status")
    )
    extra = [{**_report(9, "00-QB", report_status), "position": "QB"}] if on_report else []
    report = (
        injuries_df.vstack(pl.DataFrame(extra, schema=injuries_df.schema)) if extra else injuries_df
    )
    games = _games([(8, "GB", "NE", 20), (9, "NE", "DET", 17), (10, "NE", "MIA", None)])
    status = rosters.player_week_status(r, report, 2026, games=games, through_week=10)
    qb = status.filter(pl.col("gsis_id") == "00-QB")
    return {row["week"]: row for row in qb.iter_rows(named=True)}


def test_doubtful_or_questionable_and_sat_carries_over(rosters_df, injuries_df):
    for designation in ("Doubtful", "Questionable", None):
        weeks = _sat_week9(rosters_df, injuries_df, designation)
        assert weeks[9]["gameday_flag"] == "inactive"
        assert weeks[9]["inactive_reason"] == "inactive_list"
        assert weeks[10]["gameday_flag"] == "inactive", designation
        assert weeks[10]["inactive_reason"] == "out_last_game"


def test_healthy_scratch_counts_as_active(rosters_df, injuries_df):
    # Inactive in week 9 without being on the injury report: active that week, and
    # nothing to carry into week 10.
    weeks = _sat_week9(rosters_df, injuries_df, None, on_report=False)
    assert weeks[9]["roster_status"] == "INA"
    assert weeks[9]["gameday_flag"] == "active" and weeks[9]["inactive_reason"] is None
    assert weeks[9]["absence"] is None
    assert weeks[10]["gameday_flag"] == "active"


def test_played_or_on_ir_does_not_carry_over(rosters_df, injuries_df):
    # The kicker was Questionable in week 8 and played; the WR2 is on IR. Neither is
    # "out last game".
    games = _games([(8, "GB", "NE", 20), (9, "NE", "DET", None)])
    status = rosters.player_week_status(rosters_df, injuries_df, 2026, games=games)
    wk9 = {r["gsis_id"]: r for r in status.filter(pl.col("week") == 9).iter_rows(named=True)}
    assert wk9["00-K"]["gameday_flag"] == "active"
    assert wk9["00-WR2"]["inactive_reason"] == "injured_reserve"


def test_rollup_splits_inactive_money(contracts_df, teams_map, players_df, rosters_df, injuries_df):
    from captracker import contracts, crosswalk

    cy = contracts.with_player_key(contracts.contract_years(contracts_df, 2026, teams_map))
    grouped = rollup.assign_groups(cy, crosswalk.build_crosswalk(players_df, cy))
    status = rosters.player_week_status(rosters_df, injuries_df, 2026)
    roll = rollup.rollup(rollup.player_week_cap(grouped, status, 9))
    team = roll.filter(pl.col("level") == "team").row(0, named=True)
    assert team["cap_inactive_week"] == 20_000_000  # WR1, gameday inactive
    assert team["cap_inactive_season"] == 10_000_000  # WR2, injured reserve
    assert team["cap_inactive_year"] == 0
    assert team["cap_inactive"] == (
        team["cap_inactive_week"] + team["cap_inactive_season"] + team["cap_inactive_year"]
    )


def test_rollup_counts_out_for_season_money_apart(
    contracts_df, teams_map, players_df, rosters_df, injuries_df
):
    from captracker import contracts, crosswalk

    cy = contracts.with_player_key(contracts.contract_years(contracts_df, 2026, teams_map))
    grouped = rollup.assign_groups(cy, crosswalk.build_crosswalk(players_df, cy))
    table = pl.DataFrame(
        {"gsis_id": ["00-WR2"], "outlook": ["out_for_season"], "from_week": [None], "note": ["x"]},
        schema_overrides={"from_week": pl.Int32, "note": pl.String},
    )
    status = rosters.player_week_status(rosters_df, injuries_df, 2026, outlook=table)
    roll = rollup.rollup(rollup.player_week_cap(grouped, status, 9))
    team = roll.filter(pl.col("level") == "team").row(0, named=True)
    assert team["cap_inactive_season"] == 0
    assert team["cap_inactive_year"] == 10_000_000  # WR2, done for the year


def test_current_week_follows_the_schedule():
    games = _games([(8, "GB", "NE", 20), (9, "NE", "DET", 17), (9, "MIN", "BUF", None)])
    assert rosters.current_week(games, 2026) == 9  # Monday night still to play
    done = _games([(8, "GB", "NE", 20), (9, "NE", "DET", 17), (10, "NE", "NYJ", None)])
    assert rosters.current_week(done, 2026) == 10
    over = _games([(17, "GB", "NE", 20), (18, "NE", "DET", 17)])
    assert rosters.current_week(over, 2026) == 18


def test_known_gap_allowance():
    ref = pl.DataFrame(
        {
            "team": ["BAL", "NE"],
            "active_cap_spending": [100_000_000, 100_000_000],
            "dead_money": [0, 0],
            "players": [80, 80],
            "as_of": ["2026-11-09", "2026-11-09"],
        }
    )
    totals = pl.DataFrame(
        {"team": ["BAL", "NE"], "cap_total": [102_400_000, 102_400_000], "players": [80, 80]}
    )
    rep = reconcile.reconcile(totals, ref, 2026, known_gaps={"BAL": (0.03, "restructure")})
    by = {t.team: t for t in rep.teams}
    assert by["BAL"].ok and not by["NE"].ok


def test_health_checks():
    report = {
        "tolerance": 0.01,
        "reference_as_of": "2026-09-01",
        "teams": [
            {"team": "NE", "ok": True, "allowance": 0, "diff_pct": 0.001},
            {
                "team": "BAL",
                "ok": False,
                "allowance": 0.03,
                "diff_pct": 0.05,
                "nflverse_total": 105,
                "otc_active": 100,
            },
        ],
    }
    issues = health.evaluate(
        week=10,
        freshness={"roster_week": 7, "injury_week": 9},
        reconcile_report=report,
        totals={"NE": 103_000_000},
        previous={"teams": {"NE": 100_000_000}},
        today=date(2026, 11, 9),
    )
    titles = {(i.level, i.title) for i in issues}
    assert ("error", "Weekly rosters are stale") in titles
    assert not any(t == "Injury reports are stale" for _, t in titles)
    assert ("error", "BAL outside the reconciliation gate") in titles
    assert ("warning", "OverTheCap reference is getting old") in titles
    assert ("warning", "Team totals moved more than 1% since the last run") in titles


def _reserve_history(codes_by_player: dict[str, list[str]]) -> pl.DataFrame:
    """Status rows for a few players, one detail code per week from week 1."""
    rows = []
    for gid, codes in codes_by_player.items():
        for week, code in enumerate(codes, start=1):
            rows.append(
                {
                    "season": 2026,
                    "week": week,
                    "gsis_id": gid,
                    "roster_status_detail": code,
                    "absence": None if code == "A01" else "season",
                }
            )
    return pl.DataFrame(rows, schema_overrides={"week": pl.Int32, "absence": pl.String})


def _outlook_at(df: pl.DataFrame, week: int) -> dict[str, tuple]:
    return {
        r["gsis_id"]: (r["absence"], r["outlook_basis"])
        for r in df.filter(pl.col("week") == week).iter_rows(named=True)
    }


def test_out_for_season_from_roster_codes():
    status = _reserve_history(
        {
            "window_closed": ["A01", "R01", "R01", "R48", "R48", "R01"],
            "window_open": ["A01", "R01", "R01", "R48", "R48", "R48"],
            "back_then_hurt": ["R01", "R48", "A01", "A01", "R01", "R01"],
            "plain_ir": ["A01", "A01", "R01", "R01", "R01", "R01"],
            "pup": ["R04", "R04", "R04", "R04", "R04", "R04"],
            "healthy": ["A01"] * 6,
        }
    )
    wk6 = _outlook_at(rosters.season_outlook(status), 6)
    assert wk6["window_closed"] == ("year", "return_window_closed")
    assert wk6["window_open"] == ("season", "designated_for_return")
    # Activated in between, so the later IR stint is a new one with no signal.
    assert wk6["back_then_hurt"] == ("season", None)
    assert wk6["plain_ir"] == ("season", None)
    assert wk6["pup"] == ("season", None)
    assert wk6["healthy"] == (None, None)


def test_out_for_season_table_wins_from_its_week():
    status = _reserve_history(
        {
            "torn_acl": ["A01", "A01", "R01", "R01", "R01", "R01"],
            "comeback": ["A01", "R48", "R48", "R01", "R01", "R01"],
            "healthy": ["A01"] * 6,
        }
    )
    table = pl.DataFrame(
        {
            "gsis_id": ["torn_acl", "comeback", "healthy"],
            "outlook": ["out_for_season", "returning", "out_for_season"],
            "from_week": [5, None, None],
            "note": ["Torn ACL", "Expected back in December", "stale row"],
        },
        schema_overrides={"from_week": pl.Int32},
    )
    out = rosters.season_outlook(status, table)
    wk4, wk6 = _outlook_at(out, 4), _outlook_at(out, 6)
    assert wk4["torn_acl"] == ("season", None)  # before the row applies
    assert wk6["torn_acl"] == ("year", "table")
    assert wk6["comeback"] == ("season", "table")  # beats the closed return window
    assert wk6["healthy"] == (None, None)  # a table row never benches an active player
    note = out.filter((pl.col("week") == 6) & (pl.col("gsis_id") == "torn_acl"))["outlook_note"]
    assert note.to_list() == ["Torn ACL"]
    assert out.height == status.height


def test_season_outlook_table_loads():
    table = rosters.load_season_outlook(2026)
    assert table is not None and table.height > 0
    assert table["gsis_id"].is_unique().all()
    assert set(table["outlook"]) <= set(rosters.OUTLOOKS)


def test_export_carries_the_whole_regular_season():
    # The site's week picker previews any week, so every regular-season game is exported.
    from captracker import export

    games = _games([(w, "GB", "NE", 20 if w < 9 else None) for w in range(1, 20)])
    games = games.with_columns(
        pl.when(pl.col("week") == 19)
        .then(pl.lit("POST"))
        .otherwise("game_type")
        .alias("game_type"),
        pl.lit("13:00").alias("gametime"),
    )
    out = export._games(games, 2026)
    assert sorted({g["week"] for g in out}) == list(range(1, 19))
