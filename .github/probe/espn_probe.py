"""Temporary probe: which ESPN field marks gameday inactives before kickoff?

Waits until a given UTC time, then prints one pass over today's games: per team, who
ESPN marks didNotPlay on its game roster, and the summary endpoint's injury entries.
Not part of the site.
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


def one_pass():
    sb = get(f"{SITE}/scoreboard")
    for ev in sb["events"]:
        comp = ev["competitions"][0]
        state = comp["status"]["type"]["state"]
        if state == "post":
            continue
        try:
            summ = get(f"{SITE}/summary?event={ev['id']}")
            for t in summ.get("injuries", []):
                abbr = t["team"]["abbreviation"]
                for i in t.get("injuries", []):
                    a = i.get("athlete", {})
                    print(f"INJ {now()} {abbr} {a.get('id')} {a.get('fullName')} | {i.get('status')} | {i.get('date')} | type={json.dumps(i.get('type'))[:80]}")
        except Exception as exc:  # noqa: BLE001
            print(f"SUMMARY_ERR {ev['shortName']} {exc}")
        for c in comp["competitors"]:
            abbr = c["team"]["abbreviation"]
            try:
                r = get(f"{CORE}/events/{ev['id']}/competitions/{ev['id']}/competitors/{c['id']}/roster?limit=200")
            except Exception as exc:  # noqa: BLE001
                print(f"ROSTER_ERR {ev['shortName']} {abbr} {exc}")
                continue
            entries = r.get("entries", [])
            dnp = [e for e in entries if e.get("didNotPlay")]
            print(f"POLL {now()} {ev['shortName']} kick={ev['date']} state={state} {abbr} n={len(entries)} dnp={len(dnp)}")
            for e in dnp:
                print(f"DNP {now()} {abbr} {e.get('playerId')} {e.get('displayName')} valid={e.get('valid')} starter={e.get('starter')}")
    sys.stdout.flush()


def main(at_hhmm):
    target = datetime.now(UTC).replace(hour=int(at_hhmm[:2]), minute=int(at_hhmm[2:]), second=0)
    wait = (target - datetime.now(UTC)).total_seconds()
    if wait > 0:
        print(f"waiting {wait:.0f}s until {target.isoformat()}")
        sys.stdout.flush()
        time.sleep(wait)
    one_pass()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "0000")
