import Link from "next/link";
import { GameCard } from "@/components/GameCard";
import { Heatmap, type HeatRow } from "@/components/league/Heatmap";
import { InactiveBoard } from "@/components/league/InactiveBoard";
import { OffenseShare } from "@/components/league/OffenseShare";
import { PlayersOut, type OutRow } from "@/components/league/PlayersOut";
import { displayColor } from "@/design/tokens";
import { getSnapshot, weekGames } from "@/lib/data";
import { money, pct } from "@/lib/format";
import type { Absence } from "@/lib/types";

export default async function LeaguePage() {
  const s = await getSnapshot();
  const sum = (
    k: "cap_total" | "cap_inactive_week" | "cap_inactive_season" | "cap_inactive_year" | "cap_questionable",
  ) =>
    s.summary.reduce((acc, t) => acc + (t[k] ?? 0), 0);
  const total = sum("cap_total");
  const outWeek = sum("cap_inactive_week");
  const outSeason = sum("cap_inactive_season");
  const outYear = sum("cap_inactive_year");
  const questionable = sum("cap_questionable");
  const isOut = (kind: Absence) => (p: (typeof s.players)[number]) =>
    p.flag === "inactive" && (p.absence ?? "week") === kind;
  const nWeek = s.players.filter(isOut("week")).length;
  const nSeason = s.players.filter(isOut("season")).length;
  const nYear = s.players.filter(isOut("year")).length;
  const teamsById = Object.fromEntries(s.teams.map((t) => [t.team, t]));
  const games = weekGames(s);
  const finals = games.filter((g) => g.away_score !== null && g.home_score !== null).length;

  const groupsOrdered = [...s.groups].sort(
    (a, b) => unitIndex(a.unit) - unitIndex(b.unit) || a.order - b.order,
  );
  const heatRows: HeatRow[] = s.summary.map((t) => {
    const team = teamsById[t.team];
    const cells: HeatRow["cells"] = {};
    for (const r of s.rollup) {
      if (r.team === t.team && r.level === "group") {
        cells[r.position_group] = { cap: r.cap_total, inactive: r.cap_inactive_week ?? 0 };
      }
    }
    return { team: t.team, nick: team.nick, name: team.name, color: displayColor(team), total: t.cap_total, cells };
  });

  const outRows = (kind: Absence): OutRow[] =>
    s.players
      .filter(isOut(kind))
      .sort((a, b) => b.cap - a.cap)
      .slice(0, 10)
      .map((p) => ({ player: p, nick: teamsById[p.team].nick, color: displayColor(teamsById[p.team]) }));
  const boardTeams = s.teams.map((t) => ({ team: t.team, nick: t.nick, name: t.name, color: displayColor(t) }));
  const history = s.history.length
    ? s.history
    : s.summary.map((t) => ({ ...t, week: s.week, unit: "all" as const }));

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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Hero label="Cap counted across 32 rosters" value={money(total, 2)} wide />
          <Hero
            label={`Out this week · ${nWeek} players`}
            value={money(outWeek)}
            sub={`${pct(outWeek / total)} of counted cap`}
            accent
          />
          <Hero
            label={`Questionable · not yet ruled in or out`}
            value={money(questionable)}
            sub={questionable > 0 ? `${pct(questionable / total)} of cap` : "Every reported player is decided"}
          />
          <Hero
            label={`Out long-term, can return · ${nSeason} players`}
            value={money(outSeason)}
            sub={`${pct(outSeason / total)} of cap · IR, PUP, NFI`}
          />
          <Hero
            label={`Out for season · ${nYear} players`}
            value={money(outYear)}
            sub={`${pct(outYear / total)} of cap · done for the year`}
          />
        </div>
      </section>

      {games.length > 0 && (
        <section id="games" className="scroll-mt-4">
          <SectionTitle
            title={`Week ${s.week} matchups`}
            note={`${finals} of ${games.length} games final. Each card names the biggest gap in money on the field between position groups that face each other.`}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {games.map((g) => (
              <GameCard key={g.game_id} s={s} g={g} />
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <SectionTitle
            title="Money out, team by team"
            note="Ranked by money out for this week's game. Click any entry below to rank by that money instead, and click it again to flip the order. Reserve lists are the faint band; the outlined band is money out for the season."
          />
          <InactiveBoard teams={boardTeams} history={history} week={s.week} />
        </div>
        <div>
          <SectionTitle
            title="Most expensive players out"
            note={`Ruled out, doubtful or gameday inactive; on a reserve list and able to come back; or done for the season. Week ${s.week}.`}
          />
          <PlayersOut week={s.week} thisWeek={outRows("week")} longTerm={outRows("season")} forSeason={outRows("year")} />
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
        <SectionTitle title="Offense or defense?" note="Share of counted cap by unit, most offense-heavy first. Click a unit to rank teams by its share, and click it again to flip the order." />
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

function Hero({
  label,
  value,
  sub,
  accent,
  wide,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  /** Spans both columns on phones, so the five cards pair up below it. */
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-panel px-5 py-4 ${accent ? "border-[#ff7b1c]/50" : "border-border"} ${wide ? "col-span-2 lg:col-span-1" : ""}`}
    >
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="num mt-1 text-4xl leading-none font-bold sm:text-5xl">{value}</p>
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
