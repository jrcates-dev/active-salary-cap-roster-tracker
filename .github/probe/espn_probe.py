"""Temporary probe: does ESPN's per-game roster flag gameday inactives before kickoff?

Polls today's NFL games every few minutes and prints, per team, how many players ESPN
marks inactive, plus the names the first time a list appears. Not part of the site.
"""

import json
import sys
import time
import urllib.request
from datetime import UTC, datetime

CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl"
SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
UA = {"User-Agent": "Mozilla/5.0 (compatible; cap-tracker-probe)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def now():
    return datetime.now(UTC).strftime("%H:%M:%S")


def roster(eid, tid):
    url = f"{CORE}/events/{eid}/competitions/{eid}/competitors/{tid}/roster?limit=200"
    return get(url)


def main(until_hhmm):
    deadline = datetime.now(UTC).replace(
        hour=int(until_hhmm[:2]), minute=int(until_hhmm[2:]), second=0
    )
    seen = {}
    first = True
    while True:
        sb = get(f"{SITE}/scoreboard")
        for ev in sb["events"]:
            comp = ev["competitions"][0]
            state = comp["status"]["type"]["state"]
            kick = ev["date"]
            if not kick.startswith(datetime.now(UTC).strftime("%Y-%m-%d")) and state == "pre" and not kick.startswith("2026-11-23T01"):
                continue
            if first:
                try:
                    summ = get(f"{SITE}/summary?event={ev['id']}")
                    print(f"SUMMARY_KEYS {ev['shortName']} {sorted(summ.keys())}")
                except Exception as exc:  # noqa: BLE001
                    print(f"SUMMARY_ERR {ev['shortName']} {exc}")
            parts = []
            for c in comp["competitors"]:
                abbr = c["team"]["abbreviation"]
                try:
                    r = roster(ev["id"], c["id"])
                except Exception as exc:  # noqa: BLE001
                    parts.append(f"{abbr} ERR {exc}")
                    continue
                entries = r.get("entries", [])
                if first and entries:
                    print(f"ENTRY_KEYS {sorted(entries[0].keys())}")
                    first = False
                ina = [e for e in entries if e.get("active") is False]
                dnp = [e for e in entries if e.get("didNotPlay")]
                parts.append(f"{abbr} n={len(entries)} inactive={len(ina)} dnp={len(dnp)}")
                key = (ev["id"], abbr)
                names = sorted((str(e.get("playerId")), e.get("displayName", "?")) for e in ina)
                if names and seen.get(key) != names:
                    seen[key] = names
                    for pid, nm in names:
                        print(f"INA {now()} {abbr} {pid} {nm}")
            print(f"POLL {now()} {ev['shortName']} kick={kick} state={state} | " + " | ".join(parts))
        sys.stdout.flush()
        if datetime.now(UTC) >= deadline:
            break
        time.sleep(300)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "2045")
