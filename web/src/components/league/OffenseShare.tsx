import { displayColor, unitMark } from "@/design/tokens";
import { money, pct } from "@/lib/format";
import type { Snapshot, Unit } from "@/lib/types";
import { TeamChip } from "../TeamChip";
import { Tip, TipRow } from "../Tip";

/** Units are neutral fills, not colors: team color stays reserved for identity. */
const UNIT_FILL: Record<Unit, string> = {
  offense: "#c9ced8",
  defense: "#6b7385",
  special_teams: "#3a404e",
};
const UNITS: Unit[] = ["offense", "defense", "special_teams"];

/** Each team's counted cap split by unit, ranked from most offense-heavy. */
export function OffenseShare({ s }: { s: Snapshot }) {
  const rows = s.teams
    .map((team) => {
      const unitCap = Object.fromEntries(
        UNITS.map((u) => [
          u,
          s.rollup.find((r) => r.team === team.team && r.level === "unit" && r.unit === u)?.cap_total ?? 0,
        ]),
      ) as Record<Unit, number>;
      const total = UNITS.reduce((acc, u) => acc + unitCap[u], 0);
      return { team, unitCap, total, off: total ? unitCap.offense / total : 0 };
    })
    .sort((a, b) => b.off - a.off);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg-muted">
        {UNITS.map((u) => (
          <span key={u} className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-[3px]" style={{ background: UNIT_FILL[u] }} />
            {unitMark[u].label}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-3 w-[2px] bg-fg" />
          Even split
        </span>
      </div>
      <ol className="space-y-1.5">
        {rows.map(({ team, unitCap, total, off }) => (
          <li key={team.team} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-3">
            <TeamChip team={team.team} nick={team.nick} color={displayColor(team)} size="sm" />
            <div className="relative h-4">
              <div className="flex h-full gap-[2px]">
                {UNITS.map((u) => (
                  <Tip
                    key={u}
                    className="h-full rounded-[3px]"
                    style={{ flexGrow: unitCap[u], flexBasis: 0, background: UNIT_FILL[u] }}
                    content={
                      <div className="space-y-1">
                        <div className="font-semibold">{team.name}</div>
                        <TipRow label={unitMark[u].label} value={`${money(unitCap[u])} · ${pct(unitCap[u] / total)}`} />
                      </div>
                    }
                  />
                ))}
              </div>
              <span
                aria-hidden
                className="pointer-events-none absolute -top-0.5 -bottom-0.5 left-1/2 w-[2px] -translate-x-1/2 bg-fg"
              />
            </div>
            <span className="num text-right text-base">{pct(off, 0)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
