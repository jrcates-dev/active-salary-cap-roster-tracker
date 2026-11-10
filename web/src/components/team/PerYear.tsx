"use client";

import { money } from "@/lib/format";
import type { MoneyYear, Player } from "@/lib/types";
import { Tip, TipTitle } from "../Tip";

/** '27 */
const yy = (season: number) => `’${String(season).slice(2)}`;

/** The seasons a strip draws: every paid season, void years left out. */
const paidYears = (p: Player): MoneyYear[] => (p.money_years ?? []).filter((y) => y.kind !== "void");

/** Under the per-year number: which seasons it averages. */
function spanLabel(p: Player): string {
  if (p.per_year_basis === "apy") return "contract APY";
  const years = (p.money_years ?? []).filter((y) => y.kind === "counted");
  if (years.length <= 1) return "final year";
  return `avg, ${years[0].season}–${String(years[years.length - 1].season).slice(2)}`;
}

/** Under the strip: how long the money is locked in. */
function guaranteeLabel(p: Player): string {
  const now = p.money_years?.[0]?.season;
  if (p.per_year_basis === "apy") return p.deal_thru ? `thru ${yy(p.deal_thru)}` : "";
  if (now == null) return "";
  if (p.gtd_thru) return `gtd thru ${yy(p.gtd_thru)}`;
  if ((p.deal_thru ?? now) <= now) return "final year";
  return `no gtd after ${yy(now)}`;
}

/** One bar per paid season, as tall as its cash: this season gray, later guaranteed seasons solid, the rest hollow. */
function Strip({ years }: { years: MoneyYear[] }) {
  const max = Math.max(...years.map((y) => y.cash), 1);
  return (
    <span className="inline-flex h-[18px] items-end gap-[2px]" aria-hidden>
      {years.slice(0, 10).map((y, i) => {
        const h = Math.max(4, Math.round((y.cash / max) * 18));
        const cls =
          i === 0
            ? "bg-ink-4"
            : y.gtd && y.kind === "counted"
              ? "bg-ink"
              : y.kind === "token"
                ? "border border-dashed border-b-0 border-ink-4"
                : "border-[1.5px] border-b-0 border-ink-4";
        return <i key={y.season} className={`block w-[7px] rounded-t-[2px] ${cls}`} style={{ height: h }} />;
      })}
    </span>
  );
}

/** A one-line reason the cap number and this season's pay differ a lot, when they do. */
function capNote(p: Player): string | null {
  const now = p.money_years?.[0];
  if (!now || now.cash <= 0) return null;
  if (now.cap < now.cash * 0.6) return "His cap number is below this season's pay because bonus money is spread over later seasons.";
  if (now.cap > now.cash * 1.4) return "His cap number is above this season's pay because bonus money paid earlier is still being charged.";
  return null;
}

function PayTip({ p }: { p: Player }) {
  const years = p.money_years ?? [];
  const now = years[0]?.season;
  const signed =
    p.year_signed && p.contract_years && p.contract_value
      ? `${p.year_signed} deal: ${p.contract_years} yr${p.contract_years === 1 ? "" : "s"}, ${money(p.contract_value)}`
      : null;
  const voids = years.filter((y) => y.kind === "void");
  const note = capNote(p);
  return (
    <div className="w-[256px]">
      <TipTitle>{p.name}</TipTitle>
      {signed && (
        <div className="text-xs text-ink-3">
          {signed}
          {p.contract_guaranteed ? `, ${money(p.contract_guaranteed)} gtd` : ""}
        </div>
      )}
      {p.per_year_basis === "apy" ? (
        <p className="mt-1.5 text-xs text-ink-2">
          The free data has no year-by-year breakdown for this deal yet, so this is the contract&rsquo;s average per year, which is what a new deal
          pays.
        </p>
      ) : (
        <>
          {note && <p className="mt-1.5 text-xs text-ink-2">{note}</p>}
          <table className="mt-1.5 w-full text-xs">
            <thead className="text-ink-3">
              <tr>
                <th className="py-0.5 text-left font-normal">Season</th>
                <th className="py-0.5 text-right font-normal">Cap</th>
                <th className="py-0.5 text-right font-normal">Cash</th>
                <th className="py-0.5 text-right font-normal">Gtd</th>
              </tr>
            </thead>
            <tbody className="num">
              {years
                .filter((y) => y.kind !== "void")
                .map((y) => (
                  <tr key={y.season} className={y.kind === "token" ? "text-ink-3" : undefined}>
                    <td className="py-0.5">{y.season}</td>
                    <td className="py-0.5 text-right">{money(y.cap)}</td>
                    <td className="py-0.5 text-right font-medium">{money(y.cash)}</td>
                    <td className="py-0.5 text-right">{y.season === now ? "" : y.gtd ? "yes" : "no"}</td>
                  </tr>
                ))}
              {voids.length > 0 && (
                <tr className="text-ink-3">
                  <td className="py-0.5">
                    {voids[0].season}
                    {voids.length > 1 ? `–${String(voids[voids.length - 1].season).slice(2)}` : ""}
                  </td>
                  <td className="py-0.5 text-right">{money(voids.reduce((a, y) => a + y.cap, 0))}</td>
                  <td className="py-0.5 text-right" colSpan={2}>
                    void
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {years.some((y) => y.kind === "token") && (
            <p className="mt-1 text-[11px] text-ink-3">A gray season is a placeholder year at the end of the deal, left out of the average.</p>
          )}
        </>
      )}
      <div className="mt-1.5 space-y-0.5 border-t border-line pt-1.5 text-xs text-ink-2">
        {p.per_year != null && (
          <div>
            <span className="font-semibold text-ink">{money(p.per_year)}</span> a season
            {p.deal_thru && now != null && p.deal_thru > now ? ` through ${p.deal_thru}` : p.per_year_basis === "apy" ? "" : " this final year"}.
          </div>
        )}
        {p.per_year_basis !== "apy" && now != null && (
          <div>{p.gtd_thru ? `Guaranteed through ${p.gtd_thru}.` : (p.deal_thru ?? now) > now ? `Nothing guaranteed after ${now}.` : null}</div>
        )}
        {p.dead_if_cut ? (
          <div>
            Released after this season: <span className="font-semibold text-ink">{money(p.dead_if_cut)}</span> dead cap.
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The "Per year" cell: what he is paid a season from here on. */
export function PerYearCell({ p, fmt }: { p: Player; fmt: (d: number) => string }) {
  if (p.per_year == null) return <td className="num text-right text-ink-3">&ndash;</td>;
  return (
    <Tip as="td" className="num cursor-default text-right" content={<PayTip p={p} />}>
      <span className="font-medium">{fmt(p.per_year)}</span>
      <span className="block text-[11px] whitespace-nowrap text-ink-3">{spanLabel(p)}</span>
    </Tip>
  );
}

/** The "Contract" cell: one bar per season left and how long it is guaranteed. */
export function ContractCell({ p }: { p: Player }) {
  const years = paidYears(p);
  const label = guaranteeLabel(p);
  if (p.per_year == null) return <td className="num text-ink-3">{p.years_left ?? "–"}</td>;
  return (
    <Tip as="td" className="cursor-default" content={<PayTip p={p} />}>
      {years.length > 0 && <Strip years={years} />}
      {label && <span className="block text-[11px] whitespace-nowrap text-ink-3">{label}</span>}
    </Tip>
  );
}

/** Key to the strip, shown under the roster table. */
export function StripKey({ className = "" }: { className?: string }) {
  const sw = "inline-block h-3 w-[7px] rounded-t-[2px]";
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3 ${className}`}>
      <span className="inline-flex items-center gap-1.5">
        <i className={`${sw} bg-ink-4`} />
        This season
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className={`${sw} bg-ink`} />
        Later season, guaranteed
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className={`${sw} border-[1.5px] border-b-0 border-ink-4`} />
        Later season, not guaranteed (he can be cut)
      </span>
      <span>Per year: his average cash a season from now to the end of the deal.</span>
    </div>
  );
}
