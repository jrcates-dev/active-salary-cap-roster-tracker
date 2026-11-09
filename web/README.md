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
| `data/snapshot.json` | The real week snapshot, written by `captracker export` in `pipeline/`. Gitignored, because the repo is public and the file holds per-player contract data |
| `data/fixture.json` | Synthetic data with the same shape (real team names and colors, fake players and dollars). Committed, used by CI and fresh clones |

`src/lib/data.ts` reads `snapshot.json` and falls back to `fixture.json`. When the
fixture is in use, a banner under the nav says so.

## Pages

| Route | What |
| --- | --- |
| `/` | League overview: totals, inactive money by team, most expensive players out, the 32 × 13 heatmap, offense/defense split |
| `/team/[abbr]` | Team page: cap summary and availability bar, $ / % toggle, position groups against the league median, treemap of every player, sortable roster |
| `/methodology` | Sources and attribution, accounting rules, estimates, reconciliation table |

## Layout

| Path | What |
| --- | --- |
| `src/lib/types.ts` | Shapes of the snapshot JSON |
| `src/lib/data.ts` | Snapshot loader and per-team and league helpers |
| `src/lib/format.ts` | Money, percent and label formatting |
| `src/design/tokens.ts` | Surfaces, the one-hue intensity ramp, unit marks, the inactive hatch, and `displayColor` (a team color that clears 3:1 on the dark panel) |
| `src/components/Availability.tsx` | The active / questionable / inactive / practice squad / dead money bar and legend used at every level |
| `src/components/Tip.tsx` | Pointer-following hover tooltip |
| `src/components/team/` | Team page pieces: money mode toggle, group breakdown, treemap, player table |
| `src/components/league/` | League pieces: inactive board, heatmap, offense share |
| `src/db/schema.ts` | Drizzle schema, matching the pipeline's parquet tables, for the optional Postgres load |

Scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm db:generate`,
`pnpm db:migrate`.
