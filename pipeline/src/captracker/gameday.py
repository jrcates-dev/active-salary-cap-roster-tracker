"""Gameday inactives before kickoff, from ESPN's per-game rosters (unofficial).

Teams post their inactives 90 minutes before kickoff, and no free, supported feed carries
them until nflverse adds the roster file's INA rows after the game. ESPN's game roster
(one per team per game) flags each inactive with `didNotPlay`. This module is the only
code that knows ESPN's shape; everything downstream reads the document it writes.

What the probes on Nov 22, 2026 showed (see the PR that added this module):
  - `didNotPlay` after games, Weeks 8 to 11: 545 of 547 official inactives flagged, plus
    players who dressed and never got on the field (which cannot happen before kickoff).
  - `active` is false for every player, before and after games: unusable.
  - The game roster lists everyone, practice squad and IR included, so "not flagged"
    does not mean "dressing" on its own.
  - Until a team's new list is posted, ESPN shows its last game's flagged players (minus
    anyone no longer on the roster). So a list counts as posted only once it is due
    (kickoff minus 90 minutes) and it names someone the last game's list did not; from
    kickoff minus 60 minutes it counts whatever it holds.

The document is kept between runs (published with the site as data/gameday.json). Lists
are frozen at kickoff: once a game starts, the last list seen before kickoff is carried
forward, because `didNotPlay` starts meaning "has not played yet" during the game.
"""

from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
import polars as pl

from .config import WEB_PUBLIC
from .teams import LEGACY_ABBR

log = logging.getLogger(__name__)

CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl"
SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
USER_AGENT = "Mozilla/5.0 (compatible; nfl-cap-tracker)"
EASTERN = ZoneInfo("America/New_York")  # nflverse schedule times are Eastern

WINDOW_OPENS = timedelta(minutes=95)  # start looking a little before lists are due
LIST_DUE = timedelta(minutes=90)
LIST_CERTAIN = timedelta(minutes=60)

DEFAULT_PATH = WEB_PUBLIC / "data" / "gameday.json"
SOURCE = "ESPN game rosters (unofficial)"

Fetch = Callable[[str], dict]


def http_fetch(url: str) -> dict:
    """GET a JSON document from ESPN, retrying network blips."""
    last: Exception | None = None
    for attempt in range(3):
        try:
            with httpx.Client(timeout=30, headers={"User-Agent": USER_AGENT}) as client:
                resp = client.get(url)
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPError as exc:
            last = exc
            time.sleep(2**attempt)
    raise RuntimeError(f"could not fetch {url}") from last


def kickoff_utc(gameday: str, gametime: str) -> datetime:
    """nflverse's gameday (YYYY-MM-DD) and gametime (HH:MM, Eastern) as a UTC time."""
    local = datetime.fromisoformat(f"{gameday}T{gametime}").replace(tzinfo=EASTERN)
    return local.astimezone(UTC)


def _iso(t: datetime) -> str:
    return t.astimezone(UTC).isoformat(timespec="seconds").replace("+00:00", "Z")


def _parse(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def week_games(games: pl.DataFrame, season: int, week: int) -> list[dict]:
    """The week's regular-season games with kickoff, final flag, ESPN id, and each
    team's previous game's ESPN id (for telling a new list from last game's)."""
    reg = games.filter(
        (pl.col("season") == season) & (pl.col("game_type") == "REG") & pl.col("espn").is_not_null()
    ).with_columns(
        pl.col("home_team").replace(LEGACY_ABBR),
        pl.col("away_team").replace(LEGACY_ABBR),
        pl.col("espn").cast(pl.Int64).cast(pl.String),
    )
    by_team = pl.concat(
        [
            reg.select("week", "gameday", pl.col(side).alias("team"), "espn")
            for side in ("home_team", "away_team")
        ]
    ).sort("week")
    out = []
    for g in reg.filter(pl.col("week") == week).iter_rows(named=True):
        prev = {}
        for team in (g["away_team"], g["home_team"]):
            earlier = by_team.filter((pl.col("team") == team) & (pl.col("week") < week))
            prev[team] = earlier["espn"][-1] if earlier.height else None
        out.append(
            {
                "game_id": g["game_id"],
                "espn_id": g["espn"],
                "teams": [g["away_team"], g["home_team"]],
                "kickoff": kickoff_utc(str(g["gameday"]), str(g["gametime"])),
                "final": g["away_score"] is not None and g["home_score"] is not None,
                "previous_espn_id": prev,
            }
        )
    return out


def list_posted(
    now: datetime, kickoff: datetime, flagged: set[str], last_game: set[str] | None
) -> bool:
    """Is a team's flagged list today's, rather than last game's carried forward?"""
    if now < kickoff - LIST_DUE:
        return False
    if now >= kickoff - LIST_CERTAIN:
        return True
    if last_game is None:
        return False
    return bool(flagged - last_game)


def _competitors(fetch: Fetch, season: int, week: int) -> dict[str, dict[str, str]]:
    """ESPN event id -> {team abbreviation: ESPN team id} for one week's games."""
    sb = fetch(f"{SITE}/scoreboard?seasontype=2&week={week}&dates={season}")
    out: dict[str, dict[str, str]] = {}
    for ev in sb.get("events", []):
        comp = ev["competitions"][0]
        out[str(ev["id"])] = {
            LEGACY_ABBR.get(c["team"]["abbreviation"], c["team"]["abbreviation"]): str(c["id"])
            for c in comp["competitors"]
        }
    return out


def _game_roster(fetch: Fetch, event_id: str, team_id: str) -> tuple[set[str], set[str]]:
    """(everyone listed, those flagged didNotPlay) as ESPN athlete ids."""
    url = f"{CORE}/events/{event_id}/competitions/{event_id}/competitors/{team_id}/roster?limit=200"
    entries = fetch(url).get("entries", [])
    listed = {str(e["playerId"]) for e in entries if e.get("playerId") is not None}
    flagged = {str(e["playerId"]) for e in entries if e.get("didNotPlay") and e.get("playerId")}
    return listed, flagged


def _espn_to_gsis(players: pl.DataFrame) -> dict[str, str]:
    p = players.filter(pl.col("espn_id").is_not_null() & pl.col("gsis_id").is_not_null())
    return dict(
        zip(
            p["espn_id"].cast(pl.String).str.replace(r"\.0$", "").to_list(),
            p["gsis_id"].to_list(),
            strict=True,
        )
    )


def _team_entry(
    fetch: Fetch,
    team: str,
    game: dict,
    teams_by_event: dict[str, dict[str, str]],
    ids: dict[str, str],
    now: datetime,
) -> dict:
    team_id = teams_by_event[game["espn_id"]][team]
    listed, flagged = _game_roster(fetch, game["espn_id"], team_id)
    # ESPN's competitor id is the team's id, the same in every game.
    last: set[str] | None = None
    prev_event = game["previous_espn_id"].get(team)
    if prev_event and now < game["kickoff"] - LIST_CERTAIN:
        try:
            _, last = _game_roster(fetch, prev_event, team_id)
        except RuntimeError as exc:  # no last list: wait for kickoff minus 60 instead
            log.warning("ESPN roster for %s's last game unavailable: %s", team, exc)
    posted = list_posted(now, game["kickoff"], flagged, last)
    mapped_flagged = sorted(ids[i] for i in flagged if i in ids)
    mapped_dressed = sorted(ids[i] for i in listed - flagged if i in ids)
    return {
        "team": team,
        "posted": posted,
        "inactive": mapped_flagged if posted else [],
        "dressed": mapped_dressed if posted else [],
        "unmapped": len({i for i in listed if i not in ids}),
    }


def collect(
    *,
    games: pl.DataFrame,
    players: pl.DataFrame,
    season: int,
    week: int,
    now: datetime,
    previous: dict | None = None,
    fetch: Fetch = http_fetch,
) -> dict:
    """The week's gameday document: per game, each team's posted list, if any.

    Games whose window is open and that have not kicked off are read live. Games under
    way keep the list from `previous` (the last document published), frozen at kickoff.
    Final games, and games whose window has not opened, are left out: the injury report
    and nflverse's official INA rows decide those.
    """
    prev_games = {}
    if previous and previous.get("season") == season and previous.get("week") == week:
        prev_games = {g["game_id"]: g for g in previous.get("games", [])}
    ids = _espn_to_gsis(players)
    teams_by_event: dict[str, dict[str, str]] | None = None
    out_games = []
    missing: list[str] = []  # games in their window that ESPN could not answer for
    for game in week_games(games, season, week):
        if game["final"] or now < game["kickoff"] - WINDOW_OPENS:
            continue
        if now >= game["kickoff"]:
            kept = prev_games.get(game["game_id"])
            if kept is not None:
                out_games.append({**kept, "frozen": True})
            continue
        if teams_by_event is None:
            try:
                teams_by_event = _competitors(fetch, season, week)
            except RuntimeError as exc:
                log.warning("ESPN scoreboard unavailable: %s", exc)
                teams_by_event = {}
        if game["espn_id"] not in teams_by_event:
            log.warning("ESPN scoreboard has no event %s (%s)", game["espn_id"], game["game_id"])
            missing.append(game["game_id"])
            kept = prev_games.get(game["game_id"])
            if kept is not None:
                out_games.append(kept)
            continue
        try:
            entries = [
                _team_entry(fetch, team, game, teams_by_event, ids, now) for team in game["teams"]
            ]
        except (RuntimeError, KeyError) as exc:
            log.warning("ESPN roster for %s unavailable: %s", game["game_id"], exc)
            missing.append(game["game_id"])
            kept = prev_games.get(game["game_id"])
            if kept is not None:
                out_games.append(kept)
            continue
        out_games.append(
            {
                "game_id": game["game_id"],
                "espn_id": game["espn_id"],
                "kickoff": _iso(game["kickoff"]),
                "fetched_at": _iso(now),
                "frozen": False,
                "teams": entries,
            }
        )
    return {
        "season": season,
        "week": week,
        "checked_at": _iso(now),
        "source": SOURCE,
        "games": out_games,
        "missing": missing,
    }


def lists_signature(doc: dict | None) -> list:
    """What a rebuild depends on: each game's teams, posted flags and lists."""
    if not doc:
        return []
    return sorted(
        (g["game_id"], t["team"], t["posted"], tuple(t["inactive"]), tuple(t["dressed"]))
        for g in doc.get("games", [])
        for t in g["teams"]
    )


def changed(doc: dict, previous: dict | None) -> bool:
    return lists_signature(doc) != lists_signature(previous)


def read(path: Path) -> dict | None:
    """A gameday document, or None if missing or unreadable."""
    try:
        raw = json.loads(Path(path).read_text())
    except (OSError, ValueError):
        return None
    return raw if isinstance(raw, dict) and isinstance(raw.get("games"), list) else None


def write(doc: dict, path: Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, indent=1))
    return path


def to_frame(doc: dict | None) -> pl.DataFrame:
    """One row per player on a posted list: week, team, gsis_id, espn_inactive."""
    schema = {
        "week": pl.Int32,
        "team": pl.String,
        "gsis_id": pl.String,
        "espn_inactive": pl.Boolean,
    }
    if not doc:
        return pl.DataFrame(schema=schema)
    rows = [
        {"week": doc["week"], "team": t["team"], "gsis_id": gid, "espn_inactive": flag}
        for g in doc.get("games", [])
        for t in g["teams"]
        if t["posted"]
        for gid, flag in [(i, True) for i in t["inactive"]] + [(d, False) for d in t["dressed"]]
    ]
    return pl.DataFrame(rows, schema=schema) if rows else pl.DataFrame(schema=schema)


def site_summary(doc: dict | None) -> dict | None:
    """The part of the document the site shows: per game, which lists are in, and when."""
    if not doc:
        return None
    return {
        "checked_at": doc["checked_at"],
        "source": doc.get("source", SOURCE),
        "games": [
            {
                "game_id": g["game_id"],
                "fetched_at": g["fetched_at"],
                "posted": {t["team"]: t["posted"] for t in g["teams"]},
            }
            for g in doc.get("games", [])
        ],
    }
