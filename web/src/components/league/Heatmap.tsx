"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import { intensityColor, intensityInk, intensityRamp, unitMark } from "@/design/tokens";
import { money, ordinal, pct } from "@/lib/format";
import type { Group } from "@/lib/types";
import { ariaSort, byDir, SortHeader, useSort } from "../Sort";
import { Tip, TipRow } from "../Tip";

export interface HeatRow {
  team: string;
  nick: string;
  name: string;
  color: string;
  total: number;
  cells: Record<string, { cap: number; inactive: number }>;
}

/**
 * 32 teams by 13 position groups. Each cell is the group's share of the team's
 * counted cap, shaded relative to the other 31 teams in that column, so a bright
 * cell means "spends more here than most of the league".
 */
export function Heatmap({ groups, rows }: { groups: Group[]; rows: HeatRow[] }) {
  // Team names read A to Z first; every money column reads biggest share first.
  const [sort, toggleSort] = useSort<string>("team", (k) => (k === "team" ? "asc" : "desc"));

  const ranges = useMemo(() => {
    const out: Record<string, { min: number; max: number; ranks: Record<string, number> }> = {};
    for (const g of groups) {
      const shares = rows.map((r) => ({ team: r.team, v: (r.cells[g.code]?.cap ?? 0) / r.total }));
      const sorted = [...shares].sort((a, b) => b.v - a.v);
      out[g.code] = {
        min: sorted[sorted.length - 1]?.v ?? 0,
        max: sorted[0]?.v ?? 0,
        ranks: Object.fromEntries(sorted.map((x, i) => [x.team, i + 1])),
      };
    }
    return out;
  }, [groups, rows]);

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    const byName = (a: HeatRow, b: HeatRow) => a.nick.localeCompare(b.nick);
    if (key === "team") return [...rows].sort((a, b) => (dir === "asc" ? byName(a, b) : byName(b, a)));
    const share = (r: HeatRow) => (r.cells[key]?.cap ?? 0) / r.total;
    return [...rows].sort((a, b) => byDir(share(a), share(b), dir) || byName(a, b));
  }, [rows, sort]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted">
        <p>Share of each team&apos;s counted cap. Click a column to rank teams by it, and click again to flip the order.</p>
        <div className="flex items-center gap-2" aria-label="Color scale">
          <span>Less than the league</span>
          <span className="flex gap-[2px]">
            {intensityRamp.map((c) => (
              <span key={c} className="h-3 w-4 rounded-[2px]" style={{ background: c }} />
            ))}
          </span>
          <span>More</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-[2px] text-sm">
          <thead>
            <tr>
              <th scope="col" className="w-28 text-left font-medium" aria-sort={ariaSort(sort.key === "team", sort.dir)}>
                <SortHeader
                  active={sort.key === "team"}
                  dir={sort.dir}
                  onClick={() => toggleSort("team")}
                  label="team name"
                  ascLabel="A to Z"
                  descLabel="Z to A"
                >
                  Team
                </SortHeader>
              </th>
              {groups.map((g, i) => (
                <Fragment key={g.code}>
                  {i > 0 && groups[i - 1].unit !== g.unit && <th aria-hidden className="w-2" />}
                  <th
                    scope="col"
                    title={g.label}
                    className="font-medium"
                    aria-sort={ariaSort(sort.key === g.code, sort.dir)}
                  >
                    <span aria-hidden className="block text-[10px] text-fg-faint">
                      {unitMark[g.unit].glyph}
                    </span>
                    <SortHeader
                      active={sort.key === g.code}
                      dir={sort.dir}
                      onClick={() => toggleSort(g.code)}
                      label={`${g.label} share`}
                    >
                      {g.code}
                    </SortHeader>
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.team}>
                <th scope="row" className="pr-2 text-left font-normal">
                  <Link href={`/team/${r.team}`} className="flex items-center gap-2 hover:underline">
                    <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                    <span className="num text-base font-semibold">{r.nick}</span>
                  </Link>
                </th>
                {groups.map((g, i) => {
                  const cell = r.cells[g.code] ?? { cap: 0, inactive: 0 };
                  const share = cell.cap / r.total;
                  const range = ranges[g.code];
                  const t = range.max > range.min ? (share - range.min) / (range.max - range.min) : 0;
                  const gap = i > 0 && groups[i - 1].unit !== g.unit;
                  return (
                    <Fragment key={g.code}>
                    {gap && <td aria-hidden />}
                    <Tip
                      as="td"
                      className="num h-8 rounded-[3px] text-center text-[15px]"
                      style={{ background: intensityColor(t), color: intensityInk(t) }}
                      content={
                        <div className="space-y-1">
                          <div className="font-semibold">
                            {r.name} · {g.label}
                          </div>
                          <TipRow label="Cap" value={money(cell.cap)} />
                          <TipRow label="Share of team cap" value={pct(share)} />
                          <TipRow label="Out this week" value={money(cell.inactive)} />
                          <TipRow label="League rank by share" value={`${ordinal(range.ranks[r.team])} of 32`} />
                        </div>
                      }
                    >
                      {(share * 100).toFixed(share < 0.1 ? 1 : 0)}
                    </Tip>
                    </Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
