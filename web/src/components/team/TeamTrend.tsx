"use client";

import { money } from "@/lib/format";
import { rosterHref, type RosterStatus } from "@/lib/rosterLink";
import type { HistoryRow } from "@/lib/types";
import { SEGMENT_LINK, sliceClass, Swatch, type SliceKey } from "../Availability";
import { ChartLink } from "../ChartLink";
import { Tip, TipHint, TipRow, TipTitle } from "../Tip";

const STACK: { k: SliceKey; field: keyof HistoryRow; label: string }[] = [
  { k: "year", field: "cap_inactive_year", label: "Out for season" },
  { k: "season", field: "cap_inactive_season", label: "Out long-term" },
  { k: "inactive", field: "cap_inactive_week", label: "Out that week" },
  { k: "questionable", field: "cap_questionable", label: "Questionable" },
];

/**
 * Money out, week by week: one column per week, money out for the season at the
 * bottom, other reserve-list money above it and that week's absences on top, all on
 * one axis. Each band links to the roster list of the players behind it in that
 * week, and the rest of the column (and its week number) to everyone out that week.
 * `league` is the average team's rows (`leagueHistoryAverage`): a tick across each
 * column marks the league average of the same stacked total that week.
 */
export function TeamTrend({
  team,
  rows,
  week,
  league = [],
}: {
  team: string;
  rows: HistoryRow[];
  week: number;
  league?: HistoryRow[];
}) {
  /** The roster as it stood in a week: the live one for the current week. */
  const href = (w: number, status?: RosterStatus) => rosterHref(team, { week: w === week ? undefined : w, status });
  const data = [...rows].sort((a, b) => a.week - b.week);
  const total = (r: HistoryRow) => STACK.reduce((acc, s) => acc + Number(r[s.field] ?? 0), 0);
  const totals = data.map(total);
  const avgs = data.map((r) => {
    const a = league.find((l) => l.week === r.week);
    return a ? total(a) : null;
  });
  const max = Math.max(1, ...totals, ...avgs.map((a) => a ?? 0));
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
                    <TipRow key={s.k} label={s.label} value={money(Number(r[s.field] ?? 0))} swatch={<Swatch k={s.k} />} />
                  ))}
                  {avgs[i] !== null && (
                    <div className="mt-1 border-t border-line pt-1">
                      <TipRow label="Team total" value={money(totals[i])} />
                      <TipRow label="League average" value={money(avgs[i]!)} swatch={<AverageSwatch />} />
                    </div>
                  )}
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
                  const v = Number(r[s.field] ?? 0);
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
              {avgs[i] !== null && avgs[i]! > 0 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 h-0.5 translate-y-1/2 rounded-full bg-ink"
                  style={{ bottom: `${(avgs[i]! / max) * 100}%`, boxShadow: "0 0 0 1.5px var(--surface)" }}
                />
              )}
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

/** The league-average tick, as drawn over each week's column, for legends and tips. */
export function AverageSwatch() {
  return (
    <span aria-hidden className="flex h-3 w-3.5 items-center">
      <span className="h-0.5 w-full rounded-full bg-ink" />
    </span>
  );
}
