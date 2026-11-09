import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityBar, AvailabilityLegend, Swatch } from "@/components/Availability";
import { MatchupChart, type MatchupHalf, type MatchupRow } from "@/components/matchup/MatchupChart";
import { playerSlice, slicesOf, statusText } from "@/lib/availability";
import { displayColor } from "@/design/tokens";
import { getSnapshot, kickoffLabel, matchupHref } from "@/lib/data";
import { money } from "@/lib/format";
import { biggestEdges, edgeSides, edgeText, gameEdges, groupMoney, leagueRanks, PAIRS } from "@/lib/matchup";
import type { Game, Snapshot } from "@/lib/types";

/** Every game of the current and the next week is prerendered. */
export const dynamicParams = false;

function slugOf(g: Game) {
  return matchupHref(g).split("/").pop()!;
}

function gamesFor(s: Snapshot) {
  return s.games.filter((g) => g.week === s.week || g.week === s.week + 1);
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
  return { title: `${nick(g.away_team)} at ${nick(g.home_team)} · Week ${g.week} matchup` };
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
      off: groupMoney(s, offAbbr, p.off),
      def: groupMoney(s, defAbbr, p.def),
      ranks: {
        field: { off: ranks[`off:${p.key}`].field[offAbbr], def: ranks[`def:${p.key}`].field[defAbbr] },
        full: { off: ranks[`off:${p.key}`].full[offAbbr], def: ranks[`def:${p.key}`].full[defAbbr] },
      },
    }));
    return {
      title: `${off.nick} offense vs ${def.nick} defense`,
      offTeam: { abbr: offAbbr, nick: off.nick, color: displayColor(off) },
      defTeam: { abbr: defAbbr, nick: def.nick, color: displayColor(def) },
      rows,
    };
  };
  const halves = [half(away.team, home.team), half(home.team, away.team)];
  const edges = biggestEdges(gameEdges(s, away.team, home.team));

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <p className="text-sm tracking-wider text-fg-muted uppercase">
          Week {g.week} · {final ? "Final" : kickoffLabel(g)}
          {future && " · early look"}
        </p>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          <TeamHead s={s} abbr={away.team} score={final ? g.away_score : null} align="right" />
          <span className="num text-2xl text-fg-faint">at</span>
          <TeamHead s={s} abbr={home.team} score={final ? g.home_score : null} align="left" />
        </div>
        {future && (
          <p className="rounded-md border border-border bg-panel px-4 py-2 text-sm text-fg-muted">
            This game is in week {g.week}. Statuses are this week&apos;s; the picture changes once week {g.week}&apos;s
            injury reports come out.
          </p>
        )}
      </header>

      {edges.length > 0 && (
        <section className="rounded-lg border border-[#ff7b1c]/50 bg-panel px-5 py-4">
          <h2 className="num mb-2 text-xl font-semibold">Biggest edges on paper</h2>
          <ul className="space-y-1">
            {edges.map((e) => (
              <li key={`${e.offTeam}-${e.pair.key}`} className="text-fg">
                {edgeText(e, nick)}{" "}
                <span className="text-fg-muted">
                  · {money(edgeSides(e).winMoney.field)} vs {money(edgeSides(e).loseMoney.field)} on the field
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-fg-muted">
            Ranks are each group&apos;s money on the field against the other 31 teams. Money is a proxy for talent,
            not a prediction: it says where each team invested and who is available.
          </p>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        {[away, home].map((t) => {
          const sum = s.summary.find((x) => x.team === t.team)!;
          const color = displayColor(t);
          return (
            <div key={t.team} className="rounded-lg border border-border bg-panel px-5 py-4">
              <div className="mb-2 flex items-baseline justify-between">
                <Link href={`/team/${t.team}`} className="num text-xl font-semibold hover:underline">
                  {t.name}
                </Link>
                <span className="num text-lg">{money(sum.cap_total)}</span>
              </div>
              <AvailabilityBar color={color} height={22} title={t.name} slices={slicesOf(sum)} />
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <Stat label="On the field" value={money(sum.cap_active + sum.cap_questionable)} />
                <Stat label="Out this week" value={money(sum.cap_inactive_week)} />
                <Stat label="Out long-term" value={money(sum.cap_inactive_season)} />
                <Stat label="Out for season" value={money(sum.cap_inactive_year ?? 0)} />
              </dl>
            </div>
          );
        })}
      </section>
      <AvailabilityLegend color="#c9ced8" keys={["active", "questionable", "inactive", "season", "year"]} />

      <MatchupChart halves={halves} />

      <section className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
        {[away, home].map((t) => (
          <KeyAbsences key={t.team} s={s} abbr={t.team} />
        ))}
      </section>
    </main>
  );
}

function TeamHead({
  s,
  abbr,
  score,
  align,
}: {
  s: Snapshot;
  abbr: string;
  score: number | null;
  align: "left" | "right";
}) {
  const t = s.teams.find((x) => x.team === abbr)!;
  return (
    <Link
      href={`/team/${abbr}`}
      className={`flex items-center gap-3 hover:underline ${align === "right" ? "flex-row-reverse text-right" : ""}`}
    >
      {t.logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.logo_url} alt="" width={56} height={56} className="hidden h-14 w-14 sm:block" />
      )}
      <div>
        <p className="num text-3xl leading-none font-bold sm:text-4xl">{t.nick}</p>
        {score !== null && <p className="num text-2xl text-fg-muted">{score}</p>}
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="num text-xl">{value}</dd>
    </div>
  );
}

/** The biggest names out or in doubt for this game, by cap number. */
function KeyAbsences({ s, abbr }: { s: Snapshot; abbr: string }) {
  const t = s.teams.find((x) => x.team === abbr)!;
  const color = displayColor(t);
  const rows = s.players
    .filter((p) => p.team === abbr && (p.flag === "inactive" || p.flag === "questionable"))
    .sort((a, b) => {
      const rank = (x: typeof a) => ({ season: 1, year: 2 })[playerSlice(x) as string] ?? 0;
      return rank(a) - rank(b) || b.cap - a.cap;
    })
    .slice(0, 8);
  return (
    <div>
      <h2 className="num mb-2 text-xl font-semibold">{t.nick}: who&apos;s out</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-muted">Nobody out or in doubt.</p>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-panel text-sm">
          {rows.map((p) => (
            <li key={p.key} className="flex items-center gap-3 px-3 py-2">
              <Swatch k={playerSlice(p)} color={color} />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 text-fg-muted">
                  {p.group} · {statusText(p)}
                </span>
              </span>
              <span className="num text-base">{money(p.cap)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
