"use client";

import { useMemo, useState } from "react";
import { unitMark, UNITS } from "@/design/tokens";
import { money, pct } from "@/lib/format";
import type { Unit } from "@/lib/types";
import { byDir, SortChip, useSort } from "../Sort";
import { TeamChip } from "../TeamChip";
import { Tip, TipRow } from "../Tip";

/** Units are neutral fills, not colors: team color stays reserved for identity. */
const UNIT_FILL: Record<Unit, string> = {
  offense: "#c9ced8",
  defense: "#6b7385",
  special_teams: "#3a404e",
};

export interface UnitRow {
  team: string;
  nick: string;
  name: string;
  color: string;
  unitCap: Record<Unit, number>;
  total: number;
}

/**
 * Each team's counted cap split by unit, ranked from most offense-heavy until the
 * reader picks another unit. Clicking a unit ranks teams by that unit's share of
 * their cap; clicking it again flips the order.
 */
export function OffenseShareBoard({ rows }: { rows: UnitRow[] }) {
  const [sort, toggleSort] = useSort<Unit>("offense");
  const [picked, setPicked] = useState(false);
  const share = (r: UnitRow, u: Unit) => (r.total ? r.unitCap[u] / r.total : 0);

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          byDir(share(a, sort.key), share(b, sort.key), sort.dir) ||
          byDir(a.unitCap[sort.key], b.unitCap[sort.key], sort.dir) ||
          a.nick.localeCompare(b.nick),
      ),
    [rows, sort],
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-1 gap-y-1" role="group" aria-label="Rank teams by">
        <span className="mr-1 text-sm text-fg-faint">Rank by</span>
        {UNITS.map((u) => (
          <SortChip
            key={u}
            active={sort.key === u}
            dir={sort.dir}
            onClick={() => {
              toggleSort(u);
              setPicked(true);
            }}
            label={unitMark[u].label}
            swatch={<span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: UNIT_FILL[u] }} />}
            ascLabel="smallest share first"
            descLabel="biggest share first"
          />
        ))}
        <span className="ml-3 flex items-center gap-2 text-sm text-fg-muted">
          <span aria-hidden className="h-3 w-[2px] bg-fg" />
          Even split
        </span>
      </div>
      <ol className="space-y-1.5">
        {sorted.map((r, i) => (
          <li key={r.team} className="grid grid-cols-[1.5rem_5.5rem_1fr_3rem] items-center gap-3">
            <span className="num text-right text-fg-faint">{i + 1}</span>
            <TeamChip team={r.team} nick={r.nick} color={r.color} size="sm" />
            <div className="relative h-4">
              <div className="flex h-full gap-[2px]">
                {UNITS.map((u) => (
                  <Tip
                    key={u}
                    className="h-full rounded-[3px]"
                    style={{
                      flexGrow: r.unitCap[u],
                      flexBasis: 0,
                      background: UNIT_FILL[u],
                      opacity: picked && sort.key !== u ? 0.35 : undefined,
                    }}
                    content={
                      <div className="space-y-1">
                        <div className="font-semibold">{r.name}</div>
                        {UNITS.map((v) => (
                          <TipRow
                            key={v}
                            label={unitMark[v].label}
                            value={`${money(r.unitCap[v])} · ${pct(share(r, v))}`}
                          />
                        ))}
                      </div>
                    }
                  />
                ))}
              </div>
              <span
                aria-hidden
                className="pointer-events-none absolute -top-0.5 -bottom-0.5 left-1/2 w-[2px] -translate-x-1/2 bg-fg"
              />
            </div>
            <span className="num text-right text-base" title={`${unitMark[sort.key].label} share`}>
              {pct(share(r, sort.key), 0)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
