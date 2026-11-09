# web

Next.js (App Router) + TypeScript + Tailwind site for the salary cap tracker. Reads from
Postgres through Drizzle; never calls an outside API at request time.

```bash
pnpm install
cp .env.example .env.local   # set DATABASE_URL (Neon)
pnpm dev
```

| Path | What |
| --- | --- |
| `src/db/schema.ts` | Drizzle schema. The contract between `pipeline/` and the site |
| `src/db/index.ts` | Lazily-created database client |
| `src/design/tokens.ts` | Design tokens: team colors, availability treatments, intensity ramp, unit marks, money formatting |
| `src/design/teams.json` | The 32 teams with colors, generated from the nflverse teams file |
| `src/components/AvailabilityBar.tsx` | Active / questionable / inactive / dead stacked bar used at every level |
| `src/components/HatchDefs.tsx` | SVG hatch pattern for inactive money |
| `drizzle.config.ts` | `pnpm drizzle-kit generate` writes migrations to `drizzle/` |

Scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm db:generate`, `pnpm db:migrate`.
