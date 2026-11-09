# NFL Salary Cap Tracker

Where every NFL team's salary cap goes, by unit and position group, and how much of that
money is actually on the field each week. A stats site built on free, public data.

- **[PLAN.md](PLAN.md)**: vision, data sources, data model, views, design, stack and roadmap.
- **[docs/phase0-findings.md](docs/phase0-findings.md)**: what the day-one data check found.
- **[pipeline/](pipeline/)**: Python 3.12 + polars ingestion, run daily by GitHub Actions.
- **[web/](web/)**: Next.js + TypeScript + Tailwind site, Drizzle schema over Postgres (Neon).

## How the pieces fit

```
nflverse releases ──> pipeline/ (fetch, normalize, roll up, reconcile) ──> Postgres ──> web/
                                     │
                                     └─ data/out/<season>/week_NN/  (parquet + json snapshot)
```

The web app never calls an outside API at request time. The pipeline pulls the nflverse
files, explodes contracts into per-season cap rows, tags each dollar with that week's
roster and injury status, rolls everything up by team, unit and position group, and
checks each team's total against OverTheCap's published figure before writing.

## Status

Phase 0 (foundation). See the roadmap in `PLAN.md`.

## Data and attribution

Contract, roster, injury and schedule data come from [nflverse](https://github.com/nflverse/nflverse-data)
(CC BY 4.0). Contract figures in that dataset are sourced from
[OverTheCap](https://overthecap.com). This project does not scrape OverTheCap or Spotrac.
