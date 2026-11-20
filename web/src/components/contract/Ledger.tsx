"use client";

import type { ReactNode } from "react";
import { money, pct } from "@/lib/format";
import type { ContractYear } from "@/lib/types";
import { Tip } from "../Tip";
import { capParts, GAP_NOTE, GtdMark } from "./CapChart";

type Line = {
  key: string;
  label: string;
  title: string;
  value: (y: ContractYear) => number | null | undefined;
  /** Shown only when some season has it. */
  optional?: boolean;
  strong?: boolean;
  /** Left out of the total column. */
  noTotal?: boolean;
  /** Starts a new block: a heavier rule above it. */
  rule?: boolean;
};

const LINES: Line[] = [
  { key: "base", label: "Base salary", title: "Salary for the season, paid weekly during it", value: (y) => y.base },
  {
    key: "prorated",
    label: "Prorated bonus",
    title: "Signing and restructure bonuses, paid up front and charged to the cap evenly over up to five seasons",
    value: (y) => y.prorated,
  },
  { key: "option", label: "Option bonus", title: "Option bonuses, charged over up to five seasons like a signing bonus", value: (y) => y.option, optional: true },
  { key: "roster", label: "Roster bonus", title: "Paid for being on the roster on a set date", value: (y) => y.roster, optional: true },
  { key: "per_game", label: "Per-game bonus", title: "Paid for each game on the 46-man gameday roster", value: (y) => y.per_game, optional: true },
  { key: "workout", label: "Workout bonus", title: "Paid for attending the offseason program", value: (y) => y.workout, optional: true },
  { key: "other", label: "Other bonus", title: "Other bonuses counted on the cap", value: (y) => y.other, optional: true },
  { key: "cap", label: "Cap number", title: "What the season charges against the salary cap", value: (y) => y.cap, strong: true, rule: true },
  { key: "cap_pct", label: "% of cap", title: "Share of that season's salary cap (set a season at a time)", value: (y) => y.cap_pct, optional: true, noTotal: true },
  { key: "cash", label: "Cash paid", title: "What he is paid that season, salary and bonuses", value: (y) => y.cash, strong: true },
  { key: "gtd", label: "Guaranteed", title: "Salary guaranteed that season", value: (y) => y.gtd },
  {
    key: "dead_cut",
    label: "Dead if cut",
    title: "Released before June 1 of that league year: bonus proration still to come plus guaranteed salary still owed",
    value: (y) => y.dead_cut,
    noTotal: true,
    rule: true,
  },
  {
    key: "savings_cut",
    label: "Cap savings",
    title: "Released before June 1: his cap number that season less the dead money. Negative means cutting him costs cap space",
    value: (y) => y.savings_cut,
    noTotal: true,
  },
];

const KIND_TAG: Partial<Record<ContractYear["kind"], string>> = { past: "paid", void: "void", token: "placeholder" };

/**
 * The contract the way a cap sheet lists it, one column a season in the same order as
 * the chart above: salary and each bonus, the cap number they add up to, the cash, the
 * guaranteed salary, and what a release that season would leave and save. Bonus lines a
 * deal never uses are left out. The line names stay put while the seasons scroll
 * sideways on a phone.
 */
export function Ledger({ years, season, team }: { years: ContractYear[]; season: number; team: string }) {
  const lines = LINES.filter((l) => !l.optional || years.some((y) => (l.value(y) ?? 0) !== 0));
  const traded = years.some((y) => y.team && y.team !== team);
  const deal = years.filter((y) => y.kind !== "void");
  const total = years.length > 1;
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="tbl w-full text-[13px]">
          <thead className="bg-surface-2">
            <tr>
              <th scope="col" className="sticky left-0 z-[1] bg-surface-2 text-left align-bottom">
                <span className="sr-only">Line</span>
              </th>
              {years.map((y) => {
                const now = y.season === season;
                const tag = now ? null : KIND_TAG[y.kind];
                return (
                  <th key={y.season} scope="col" className={`text-right align-bottom ${now ? "bg-surface-3" : ""}`}>
                    <span className={`block text-[13px] tracking-normal ${now ? "font-semibold text-ink" : y.kind === "counted" ? "text-ink-2" : ""}`}>{y.season}</span>
                    <span className="block text-[10px] leading-4 normal-case tracking-normal">
                      {now ? (
                        <span className="rounded bg-ink px-1 font-semibold tracking-wide text-bg uppercase">Now</span>
                      ) : tag ? (
                        <span className="italic">{tag}</span>
                      ) : (
                        <span aria-hidden>&nbsp;</span>
                      )}
                      {traded && y.team ? <span className="ml-1">{y.team}</span> : null}
                    </span>
                  </th>
                );
              })}
              {total && (
                <th scope="col" className="text-right align-bottom">
                  Total
                </th>
              )}
            </tr>
          </thead>
          <tbody className="num">
            {lines.map((l) => (
              <tr key={l.key} className={l.rule ? "border-t-line-2!" : ""}>
                <th
                  scope="row"
                  title={l.title}
                  className={`sticky left-0 z-[1] bg-surface text-left text-[13px]! [tr:hover>&]:bg-surface-2 tracking-normal! whitespace-nowrap normal-case! ${l.strong ? "font-semibold! text-ink!" : "font-normal! text-ink-2!"}`}
                >
                  {l.label}
                </th>
                {years.map((y) => (
                  <Cell key={y.season} line={l} y={y} now={y.season === season} />
                ))}
                {total && (
                  <td className={`text-right whitespace-nowrap ${l.strong ? "font-semibold text-ink" : "text-ink-2"}`}>
                    {l.noTotal ? "" : money((l.key === "cap" || l.key === "prorated" ? years : deal).reduce((n, y) => n + (l.value(y) ?? 0), 0))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ line: l, y, now }: { line: Line; y: ContractYear; now: boolean }) {
  const muted = y.kind === "past" || y.kind === "void" || y.kind === "token";
  const v = l.value(y);
  const cls = `text-right whitespace-nowrap ${now ? "bg-surface-2" : ""} ${muted ? "text-ink-3" : l.strong ? "font-semibold text-ink" : ""}`;
  let body: ReactNode;
  if (v == null || (l.key !== "cap" && l.key !== "cash" && v === 0 && (l.optional || l.key === "gtd"))) body = <span className="text-ink-4">&ndash;</span>;
  else if (l.key === "cap_pct") body = pct(v);
  else body = money(v);
  if (l.key === "gtd" && v && y.kind !== "past") {
    body = (
      <span className="inline-flex items-center gap-1">
        <GtdMark className="text-ink-3" />
        {body}
      </span>
    );
  }
  if (l.key === "cap") {
    const { gap } = capParts(y);
    if (gap !== 0) {
      return (
        <Tip as="td" className={cls} content={<p className="w-[240px] text-xs text-ink-2">{GAP_NOTE(gap)}</p>}>
          <span className="underline decoration-line-2 decoration-dotted underline-offset-[3px]">{body}</span>
        </Tip>
      );
    }
  }
  return <td className={cls}>{body}</td>;
}
