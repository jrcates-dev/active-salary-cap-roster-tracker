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

## Status

Phases 0 and 1 are live, plus the matchup page (planned for Phase 3) and the weekly
history views. See the roadmap in `PLAN.md`.

## Data and attribution

Contract, roster, injury and schedule data come from [nflverse](https://github.com/nflverse/nflverse-data)
(CC BY 4.0). Contract figures in that dataset are sourced from
[OverTheCap](https://overthecap.com). This project does not scrape OverTheCap or Spotrac.
