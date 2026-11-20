"use client";

import { useEffect, useRef, useState } from "react";
import { otherBonuses, proration } from "@/lib/contract";
import { money } from "@/lib/format";
import type { ContractYear } from "@/lib/types";
import { Tip, TipRow, TipTitle } from "../Tip";

/** '27 */
export const yy = (season: number) => `’${String(season).slice(2)}`;

/**
 * A season's cap number as its three parts, bottom up: base salary, bonus proration
 * and the other bonuses. The ledger's parts do not always add up to its cap number
 * (a per-game roster bonus not earned for games missed, a roster bonus converted in a
 * restructure, part of a season spent on another team), so the parts are fitted to
 * the cap number: a shortfall comes off the other bonuses, then the base salary. A void
 * season's whole charge is proration.
 */
export function capParts(y: ContractYear) {
  if (y.kind === "void") return { base: 0, bonus: y.cap, other: 0, gap: 0 };
  let base = y.base;
  let other = otherBonuses(y);
  const bonus = proration(y);
  const gap = y.cap - (base + bonus + other);
  if (gap > 0) other += gap;
  else if (gap < 0) {
    const cut = Math.min(other, -gap);
    other -= cut;
    base = Math.max(0, base + gap + cut);
  }
  return { base, bonus, other, gap: Math.abs(gap) >= 100_000 ? gap : 0 };
}

/** Why a season's listed parts and its cap number differ, when they do by $100K or more. */
export const GAP_NOTE = (gap: number) =>
  `The listed parts come to ${money(Math.abs(gap))} ${gap < 0 ? "more" : "less"} than the cap number: usually a per-game roster bonus not earned for games missed, a bonus converted in a restructure, or part of the season with another team.`;

/** A round step for about three gridlines up to `max`. */
function niceStep(max: number): number {
  const raw = max / 3;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

function Lock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 12" width="9" height="11" aria-hidden className={className}>
      <path d="M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1" y="5" width="8" height="6.2" rx="1.4" fill="currentColor" />
    </svg>
  );
}

export function GtdMark({ className = "" }: { className?: string }) {
  return <Lock className={className} />;
}

/**
 * The cap number of every season of the deal, as stacked columns in the player's team
 * color (darkest is base salary, then bonus proration, then the hollow other bonuses),
 * with the cash paid that season as a tick across each column and a lock under every
 * season with guaranteed salary. Past seasons are faded, this season is marked, and a
 * void season is dashed.
 */
export function CapChart({ years, season }: { years: ContractYear[]; season: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = width < 480 ? 150 : 180;
  const max = Math.max(1, ...years.map((y) => Math.max(y.cap, y.cash)));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const px = (v: number) => (v / top) * H;
  const col = width > 0 ? width / years.length : 0;
  const barW = Math.max(10, Math.min(30, col * 0.56));
  const labels = col >= 46;
  const shortYears = col < 40;

  return (
    <div className="flex gap-2">
      {/* Axis: a few round figures, the gridlines run under the columns. */}
      <div className="relative w-9 shrink-0" style={{ height: H + 14 }} aria-hidden>
        {ticks.map((t) => (
          <span key={t} className="num absolute right-0 -translate-y-1/2 text-[10px] text-ink-4" style={{ top: 14 + H - px(t) }}>
            {t === 0 ? "$0" : money(t, t % 1_000_000 === 0 ? 0 : 1)}
          </span>
        ))}
      </div>
      <div ref={ref} className="relative min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0" style={{ top: 14, height: H }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className={`absolute inset-x-0 h-px ${t === 0 ? "bg-line-2" : "bg-line"}`} style={{ top: H - px(t) }} />
          ))}
        </div>
        <ol className="relative flex" aria-label="Cap number by season">
          {years.map((y) => {
            const parts = capParts(y);
            const now = y.season === season;
            const past = y.kind === "past";
            const voided = y.kind === "void";
            const total = parts.base + parts.bonus + parts.other;
            const label = `${y.season}: cap ${money(y.cap)}, cash ${money(y.cash)}${y.gtd > 0 && !past ? `, ${money(y.gtd)} guaranteed` : ""}${voided ? ", void year" : ""}`;
            return (
              <li key={y.season} className="min-w-0 flex-1">
                <Tip
                  className={`relative flex cursor-default flex-col items-center rounded-md ${now ? "bg-surface-2" : ""}`}
                  content={<SeasonTip y={y} gap={parts.gap} />}
                >
                  <span className="sr-only">{label}</span>
                  <div className={`relative w-full ${past ? "opacity-55" : ""}`} style={{ height: H + 14 }} aria-hidden>
                    {labels && total > 0 && (
                      <span
                        className={`num absolute inset-x-0 text-center text-[11px] leading-none ${now ? "font-semibold text-ink" : "text-ink-2"}`}
                        style={{ bottom: px(total) + 4 }}
                      >
                        {money(y.cap)}
                      </span>
                    )}
                    <span
                      className={`bar-grow-up absolute bottom-0 left-1/2 flex -translate-x-1/2 flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] ${voided ? "c-void" : ""}`}
                      style={{ width: barW, height: px(total) }}
                    >
                      {/* Each part takes its share of the column after the 2px gaps between them. */}
                      {parts.base > 0 && <i className="c-base block min-h-px basis-0" style={{ flexGrow: parts.base }} />}
                      {parts.bonus > 0 && <i className="c-bonus block min-h-px basis-0" style={{ flexGrow: parts.bonus }} />}
                      {parts.other > 0 && <i className="c-other block min-h-px basis-0" style={{ flexGrow: parts.other }} />}
                    </span>
                    {y.cash > 0 && (
                      <span
                        className="absolute left-1/2 h-[3px] -translate-x-1/2 translate-y-1/2 rounded-full bg-ink shadow-[0_0_0_1.5px_var(--bg)]"
                        style={{ bottom: px(y.cash), width: barW + 12 }}
                      />
                    )}
                  </div>
                  <span className={`num mt-1.5 text-[11px] leading-none ${now ? "font-semibold text-ink" : "text-ink-3"}`}>
                    {shortYears ? yy(y.season) : y.season}
                  </span>
                  <span className="mt-1 mb-1 flex h-3 items-center gap-1 text-[10px] leading-none text-ink-3">
                    {now ? (
                      <span className="font-semibold tracking-wide text-ink-2 uppercase">Now</span>
                    ) : voided ? (
                      <span className="italic">void</span>
                    ) : past ? (
                      <span>paid</span>
                    ) : null}
                    {!past && !voided && y.gtd > 0 && <Lock className={`${now ? "hidden sm:block" : ""} text-ink-2`} />}
                  </span>
                </Tip>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function SeasonTip({ y, gap }: { y: ContractYear; gap: number }) {
  if (y.kind === "void") {
    return (
      <div className="w-[230px]">
        <TipTitle>{y.season} · void year</TipTitle>
        <TipRow label="Cap charge" value={money(y.cap)} />
        <p className="mt-1 text-xs text-ink-3">
          A placeholder season that voids before it is played. Bonus proration spread into it, and the seasons after it, lands here as dead money.
        </p>
      </div>
    );
  }
  const other = otherBonuses(y);
  return (
    <div className="w-[230px]">
      <TipTitle>
        {y.season}
        {y.kind === "past" ? " · paid" : y.kind === "token" ? " · placeholder year" : ""}
      </TipTitle>
      <TipRow label="Base salary" value={money(y.base)} swatch={<i className="sw c-base" />} />
      <TipRow label="Bonus proration" value={money(proration(y))} swatch={<i className="sw c-bonus" />} />
      {other > 0 && <TipRow label="Roster and other bonuses" value={money(other)} swatch={<i className="sw c-other" />} />}
      <div className="mt-1 border-t border-line pt-1">
        <TipRow label="Cap number" value={money(y.cap)} />
        <TipRow label="Cash paid" value={money(y.cash)} />
        {y.gtd > 0 && <TipRow label="Guaranteed salary" value={money(y.gtd)} />}
        {y.dead_cut != null && <TipRow label="Dead money if cut" value={money(y.dead_cut)} />}
      </div>
      {gap !== 0 && <p className="mt-1 text-[11px] text-ink-3">{GAP_NOTE(gap)}</p>}
    </div>
  );
}

/** The chart's key: one swatch per part, the cash tick and the guarantee lock. */
export function CapChartKey() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
      <span className="inline-flex items-center gap-1.5">
        <i className="sw c-base" /> Base salary
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="sw c-bonus" /> Bonus proration
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="sw c-other" /> Roster and other bonuses
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-[3px] w-3.5 rounded-full bg-ink" /> Cash paid
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Lock className="text-ink-2" /> Salary guaranteed
      </span>
    </div>
  );
}
