"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { unitMark, UNITS } from "@/design/tokens";
import { money, pct } from "@/lib/format";
import type { Unit } from "@/lib/types";
import { byDir, SortChip, useSort } from "../Sort";
import { TeamChip } from "../TeamChip";
import { Tip, TipRow, TipTitle } from "../Tip";

/** Units are three neutral steps, not colors: team color stays reserved for identity. */
const UNIT_FILL: Record<Unit, string> = {
  offense: "var(--ink-2)",
  defense: "var(--ink-4)",
  special_teams: "var(--line-2)",
};

export interface UnitRow {
  team: string;
  nick: string;
  name: string;
  vars: CSSProperties;
  unitCap: Record<Unit, number>;
  total: number;
}

/**
 * Each team's counted cap split by unit, ranked from most offense-heavy until the
 * reader picks another unit. Clicking a unit ranks teams by that unit's share;
 * clicking it again flips the order.
 */
export function OffenseShareBoard({ rows }: { rows: UnitRow[] }) {
  const [sort, toggleSort] = useSort<Unit>("offense");
  const [picked, setPicked] = useState(false);
  const [animate, setAnimate] = useState(true);
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
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="-ml-2 flex flex-wrap items-center gap-0.5" role="group" aria-label="Rank teams by">
          {UNITS.map((u) => (
            <SortChip
              key={u}
              active={sort.key === u}
              dir={sort.dir}
              onClick={() => {
                setAnimate(false);
                toggleSort(u);
                setPicked(true);
              }}
              label={unitMark[u].label}
              swatch={<span aria-hidden className="sw" style={{ background: UNIT_FILL[u] }} />}
              ascLabel="smallest share first"
              descLabel="biggest share first"
            />
          ))}
        </div>
        <span className="flex items-center gap-2 text-[13px] text-ink-2">
          <span aria-hidden className="h-3 w-0.5 rounded-full bg-ink" />
          Even split
        </span>
      </div>
      <ol className="space-y-[7px]">
        {sorted.map((r, i) => (
          <li key={r.team} className="grid grid-cols-[1.25rem_5.25rem_1fr_2.75rem] items-center gap-x-3 sm:grid-cols-[1.5rem_7.5rem_1fr_3rem]">
            <span className="num text-right text-xs text-ink-3">{i + 1}</span>
            <TeamChip team={r.team} nick={r.nick} vars={r.vars} size="sm" />
            <div className="relative h-2.5">
              <div className={`flex h-full gap-[2px] ${animate ? "grow" : ""}`}>
                {UNITS.map((u) => (
                  <Tip
                    key={u}
                    className="h-full rounded-[3px] transition-opacity duration-(--dur-2)"
                    style={{
                      flexGrow: r.unitCap[u],
                      flexBasis: 0,
                      background: UNIT_FILL[u],
                      opacity: picked && sort.key !== u ? 0.3 : undefined,
                    }}
                    content={
                      <div>
                        <TipTitle>{r.name}</TipTitle>
                        {UNITS.map((v) => (
                          <TipRow key={v} label={unitMark[v].label} value={`${money(r.unitCap[v])} · ${pct(share(r, v))}`} />
                        ))}
                      </div>
                    }
                  />
                ))}
              </div>
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-y-1 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-ink"
                style={{ boxShadow: "0 0 0 2px var(--surface)" }}
              />
            </div>
            <span className="num text-right text-sm font-medium" title={`${unitMark[sort.key].label} share`}>
              {pct(share(r, sort.key), 0)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
