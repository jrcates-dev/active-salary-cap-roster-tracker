"use client";

import { money } from "@/lib/format";
import type { HistoryRow } from "@/lib/types";
import { sliceClass, Swatch, type SliceKey } from "../Availability";
import { Tip, TipRow, TipTitle } from "../Tip";

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
export function TeamTrend({ rows, week }: { rows: HistoryRow[]; week: number }) {
  const data = [...rows].sort((a, b) => a.week - b.week);
  const totals = data.map((r) => STACK.reduce((acc, s) => acc + Number(r[s.field] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const height = 132;
  return (
    <div>
      <div className="relative" style={{ height }}>
        <span className="num pointer-events-none absolute top-0 right-0 text-[11px] text-ink-3">{money(max)}</span>
        <div className="absolute inset-x-0 top-0 border-t border-line" aria-hidden />
        <div className="flex h-full items-end gap-1.5 sm:gap-2">
          {data.map((r, i) => (
            <Tip
              key={r.week}
              className="group flex h-full min-w-0 flex-1 flex-col justify-end"
              content={
                <div>
                  <TipTitle>Week {r.week}</TipTitle>
                  {[...STACK].reverse().map((s) => (
                    <TipRow key={s.k} label={s.label} value={money(Number(r[s.field] ?? 0))} swatch={<Swatch k={s.k} />} />
                  ))}
                </div>
              }
            >
              <div
                className={`grow-up flex flex-col-reverse gap-[2px] transition-opacity duration-(--dur-1) group-hover:opacity-80 ${
                  r.week === week ? "" : ""
                }`}
                style={{ height: `${(totals[i] / max) * 100}%` }}
              >
                {STACK.map((s) => {
                  const v = Number(r[s.field] ?? 0);
                  if (v <= 0) return null;
                  return <div key={s.k} className={`${sliceClass(s.k)} min-h-[2px] rounded-[3px]`} style={{ flexGrow: v, flexBasis: 0 }} />;
                })}
              </div>
            </Tip>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1.5 border-t border-line pt-1.5 sm:gap-2">
        {data.map((r) => (
          <span key={r.week} className={`num flex-1 text-center text-[11px] ${r.week === week ? "font-semibold text-ink" : "text-ink-3"}`}>
            {r.week}
          </span>
        ))}
      </div>
    </div>
  );
}
