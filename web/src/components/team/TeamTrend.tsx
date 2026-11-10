"use client";

import { outOf, reserveLine } from "@/lib/availability";
import { money } from "@/lib/format";
import { rosterHref, type RosterStatus } from "@/lib/rosterLink";
import type { HistoryRow } from "@/lib/types";
import { SEGMENT_LINK, sliceClass, Swatch, type SliceKey } from "../Availability";
import { ChartLink } from "../ChartLink";
import { Tip, TipHint, TipRow, TipTitle } from "../Tip";

const STACK: { k: SliceKey; value: (r: HistoryRow) => number; label: string }[] = [
  { k: "year", value: (r) => r.cap_inactive_year ?? 0, label: "Out for season" },
  { k: "inactive", value: outOf, label: "Out" },
  { k: "questionable", value: (r) => r.cap_questionable, label: "Questionable" },
];

/**
 * Money out, week by week: one column per week, money out for the season at the
 * bottom, the rest of that week's money out above it and questionable money on top,
 * all on one axis. Each band links to the roster list of the players behind it in that
 * week, and the rest of the column (and its week number) to everyone out that week.
 */
export function TeamTrend({ team, rows, week }: { team: string; rows: HistoryRow[]; week: number }) {
  /** The roster as it stood in a week: the live one for the current week. */
  const href = (w: number, status?: RosterStatus) => rosterHref(team, { week: w === week ? undefined : w, status });
  const data = [...rows].sort((a, b) => a.week - b.week);
  const totals = data.map((r) => STACK.reduce((acc, s) => acc + s.value(r), 0));
  const max = Math.max(1, ...totals);
  const height = 132;
  return (
    <div>
      {/* The scale's top value sits above its gridline, clear of the tallest bar. */}
      <p className="num mb-1 text-right text-[11px] leading-none text-ink-3">{money(max)}</p>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-x-0 top-0 border-t border-line" aria-hidden />
        <div className="flex h-full items-end gap-1.5 sm:gap-2">
          {data.map((r, i) => (
            <Tip
              key={r.week}
              className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
              content={
                <div>
                  <TipTitle>Week {r.week}</TipTitle>
                  {[...STACK].reverse().map((s) => (
                    <div key={s.k}>
                      <TipRow label={s.label} value={money(s.value(r))} swatch={<Swatch k={s.k} />} />
                      {s.k === "inactive" && reserveLine(outOf(r), r.cap_inactive_season) && (
                        <p className="mb-0.5 text-ink-3">{reserveLine(outOf(r), r.cap_inactive_season)}</p>
                      )}
                    </div>
                  ))}
                  {totals[i] > 0 && <TipHint>see who was out</TipHint>}
                </div>
              }
            >
              {/* Behind the bands: the whole column opens everyone out that week. */}
              <ChartLink
                href={href(r.week)}
                label={`Week ${r.week}: ${money(totals[i])} out or questionable. Show these players`}
                className="absolute inset-0 rounded-[3px] transition-colors duration-(--dur-1) hover:bg-surface-2"
              />
              <div className="bar-grow-up pointer-events-none relative flex flex-col-reverse gap-[2px]" style={{ height: `${(totals[i] / max) * 100}%` }}>
                {STACK.map((s) => {
                  const v = s.value(r);
                  if (v <= 0) return null;
                  return (
                    <div key={s.k} className={`${sliceClass(s.k)} pointer-events-auto relative min-h-[2px] rounded-[3px]`} style={{ flexGrow: v, flexBasis: 0 }}>
                      <ChartLink
                        href={href(r.week, s.k as RosterStatus)}
                        label={`Week ${r.week}, ${s.label.toLowerCase()} ${money(v)}: show these players`}
                        className={SEGMENT_LINK}
                      />
                    </div>
                  );
                })}
              </div>
            </Tip>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1.5 border-t border-line pt-1.5 sm:gap-2">
        {data.map((r) => (
          <ChartLink
            key={r.week}
            href={href(r.week)}
            tapPreview={false}
            label={`Week ${r.week}: show who was out`}
            className={`num flex-1 rounded text-center text-[11px] hover:text-ink hover:underline ${r.week === week ? "font-semibold text-ink" : "text-ink-3"}`}
          >
            {r.week}
          </ChartLink>
        ))}
      </div>
    </div>
  );
}
