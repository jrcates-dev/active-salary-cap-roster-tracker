"""Temporary probe: ESPN's didNotPlay lists for finished games, to check against nflverse INA."""

import json
import sys
import urllib.request

CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl"
SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
UA = {"User-Agent": "Mozilla/5.0 (compatible; cap-tracker-probe)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


for week in sys.argv[1:]:
    sb = get(f"{SITE}/scoreboard?seasontype=2&week={week}&dates=2026")
    for ev in sb["events"]:
        comp = ev["competitions"][0]
        if comp["status"]["type"]["state"] != "post":
            continue
        for c in comp["competitors"]:
            abbr = c["team"]["abbreviation"]
            try:
                r = get(f"{CORE}/events/{ev['id']}/competitions/{ev['id']}/competitors/{c['id']}/roster?limit=200")
            except Exception as exc:  # noqa: BLE001
                print(f"ERR {week} {abbr} {exc}")
                continue
            entries = r.get("entries", [])
            print(f"TEAM {week} {abbr} n={len(entries)}")
            for e in entries:
                if e.get("didNotPlay"):
                    print(f"DNP {week} {abbr} {e.get('playerId')}")
