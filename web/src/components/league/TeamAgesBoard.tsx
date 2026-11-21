"use client";

import { useMemo, type CSSProperties } from "react";
import { UNIT_COLOR } from "@/design/tokens";
import type { AgeScope, TeamAge } from "@/lib/data";
import { ageLabel, ordinal } from "@/lib/format";
import { rosterHref } from "@/lib/rosterLink";
import { useViewState } from "@/lib/viewState";
import { ChartLink } from "../ChartLink";
import { TeamChip } from "../TeamChip";
import { Tip, TipHint, TipRow, TipTitle } from "../Tip";
import { Note } from "../ui";
import { Segmented } from "../ui/controls";

export interface AgeRow extends TeamAge {
  nick: string;
  name: string;
  logo: string | null;
  vars: CSSProperties;
}

type Order = "young" | "old";

const SCOPE_LABEL: Record<AgeScope, string> = { all: "Whole team", offense: "Offense", defense: "Defense" };
const SCOPES = Object.keys(SCOPE_LABEL) as AgeScope[];
/** The dot: ink for the whole team, the unit's color for one side of the ball. */
const DOT: Record<AgeScope, string> = { all: "var(--ink)", offense: UNIT_COLOR.offense, defense: UNIT_COLOR.defense };

/** 1 -> "youngest", last -> "oldest", else "12th youngest". */
const rankWords = (rank: number, of: number) => (rank === 1 ? "youngest" : rank === of ? "oldest" : `${ordinal(rank)} youngest`);

const COLS = "grid grid-cols-[1.25rem_5.25rem_minmax(0,1fr)_2.25rem] items-center gap-x-3 sm:grid-cols-[1.5rem_7.5rem_minmax(0,1fr)_2.75rem]";

/**
 * Every team's average age on one scale, youngest first or oldest first, for the
 * whole team or one side of the ball. Each dot hangs off the league average, so a
 * stem to the left reads younger than the league and one to the right older.
 * The track links to that team's roster (the unit's players when one is picked).
 */
export function TeamAgesBoard({ rows, league, asOf }: { rows: AgeRow[]; league: Record<AgeScope, number | null>; asOf: string }) {
  const [scope, setScope] = useViewState<AgeScope>("team-ages-scope", "all", (v) => SCOPES.includes(v as AgeScope));
  const [order, setOrder] = useViewState<Order>("team-ages-order", "young", (v) => v === "young" || v === "old");

  /** Youngest is 1st, per scope, for the tooltips. */
  const youngRank = useMemo(() => {
    const out = {} as Record<AgeScope, Map<string, number>>;
    for (const k of SCOPES) {
      const ranked = rows.filter((r) => r.age[k] != null).sort((a, b) => a.age[k]! - b.age[k]!);
      out[k] = new Map(ranked.map((r, i) => [r.team, i + 1]));
    }
    return out;
  }, [rows]);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const va = a.age[scope];
        const vb = b.age[scope];
        if (va == null || vb == null) return va == null ? (vb == null ? a.nick.localeCompare(b.nick) : 1) : -1;
        return (order === "young" ? va - vb : vb - va) || a.nick.localeCompare(b.nick);
      }),
    [rows, scope, order],
  );

  // Whole years across the picked scope's range, with a little room at each end.
  const values = rows.map((r) => r.age[scope]).filter((v): v is number => v != null);
  const lo = values.length ? Math.floor(Math.min(...values) - 0.2) : 22;
  const hi = values.length ? Math.ceil(Math.max(...values) + 0.2) : 30;
  const step = hi - lo > 8 ? 2 : 1;
  const ticks = Array.from({ length: Math.floor((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const avg = league[scope];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented<AgeScope>
          label="Average age of"
          value={scope}
          onChange={setScope}
          options={SCOPES.map((k) => ({ value: k, label: SCOPE_LABEL[k] }))}
        />
        <Segmented<Order>
          label="Order"
          value={order}
          onChange={setOrder}
          options={[
            { value: "young", label: "Youngest first" },
            { value: "old", label: "Oldest first" },
          ]}
        />
        {avg != null && (
          <span className="flex items-center gap-2 text-[13px] text-ink-2">
            <span aria-hidden className="h-3 w-0.5 rounded-full bg-ink" />
            League <span className="num font-medium text-ink">{ageLabel(avg)}</span>
          </span>
        )}
      </div>
      <div aria-hidden className={`${COLS} mb-1.5 text-[11px] text-ink-3`}>
        <span />
        <span />
        <span className="relative h-4">
          {ticks.map((t) => (
            <span key={t} className="num absolute top-0 -translate-x-1/2" style={{ left: x(t) }}>
              {t}
            </span>
          ))}
        </span>
        <span className="text-right font-medium tracking-[0.06em] uppercase">Age</span>
      </div>
      <ol className="space-y-[5px]">
        {sorted.map((r, i) => {
          const v = r.age[scope];
          return (
            <li key={r.team} className={COLS}>
              <span className="num text-right text-xs text-ink-3">{i + 1}</span>
              <TeamChip team={r.team} nick={r.nick} logo={r.logo} vars={r.vars} size="sm" />
              <Tip
                className="relative h-5"
                content={
                  <div>
                    <TipTitle>{r.name}</TipTitle>
                    {SCOPES.map((k) => (
                      <TipRow
                        key={k}
                        label={SCOPE_LABEL[k]}
                        value={r.age[k] != null ? `${ageLabel(r.age[k]!)} · ${rankWords(youngRank[k].get(r.team)!, youngRank[k].size)}` : "–"}
                      />
                    ))}
                    <div className="pt-1 text-xs text-ink-3">
                      {r.players[scope]} {scope === "all" ? "players" : `${SCOPE_LABEL[scope].toLowerCase()} players`}, no practice squad or specialists
                    </div>
                    <TipHint>see the roster</TipHint>
                  </div>
                }
              >
                {ticks.map((t) => (
                  <span key={t} aria-hidden className="absolute inset-y-0 w-px -translate-x-1/2 bg-line" style={{ left: x(t) }} />
                ))}
                {v != null && avg != null && (
                  <>
                    <span
                      aria-hidden
                      className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-line-2"
                      style={{ left: x(Math.min(v, avg)), width: `${(Math.abs(v - avg) / (hi - lo)) * 100}%` }}
                    />
                    <span
                      aria-hidden
                      className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-ink"
                      style={{ left: x(avg), boxShadow: "0 0 0 2px var(--surface)" }}
                    />
                  </>
                )}
                {v != null && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{ left: x(v), background: DOT[scope], boxShadow: "0 0 0 2px var(--surface)" }}
                  />
                )}
                <ChartLink
                  href={rosterHref(r.team, scope === "all" ? {} : { unit: scope })}
                  label={`${r.name} ${SCOPE_LABEL[scope].toLowerCase()}, average age ${v != null ? ageLabel(v) : "unknown"}: show the roster`}
                  className="absolute -inset-x-1 inset-y-0 rounded-[4px] transition-colors duration-(--dur-1) hover:bg-ink/[0.06] focus-visible:shadow-[inset_0_0_0_2px_var(--ink)]"
                />
              </Tip>
              <span className="num text-right text-sm font-medium">{v != null ? ageLabel(v) : "–"}</span>
            </li>
          );
        })}
      </ol>
      <Note>
        Average age on {asOf} of everyone on the roster or a reserve list, leaving out the practice squad and the kickers, punters and long
        snappers. Each player&rsquo;s age counts to the day; the average is rounded to a tenth of a year.
      </Note>
    </div>
  );
}
