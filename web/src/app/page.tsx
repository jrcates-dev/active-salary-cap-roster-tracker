import Link from "next/link";
import { AvailabilityLegend, Swatch } from "@/components/Availability";
import { Heatmap, type HeatRow } from "@/components/league/Heatmap";
import { InactiveBoard } from "@/components/league/InactiveBoard";
import { OffenseShare } from "@/components/league/OffenseShare";
import { displayColor } from "@/design/tokens";
import { getSnapshot } from "@/lib/data";
import { money, pct, reasonLabel } from "@/lib/format";

export default async function LeaguePage() {
  const s = await getSnapshot();
  const sum = (k: "cap_total" | "cap_inactive" | "cap_questionable") =>
    s.summary.reduce((acc, t) => acc + t[k], 0);
  const total = sum("cap_total");
  const inactive = sum("cap_inactive");
  const questionable = sum("cap_questionable");
  const playersOut = s.players.filter((p) => p.flag === "inactive").length;
  const teamsById = Object.fromEntries(s.teams.map((t) => [t.team, t]));

  const groupsOrdered = [...s.groups].sort(
    (a, b) => unitIndex(a.unit) - unitIndex(b.unit) || a.order - b.order,
  );
  const heatRows: HeatRow[] = s.summary.map((t) => {
    const team = teamsById[t.team];
    const cells: HeatRow["cells"] = {};
    for (const r of s.rollup) {
      if (r.team === t.team && r.level === "group") {
        cells[r.position_group] = { cap: r.cap_total, inactive: r.cap_inactive };
      }
    }
    return { team: t.team, nick: team.nick, name: team.name, color: displayColor(team), total: t.cap_total, cells };
  });

  const biggestOut = s.players
    .filter((p) => p.flag === "inactive")
    .sort((a, b) => b.cap - a.cap)
    .slice(0, 10);

  return (
    <main className="mx-auto max-w-7xl space-y-14 px-4 py-8 sm:px-6">
      <section className="space-y-6">
        <div>
          <p className="text-sm tracking-wider text-fg-muted uppercase">
            {s.season} season · Week {s.week}
          </p>
          <h1 className="num mt-1 text-4xl leading-tight font-bold sm:text-5xl">
            Where the money is, and whether it&apos;s playing
          </h1>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Hero label="Cap counted across 32 rosters" value={money(total, 2)} />
          <Hero
            label={`Inactive this week · ${playersOut} players`}
            value={money(inactive)}
            sub={`${pct(inactive / total)} of all counted cap`}
            accent
          />
          <Hero label="Questionable or doubtful" value={money(questionable)} sub={`${pct(questionable / total)} of cap`} />
        </div>
      </section>

      <section className="grid gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <SectionTitle
            title="Inactive money, team by team"
            note="Each bar is a team's counted cap on one shared scale, split by this week's availability."
          />
          <div className="mb-4">
            <AvailabilityLegend color="#c9ced8" />
          </div>
          <InactiveBoard s={s} />
        </div>
        <div>
          <SectionTitle title="Most expensive players out" note={`Gameday inactive, reserve lists or ruled out, week ${s.week}.`} />
          <ol className="divide-y divide-border rounded-lg border border-border bg-panel">
            {biggestOut.map((p) => {
              const team = teamsById[p.team];
              const color = displayColor(team);
              return (
                <li key={p.key} className="flex items-center gap-3 px-4 py-2.5">
                  <Swatch k="inactive" color={color} size={14} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-fg-muted">
                      <Link href={`/team/${p.team}`} className="hover:underline">
                        {team.nick}
                      </Link>{" "}
                      · {p.group} · {reasonLabel(p.reason) ?? "Inactive"}
                      {p.injury ? ` · ${p.injury}` : ""}
                    </p>
                  </div>
                  <span className="num text-xl">{money(p.cap)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section>
        <SectionTitle
          title="How every team splits its cap"
          note="Shaded within each column against the rest of the league. Hover any cell for dollars and rank."
        />
        <Heatmap groups={groupsOrdered} rows={heatRows} />
      </section>

      <section className="max-w-3xl">
        <SectionTitle title="Offense or defense?" note="Share of counted cap by unit, most offense-heavy first." />
        <OffenseShare s={s} />
      </section>

      <p className="text-sm text-fg-faint">
        Pick a team above, or click any team name, for its full breakdown. How the numbers are built is on the{" "}
        <Link href="/methodology" className="text-fg-muted underline underline-offset-4 hover:text-fg">
          methodology page
        </Link>
        .
      </p>
    </main>
  );
}

function unitIndex(u: string) {
  return u === "offense" ? 0 : u === "defense" ? 1 : 2;
}

function Hero({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border bg-panel px-5 py-4 ${accent ? "border-[#ff7b1c]/50" : "border-border"}`}>
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="num mt-1 text-5xl leading-none font-bold">{value}</p>
      {sub && <p className="mt-1 text-sm text-fg-muted">{sub}</p>}
    </div>
  );
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4">
      <h2 className="num text-2xl font-semibold sm:text-3xl">{title}</h2>
      {note && <p className="text-sm text-fg-muted">{note}</p>}
    </div>
  );
}
