import { HatchDefs, hatchId } from "./HatchDefs";
import { deadMoney, formatMoney } from "@/design/tokens";

export interface AvailabilitySlices {
  active: number;
  questionable: number;
  inactive: number;
  dead?: number;
}

/**
 * The one component every page reuses: a stacked bar of active, questionable,
 * inactive and dead money. Solid team color, dashed outline, hatched, flat gray.
 */
export function AvailabilityBar({
  team,
  color,
  slices,
  height = 28,
}: {
  team: string;
  color: string;
  slices: AvailabilitySlices;
  height?: number;
}) {
  const dead = slices.dead ?? 0;
  const total = slices.active + slices.questionable + slices.inactive + dead;
  if (total <= 0) return null;
  const w = (v: number) => (v / total) * 100;
  let x = 0;
  const segs: { key: string; width: number; fill: string; dashed?: boolean; label: string }[] = [
    { key: "active", width: w(slices.active), fill: color, label: "Active" },
    { key: "questionable", width: w(slices.questionable), fill: color, dashed: true, label: "Questionable" },
    { key: "inactive", width: w(slices.inactive), fill: `url(#${hatchId(team)})`, label: "Inactive" },
    { key: "dead", width: w(dead), fill: deadMoney, label: "Dead money" },
  ];
  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      role="img"
      aria-label={`${team}: ${formatMoney(slices.active)} active, ${formatMoney(slices.questionable)} questionable, ${formatMoney(slices.inactive)} inactive, ${formatMoney(dead)} dead`}
    >
      <HatchDefs teams={[{ team, color }]} />
      {segs.map((s) => {
        if (s.width <= 0) return null;
        const el = (
          <rect
            key={s.key}
            x={x}
            y={0}
            width={s.width}
            height={height}
            fill={s.fill}
            stroke={s.dashed ? color : "none"}
            strokeDasharray={s.dashed ? "3 2" : undefined}
            strokeWidth={s.dashed ? 1.5 : 0}
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${s.label}`}</title>
          </rect>
        );
        x += s.width;
        return el;
      })}
    </svg>
  );
}
