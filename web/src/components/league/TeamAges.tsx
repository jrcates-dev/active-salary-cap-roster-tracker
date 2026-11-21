import { teamVars } from "@/design/tokens";
import { ageDate, teamAges } from "@/lib/data";
import { dayLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { TeamAgesBoard, type AgeRow } from "./TeamAgesBoard";

/** Each team's average age, youngest to oldest. Built on the server; sorted in the browser. */
export function TeamAges({ s }: { s: Snapshot }) {
  const { teams, league } = teamAges(s);
  const byAbbr = new Map(s.teams.map((t) => [t.team, t]));
  const rows: AgeRow[] = teams.map((a) => {
    const t = byAbbr.get(a.team)!;
    return { ...a, nick: t.nick, name: t.name, vars: teamVars(t) };
  });
  return <TeamAgesBoard rows={rows} league={league} asOf={dayLabel(ageDate(s).toISOString().slice(0, 10))} />;
}
