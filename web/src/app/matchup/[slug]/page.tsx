import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityBar, AvailabilityLegend, Swatch } from "@/components/Availability";
import { MatchupChart, type MatchupHalf, type MatchupRow } from "@/components/matchup/MatchupChart";
import { Logo } from "@/components/Logo";
import { StarterKey, StarterMark } from "@/components/Starter";
import { SectionNav } from "@/components/site/SectionNav";
import { Strip } from "@/components/site/Strip";
import { SectionHead, WRAP } from "@/components/ui";
import { teamVars } from "@/design/tokens";
import { playerSlice, slicesOf, statusText } from "@/lib/availability";
import { getSnapshot, kickoffLabel, matchupHref, weekGames } from "@/lib/data";
import { money, ordinal } from "@/lib/format";
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
      offTeam: { abbr: offAbbr, nick: off.nick, vars: teamVars(off) },
      defTeam: { abbr: defAbbr, nick: def.nick, vars: teamVars(def) },
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
      <div className={`${WRAP} space-y-12 pt-5 pb-6 sm:pt-6`}>
        <Strip items={strip} label={`Week ${g.week} games`} />

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
            <TeamHead s={s} abbr={away.team} score={final ? g.away_score : null} won={final && g.away_score! > g.home_score!} align="right" />
            <span className="text-sm text-ink-3">at</span>
            <TeamHead s={s} abbr={home.team} score={final ? g.home_score : null} won={final && g.home_score! > g.away_score!} align="left" />
          </div>
        </header>
      </div>

      <SectionNav
        crumbs={[
          { label: "Matchups", href: "/matchups/" },
          { label: `Week ${g.week}`, href: `/matchups/?week=${g.week}` },
          { label: `${away.team} @ ${home.team}` },
        ]}
        items={[
          { id: "overview", label: "Overview" },
          { id: "positions", label: "Position matchups" },
          { id: "out", label: "Who's out" },
        ]}
      />

      <main className={`${WRAP} space-y-12 pt-6 pb-5 sm:pb-6`}>
        <div id="overview" className="scroll-mt-28 space-y-12">
          {edges.length > 0 && (
            <section aria-label="Biggest edges" className="grid gap-3 md:grid-cols-2">
              {edges.map((e) => {
                const x = edgeSides(e);
                return (
                  <div key={`${e.offTeam}-${e.pair.key}`} className="card border-l-[3px] border-l-accent px-4 py-3.5">
                    <p className="eyebrow mb-2">Edge · {e.pair.label}</p>
                    <p className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
                      <span className="font-semibold">
                        {nick(x.win)} {x.winLabel}
                      </span>
                      <span className="num rounded bg-surface-2 px-1.5 text-xs font-medium text-ink-2">{ordinal(x.winRank)}</span>
                      <span className="text-ink-3">vs</span>
                      <span className="font-medium text-ink-2">
                        {nick(x.lose)} {x.loseLabel}
                      </span>
                      <span className="num rounded bg-surface-2 px-1.5 text-xs font-medium text-ink-2">{ordinal(x.loseRank)}</span>
                    </p>
                    <p className="num mt-1.5 text-[13px] text-ink-3">
                      {money(x.winMoney.field)} vs {money(x.loseMoney.field)} on the field
                    </p>
                  </div>
                );
              })}
            </section>
          )}

          <section className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 [&>*]:min-w-0">
              {[away, home].map((t) => {
                const sum = s.summary.find((x) => x.team === t.team)!;
                return (
                  <div key={t.team} className="tc card px-4 py-4" style={teamVars(t)}>
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <Link href={`/team/${t.team}`} className="flex items-center gap-2 text-[15px] font-semibold hover:underline">
                        <span aria-hidden className="h-3 w-3 rounded-[3px]" style={{ background: "var(--team)" }} />
                        {t.name}
                      </Link>
                      <span className="num text-[15px] font-semibold">{money(sum.cap_total)}</span>
                    </div>
                    <AvailabilityBar height={20} labels title={t.name} slices={slicesOf(sum)} team={teamVars(t)} />
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
                      <StatPair label="On the field" value={money(sum.cap_active + sum.cap_questionable)} />
                      <StatPair label="Out this week" value={money(sum.cap_inactive_week)} />
                      <StatPair label="Out long-term" value={money(sum.cap_inactive_season)} />
                      <StatPair label="Out for season" value={money(sum.cap_inactive_year ?? 0)} />
                    </dl>
                  </div>
                );
              })}
            </div>
            <div>
              <AvailabilityLegend keys={["active", "questionable", "inactive", "season", "year"]} short palette="team" extra={<span className="text-ink-3">Bars wear each team&apos;s color</span>} />
            </div>
          </section>
        </div>

        <div id="positions" className="scroll-mt-28">
          <MatchupChart halves={halves} />
        </div>

        <section id="out" aria-label="Who's out" className="grid scroll-mt-28 gap-6 md:grid-cols-2 [&>*]:min-w-0">
          {[away, home].map((t) => (
            <KeyAbsences key={t.team} s={s} abbr={t.team} />
          ))}
        </section>
      </main>
    </>
  );
}

function TeamHead({ s, abbr, score, won, align }: { s: Snapshot; abbr: string; score: number | null; won: boolean; align: "left" | "right" }) {
  const t = s.teams.find((x) => x.team === abbr)!;
  const dim = score !== null && !won;
  return (
    <Link
      href={`/team/${abbr}`}
      className={`tc flex items-center gap-3 rounded-md sm:gap-4 ${align === "right" ? "flex-row-reverse text-right" : ""}`}
      style={teamVars(t)}
    >
      <span className="hidden sm:block">
        <Logo src={t.logo_url} size={60} fallback={abbr} />
      </span>
      <span className="block h-10 w-1.5 rounded-full sm:hidden" style={{ background: "var(--team)" }} aria-hidden />
      <span className="min-w-0">
        <span className={`block truncate text-[22px] leading-none font-semibold tracking-tight sm:text-[32px] ${dim ? "text-ink-3" : ""}`}>{t.nick}</span>
        {score !== null && <span className={`fig mt-1 block text-[26px] leading-none sm:text-[34px] ${dim ? "text-ink-3" : ""}`}>{score}</span>}
      </span>
    </Link>
  );
}

function StatPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className="num text-sm font-medium">{value}</dd>
    </div>
  );
}

/** The biggest names out or in doubt for this game, by cap number. */
function KeyAbsences({ s, abbr }: { s: Snapshot; abbr: string }) {
  const t = s.teams.find((x) => x.team === abbr)!;
  const rows = s.players
    .filter((p) => p.team === abbr && (p.flag === "inactive" || p.flag === "questionable"))
    .sort((a, b) => {
      const rank = (x: typeof a) => ({ season: 1, year: 2 })[playerSlice(x) as string] ?? 0;
      return rank(a) - rank(b) || b.cap - a.cap;
    })
    .slice(0, 8);
  return (
    <div className="tc" style={teamVars(t)}>
      <SectionHead title={`${t.nick} out`} count={rows.length || undefined} />
      {rows.length === 0 ? (
        <p className="card px-4 py-5 text-center text-sm text-ink-3">Everyone available</p>
      ) : (
        <ol className="card divide-y divide-line text-sm">
          {rows.map((p) => (
            <li key={p.key} className="flex items-center gap-3 px-3.5 py-2">
              <Swatch k={playerSlice(p)} team={teamVars(t)} />
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
