"use client";

import Link from "next/link";
import { Fragment, useMemo, type CSSProperties } from "react";
import { rampStep, UNIT_COLOR, unitMark, UNITS } from "@/design/tokens";
import { money, ordinal, pct } from "@/lib/format";
import type { Group } from "@/lib/types";
import { ariaSort, byDir, SortHeader, useSort } from "../Sort";
import { TeamChip } from "../TeamChip";
import { Tip, TipRow, TipTitle } from "../Tip";

export interface HeatRow {
  team: string;
  nick: string;
  name: string;
  vars: CSSProperties;
  total: number;
  cells: Record<string, { cap: number; inactive: number }>;
}

/**
 * 32 teams by 13 position groups. Each cell is the group's share of the team's
 * counted cap, shaded against the other 31 teams in that column, so a dark cell
 * means "spends more here than most of the league". Click a column to rank by it.
 */
export function Heatmap({ groups, rows }: { groups: Group[]; rows: HeatRow[] }) {
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

  const unitSpan = (u: string) => groups.filter((g) => g.unit === u).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[13px] text-ink-2">
        <p>Share of team cap, shaded within each column</p>
        <div className="flex items-center gap-2" aria-label="Color scale">
          <span>Less</span>
          <span className="flex gap-[2px]">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="h-2.5 w-3.5 rounded-[2px]" style={{ background: `var(--ramp-${i})` }} />
            ))}
          </span>
          <span>More</span>
        </div>
      </div>
      <div className="strip -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[820px] table-fixed border-separate border-spacing-[2px] text-[13px]">
          <thead>
            <tr>
              <td className="w-[7.5rem]" />
              {UNITS.map((u, i) => (
                <Fragment key={u}>
                  {i > 0 && <td className="w-1.5" />}
                  <th scope="colgroup" colSpan={unitSpan(u)} className="pb-1 text-center text-[11px] font-medium tracking-[0.08em] text-ink-3 uppercase">
                    <span aria-hidden className="mr-1.5 text-[9px]" style={{ color: UNIT_COLOR[u] }}>
                      {unitMark[u].glyph}
                    </span>
                    {unitMark[u].label}
                  </th>
                </Fragment>
              ))}
            </tr>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-bg text-left text-xs font-medium text-ink-3" aria-sort={ariaSort(sort.key === "team", sort.dir)}>
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
                  {i > 0 && groups[i - 1].unit !== g.unit && <th aria-hidden className="w-1.5" />}
                  <th scope="col" title={g.label} className="pb-1 text-center text-xs font-medium text-ink-3" aria-sort={ariaSort(sort.key === g.code, sort.dir)}>
                    <SortHeader active={sort.key === g.code} dir={sort.dir} onClick={() => toggleSort(g.code)} label={`${g.code} share (${g.label})`} align="center">
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
                <th scope="row" className="sticky left-0 z-10 bg-bg pr-2 text-left font-normal">
                  <TeamChip team={r.team} nick={r.nick} vars={r.vars} size="sm" />
                </th>
                {groups.map((g, i) => {
                  const cell = r.cells[g.code] ?? { cap: 0, inactive: 0 };
                  const share = cell.cap / r.total;
                  const range = ranges[g.code];
                  const t = range.max > range.min ? (share - range.min) / (range.max - range.min) : 0;
                  const step = rampStep(t);
                  const gap = i > 0 && groups[i - 1].unit !== g.unit;
                  return (
                    <Fragment key={g.code}>
                      {gap && <td aria-hidden />}
                      <Tip
                        as="td"
                        className="num h-8 rounded-[4px] text-center transition-[box-shadow] duration-(--dur-1) hover:shadow-[inset_0_0_0_2px_var(--ink)]"
                        style={{ background: `var(--ramp-${step})`, color: `var(--ramp-ink-${step})` }}
                        content={
                          <div>
                            <TipTitle>
                              {r.name} · {g.label}
                            </TipTitle>
                            <TipRow label="Cap" value={money(cell.cap)} />
                            <TipRow label="Share of cap" value={pct(share)} />
                            <TipRow label="Out this week" value={money(cell.inactive)} />
                            <TipRow label="Rank by share" value={`${ordinal(range.ranks[r.team])} of 32`} />
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
      <p className="sr-only">
        <Link href="/methodology">How shares are computed</Link>
      </p>
    </div>
  );
}
