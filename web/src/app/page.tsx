import { AvailabilityBar } from "@/components/Availability";
import { Heatmap, type HeatRow } from "@/components/league/Heatmap";
import { InactiveBoard } from "@/components/league/InactiveBoard";
import { OffenseShare } from "@/components/league/OffenseShare";
import { PlayersOut, type OutRow } from "@/components/league/PlayersOut";
import { Tape } from "@/components/Tape";
import { WeekGames } from "@/components/WeekGames";
import { SectionNav } from "@/components/site/SectionNav";
import { Hero, SectionHead, WRAP } from "@/components/ui";
import { STATUS_COLOR, teamVars, UNITS } from "@/design/tokens";
import { cardTeams, getSnapshot, weekSlates } from "@/lib/data";
import { defaultWeek } from "@/lib/schedule";
import { money, pct } from "@/lib/format";
import { outOf } from "@/lib/availability";

export default async function LeaguePage() {
  const s = await getSnapshot();
  type Col = "cap_total" | "cap_active" | "cap_inactive_week" | "cap_inactive_season" | "cap_inactive_year" | "cap_questionable" | "cap_unknown";
  const sum = (k: Col) => s.summary.reduce((acc, t) => acc + (t[k] ?? 0), 0);
  const dead = s.summary.reduce((acc, t) => acc + (t.dead_money ?? 0), 0);
  const deadByTeam = Object.fromEntries(s.summary.map((t) => [t.team, t.dead_money ?? 0]));
  // Player cap plus the year's dead money: the whole league bar, and every share below.
  const total = sum("cap_total") + dead;
  const active = sum("cap_active");
  const out = sum("cap_inactive_week") + sum("cap_inactive_season");
  const reserve = sum("cap_inactive_season");
  const outYear = sum("cap_inactive_year");
  const questionable = sum("cap_questionable");
  const unknown = sum("cap_unknown");
  /** Out (this week's absences and reserve lists with a way back), or out for the season. */
  type OutKind = "out" | "year";
  const isOut = (kind: OutKind) => (p: (typeof s.players)[number]) =>
    p.flag === "inactive" && (p.absence === "year") === (kind === "year");
  const count = (kind: OutKind) => s.players.filter(isOut(kind)).length;
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
        cells[r.position_group] = { cap: r.cap_total, inactive: outOf(r) };
      }
    }
    return { team: t.team, nick: team.nick, name: team.name, vars: teamVars(team), total: t.cap_total, cells };
  });

  const outRows = (kind: OutKind): OutRow[] =>
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
      <Hero
        eyebrow={`${s.season} season · Week ${s.week} · League`}
        title={
          <>
            <span style={{ color: STATUS_COLOR.active }}>{pct(active / total)}</span> of the cap is active
          </>
        }
      >
        <section id="overview" aria-label="League overview" className="mt-7 scroll-mt-28">
          <Tape
            bar={
              <AvailabilityBar
                height={36}
                labels
                title="All 32 teams"
                slices={{
                  active,
                  questionable,
                  inactive: out,
                  reserve,
                  year: outYear,
                  unknown,
                  dead,
                }}
              />
            }
            cells={[
              { k: "active", label: "Active", value: money(active, 2), sub: `${pct(active / total)} of ${money(total, 2)}` },
              { k: "questionable", label: "Questionable", value: money(questionable), sub: `${pct(questionable / total)} · ${nQuestionable} players` },
              { k: "inactive", label: "Out", value: money(out), sub: `${pct(out / total)} · ${count("out")} players` },
              { k: "year", label: "Out for season", value: money(outYear), sub: `${pct(outYear / total)} · ${count("year")} players` },
              { k: "unknown", label: "Practice squad", value: money(unknown), sub: pct(unknown / total) },
              { k: "dead", label: "Dead money", value: money(dead), sub: `${pct(dead / total)} · for the year` },
            ]}
          />
        </section>
      </Hero>
      <SectionNav
        crumbs={[{ label: "League" }]}
        items={[
          { id: "overview", label: "Overview" },
          ...(slates.length > 0 ? [{ id: "games", label: "Games" }] : []),
          { id: "money-out", label: "Money out" },
          { id: "players-out", label: "Players out" },
          { id: "groups", label: "Position groups" },
          { id: "offense-defense", label: "Offense vs defense" },
        ]}
      />
      <main className={`${WRAP} space-y-14 pt-8 pb-8 sm:pb-10`}>
        {slates.length > 0 && (
          <section id="games" className="scroll-mt-28">
            <WeekGames
              slates={slates}
              teams={cardTeams(s)}
              dataWeek={s.week}
              initialWeek={defaultWeek(slates, new Date())}
              more={{ href: "/matchups/", label: "All matchups" }}
              ticker
            />
          </section>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-14 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section id="money-out" className="scroll-mt-28">
            <InactiveBoard title="Money out by team" teams={boardTeams} history={history} week={s.week} />
          </section>
          <section id="players-out" className="scroll-mt-28">
            <SectionHead title="Players out" />
            <PlayersOut week={s.week} out={outRows("out")} forSeason={outRows("year")} />
          </section>
        </div>

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
