"use client";

import { unitMark } from "@/design/tokens";
import { money, ordinal } from "@/lib/format";
import type { Group, RollupRow, Unit } from "@/lib/types";
import { AvailabilityBar, slicesOf } from "../Availability";
import { useMoneyMode } from "./MoneyMode";

export interface GroupLine {
  group: Group;
  row: RollupRow | null;
  median: number;
  rank: number;
}

const UNITS: Unit[] = ["offense", "defense", "special_teams"];

/**
 * Every position group on one shared axis, grouped by unit. Each bar is split by
 * availability; the tick marks the league median for that group.
 */
export function GroupBreakdown({
  color,
  lines,
  unitRows,
}: {
  color: string;
  lines: GroupLine[];
  unitRows: RollupRow[];
}) {
  const { fmt } = useMoneyMode();
  const scale = Math.max(1, ...lines.map((l) => Math.max(l.row?.cap_total ?? 0, l.median)));
  return (
    <div className="space-y-8">
      {UNITS.map((u) => {
        const unitLines = lines.filter((l) => l.group.unit === u);
        const total = unitRows.find((r) => r.unit === u);
        return (
          <section key={u}>
            <div className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold tracking-wider text-fg-muted uppercase">
                <span aria-hidden className="text-fg-faint">
                  {unitMark[u].glyph}
                </span>
                {unitMark[u].label}
              </h3>
              <span className="num text-right text-lg text-fg">
                {fmt(total?.cap_total ?? 0)}
                {total && total.cap_inactive_week + total.cap_inactive_season + (total.cap_inactive_year ?? 0) > 0 && (
                  <span className="ml-3 text-sm text-fg-muted">
                    {fmt(total.cap_inactive_week)} out this week · {fmt(total.cap_inactive_season)} long-term
                    {(total.cap_inactive_year ?? 0) > 0 && <> · {fmt(total.cap_inactive_year ?? 0)} for season</>}
                  </span>
                )}
              </span>
            </div>
            <div className="space-y-3">
              {unitLines.map((l) => {
                const r = l.row;
                const cap = r?.cap_total ?? 0;
                return (
                  <div
                    key={l.group.code}
                    className="grid grid-cols-[3rem_1fr_5.5rem] items-center gap-3 sm:grid-cols-[8.5rem_1fr_5.5rem_4.5rem]"
                  >
                    <div className="min-w-0">
                      <div className="num text-lg leading-none font-semibold">{l.group.code}</div>
                      <div className="hidden truncate text-xs text-fg-muted sm:block">
                        {l.group.label}
                      </div>
                      <div
                        className="num text-xs text-fg-muted sm:hidden"
                        title={`${ordinal(l.rank)} highest ${l.group.code} spend of 32 teams`}
                      >
                        {ordinal(l.rank)}
                      </div>
                    </div>
                    <AvailabilityBar
                      color={color}
                      scale={scale}
                      height={18}
                      title={`${l.group.label} · ${r?.players ?? 0} players`}
                      slices={
                        r
                          ? slicesOf(r)
                          : { active: 0, questionable: 0, inactive: 0, season: 0, year: 0, unknown: 0 }
                      }
                      marker={l.median}
                      markerLabel={`League median for ${l.group.code}: ${money(l.median)}`}
                    />
                    <div className="num text-right text-lg leading-none">
                      {fmt(cap)}
                      {r && r.cap_inactive_week > 0 && (
                        <div className="text-xs text-fg-muted">{fmt(r.cap_inactive_week)} out</div>
                      )}
                      {r && r.cap_inactive_season > 0 && (
                        <div className="text-xs text-fg-faint">{fmt(r.cap_inactive_season)} long-term</div>
                      )}
                      {r && (r.cap_inactive_year ?? 0) > 0 && (
                        <div className="text-xs text-fg-faint">{fmt(r.cap_inactive_year ?? 0)} for season</div>
                      )}
                    </div>
                    <div
                      className="hidden text-right text-xs text-fg-muted sm:block"
                      title={`${ordinal(l.rank)} highest ${l.group.code} spend of 32 teams`}
                    >
                      <span className="num text-base text-fg">{ordinal(l.rank)}</span> of 32
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
