import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AvailabilityBar, AvailabilityLegend, Swatch } from "@/components/Availability";
import { slicesOf } from "@/lib/availability";
import { TeamChip } from "@/components/TeamChip";
import { GroupBreakdown, type GroupLine } from "@/components/team/GroupBreakdown";
import { Amount, MoneyModeProvider, MoneyToggle } from "@/components/team/MoneyMode";
import { PlayerTable } from "@/components/team/PlayerTable";
import { TeamTrend } from "@/components/team/TeamTrend";
import { Treemap } from "@/components/team/Treemap";
import { displayColor } from "@/design/tokens";
import { getSnapshot, groupLeagueStats, kickoffLabel, matchupHref, teamGame, teamView } from "@/lib/data";
import { dayLabel, money, pct, SOURCE_LABEL } from "@/lib/format";
import type { Snapshot } from "@/lib/types";

/** Every team is prerendered; a static export has no server to render any other. */
export const dynamicParams = false;

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
  const asOf = summary.reference_as_of ? `as of ${dayLabel(summary.reference_as_of)}` : undefined;
  const trend = s.history.filter((h) => h.team === team.team && h.unit === "all");

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

        <StatusNote s={s} source={summary.status_source} onBye={summary.on_bye} nick={team.nick} />

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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Out this week" swatch={<Swatch k="inactive" color={color} />}>
              <Amount value={summary.cap_inactive_week} />
            </Kpi>
            <Kpi label="Questionable" swatch={<Swatch k="questionable" color={color} />}>
              <Amount value={summary.cap_questionable} />
            </Kpi>
            <Kpi label="Out long-term" swatch={<Swatch k="season" color={color} />}>
              <Amount value={summary.cap_inactive_season} />
            </Kpi>
            <Kpi label="Dead money" swatch={<Swatch k="dead" color={color} />} note={asOf}>
              {summary.dead_money === null ? "–" : money(summary.dead_money)}
            </Kpi>
            <Kpi label="Cap space" note={asOf}>
              {summary.cap_space === null ? "–" : money(summary.cap_space)}
            </Kpi>
          </div>
          <AvailabilityBar
            color={color}
            height={34}
            title={team.name}
            slices={{ ...slicesOf(summary), dead: summary.dead_money ?? 0 }}
          />
          <AvailabilityLegend color={color} keys={["active", "questionable", "inactive", "season", "unknown", "dead"]} />
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

        {trend.length > 1 && (
          <section className="max-w-3xl">
            <SectionTitle
              title="Money out, week by week"
              note="Long-term reserve money at the bottom, that week's absences on top. Past weeks use today's cap numbers."
            />
            <TeamTrend color={color} rows={trend} week={s.week} />
          </section>
        )}

        <section>
          <SectionTitle title="Roster" note={`Statuses for week ${s.week}.`} />
          <PlayerTable color={color} players={players} groups={s.groups} />
        </section>
      </main>
    </MoneyModeProvider>
  );
}

function unitIndex(u: string) {
  return u === "offense" ? 0 : u === "defense" ? 1 : 2;
}

function Kpi({
  label,
  swatch,
  note,
  children,
}: {
  label: string;
  swatch?: React.ReactNode;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel px-4 py-3">
      <p className="flex items-center gap-2 text-sm text-fg-muted">
        {swatch}
        {label}
      </p>
      <p className="num mt-1 text-3xl leading-none font-semibold">{children}</p>
      {note && <p className="mt-1 text-xs text-fg-faint">{note}</p>}
    </div>
  );
}

function StatusNote({
  s,
  source,
  onBye,
  nick,
}: {
  s: Snapshot;
  source: string | null;
  onBye: boolean;
  nick: string;
}) {
  if (!source && !onBye) return null;
  const text = onBye
    ? `${nick} are on a bye in week ${s.week}. Statuses carry over from their last game; the next injury report starts with week ${s.week + 1}.`
    : source === "final"
      ? `Week ${s.week} is final. Statuses are the official gameday inactives and reserve lists.`
      : source === "injury_report"
        ? `Before kickoff: statuses come from the week ${s.week} injury report. Questionable players count as on the field until they are ruled out.`
        : `Before kickoff: the week ${s.week} injury report is not out yet (it starts Wednesday), so only reserve lists count as out.`;
  return (
    <p className="rounded-md border border-border bg-panel px-4 py-2 text-sm text-fg-muted" title={source ? SOURCE_LABEL[source] : undefined}>
      {text}
    </p>
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
  const last = teamGame(s, abbr, s.week - 1);
  const now = teamGame(s, abbr, s.week);
  const next = now ? null : teamGame(s, abbr, s.week + 1);
  const colorOf = (t: string) => {
    const team = s.teams.find((x) => x.team === t);
    return team ? displayColor(team) : "#9aa3b5";
  };
  const result = (g: NonNullable<ReturnType<typeof teamGame>>) => (
    <span className="num text-lg">
      {g.us! > g.them! ? "W" : g.us! < g.them! ? "L" : "T"} {g.us}–{g.them}
    </span>
  );
  // `link` is false inside the matchup card, which is itself a link.
  const vs = (g: NonNullable<ReturnType<typeof teamGame>>, link = true) => (
    <>
      <span className="text-sm text-fg-muted">{g.home ? "vs" : "at"}</span>
      <TeamChip team={g.opponent} color={colorOf(g.opponent)} size="sm" href={link} />
    </>
  );
  const upcoming = now ?? next;
  return (
    <div className="flex flex-wrap gap-3 sm:ml-auto">
      {last && last.played && (
        <div className="rounded-lg border border-border bg-panel px-4 py-2">
          <p className="text-xs text-fg-muted">Week {last.week}</p>
          <div className="flex items-center gap-2">
            {vs(last)}
            {result(last)}
          </div>
        </div>
      )}
      {!now && (
        <div className="rounded-lg border border-border bg-panel px-4 py-2">
          <p className="text-xs text-fg-muted">Week {s.week}</p>
          <p className="num text-lg">Bye</p>
        </div>
      )}
      {upcoming && (
        <Link
          href={matchupHref(upcoming)}
          className="rounded-lg border border-fg-faint/60 bg-panel px-4 py-2 transition-colors hover:border-fg-muted"
        >
          <p className="text-xs text-fg-muted">
            Week {upcoming.week} · {upcoming.played ? "Final" : kickoffLabel(upcoming)}
          </p>
          <div className="flex items-center gap-2">
            {vs(upcoming, false)}
            {upcoming.played && result(upcoming)}
          </div>
          <p className="mt-0.5 text-xs text-fg">See the matchup →</p>
        </Link>
      )}
    </div>
  );
}
