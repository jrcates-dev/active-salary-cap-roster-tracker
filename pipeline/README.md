# pipeline

Python 3.12 + polars ingestion for the salary cap tracker. It pulls the free nflverse
releases, normalizes them into the data model in `PLAN.md`, rolls cap dollars up by
team, unit and position group, and reconciles each team's total against OverTheCap's
published team figures before anything is written.

No OverTheCap or Spotrac pages are fetched by this code. The reference totals used for
the reconciliation check are hand-entered in
`src/captracker/data/reference/otc_team_totals_<season>.csv`.

## Setup

```bash
cd pipeline
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
```

## Commands

```bash
captracker fetch                    # download nflverse files into data/raw/ (cached)
captracker check-contracts          # day-one check: what cap fields does the contracts file carry?
captracker build --season 2026      # contracts + rosters -> data/out/<season>/ (parquet + json)
captracker reconcile --season 2026  # compare team totals with the OTC reference; exit 1 if any team is off by >1%
captracker load --season 2026       # optional: write the snapshot to Postgres (needs DATABASE_URL)
pytest                              # position mapping, accounting rules, rollup on a fixture
```

## Layout

| Module | Job |
| --- | --- |
| `sources.py` | nflverse release URLs, download with local cache |
| `teams.py` | team abbreviations, nicknames and colors from nflverse `teams_colors_logos` |
| `positions.py` | the 13 position groups, 3 units, raw-label normalization and the hand-maintained override table |
| `contracts.py` | explode the contracts file's `season_history` into one cap row per player per season |
| `crosswalk.py` | player id crosswalk (gsis, otc, espn, pfr, sleeper) |
| `rosters.py` | weekly roster status + injury report -> `player_week_status` with the active / inactive / questionable flag |
| `rollup.py` | team -> unit -> position group totals, active and inactive dollars |
| `reconcile.py` | the 1% gate against the hand-entered OTC team totals |
| `snapshot.py` | write the week's snapshot to `data/out/` |
| `load.py` | optional Postgres load, matching the Drizzle schema in `web/src/db/schema.ts` |
| `cli.py` | command-line entry point |
