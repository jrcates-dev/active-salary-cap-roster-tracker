"""Gameday inactive lists (ESPN, unofficial): when a list counts as posted, what the
document keeps between runs, and how a posted list settles the injury report."""

from datetime import UTC, datetime, timedelta

import polars as pl
import pytest

from captracker import gameday, rosters

# Week 11, MIA at BUF, 1 PM Eastern on Nov 22, 2026 = 18:00 UTC. Week 10 was each
# team's previous game.
KICKOFF = datetime(2026, 11, 22, 18, 0, tzinfo=UTC)


def _games(final: bool = False) -> pl.DataFrame:
    score = 20 if final else None
    return pl.DataFrame(
        [
            {
                "game_id": "2026_10_BUF_NYJ",
                "season": 2026,
                "game_type": "REG",
                "week": 10,
                "gameday": "2026-11-15",
                "gametime": "13:00",
                "away_team": "BUF",
                "home_team": "NYJ",
                "away_score": 24,
                "home_score": 10,
                "espn": 900,
            },
            {
                "game_id": "2026_10_MIA_NE",
                "season": 2026,
                "game_type": "REG",
                "week": 10,
                "gameday": "2026-11-15",
                "gametime": "13:00",
                "away_team": "MIA",
                "home_team": "NE",
                "away_score": 17,
                "home_score": 14,
                "espn": 901,
            },
            {
                "game_id": "2026_11_MIA_BUF",
                "season": 2026,
                "game_type": "REG",
                "week": 11,
                "gameday": "2026-11-22",
                "gametime": "13:00",
                "away_team": "MIA",
                "home_team": "BUF",
                "away_score": score,
                "home_score": score,
                "espn": 1000,
            },
        ],
        schema_overrides={"away_score": pl.Int64, "home_score": pl.Int64},
    )


PLAYERS = pl.DataFrame(
    {
        "gsis_id": ["00-B1", "00-B2", "00-B3", "00-B4", "00-M1", "00-M2"],
        "espn_id": ["1", "2", "3", "4", "11", "12"],
    }
)


class FakeEspn:
    """Answers the three ESPN calls `collect` makes, and counts them."""

    def __init__(self, today: dict[str, list[tuple[str, bool]]], last: dict[str, list[str]]):
        self.today = today  # team -> [(espn athlete id, didNotPlay)]
        self.last = last  # team -> last game's flagged ids
        self.calls: list[str] = []

    def __call__(self, url: str) -> dict:
        self.calls.append(url)
        team_ids = {"2": "BUF", "15": "MIA"}
        if "/scoreboard" in url:
            return {
                "events": [
                    {
                        "id": "1000",
                        "competitions": [
                            {
                                "competitors": [
                                    {"id": "2", "team": {"abbreviation": "BUF"}},
                                    {"id": "15", "team": {"abbreviation": "MIA"}},
                                ]
                            }
                        ],
                    }
                ]
            }
        team = team_ids[url.split("/competitors/")[1].split("/")[0]]
        if "/events/1000/" in url:
            rows = self.today[team]
            return {"entries": [{"playerId": int(i), "didNotPlay": f} for i, f in rows]}
        return {"entries": [{"playerId": int(i), "didNotPlay": True} for i in self.last[team]]}


def _espn(buf_today, mia_today=(("11", False), ("12", True)), buf_last=("1",), mia_last=("12",)):
    return FakeEspn(
        today={"BUF": list(buf_today), "MIA": list(mia_today)},
        last={"BUF": list(buf_last), "MIA": list(mia_last)},
    )


def _collect(now, espn, previous=None, final=False):
    return gameday.collect(
        games=_games(final),
        players=PLAYERS,
        season=2026,
        week=11,
        now=now,
        previous=previous,
        fetch=espn,
    )


def test_kickoff_is_read_as_eastern_time():
    assert gameday.kickoff_utc("2026-11-22", "13:00") == KICKOFF
    # Daylight saving time: 1 PM Eastern in September is 17:00 UTC.
    assert gameday.kickoff_utc("2026-09-13", "13:00").hour == 17


@pytest.mark.parametrize(
    ("minutes_before", "flagged", "last", "posted"),
    [
        (100, {"9"}, {"1"}, False),  # not due yet, whatever it holds
        (80, {"1"}, {"1"}, False),  # due, but still last game's list
        (80, {"1", "2"}, {"1"}, True),  # due, and names someone new
        (80, {"2"}, None, False),  # no last list to compare: wait
        (55, {"1"}, {"1"}, True),  # past kickoff minus 60: whatever it holds
    ],
)
def test_list_posted(minutes_before, flagged, last, posted):
    now = KICKOFF - timedelta(minutes=minutes_before)
    assert gameday.list_posted(now, KICKOFF, flagged, last) is posted


def test_nothing_is_read_before_the_window_opens():
    espn = _espn([("1", True)])
    doc = _collect(KICKOFF - timedelta(hours=3), espn)
    assert doc["games"] == [] and espn.calls == []


def test_a_new_list_is_read_and_mapped_to_nflverse_ids():
    # 80 minutes out: BUF's list names B2 (new since last game), MIA's is last game's.
    espn = _espn([("1", True), ("2", True), ("3", False), ("4", False), ("99", False)])
    doc = _collect(KICKOFF - timedelta(minutes=80), espn)
    (game,) = doc["games"]
    teams = {t["team"]: t for t in game["teams"]}
    assert teams["BUF"]["posted"] is True
    assert teams["BUF"]["inactive"] == ["00-B1", "00-B2"]
    assert teams["BUF"]["dressed"] == ["00-B3", "00-B4"]
    assert teams["BUF"]["unmapped"] == 1  # ESPN id 99 is in no players file
    assert teams["MIA"]["posted"] is False and teams["MIA"]["inactive"] == []
    assert game["frozen"] is False and game["kickoff"] == "2026-11-22T18:00:00Z"


def test_lists_freeze_at_kickoff():
    before = _collect(KICKOFF - timedelta(minutes=50), _espn([("2", True), ("3", False)]))
    # During the game ESPN's flags start to mean "has not played yet": keep the list.
    espn = _espn([("2", True), ("3", True)])
    during = _collect(KICKOFF + timedelta(minutes=30), espn, previous=before)
    assert espn.calls == []
    assert during["games"][0]["frozen"] is True
    assert gameday.lists_signature(during) == gameday.lists_signature(before)
    assert not gameday.changed(during, before)
    # Without a previous document the game is left to the injury report.
    assert _collect(KICKOFF + timedelta(minutes=30), espn)["games"] == []


def test_final_games_are_left_to_nflverse():
    espn = _espn([("2", True)])
    assert _collect(KICKOFF - timedelta(minutes=50), espn, final=True)["games"] == []


def test_changed_ignores_the_check_time():
    a = _collect(KICKOFF - timedelta(minutes=50), _espn([("2", True), ("3", False)]))
    b = _collect(KICKOFF - timedelta(minutes=40), _espn([("2", True), ("3", False)]))
    c = _collect(KICKOFF - timedelta(minutes=30), _espn([("2", True), ("3", True)]))
    assert not gameday.changed(b, a)
    assert gameday.changed(c, b)
    assert gameday.changed(a, None)


def test_an_espn_failure_keeps_the_last_document():
    before = _collect(KICKOFF - timedelta(minutes=50), _espn([("2", True)]))

    def broken(url: str) -> dict:
        if "/scoreboard" in url:
            return _espn([])(url)
        raise RuntimeError("could not fetch")

    after = _collect(KICKOFF - timedelta(minutes=40), broken, previous=before)
    assert gameday.lists_signature(after) == gameday.lists_signature(before)


def test_site_summary_says_which_lists_are_in():
    doc = _collect(KICKOFF - timedelta(minutes=80), _espn([("1", True), ("2", True)]))
    s = gameday.site_summary(doc)
    assert s["games"] == [
        {
            "game_id": "2026_11_MIA_BUF",
            "fetched_at": "2026-11-22T16:40:00Z",
            "posted": {"MIA": False, "BUF": True},
        }
    ]
    assert gameday.site_summary(None) is None


# --- How a posted list settles the injury report --------------------------------------


def _week11(final: bool = False):
    roster = pl.DataFrame(
        [
            {
                "season": 2026,
                "week": 11,
                "game_type": "REG",
                "team": "BUF",
                "gsis_id": gid,
                "full_name": gid,
                "position": "WR",
                "depth_chart_position": "WR",
                "status": status,
                "status_description_abbr": "A01",
            }
            for gid, status in [
                ("00-Q-SITS", "ACT"),
                ("00-Q-PLAYS", "ACT"),
                ("00-D-PLAYS", "ACT"),
                ("00-OUT", "ACT"),
                ("00-SCRATCH", "ACT"),
                ("00-Q-UNLISTED", "ACT"),
                ("00-IR", "RES"),
            ]
        ]
    )
    report = pl.DataFrame(
        [
            {
                "season": 2026,
                "week": 11,
                "game_type": "REG",
                "gsis_id": gid,
                "position": "WR",
                "report_status": status,
                "practice_status": "Limited",
                "report_primary_injury": "Knee",
            }
            for gid, status in [
                ("00-Q-SITS", "Questionable"),
                ("00-Q-PLAYS", "Questionable"),
                ("00-D-PLAYS", "Doubtful"),
                ("00-OUT", "Out"),
                ("00-Q-UNLISTED", "Questionable"),
            ]
        ]
    )
    lists = pl.DataFrame(
        {
            "week": [11] * 6,
            "team": ["BUF"] * 6,
            "gsis_id": ["00-Q-SITS", "00-SCRATCH", "00-Q-PLAYS", "00-D-PLAYS", "00-OUT", "00-IR"],
            "espn_inactive": [True, True, False, False, False, False],
        }
    )
    games = _games(final).with_columns(pl.col("week").cast(pl.Int64))
    status = rosters.player_week_status(roster, report, 2026, games=games, gameday=lists)
    return {r["gsis_id"]: r for r in status.iter_rows(named=True)}


def test_a_posted_list_settles_questionable_and_doubtful():
    s = _week11()
    # On the report and on the list: inactive for this game, from the gameday list.
    assert s["00-Q-SITS"]["gameday_flag"] == "inactive"
    assert s["00-Q-SITS"]["inactive_reason"] == rosters.GAMEDAY_INACTIVE
    assert s["00-Q-SITS"]["absence"] == "week"
    assert s["00-Q-SITS"]["flag_source"] == "gameday"
    # Listed and not flagged: dressing.
    for gid in ("00-Q-PLAYS", "00-D-PLAYS"):
        assert s[gid]["gameday_flag"] == "active" and s[gid]["inactive_reason"] is None
        assert s[gid]["flag_source"] == "gameday"


def test_a_posted_list_never_clears_out_or_reserve_and_keeps_scratches_active():
    s = _week11()
    assert s["00-OUT"]["gameday_flag"] == "inactive" and s["00-OUT"]["inactive_reason"] == "out"
    assert s["00-OUT"]["flag_source"] is None
    assert s["00-IR"]["inactive_reason"] == "injured_reserve"
    # Flagged without being on the report: a healthy scratch counts as active.
    assert s["00-SCRATCH"]["gameday_flag"] == "active" and s["00-SCRATCH"]["flag_source"] is None
    # Not on ESPN's list at all: the report still decides.
    assert s["00-Q-UNLISTED"]["gameday_flag"] == "questionable"


def test_the_list_stops_mattering_once_the_game_is_final():
    s = _week11(final=True)
    assert s["00-Q-SITS"]["gameday_flag"] == "active"  # the roster file's INA decides now
    assert s["00-Q-SITS"]["flag_source"] is None
