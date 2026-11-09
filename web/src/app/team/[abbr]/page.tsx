import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AvailabilityBar, AvailabilityLegend, Swatch } from "@/components/Availability";
import { TeamChip } from "@/components/TeamChip";
import { GroupBreakdown, type GroupLine } from "@/components/team/GroupBreakdown";
import { Amount, MoneyModeProvider, MoneyToggle } from "@/components/team/MoneyMode";
import { PlayerTable } from "@/components/team/PlayerTable";
import { Treemap } from "@/components/team/Treemap";
import { displayColor } from "@/design/tokens";
import { getSnapshot, groupLeagueStats, teamGame, teamView } from "@/lib/data";
import { money, pct } from "@/lib/format";
import type { Snapshot } from "@/lib/types";

export async function generateStaticParams() {
  const s = await getSnapshot();
  return s.teams.map((t) => ({ abbr: t.team }));
}

export async function generateMetadata({ params }: { params: Promise<{ abbr: string }> }): Promise<Metadata> {
  const { abbr } = await params;
  const s = await getSnapshot();
  const t = s.teams.find((x) => x.team === abbr.toUpperCase());
  return { title: t ? `${t.name} cap · Week ${s.week}` : "Team not found" };
}

export default async function TeamPage({ params }: { params: Promise<{ abbr: string }> }) {
  const { abbr } = await params;
  const s = await getSnapshot();
  const view = teamView(s, abbr.toUpperCase());
  if (!view) notFound();
  const { team, summary, rollup, players } = view;
  const color = displayColor(team);
  const stats = groupLeagueStats(s);
  const lines: GroupLine[] = [...s.groups]
    .sort((a, b) => unitIndex(a.unit) - unitIndex(b.unit) || a.order - b.order)
    .map((g) => ({
      group: g,
      row: rollup.find((r) => r.level === "group" && r.position_group === g.code) ?? null,
      median: stats[g.code]?.median ?? 0,
      rank: stats[g.code]?.ranks[team.team] ?? 32,
    }));
  const unitRows = rollup.filter((r) => r.level === "unit");
  const base = summary.cap_total;

  return (
    <MoneyModeProvider base={base}>
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6">
        <header className="flex flex-wrap items-center gap-x-6 gap-y-4">
          {team.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo_url} alt="" width={72} height={72} className="h-16 w-16 sm:h-[72px] sm:w-[72px]" />
          )}
          <div>
            <p className="text-sm tracking-wider text-fg-muted uppercase">{team.division}</p>
            <h1 className="num text-4xl leading-none font-bold sm:text-5xl">{team.name}</h1>
          </div>
          <Games s={s} abbr={team.team} />
        </header>

        {summary.on_bye && (
          <p className="rounded-md border border-border bg-panel px-4 py-2 text-sm text-fg-muted">
            {team.nick} are on a bye in week {s.week}. Availability shows their week{" "}
            {summary.status_week} statuses.
          </p>
        )}

        <section aria-label="Cap summary" className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-fg-muted">Cap counted on the roster</p>
              <p className="num text-6xl leading-none font-bold">{money(summary.cap_total)}</p>
              <p className="mt-1 text-sm text-fg-muted">
                {summary.players} players
                {summary.ref_active_cap !== null && (
                  <>
                    {" "}
                    · OTC lists {money(summary.ref_active_cap)} (
                    {pct((summary.cap_total - summary.ref_active_cap) / summary.ref_active_cap)})
                  </>
                )}
              </p>
            </div>
            <MoneyToggle />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Inactive" swatch={<Swatch k="inactive" color={color} />}>
              <Amount value={summary.cap_inactive} />
            </Kpi>
            <Kpi label="Questionable" swatch={<Swatch k="questionable" color={color} />}>
              <Amount value={summary.cap_questionable} />
            </Kpi>
            <Kpi label="Dead money" swatch={<Swatch k="dead" color={color} />}>
              {summary.dead_money === null ? "–" : money(summary.dead_money)}
            </Kpi>
            <Kpi label="Cap space">{summary.cap_space === null ? "–" : money(summary.cap_space)}</Kpi>
          </div>
          <AvailabilityBar
            color={color}
            height={34}
            title={team.name}
            slices={{
              active: summary.cap_active,
              questionable: summary.cap_questionable,
              inactive: summary.cap_inactive,
              unknown: summary.cap_unknown,
              dead: summary.dead_money ?? 0,
            }}
          />
          <AvailabilityLegend color={color} keys={["active", "questionable", "inactive", "unknown", "dead"]} />
        </section>

        <section className="grid gap-10 lg:grid-cols-2">
          <div>
            <SectionTitle
              title="Position groups"
              note="Tick marks the league median. Rank is out of 32 by money spent."
            />
            <GroupBreakdown color={color} lines={lines} unitRows={unitRows} />
          </div>
          <div>
            <SectionTitle title="Every player, sized by cap number" note="Hover for details." />
            <Treemap color={color} groups={s.groups} players={players} teamTotal={base} />
          </div>
        </section>

        <section>
          <SectionTitle title="Roster" note={`Statuses as of week ${summary.status_week}.`} />
          <PlayerTable color={color} players={players} groups={s.groups} />
        </section>
      </main>
    </MoneyModeProvider>
  );
}

function unitIndex(u: string) {
  return u === "offense" ? 0 : u === "defense" ? 1 : 2;
}

function Kpi({ label, swatch, children }: { label: string; swatch?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        {swatch}
        {label}
      </p>
      <p className="num mt-1 text-3xl leading-none font-semibold">{children}</p>
    </div>
  );
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4">
      <h2 className="num text-2xl font-semibold">{title}</h2>
      {note && <p className="text-sm text-fg-muted">{note}</p>}
    </div>
  );
}

function Games({ s, abbr }: { s: Snapshot; abbr: string }) {
  const last = teamGame(s, abbr, s.week);
  const next = teamGame(s, abbr, s.week + 1);
  const colorOf = (t: string) => {
    const team = s.teams.find((x) => x.team === t);
    return team ? displayColor(team) : "#9aa3b5";
  };
  return (
    <div className="flex flex-wrap gap-3 sm:ml-auto">
      {last && (
        <div className="rounded-lg border border-border bg-panel px-4 py-2">
          <p className="text-xs text-fg-muted">Week {last.week}</p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-fg-muted">{last.home ? "vs" : "at"}</span>
            <TeamChip team={last.opponent} color={colorOf(last.opponent)} size="sm" />
            {last.played && (
              <span className="num text-lg">
                {last.us! > last.them! ? "W" : last.us! < last.them! ? "L" : "T"} {last.us}–{last.them}
              </span>
            )}
          </div>
        </div>
      )}
      {next && (
        <div className="rounded-lg border border-border bg-panel px-4 py-2">
          <p className="text-xs text-fg-muted">
            Next · {new Date(`${next.gameday}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-fg-muted">{next.home ? "vs" : "at"}</span>
            <TeamChip team={next.opponent} color={colorOf(next.opponent)} size="sm" />
          </div>
        </div>
      )}
    </div>
  );
}
