"use client";

import { money } from "@/lib/format";
import type { HistoryRow } from "@/lib/types";
import { sliceStyle, Swatch, type SliceKey } from "../Availability";
import { Tip, TipRow } from "../Tip";

const STACK: { k: SliceKey; field: keyof HistoryRow; label: string }[] = [
  { k: "year", field: "cap_inactive_year", label: "Out for season" },
  { k: "season", field: "cap_inactive_season", label: "Out long-term" },
  { k: "inactive", field: "cap_inactive_week", label: "Out that week" },
  { k: "questionable", field: "cap_questionable", label: "Questionable" },
];

/**
 * Money out, week by week: one column per week, money out for the season at the
 * bottom, other reserve-list money above it and that week's absences on top, all on
 * one axis.
 */
export function TeamTrend({
  color,
  rows,
  week,
}: {
  color: string;
  rows: HistoryRow[];
  week: number;
}) {
  const data = [...rows].sort((a, b) => a.week - b.week);
  const totals = data.map((r) => STACK.reduce((acc, s) => acc + Number(r[s.field] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const height = 140;
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((r, i) => (
          <Tip
            key={r.week}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            content={
              <div className="space-y-1">
                <div className="font-semibold">Week {r.week}</div>
                {[...STACK].reverse().map((s) => (
                  <TipRow
                    key={s.k}
                    label={s.label}
                    value={money(Number(r[s.field] ?? 0))}
                    swatch={<Swatch k={s.k} color={color} />}
                  />
                ))}
              </div>
            }
          >
            <div className="flex flex-col-reverse gap-[2px]" style={{ height: `${(totals[i] / max) * 100}%` }}>
              {STACK.map((s) => {
                const v = Number(r[s.field] ?? 0);
                if (v <= 0) return null;
                return (
                  <div
                    key={s.k}
                    className="min-h-[2px] rounded-[2px]"
                    style={{ flexGrow: v, flexBasis: 0, ...sliceStyle(s.k, color) }}
                  />
                );
              })}
            </div>
          </Tip>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5 border-t border-border pt-1">
        {data.map((r) => (
          <span
            key={r.week}
            className={`num flex-1 text-center text-xs ${r.week === week ? "text-fg" : "text-fg-faint"}`}
          >
            {r.week}
          </span>
        ))}
      </div>
      <p className="mt-1 text-xs text-fg-faint">Week · tallest column {money(max)}</p>
    </div>
  );
}
