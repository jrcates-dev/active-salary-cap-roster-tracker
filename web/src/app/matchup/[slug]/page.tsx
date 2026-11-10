import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityBar, AvailabilityLegend, Swatch } from "@/components/Availability";
import { MatchupChart, type MatchupHalf, type MatchupRow } from "@/components/matchup/MatchupChart";
import { Logo } from "@/components/Logo";
import { StarterKey, StarterMark } from "@/components/Starter";
import { SectionNav } from "@/components/site/SectionNav";
import { Strip } from "@/components/site/Strip";
import { Hero, SectionHead, WRAP } from "@/components/ui";
import { matchupVars } from "@/design/tokens";
import { outOf, playerSlice, slicesOf, statusText } from "@/lib/availability";
import { getSnapshot, kickoffLabel, matchupHref, weekGames } from "@/lib/data";
import { money, ordinal } from "@/lib/format";
import { statusHrefs } from "@/lib/rosterLink";
import { biggestEdges, edgeSides, gameEdges, groupMoney, leagueRanks, PAIRS } from "@/lib/matchup";
import type { Game, Snapshot } from "@/lib/types";

/**
 * Every game of the regular season is prerendered, so any week can be previewed.
 * Money always comes from the current week's rosters and statuses.
 */
export const dynamicParams = false;

function slugOf(g: Game) {
  return matchupHref(g).split("/").pop()!;
}

function gamesFor(s: Snapshot) {
  return s.games;
}

export async function generateStaticParams() {
  const s = await getSnapshot();
  const params = gamesFor(s).map((g) => ({ slug: slugOf(g) }));
  // A static export needs at least one path; an empty schedule gets a placeholder 404.
  return params.length ? params : [{ slug: "none" }];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getSnapshot();
  const g = gamesFor(s).find((x) => slugOf(x) === slug);
  if (!g) return { title: "Matchup not found" };
  const nick = (a: string) => s.teams.find((t) => t.team === a)?.nick ?? a;
  return { title: `${nick(g.away_team)} at ${nick(g.home_team)} · Week ${g.week}` };
}

export default async function MatchupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = await getSnapshot();
  const g = gamesFor(s).find((x) => slugOf(x) === slug);
  if (!g) notFound();
  const team = (abbr: string) => s.teams.find((t) => t.team === abbr)!;
  const away = team(g.away_team);
  const home = team(g.home_team);
  if (!away || !home) notFound();
  // Both teams share every chart here, so their colors are picked as a pair.
  const [awayVars, homeVars] = matchupVars(away, home);
  const varsOf = (abbr: string) => (abbr === away.team ? awayVars : homeVars);
  const nick = (abbr: string) => team(abbr)?.nick ?? abbr;
  const final = g.away_score !== null && g.home_score !== null;
  const future = g.week > s.week;
  const past = g.week < s.week;

  const ranks = Object.fromEntries(
    PAIRS.flatMap((p) => [
      [`off:${p.key}`, { field: leagueRanks(s, p.off, "field"), full: leagueRanks(s, p.off, "full") }],
      [`def:${p.key}`, { field: leagueRanks(s, p.def, "field"), full: leagueRanks(s, p.def, "full") }],
    ]),
  );
  const half = (offAbbr: string, defAbbr: string): MatchupHalf => {
    const off = team(offAbbr);
    const def = team(defAbbr);
    const rows: MatchupRow[] = PAIRS.map((p) => ({
      key: p.key,
      label: p.label,
      offLabel: p.offLabel,
      defLabel: p.defLabel,
      offGroups: p.off,
      defGroups: p.def,
      off: groupMoney(s, offAbbr, p.off),
      def: groupMoney(s, defAbbr, p.def),
      ranks: {
        field: { off: ranks[`off:${p.key}`].field[offAbbr], def: ranks[`def:${p.key}`].field[defAbbr] },
        full: { off: ranks[`off:${p.key}`].full[offAbbr], def: ranks[`def:${p.key}`].full[defAbbr] },
      },
    }));
    return {
      title: `${off.nick} offense vs ${def.nick} defense`,
      offTeam: { abbr: offAbbr, nick: off.nick, vars: varsOf(offAbbr) },
      defTeam: { abbr: defAbbr, nick: def.nick, vars: varsOf(defAbbr) },
      rows,
    };
  };
  const halves = [half(away.team, home.team), half(home.team, away.team)];
  const edges = biggestEdges(gameEdges(s, away.team, home.team));
  const strip = weekGames(s, g.week).map((x) => ({
    key: x.game_id,
    href: matchupHref(x),
    label: `${x.away_team} @ ${x.home_team}`,
    title: `${nick(x.away_team)} at ${nick(x.home_team)}`,
    current: x.game_id === g.game_id,
  }));

  return (
    <>
      <Hero before={<Strip items={strip} label={`Week ${g.week} games`} />}>
        <header className="space-y-5">
          <p className="eyebrow text-center">
            <Link href={`/matchups/?week=${g.week}`} className="hover:text-ink">
              Week {g.week}
            </Link>{" "}
            · {final ? "Final" : kickoffLabel(g)}
            {future && " · early look"}
          </p>
          {(future || past) && (
            <p className="mx-auto max-w-xl text-center text-[13px] text-ink-3">
              {future
                ? `Money and injury statuses below are from week ${s.week}. They update each day as this game gets closer.`
                : `Money and injury statuses below are from the current week ${s.week}, not from the week this game was played.`}
            </p>
          )}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
            <TeamHead s={s} abbr={away.team} vars={awayVars} score={final ? g.away_score : null} won={final && g.away_score! > g.home_score!} align="right" />
            <span className="display text-base text-ink-3">at</span>
            <TeamHead s={s} abbr={home.team} vars={homeVars} score={final ? g.home_score : null} won={final && g.home_score! > g.away_score!} align="left" />
          </div>
        </header>

        <div id="overview" className="mt-8 scroll-mt-28">
          {edges.length > 0 && (
            <section aria-label="Biggest edges" className="grid gap-3 md:grid-cols-2">
              {edges.map((e) => {
                const x = edgeSides(e);
                return (
                  <div key={`${e.offTeam}-${e.pair.key}`} className="rounded-md border border-line-2 border-l-[3px] border-l-accent bg-surface/70 px-4 py-3.5">
                    <p className="eyebrow mb-1.5 text-accent">Edge · {e.pair.label}</p>
                    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="display text-[22px] leading-tight sm:text-[26px]">
                        {nick(x.win)} {x.winLabel}
                      </span>
                      <span className="num rounded-sm bg-surface-3 px-1.5 text-xs font-medium text-ink">{ordinal(x.winRank)}</span>
                      <span className="text-ink-3">vs</span>
                      <span className="text-[15px] font-medium text-ink-2">
                        {nick(x.lose)} {x.loseLabel}
                      </span>
                      <span className="num rounded-sm bg-surface-3 px-1.5 text-xs font-medium text-ink-2">{ordinal(x.loseRank)}</span>
                    </p>
                    <p className="num mt-1.5 text-[13px] text-ink-2">
                      {money(x.winMoney.field)} vs {money(x.loseMoney.field)} on the field
                    </p>
                  </div>
                );
              })}
            </section>
          )}
        </div>
      </Hero>

      <SectionNav
        crumbs={[
          { label: "Matchups", href: "/matchups/" },
          { label: `Week ${g.week}`, href: `/matchups/?week=${g.week}` },
          { label: `${away.team} @ ${home.team}` },
        ]}
        items={[
          { id: "overview", label: "Edges" },
          { id: "payroll", label: "Payroll" },
          { id: "positions", label: "Position matchups" },
          { id: "out", label: "Who's out" },
        ]}
      />


      <main className={`${WRAP} space-y-12 pt-8 pb-5 sm:pb-6`}>
        <div id="payroll" className="scroll-mt-28">
          {/* Tale of the tape: both teams' bars on one dollar scale, so the bigger
              payroll draws the longer bar and the two compare at a glance. It sits on
              the page, not the board: the board would repaint each team in its dark
              theme color, and on this page a team must be one color top to bottom. */}
          <section aria-label="Money on each side" className="space-y-4">
            <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 [&>*]:min-w-0">
              {[away, home].map((t) => {
                const sum = s.summary.find((x) => x.team === t.team)!;
                const rival = s.summary.find((x) => x.team === (t.team === away.team ? home.team : away.team))!;
                // The practice squad never suits up, so its money stays off the matchup bars.
                const rostered = (x: typeof sum) => x.cap_total - x.cap_unknown;
                const slices = { ...slicesOf(sum), unknown: 0 };
                return (
                  <div key={t.team} className="tc border-t-[3px] pt-3" style={{ ...varsOf(t.team), borderColor: "var(--team)" }}>
                    <div className="mb-2.5 flex items-end justify-between gap-3">
                      <Link href={`/team/${t.team}`} className="text-[15px] font-semibold hover:underline">
                        {t.name}
                      </Link>
                      <span className="fig text-[30px] leading-none sm:text-[34px]">{money(rostered(sum))}</span>
                    </div>
                    <AvailabilityBar
                      height={28}
                      labels
                      title={t.name}
                      slices={slices}
                      team={varsOf(t.team)}
                      scale={Math.max(rostered(sum), rostered(rival))}
                      hrefs={statusHrefs(t.team)}
                      subject={t.name}
                    />
                    <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-3">
                      <StatPair label="On the field" value={money(sum.cap_active + sum.cap_questionable)} />
                      <StatPair label="Out" value={money(outOf(sum))} />
                      <StatPair label="Out for season" value={money(sum.cap_inactive_year ?? 0)} />
                    </dl>
                  </div>
                );
              })}
            </div>
            <div>
              <AvailabilityLegend keys={["active", "questionable", "inactive", "year"]} short palette="team" extra={<span className="text-ink-3">Bars wear each team&apos;s color, on one dollar scale, practice squad left out</span>} />
            </div>
          </section>
        </div>

        <div id="positions" className="scroll-mt-28">
          <MatchupChart halves={halves} />
        </div>

        <section id="out" aria-label="Who's out" className="grid scroll-mt-28 gap-6 md:grid-cols-2 [&>*]:min-w-0">
          {[away, home].map((t) => (
            <KeyAbsences key={t.team} s={s} abbr={t.team} vars={varsOf(t.team)} />
          ))}
        </section>
      </main>
    </>
  );
}

function TeamHead({
  s,
  abbr,
  vars,
  score,
  won,
  align,
}: {
  s: Snapshot;
  abbr: string;
  vars: CSSProperties;
  score: number | null;
  won: boolean;
  align: "left" | "right";
}) {
  const t = s.teams.find((x) => x.team === abbr)!;
  const dim = score !== null && !won;
  return (
    <Link
      href={`/team/${abbr}`}
      className={`tc flex items-center gap-3 rounded-md sm:gap-4 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
      style={vars}
    >
      <span className="hidden sm:block">
        <Logo src={t.logo_url} size={64} fallback={abbr} />
      </span>
      <span className="sm:hidden">
        <Logo src={t.logo_url} size={36} fallback={abbr} />
      </span>
      <span className="min-w-0">
        <span className={`display block truncate text-[28px] leading-none sm:text-[52px] ${dim ? "text-ink-3" : ""}`}>{t.nick}</span>
        {score !== null && <span className={`fig mt-1 block text-[30px] leading-none sm:text-[44px] ${dim ? "text-ink-3" : ""}`}>{score}</span>}
      </span>
    </Link>
  );
}

function StatPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-ink-3">{label}</dt>
      <dd className="fig mt-0.5 text-[20px] leading-none sm:text-[22px]">{value}</dd>
    </div>
  );
}

/** The biggest names out or in doubt for this game, by cap number. */
function KeyAbsences({ s, abbr, vars }: { s: Snapshot; abbr: string; vars: CSSProperties }) {
  const t = s.teams.find((x) => x.team === abbr)!;
  const rows = s.players
    .filter((p) => p.team === abbr && (p.flag === "inactive" || p.flag === "questionable"))
    .sort((a, b) => {
      const rank = (x: typeof a) => (playerSlice(x) === "year" ? 1 : 0);
      return rank(a) - rank(b) || b.cap - a.cap;
    })
    .slice(0, 8);
  return (
    <div className="tc" style={vars}>
      <SectionHead title={`${t.nick} out`} count={rows.length || undefined} />
      {rows.length === 0 ? (
        <p className="card px-4 py-5 text-center text-sm text-ink-3">Everyone available</p>
      ) : (
        <ol className="card divide-y divide-line text-sm">
          {rows.map((p) => (
            <li key={p.key} className="flex items-center gap-3 px-3.5 py-2">
              <Swatch k={playerSlice(p)} team={vars} />
              <span className="flex min-w-0 flex-1 items-center gap-1">
                <span className="truncate font-medium">{p.name}</span>
                <StarterMark player={p} />
                <span className="ml-1 truncate text-ink-3">
                  {p.group} · {statusText(p)}
                </span>
              </span>
              <span className="num font-medium">{money(p.cap)}</span>
            </li>
          ))}
        </ol>
      )}
      {rows.some((p) => p.starter) && <StarterKey className="mt-2" />}
    </div>
  );
}
