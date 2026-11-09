import { AvailabilityBar } from "@/components/AvailabilityBar";
import { TEAMS, formatMoney, positionGroups, unitMark } from "@/design/tokens";

/**
 * Phase 0 placeholder: shows the design tokens (team colors, availability
 * treatments, unit marks) on real-looking numbers so the look can be judged
 * before the database and the team pages exist. Phase 1 replaces this with the
 * league overview.
 */
const SAMPLE = {
  NE: { active: 150_655_061, questionable: 60_088_529, inactive: 70_870_559, dead: 47_081_813 },
  GB: { active: 162_708_322, questionable: 7_166_668, inactive: 78_610_744, dead: 48_932_823 },
  MIA: { active: 60_000_000, questionable: 5_000_000, inactive: 25_584_564, dead: 190_078_227 },
};

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="mb-10">
        <p className="text-sm uppercase tracking-[0.2em] text-fg-muted">Phase 0 scaffold</p>
        <h1 className="num mt-2 text-5xl font-semibold">NFL Salary Cap Tracker</h1>
        <p className="mt-3 max-w-2xl text-fg-muted">
          Where each team&apos;s cap goes, by unit and position group, and how much of it is on
          the field this week. Numbers below are from the week 9 snapshot the pipeline built;
          the dead money column is the published team figure.
        </p>
      </header>

      <section className="mb-12">
        <h2 className="num mb-4 text-2xl font-semibold">Availability bars</h2>
        <div className="grid gap-4 rounded-md border border-border bg-panel p-6">
          {Object.entries(SAMPLE).map(([abbr, slices]) => {
            const t = TEAMS.find((x) => x.team === abbr)!;
            const total = slices.active + slices.questionable + slices.inactive + slices.dead;
            return (
              <div key={abbr} className="grid grid-cols-[120px_1fr_140px] items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 rounded-sm" style={{ background: t.color_primary }} />
                  <span className="num text-xl font-semibold">{t.nick}</span>
                </div>
                <AvailabilityBar team={abbr} color={t.color_primary} slices={slices} />
                <div className="num text-right text-lg">
                  <span className="text-fg-muted">{formatMoney(slices.inactive)} inactive</span>
                  <span className="block text-sm text-fg-faint">of {formatMoney(total)}</span>
                </div>
              </div>
            );
          })}
          <p className="mt-2 text-sm text-fg-faint">
            Solid = active · dashed outline = questionable · hatched = inactive · gray = dead money
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="num mb-4 text-2xl font-semibold">Position groups and unit marks</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(["offense", "defense", "special_teams"] as const).map((unit) => (
            <div key={unit} className="rounded-md border border-border bg-panel p-4">
              <div className="mb-3 flex items-center gap-2 text-fg-muted">
                <span aria-hidden>{unitMark[unit].glyph}</span>
                <span className="text-sm uppercase tracking-wider">{unitMark[unit].label}</span>
              </div>
              <ul className="space-y-1">
                {positionGroups
                  .filter((g) => g.unit === unit)
                  .map((g) => (
                    <li key={g.code} className="flex justify-between text-sm">
                      <span className="num text-base font-semibold">{g.code}</span>
                      <span className="text-fg-muted">{g.label}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="num mb-4 text-2xl font-semibold">Team colors</h2>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {TEAMS.map((t) => (
            <div
              key={t.team}
              className="num flex h-14 items-end rounded-sm p-2 text-sm font-semibold"
              style={{ background: t.color_primary, color: "#fff" }}
              title={t.name}
            >
              {t.team}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
