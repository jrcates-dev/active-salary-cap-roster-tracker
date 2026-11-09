import { teamVars, UNITS } from "@/design/tokens";
import type { Snapshot, Unit } from "@/lib/types";
import { OffenseShareBoard, type UnitRow } from "./OffenseShareBoard";

/** Each team's counted cap split by unit. Built on the server; sorted in the browser. */
export function OffenseShare({ s }: { s: Snapshot }) {
  const rows: UnitRow[] = s.teams.map((team) => {
    const unitCap = Object.fromEntries(
      UNITS.map((u) => [
        u,
        s.rollup.find((r) => r.team === team.team && r.level === "unit" && r.unit === u)?.cap_total ?? 0,
      ]),
    ) as Record<Unit, number>;
    const total = UNITS.reduce((acc, u) => acc + unitCap[u], 0);
    return { team: team.team, nick: team.nick, name: team.name, vars: teamVars(team), unitCap, total };
  });
  return <OffenseShareBoard rows={rows} />;
}
