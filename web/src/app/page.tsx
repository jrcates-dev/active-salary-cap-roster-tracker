import { AvailabilityBar, AvailabilityLegend, Swatch } from "@/components/Availability";
import { Heatmap, type HeatRow } from "@/components/league/Heatmap";
import { InactiveBoard } from "@/components/league/InactiveBoard";
import { OffenseShare } from "@/components/league/OffenseShare";
import { PlayersOut, type OutRow } from "@/components/league/PlayersOut";
import { WeekGames } from "@/components/WeekGames";
import { SectionNav } from "@/components/site/SectionNav";
import { Hero, SectionHead, Stat, WRAP } from "@/components/ui";
import { STATUS_COLOR, teamVars, UNITS } from "@/design/tokens";
import { cardTeams, getSnapshot, weekSlates } from "@/lib/data";
import { defaultWeek } from "@/lib/schedule";
import { money, pct } from "@/lib/format";
import type { Absence } from "@/lib/types";

export default async function LeaguePage() {
  const s = await getSnapshot();
  type Col = "cap_total" | "cap_active" | "cap_inactive_week" | "cap_inactive_season" | "cap_inactive_year" | "cap_questionable" | "cap_unknown";
  const sum = (k: Col) => s.summary.reduce((acc, t) => acc + (t[k] ?? 0), 0);
  const dead = s.summary.reduce((acc, t) => acc + (t.dead_money ?? 0), 0);
  const deadByTeam = Object.fromEntries(s.summary.map((t) => [t.team, t.dead_money ?? 0]));
  // Player cap plus the year's dead money: the whole league bar, and every share below.
  const total = sum("cap_total") + dead;
  const active = sum("cap_active");
  const outWeek = sum("cap_inactive_week");
  const outSeason = sum("cap_inactive_season");
  const outYear = sum("cap_inactive_year");
  const questionable = sum("cap_questionable");
  const isOut = (kind: Absence) => (p: (typeof s.players)[number]) =>
    p.flag === "inactive" && (p.absence ?? "week") === kind;
  const count = (kind: Absence) => s.players.filter(isOut(kind)).length;
  const nQuestionable = s.players.filter((p) => p.flag === "questionable").length;
  const teamsById = Object.fromEntries(s.teams.map((t) => [t.team, t]));
  const slates = weekSlates(s);

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
      .slice(0, 40)
      .map((p) => ({ player: p, nick: teamsById[p.team].nick, vars: teamVars(teamsById[p.team]) }));
  const boardTeams = s.teams.map((t) => ({
    team: t.team,
    nick: t.nick,
    name: t.name,
    vars: teamVars(t),
    dead: deadByTeam[t.team] ?? 0,
  }));
  const history = s.history.length ? s.history : s.summary.map((t) => ({ ...t, week: s.week, unit: "all" as const }));

  return (
    <>
      <Hero eyebrow={`${s.season} season · Week ${s.week}`} title="League" />
      <SectionNav
        crumbs={[{ label: "League" }]}
        items={[
          { id: "overview", label: "Overview" },
          { id: "money-out", label: "Money out" },
          ...(slates.length > 0 ? [{ id: "games", label: "Games" }] : []),
          { id: "players-out", label: "Players out" },
          { id: "groups", label: "Position groups" },
          { id: "offense-defense", label: "Offense vs defense" },
        ]}
      />
      <main className={`${WRAP} space-y-14 pt-6 pb-8 sm:pb-10`}>
        <section id="overview" aria-label="League overview" className="scroll-mt-28 space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div>
              <Stat
                label="Active"
                swatch={<Swatch k="active" />}
                tone={STATUS_COLOR.active}
                value={money(active, 2)}
                sub={`${pct(active / total)} of ${money(total, 2)}`}
              />
            </div>
            <Stat
              label="Questionable"
              swatch={<Swatch k="questionable" />}
              tone={STATUS_COLOR.questionable}
              value={money(questionable)}
              sub={`${pct(questionable / total)} · ${nQuestionable} players`}
            />
            <Stat
              label="Out this week"
              swatch={<Swatch k="inactive" />}
              tone={STATUS_COLOR.inactive}
              value={money(outWeek)}
              sub={`${pct(outWeek / total)} · ${count("week")} players`}
            />
            <Stat
              label="Out long-term"
              swatch={<Swatch k="season" />}
              tone={STATUS_COLOR.season}
              value={money(outSeason)}
              sub={`${pct(outSeason / total)} · ${count("season")} players`}
            />
            <Stat
              label="Out for season"
              swatch={<Swatch k="year" />}
              tone={STATUS_COLOR.year}
              value={money(outYear)}
              sub={`${pct(outYear / total)} · ${count("year")} players`}
            />
            <Stat
              label="Dead money"
              swatch={<Swatch k="dead" />}
              tone={STATUS_COLOR.dead}
              value={money(dead)}
              sub={`${pct(dead / total)} · for the year`}
            />
          </div>
          <div className="card space-y-3 px-4 py-4">
            <AvailabilityBar
              height={32}
              labels
              title="All 32 teams"
              slices={{
                active,
                questionable,
                inactive: outWeek,
                season: outSeason,
                year: outYear,
                unknown: sum("cap_unknown"),
                dead,
              }}
            />
            <AvailabilityLegend keys={["active", "questionable", "inactive", "season", "year", "unknown", "dead"]} short />
          </div>
        </section>

        <section id="money-out" className="scroll-mt-28">
          <InactiveBoard title="Money out by team" teams={boardTeams} history={history} week={s.week} />
        </section>

        <section
          id="games"
          className="grid scroll-mt-28 grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        >
          {slates.length > 0 && (
            <WeekGames
              slates={slates}
              teams={cardTeams(s)}
              dataWeek={s.week}
              initialWeek={defaultWeek(slates, new Date())}
              more={{ href: "/matchups/", label: "All matchups" }}
              cols="grid-cols-2"
            />
          )}
          <div id="players-out" className="scroll-mt-28">
            <SectionHead title="Players out" />
            <PlayersOut week={s.week} thisWeek={outRows("week")} longTerm={outRows("season")} forSeason={outRows("year")} />
          </div>
        </section>

        <section id="groups" className="scroll-mt-28">
          <SectionHead title="Cap by position group" />
          <Heatmap groups={groupsOrdered} rows={heatRows} />
        </section>

        <section id="offense-defense" className="max-w-3xl scroll-mt-28">
          <SectionHead title="Offense vs defense" />
          <OffenseShare s={s} />
        </section>
    </main>
    </>
  );
}
