"use client";

import { UNIT_COLOR, unitMark } from "@/design/tokens";
import { money, ordinal } from "@/lib/format";
import { rosterHref, statusHrefs } from "@/lib/rosterLink";
import type { Group, RollupRow, Unit } from "@/lib/types";
import { AvailabilityBar, slicesOf } from "../Availability";
import { ChartLink } from "../ChartLink";
import { useMoneyMode } from "./MoneyMode";

export interface GroupLine {
  group: Group;
  row: RollupRow | null;
  median: number;
  rank: number;
}

const EMPTY = { active: 0, questionable: 0, inactive: 0, season: 0, year: 0, unknown: 0 };

/**
 * Every position group on one shared axis, by unit: offense beside defense, five
 * rows each at a fixed height so the two sides line up row for row, and special
 * teams under offense. Each bar is split by availability; the tick is the league
 * median for that group; the rank is out of 32 by money spent.
 */
export function GroupBreakdown({ team, lines, unitRows }: { team: { team: string; name: string }; lines: GroupLine[]; unitRows: RollupRow[] }) {
  const scale = Math.max(1, ...lines.map((l) => Math.max(l.row?.cap_total ?? 0, l.median)));
  const unit = (u: Unit) => (
    <UnitBlock key={u} team={team} u={u} lines={lines.filter((l) => l.group.unit === u)} total={unitRows.find((r) => r.unit === u)} scale={scale} />
  );
  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2">
      {unit("offense")}
      {unit("defense")}
      {unit("special_teams")}
    </div>
  );
}

function UnitBlock({
  team,
  u,
  lines,
  total,
  scale,
}: {
  team: { team: string; name: string };
  u: Unit;
  lines: GroupLine[];
  total?: RollupRow;
  scale: number;
}) {
  const { fmt } = useMoneyMode();
  const out = total ? total.cap_inactive_week + total.cap_inactive_season + (total.cap_inactive_year ?? 0) : 0;
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-line pb-2">
        <h3 className="flex items-center gap-2 text-[13px] font-medium tracking-[0.06em] text-ink-2 uppercase">
          <span aria-hidden className="text-[10px]" style={{ color: UNIT_COLOR[u] }}>
            {unitMark[u].glyph}
          </span>
          <ChartLink
            href={rosterHref(team.team, { unit: u })}
            label={`${unitMark[u].label}: show these players`}
            tapPreview={false}
            className="underline-offset-4 hover:text-ink hover:underline"
          >
            {unitMark[u].label}
          </ChartLink>
        </h3>
        <p className="num text-right text-sm">
          <span className="font-semibold">{fmt(total?.cap_total ?? 0)}</span>
          {out > 0 && <span className="ml-2 text-ink-3">{fmt(out)} out</span>}
        </p>
      </div>
      <div className="space-y-2.5">
        {lines.map((l) => {
          const r = l.row;
          const cap = r?.cap_total ?? 0;
          const outWeek = r?.cap_inactive_week ?? 0;
          const reserve = (r?.cap_inactive_season ?? 0) + (r?.cap_inactive_year ?? 0);
          return (
            <div key={l.group.code} className="grid min-h-9 grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_2.5rem] items-center gap-x-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_5rem_2.75rem]">
              <ChartLink
                href={rosterHref(team.team, { groups: [l.group.code] })}
                label={`${l.group.code}, ${l.group.label}: show these players`}
                tapPreview={false}
                className="group min-w-0"
              >
                <div className="num text-sm leading-none font-semibold underline-offset-4 group-hover:underline">{l.group.code}</div>
                <div className="mt-0.5 hidden truncate text-[11px] text-ink-3 group-hover:text-ink-2 sm:block">{l.group.label}</div>
              </ChartLink>
              <AvailabilityBar
                scale={scale}
                height={12}
                title={`${l.group.label} · ${r?.players ?? 0} players`}
                slices={r ? slicesOf(r) : EMPTY}
                marker={l.median}
                markerLabel={`League median ${money(l.median)}`}
                subject={`${team.name} ${l.group.label}`}
                hrefs={statusHrefs(team.team, { groups: [l.group.code] })}
              />
              <div className="num text-right text-sm leading-none">
                <span className="font-medium">{fmt(cap)}</span>
                {outWeek + reserve > 0 && (
                  <div className="mt-0.5 text-[11px] text-ink-3">
                    {outWeek > 0 && `${fmt(outWeek)} out`}
                    {outWeek > 0 && reserve > 0 && " · "}
                    {reserve > 0 && `${fmt(reserve)} reserve`}
                  </div>
                )}
              </div>
              <div className="num text-right text-xs text-ink-3" title={`${ordinal(l.rank)} highest ${l.group.code} spend of 32`}>
                <span className="text-sm font-medium text-ink-2">{ordinal(l.rank)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
