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
captracker reconcile --season 2026  # compare team totals with the OTC reference; exit 2 if a team is outside the gate
captracker export                   # web/data/snapshot.json (gitignored), totals.json and data/out/health.json
captracker export --previous-totals prev.json   # same, plus the day-over-day drift check
captracker export --fixture --out ../web/data/fixture.json   # synthetic copy, safe to commit
captracker health                   # print the health report; in GitHub Actions also annotations and a status output
pytest                              # position mapping, accounting rules, week handling, rollup on a fixture
```

The week defaults to the schedule's current week: the earliest regular-season week with a
game still to play. `--week N` (before the command) overrides it.

## Health checks

`export` writes `data/out/health.json` and the daily job publishes the site first, then
fails the run if a check failed (which emails the repo owner):

- **Stale sources** (error): the roster or injury file is more than a week behind the schedule.
- **Reconciliation** (error): a team is outside 1% of OverTheCap's total, or outside its own
  allowance in `data/reference/known_gaps_<season>.csv` (Baltimore and Indianapolis today).
- **Drift** (warning): a team's total moved more than 1% since the last published run.
- **Old reference** (warning): the hand-entered OverTheCap table is more than 30 days old.
  Refresh it at least monthly, and after the trade deadline and final cuts.

```bash
```

## Out for season

No free feed says an injury ends a season, so `rosters.season_outlook` splits reserve-list
money two ways:

- **Roster codes** (automatic): R48/R49 (designated for return) means coming back; a player
  who goes back to IR or PUP after a return window without being activated is out for the
  season by league rule.
- **`data/season_outlook_<season>.csv`** (by hand): one row per player reported out for the
  season (`out_for_season`) or confirmed coming back (`returning`), with an optional
  `from_week`, the injury as `note`, a `source` link and the `checked` date. The table wins
  over the roster codes. Rows for players back on the active roster are simply ignored.

Everyone else on a reserve list counts as able to come back. Refresh the table weekly from
injury news (a public IR tracker plus team announcements; never OverTheCap or Spotrac).

## Layout

| Module | Job |
| --- | --- |
| `sources.py` | nflverse release URLs, download with local cache |
| `teams.py` | team abbreviations, nicknames and colors from nflverse `teams_colors_logos` |
| `positions.py` | the 13 position groups, 3 units, raw-label normalization and the hand-maintained override table |
| `contracts.py` | explode the contracts file's `season_history` into one cap row per player per season; derive year-one cap for this season's rookie deals |
| `estimates.py` | minimum-salary estimates for rostered players with no contract row |
| `crosswalk.py` | player id crosswalk (gsis, otc, espn, pfr, sleeper), plus name matching for contracts without a `gsis_id` |
| `rosters.py` | weekly roster status + injury report + schedule -> `player_week_status` with the active / inactive / questionable flag and the absence type (this week, long-term, or out for the season); resolves Questionable once a game is final; projects rosters to the coming week |
| `depth.py` | starters from the daily nflverse (ESPN) depth chart: top of each slot on offense, defense, K, P and LS; a player out keeps the role he had before he went out |
| `rollup.py` | team -> unit -> position group totals: active, questionable, out this week, out long-term, out for season |
| `data/season_outlook_<season>.csv` | hand-kept table of reserve-list players done for the season (or confirmed coming back), with the injury and a news source; see "Out for season" below |
| `summary.py` | one row per team: availability totals, estimates, dead money and cap space |
| `reconcile.py` | the 1% gate against the hand-entered OTC team totals, with per-team allowances for known gaps |
| `health.py` | stale-source, reconciliation, drift and reference-age checks after each export |
| `export.py` | the compact JSON the site reads (current week, week-by-week team history, and who was out or questionable in each earlier week), and the synthetic fixture |
| `snapshot.py` | write the week's snapshot to `data/out/` |
| `cli.py` | command-line entry point |
