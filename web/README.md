# web

Next.js (App Router) + TypeScript + Tailwind site for the salary cap tracker. Every page
is prerendered from one JSON snapshot; the site never calls an outside API at request
time.

```bash
pnpm install
pnpm dev
```

## Data

| File | What |
| --- | --- |
| `data/snapshot.json` | The real week snapshot, written by `captracker export` in `pipeline/`. Gitignored, so per-player contract data never enters git history |
| `data/fixture.json` | Synthetic data with the same shape (real team names, colors and schedule, fake players and dollars). Committed, used by CI and fresh clones |
| `public/data/totals.json` | Each team's counted total, written by `captracker export` and published with the site so the next run can flag day-over-day drift. Gitignored |

## Hosting

The site is a static export: `pnpm build` writes plain files to `out/`. Preview them
with any static server, for example `python3 -m http.server 3000 -d out`.

It is hosted on GitHub Pages at `https://jrcates-dev.github.io/active-salary-cap-roster-tracker/`.
The daily ingest workflow (`.github/workflows/ingest.yml`) fetches fresh data, exports
`snapshot.json` inside the run, builds with `PAGES_BASE_PATH=/<repo-name>`, and deploys
`out/` to Pages. The snapshot is never committed. A push to `main` redeploys the same way.

If the repository is ever made private again, Pages stops being free, so the workflow
switches to committing the snapshot to `main` for a host like Vercel to rebuild from.

`src/lib/data.ts` reads `snapshot.json` and falls back to `fixture.json`. When the
fixture is in use, a banner under the nav says so. The deploy sets `REQUIRE_SNAPSHOT=1`,
which turns the fallback off: a missing or fixture snapshot fails the build instead of
publishing fake numbers.

## Pages

| Route | What |
| --- | --- |
| `/` | League overview: totals, this week's games with their biggest edge, money out by team with a week picker, most expensive players out (this week, long-term or out for the season), the 32 × 13 heatmap, offense/defense split |
| `/team/[abbr]` | Team page: last result and this week's game, status source, cap summary and availability bar, $ / % toggle, position groups against the league median, treemap, week-by-week money out, sortable roster |
| `/matchup/[week-away-home]` | Matchup page for every game this week and next: edge summary, both teams' availability, mirrored bars per position matchup (on the field or full investment) with league ranks, key absences |
| `/methodology` | Sources and attribution, accounting rules, matchups, estimates, reconciliation table with known gaps |

## Layout

| Path | What |
| --- | --- |
| `src/lib/types.ts` | Shapes of the snapshot JSON |
| `src/lib/data.ts` | Snapshot loader and per-team and league helpers |
| `src/lib/format.ts` | Money, percent, date and label formatting |
| `src/lib/availability.ts` | Availability states (active, questionable, out this week, out long-term, out for season, practice squad, dead) and per-player helpers, usable from server pages |
| `src/lib/matchup.ts` | Position matchup pairs, group money, league ranks and edge picks |
| `src/design/tokens.ts` | Surfaces, the one-hue intensity ramp, unit marks, the inactive hatch, and `displayColor` (a team color that clears 3:1 on the dark panel) |
| `src/components/Availability.tsx` | The availability bar, swatches and legend used at every level |
| `src/components/Tip.tsx` | Tooltip: follows the mouse, opens on tap, and on keyboard focus |
| `src/components/team/` | Team page pieces: money mode toggle, group breakdown, treemap, week-by-week trend, player table |
| `src/components/league/` | League pieces: money-out board with week picker, players out, heatmap, offense share |
| `src/components/matchup/` | The mirrored matchup chart |

Scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`.
