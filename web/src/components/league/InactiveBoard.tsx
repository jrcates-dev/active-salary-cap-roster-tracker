import { displayColor } from "@/design/tokens";
import { money, pct } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { AvailabilityBar } from "../Availability";
import { TeamChip } from "../TeamChip";

/** All 32 teams ranked by cap sitting inactive this week, on one shared axis. */
export function InactiveBoard({ s }: { s: Snapshot }) {
  const rows = s.summary
    .map((sum) => ({ sum, team: s.teams.find((t) => t.team === sum.team)! }))
    .filter((r) => r.team)
    .sort((a, b) => b.sum.cap_inactive - a.sum.cap_inactive);
  const scale = Math.max(...rows.map((r) => r.sum.cap_total));
  return (
    <ol className="space-y-2">
      {rows.map(({ sum, team }, i) => {
        const color = displayColor(team);
        return (
          <li
            key={team.team}
            className="grid grid-cols-[1.5rem_5.5rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[1.5rem_8rem_1fr_7rem]"
          >
            <span className="num text-right text-fg-faint">{i + 1}</span>
            <TeamChip team={team.team} nick={team.nick} color={color} size="sm" />
            <AvailabilityBar
              color={color}
              scale={scale}
              height={16}
              title={`${team.name}${sum.on_bye ? ` · bye, week ${sum.status_week} statuses` : ""}`}
              slices={{
                active: sum.cap_active,
                questionable: sum.cap_questionable,
                inactive: sum.cap_inactive,
                unknown: sum.cap_unknown,
              }}
            />
            <span className="num text-right text-lg leading-none">
              {money(sum.cap_inactive)}
              <span className="ml-2 hidden text-sm text-fg-muted sm:inline">
                {pct(sum.cap_inactive / sum.cap_total, 0)}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
