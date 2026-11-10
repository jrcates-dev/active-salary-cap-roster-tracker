import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AvailabilityBar, AvailabilityLegend } from "@/components/Availability";
import { Logo } from "@/components/Logo";
import { SectionNav } from "@/components/site/SectionNav";
import { Strip } from "@/components/site/Strip";
import { Tape } from "@/components/Tape";
import { TeamChip } from "@/components/TeamChip";
import { DeadMoney } from "@/components/team/DeadMoney";
import { GroupBreakdown, type GroupLine } from "@/components/team/GroupBreakdown";
import { Amount, MoneyModeProvider, MoneyToggle } from "@/components/team/MoneyMode";
import { PlayerTable } from "@/components/team/PlayerTable";
import { TeamTrend } from "@/components/team/TeamTrend";
import { Treemap } from "@/components/team/Treemap";
import { Hero, SectionHead, WRAP } from "@/components/ui";
import { teamVars, UNITS } from "@/design/tokens";
import { outOf, slicesOf } from "@/lib/availability";
import { getSnapshot, groupLeagueStats, kickoffLabel, matchupHref, teamGame, teamView } from "@/lib/data";
import { dayLabel, money, pct } from "@/lib/format";
import { deadHref, rosterHref, statusHrefs } from "@/lib/rosterLink";
import type { Snapshot, StatusSource } from "@/lib/types";

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
  return { title: t ? `${t.name} · Week ${s.week}` : "Team not found" };
}

export default async function TeamPage({ params }: { params: Promise<{ abbr: string }> }) {
  const { abbr } = await params;
  const s = await getSnapshot();
  const view = teamView(s, abbr.toUpperCase());
  if (!view) notFound();
  const { team, summary, rollup, players } = view;
  const vars = teamVars(team);
  const stats = groupLeagueStats(s);
  const lines: GroupLine[] = [...s.groups]
    .sort((a, b) => UNITS.indexOf(a.unit) - UNITS.indexOf(b.unit) || a.order - b.order)
    .map((g) => ({
      group: g,
      row: rollup.find((r) => r.level === "group" && r.position_group === g.code) ?? null,
      median: stats[g.code]?.median ?? 0,
      rank: stats[g.code]?.ranks[team.team] ?? 32,
    }));
  const unitRows = rollup.filter((r) => r.level === "unit");
  const base = summary.cap_total;
  const asOf = summary.reference_as_of && summary.reference_as_of !== "fixture" ? `as of ${dayLabel(summary.reference_as_of)}` : undefined;
  const trend = s.history.filter((h) => h.team === team.team && h.unit === "all");
  const pastOut = s.history_players.filter((h) => h.team === team.team);
  const weeks = [...new Set([...trend.map((h) => h.week), s.week])].sort((a, b) => a - b);
  const strip = [...s.teams]
    .sort((a, b) => a.division.localeCompare(b.division) || a.nick.localeCompare(b.nick))
    .map((t) => ({ key: t.team, href: `/team/${t.team}`, label: t.team, title: t.name, vars: teamVars(t), current: t.team === team.team }));

  return (
    <MoneyModeProvider base={base}>
      <div className="tc" style={vars}>
        <Hero team={vars} before={<Strip items={strip} label="Teams" />}>
          <header className="flex flex-wrap items-center gap-x-6 gap-y-5">
            {/* Logo and name stay on one line; only the game cards wrap below. */}
            <div className="flex min-w-0 items-center gap-4 sm:gap-6">
              <Logo src={team.logo_url} size={72} fallback={team.team} />
              <div className="min-w-0">
                <p className="eyebrow mb-1">{team.division}</p>
                <h1 className="display text-[36px] leading-[0.92] sm:text-[60px]">{team.name}</h1>
              </div>
            </div>
            <Games s={s} abbr={team.team} />
          </header>

          <section id="summary" aria-label="Cap summary" className="mt-8 scroll-mt-28 space-y-6">
            <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <p className="text-[13px] text-ink-2">Counted cap</p>
                <p className="fig text-[52px] leading-[0.95] sm:text-[68px]">{money(summary.cap_total)}</p>
              </div>
              <div>
                <p className="text-[13px] text-ink-2">Cap space{asOf ? `, ${asOf}` : ""}</p>
                <p className="fig text-[32px] leading-none text-ink-2 sm:text-[40px]">{summary.cap_space === null ? "–" : money(summary.cap_space)}</p>
              </div>
              <div className="flex min-w-0 basis-full items-center justify-between gap-4 pb-1 md:basis-auto md:flex-1">
              <p className="num min-w-0 text-[13px] text-ink-3">
                {summary.players} players
                {summary.ref_active_cap !== null && (
                  <> · OTC {money(summary.ref_active_cap)} ({pct((summary.cap_total - summary.ref_active_cap) / summary.ref_active_cap)})</>
                )}
                {" · "}
                <StatusWords s={s} source={summary.status_source} onBye={summary.on_bye} />
              </p>
                <MoneyToggle />
              </div>
            </div>
            {/* The same tape, in the same order, as the league page. */}
            <Tape
              bar={
                <AvailabilityBar
                  height={36}
                  labels
                  title={team.name}
                  subject={team.name}
                  slices={{ ...slicesOf(summary), dead: summary.dead_money ?? 0 }}
                  hrefs={{ ...statusHrefs(team.team), dead: deadHref(team.team) }}
                />
              }
              cells={[
                { k: "active", label: "Active", value: <Amount value={summary.cap_active} />, href: rosterHref(team.team, { status: "active" }) },
                { k: "questionable", label: "Questionable", value: <Amount value={summary.cap_questionable} />, href: rosterHref(team.team, { status: "questionable" }) },
                {
                  k: "inactive",
                  label: "Out",
                  value: <Amount value={outOf(summary)} />,
                  sub: summary.cap_inactive_season > 0 ? `${money(summary.cap_inactive_season)} on reserve` : undefined,
                  href: rosterHref(team.team, { status: "inactive" }),
                },
                { k: "year", label: "Out for season", value: <Amount value={summary.cap_inactive_year ?? 0} />, href: rosterHref(team.team, { status: "year" }) },
                { k: "unknown", label: "Practice squad", value: <Amount value={summary.cap_unknown} />, href: rosterHref(team.team, { status: "unknown" }) },
                { k: "dead", label: "Dead money", value: summary.dead_money === null ? "–" : money(summary.dead_money), sub: asOf, href: deadHref(team.team) },
              ]}
            />
          </section>
        </Hero>

        <SectionNav
          crumbs={[{ label: "League", href: "/" }, { label: team.division }, { label: team.nick, vars }]}
          items={[
            { id: "summary", label: "Summary" },
            { id: "groups", label: "Position groups" },
            { id: "players", label: "Players" },
            ...(trend.length > 1 ? [{ id: "by-week", label: "By week" }] : []),
            { id: "roster", label: "Roster" },
            { id: "dead-money", label: "Dead money" },
          ]}
        />


        <main className={`${WRAP} space-y-12 pt-8 pb-5 sm:pb-6`}>
          <section id="groups" className="scroll-mt-28">
            <SectionHead title="Position groups" aside={<span>Tick · league median. Rank of 32 by spend</span>} />
            <GroupBreakdown team={{ team: team.team, name: team.name }} lines={lines} unitRows={unitRows} />
          </section>

          <section id="players" className="scroll-mt-28">
            <SectionHead title="Players" aside={<span>Sized by cap number</span>} />
            <Treemap team={team.team} groups={s.groups} players={players} teamTotal={base} />
          </section>

          {trend.length > 1 && (
            <section id="by-week" className="max-w-3xl scroll-mt-28">
              <SectionHead title="Money out by week" />
              <TeamTrend team={team.team} rows={trend} week={s.week} />
              <div className="mt-3">
                <AvailabilityLegend keys={["questionable", "inactive", "year"]} short />
              </div>
            </section>
          )}

          <PlayerTable players={players} pastOut={pastOut} weeks={weeks} groups={s.groups} week={s.week} />

          <DeadMoney
            charges={s.dead_charges.filter((c) => c.team === team.team)}
            total={summary.dead_money}
            asOf={asOf}
          />
        </main>
      </div>
    </MoneyModeProvider>
  );
}

/** Where this week's statuses come from, in a few words. */
function StatusWords({ s, source, onBye }: { s: Snapshot; source: StatusSource | null; onBye: boolean }) {
  if (onBye) return <>Bye in week {s.week}, statuses from the last game</>;
  if (source === "final") return <>Week {s.week} final, gameday inactives</>;
  if (source === "injury_report") return <>Week {s.week} injury report</>;
  return <>Reserve lists only, week {s.week} report pending</>;
}

function Games({ s, abbr }: { s: Snapshot; abbr: string }) {
  const last = teamGame(s, abbr, s.week - 1);
  const now = teamGame(s, abbr, s.week);
  const next = now ? null : teamGame(s, abbr, s.week + 1);
  const varsOf = (t: string) => {
    const team = s.teams.find((x) => x.team === t);
    return team ? teamVars(team) : {};
  };
  const result = (g: NonNullable<ReturnType<typeof teamGame>>) => (
    <span className="num text-sm font-semibold">
      {g.us! > g.them! ? "W" : g.us! < g.them! ? "L" : "T"} {g.us}–{g.them}
    </span>
  );
  // `link` is false inside the matchup card, which is itself a link.
  const vs = (g: NonNullable<ReturnType<typeof teamGame>>, link = true) => (
    <>
      <span className="text-xs text-ink-3">{g.home ? "vs" : "at"}</span>
      <TeamChip team={g.opponent} vars={varsOf(g.opponent)} size="sm" href={link} />
    </>
  );
  const upcoming = now ?? next;
  return (
    <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto sm:flex-wrap [&>*]:min-w-0">
      {last && last.played && (
        <div className="card px-3.5 py-2">
          <p className="num text-[11px] text-ink-3">Week {last.week}</p>
          <div className="mt-0.5 flex items-center gap-2">
            {vs(last)}
            {result(last)}
          </div>
        </div>
      )}
      {!now && (
        <div className="card px-3.5 py-2">
          <p className="num text-[11px] text-ink-3">Week {s.week}</p>
          <p className="mt-0.5 text-sm font-medium">Bye</p>
        </div>
      )}
      {upcoming && (
        <Link href={matchupHref(upcoming)} className="card px-3.5 py-2 transition-colors duration-(--dur-1) hover:border-line-2">
          <p className="num text-[11px] text-ink-3">
            Week {upcoming.week} · {upcoming.played ? "Final" : kickoffLabel(upcoming)}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            {vs(upcoming, false)}
            {upcoming.played && result(upcoming)}
            <span className="ml-1 text-xs font-medium text-ink-2">Matchup →</span>
          </div>
        </Link>
      )}
    </div>
  );
}
