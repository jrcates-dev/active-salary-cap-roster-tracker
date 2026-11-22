"""Temporary probe: which ESPN field marks gameday inactives before kickoff?

Prints, per game and team, how ESPN's per-game roster fields are distributed, one raw
entry, and the summary endpoint's keys. Loops when given a deadline. Not part of the site.
"""

import json
import sys
import time
import urllib.request
from collections import Counter
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


def describe(entries):
    out = []
    for field in ("active", "didNotPlay", "starter", "valid", "ejected"):
        c = Counter(str(e.get(field)) for e in entries)
        out.append(f"{field}={dict(c)}")
    return " ".join(out)


def one_pass(first):
    sb = get(f"{SITE}/scoreboard")
    for ev in sb["events"]:
        comp = ev["competitions"][0]
        state = comp["status"]["type"]["state"]
        if first:
            try:
                summ = get(f"{SITE}/summary?event={ev['id']}")
                print(f"SUMMARY_KEYS {ev['shortName']} {sorted(summ.keys())}")
                for k in ("injuries", "rosters", "inactives"):
                    if k in summ:
                        print(f"SUMMARY_{k.upper()} {ev['shortName']} {json.dumps(summ[k])[:1500]}")
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
            if first and entries:
                print(f"ROSTER_TOP_KEYS {sorted(r.keys())}")
                print(f"ENTRY_RAW {json.dumps(entries[0])[:1500]}")
                first = False
            print(f"POLL {now()} {ev['shortName']} kick={ev['date']} state={state} {abbr} n={len(entries)} {describe(entries)}")
    sys.stdout.flush()


def main(until_hhmm):
    deadline = datetime.now(UTC).replace(hour=int(until_hhmm[:2]), minute=int(until_hhmm[2:]), second=0)
    first = True
    while True:
        one_pass(first)
        first = False
        if datetime.now(UTC) >= deadline:
            break
        time.sleep(600)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "0000")
