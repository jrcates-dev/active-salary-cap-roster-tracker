import Link from "next/link";
import { AvailabilityBar, AvailabilityLegend, Swatch } from "@/components/Availability";
import { GameCard } from "@/components/GameCard";
import { Heatmap, type HeatRow } from "@/components/league/Heatmap";
import { InactiveBoard } from "@/components/league/InactiveBoard";
import { OffenseShare } from "@/components/league/OffenseShare";
import { PlayersOut, type OutRow } from "@/components/league/PlayersOut";
import { PageHead, SectionHead, Stat, WRAP } from "@/components/ui";
import { teamVars, UNITS } from "@/design/tokens";
import { getSnapshot, weekGames } from "@/lib/data";
import { money, pct } from "@/lib/format";
import type { Absence } from "@/lib/types";

export default async function LeaguePage() {
  const s = await getSnapshot();
  type Col = "cap_total" | "cap_active" | "cap_inactive_week" | "cap_inactive_season" | "cap_inactive_year" | "cap_questionable" | "cap_unknown";
  const sum = (k: Col) => s.summary.reduce((acc, t) => acc + (t[k] ?? 0), 0);
  const total = sum("cap_total");
  const outWeek = sum("cap_inactive_week");
  const outSeason = sum("cap_inactive_season");
  const outYear = sum("cap_inactive_year");
  const questionable = sum("cap_questionable");
  const isOut = (kind: Absence) => (p: (typeof s.players)[number]) =>
    p.flag === "inactive" && (p.absence ?? "week") === kind;
  const count = (kind: Absence) => s.players.filter(isOut(kind)).length;
  const nQuestionable = s.players.filter((p) => p.flag === "questionable").length;
  const teamsById = Object.fromEntries(s.teams.map((t) => [t.team, t]));
  const games = weekGames(s);
  const finals = games.filter((g) => g.away_score !== null && g.home_score !== null).length;

  const groupsOrdered = [...s.groups].sort(
    (a, b) => UNITS.indexOf(a.unit) - UNITS.indexOf(b.unit) || a.order - b.order,
  );
  const heatRows: HeatRow[] = s.summary.map((t) => {
    const team = teamsById[t.team];
    const cells: HeatRow["cells"] = {};
    for (const r of s.rollup) {
      if (r.team === t.team && r.level === "group") {
        cells[r.position_group] = { cap: r.cap_total, inactive: r.cap_inactive_week ?? 0 };
      }
    }
    return { team: t.team, nick: team.nick, name: team.name, vars: teamVars(team), total: t.cap_total, cells };
  });

  const outRows = (kind: Absence): OutRow[] =>
    s.players
      .filter(isOut(kind))
      .sort((a, b) => b.cap - a.cap)
      .slice(0, 10)
      .map((p) => ({ player: p, nick: teamsById[p.team].nick, vars: teamVars(teamsById[p.team]) }));
  const boardTeams = s.teams.map((t) => ({ team: t.team, nick: t.nick, name: t.name, vars: teamVars(t) }));
  const history = s.history.length ? s.history : s.summary.map((t) => ({ ...t, week: s.week, unit: "all" as const }));

  return (
    <main className={`${WRAP} space-y-14 py-8 sm:py-10`}>
      <section className="space-y-5">
        <PageHead eyebrow={`${s.season} season · Week ${s.week}`} title="League" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-1">
            <Stat label="Counted cap" value={money(total, 2)} sub="32 rosters" />
          </div>
          <Stat
            label="Out this week"
            swatch={<Swatch k="inactive" className="tc-neutral" />}
            value={money(outWeek)}
            sub={`${pct(outWeek / total)} · ${count("week")} players`}
          />
          <Stat
            label="Questionable"
            swatch={<Swatch k="questionable" className="tc-neutral" />}
            value={money(questionable)}
            sub={`${pct(questionable / total)} · ${nQuestionable} players`}
          />
          <Stat
            label="Out long-term"
            swatch={<Swatch k="season" className="tc-neutral" />}
            value={money(outSeason)}
            sub={`${pct(outSeason / total)} · ${count("season")} players`}
          />
          <Stat
            label="Out for season"
            swatch={<Swatch k="year" className="tc-neutral" />}
            value={money(outYear)}
            sub={`${pct(outYear / total)} · ${count("year")} players`}
          />
        </div>
        <div className="tc-neutral space-y-2.5">
          <AvailabilityBar
            height={28}
            labels
            title="All 32 teams"
            slices={{
              active: sum("cap_active"),
              questionable,
              inactive: outWeek,
              season: outSeason,
              year: outYear,
              unknown: sum("cap_unknown"),
            }}
          />
          <AvailabilityLegend short />
        </div>
      </section>

      {games.length > 0 && (
        <section id="games" className="scroll-mt-20">
          <SectionHead
            title={`Week ${s.week} games`}
            count={`${finals} of ${games.length} final`}
            aside={
              <Link href="/matchups" className="font-medium text-ink-2 hover:text-ink">
                All matchups →
              </Link>
            }
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {games.map((g) => (
              <GameCard key={g.game_id} s={s} g={g} />
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <InactiveBoard title="Money out by team" teams={boardTeams} history={history} week={s.week} />
        </div>
        <div>
          <SectionHead title="Players out" />
          <PlayersOut week={s.week} thisWeek={outRows("week")} longTerm={outRows("season")} forSeason={outRows("year")} />
        </div>
      </section>

      <section>
        <SectionHead title="Cap by position group" />
        <Heatmap groups={groupsOrdered} rows={heatRows} />
      </section>

      <section className="max-w-3xl">
        <SectionHead title="Offense vs defense" />
        <OffenseShare s={s} />
      </section>
    </main>
  );
}
