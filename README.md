# NFL Salary Cap Tracker

Where every NFL team's salary cap goes, by unit and position group, and how much of that
money is actually on the field each week. A stats site built on free, public data.

- **[PLAN.md](PLAN.md)**: vision, data sources, data model, views, design, stack and roadmap.
- **[docs/phase0-findings.md](docs/phase0-findings.md)**: what the day-one data check found.
- **[pipeline/](pipeline/)**: Python 3.12 + polars ingestion, run daily by GitHub Actions.
- **[web/](web/)**: Next.js + TypeScript + Tailwind site, exported as static pages to GitHub Pages.

## How the pieces fit

```
nflverse releases ──> pipeline/ (fetch, normalize, roll up, reconcile) ──> snapshot.json ──> web/ (static export) ──> GitHub Pages
                                     │
                                     ├─ data/out/<season>/week_NN/  (parquet snapshot, kept as a run artifact)
                                     └─ data/out/health.json        (stale sources, reconciliation, drift)
```

The web app never calls an outside API at request time. Every day at 07:30 UTC the
pipeline pulls the nflverse files, explodes contracts into per-season cap rows, tags each
dollar with the current week's roster and injury status, rolls everything up by team,
unit and position group, rebuilds earlier weeks for the trend views, and checks each
team's total against OverTheCap's published figure. The site is built from that one
snapshot and published to GitHub Pages; health checks run after it goes live.

On game days the site also picks up each team's inactive list, which teams post 90
minutes before kickoff, from ESPN's game rosters (unofficial; see
[pipeline/README.md](pipeline/README.md#gameday-inactives-unofficial)). That needs a run
every 10 minutes, set up below.

## Game-day refreshes

GitHub's own schedule has started the daily run 7 to 10 hours late, so an outside
scheduler starts the workflow instead. Each run reads the lists for games whose window is
open and stops in under a minute unless a list moved; then it rebuilds and redeploys. It
also rebuilds when the published site is more than 20 hours old, which keeps the daily
refresh on time too. One-time setup, about 15 minutes:

1. **A token that can only start this repo's workflows.** GitHub > Settings > Developer
   settings > Personal access tokens > Fine-grained tokens > Generate new token.
   - Repository access: *Only select repositories* > `active-salary-cap-roster-tracker`.
   - Repository permissions: *Actions* > **Read and write** (Metadata read-only is added
     for you). Nothing else.
   - Expiration: up to a year. Note the date; the game-day runs stop when it expires.
2. **The schedule.** Make a free account at [cron-job.org](https://cron-job.org) and
   create a cron job:
   - URL: `https://api.github.com/repos/jrcates-dev/active-salary-cap-roster-tracker/actions/workflows/ingest.yml/dispatches`
   - Schedule: every 10 minutes, every day, from 7 AM to 9 PM, time zone
     *America/New_York* (London games kick off at 9:30 AM ET; the last night game at
     8:20 PM).
   - Advanced > Request method: **POST**. Headers:
     - `Accept: application/vnd.github+json`
     - `Authorization: Bearer <the token>`
     - `X-GitHub-Api-Version: 2022-11-28`
     - `Content-Type: application/json`
   - Request body: `{"ref": "main", "inputs": {"mode": "gameday"}}`
3. **Check it.** GitHub answers `204 No Content` (cron-job.org's history shows it), and
   the Actions tab shows a *Daily ingest and deploy* run every 10 minutes. Its
   *gameday* job logs each game's lists and `rebuild=true|false`.

Turn the cron job off after the Super Bowl. Without it the site still updates once a day.

## Status

Phases 0 and 1 are live, plus the matchup page (planned for Phase 3) and the weekly
history views. See the roadmap in `PLAN.md`.

## Data and attribution

Contract, roster, injury and schedule data come from [nflverse](https://github.com/nflverse/nflverse-data)
(CC BY 4.0). Contract figures in that dataset are sourced from
[OverTheCap](https://overthecap.com). This project does not scrape OverTheCap or Spotrac.
