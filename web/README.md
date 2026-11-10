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
| `/` | League: the share of the cap that is active as the headline, on the tape (one league-wide availability bar with a figure per status under it), this week's games with their biggest edge as a ticker, money out by team with a week picker beside the most expensive players out, the 32 × 13 heatmap, offense/defense split |
| `/teams` | All 32 teams by division: counted cap and the availability bar on one dollar scale, each segment opening that roster |
| `/matchups` | Any week of the season: scores for played games, an early look at future ones |
| `/team/[abbr]` | Team: team strip for stepping sideways, last result and this week's game, counted cap and cap space with a $ / % toggle and the same tape as the league page (each figure opens those players), all on the team's band, position groups against the league median, player treemap, week-by-week money out, sortable roster |
| `/matchup/[week-away-home]` | Matchup: strip of the week's games, the scorebug (both teams, kickoff or score) with the two biggest edges as the headline, both teams' availability on one dollar scale (each segment opens that roster), mirrored bars per position matchup (on the field or full investment) with league ranks, key absences |
| `/methodology` | Sources and attribution, accounting rules, matchups, estimates, reconciliation table |

## Layout

| Path | What |
| --- | --- |
| `src/app/globals.css` | Design tokens: surfaces and inks for the light and dark themes (dark follows the system setting), the `.board` scope (the dark band at the top of every page, which carries the dark tokens in both themes), the display face, the amber intensity ramp, radii, motion, the `.tc` team-color scope and the `.s-*` availability fills |
| `src/design/tokens.ts` | Per-team color math: `teamVars` writes a light and a dark team color (each clearing 3:1 on its surface) and the ink that reads on it; `matchupVars` picks two teams' colors as a pair so they never look alike; unit marks; ramp step |
| `src/lib/types.ts` | Shapes of the snapshot JSON |
| `src/lib/data.ts` | Snapshot loader and per-team and league helpers |
| `src/lib/format.ts` | Money, percent, date and label formatting |
| `src/lib/viewState.ts` | `useViewState`: a toggle, tab, sort or zoomed group remembered for the visit (sessionStorage, per page), so Back returns to the same view |
| `src/lib/availability.ts` | Availability states (active, questionable, out this week, out long-term, out for season, practice squad, dead) and per-player helpers, usable from server pages |
| `src/lib/matchup.ts` | Position matchup pairs, group money, league ranks and edge picks |
| `src/components/site/` | Header with section links and the team switcher (the links move to `BottomTabs`, a tab bar at the bottom of a phone screen), footer, the strip used to step between teams or games, the scroll memory that puts each page back where it was left on Back and Forward, and the sticky section bar (breadcrumb plus a link to each section, the one in view marked) on the league, team and matchup pages |
| `src/components/ui/` | The hero band that opens every page (`Hero`, on the dark `.board` scope from globals.css), section heads, stat tile, segmented control, chips, step buttons |
| `src/components/Tape.tsx` | The tape: an availability bar with its ledger under it, one cell per money status, keyed by that status's fill |
| `src/components/Availability.tsx` | The segmented availability bar (thin in rows, tall with shares printed inside), swatches and legend |
| `src/components/Tip.tsx` | Tooltip: follows the mouse, opens on tap, and on keyboard focus |
| `src/components/Sort.tsx` | One sort pattern for every ranked list: column headers and legend chips |
| `src/components/team/` | Team page pieces: money mode toggle, group breakdown, treemap, week-by-week trend, player table |
| `src/components/league/` | League pieces: money-out board with week picker, players out, heatmap, offense share |
| `src/components/matchup/` | The mirrored matchup chart |

Scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`.
