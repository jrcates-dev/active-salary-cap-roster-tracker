import { money } from "@/lib/format";
import type { ContractRelease } from "@/lib/types";

/**
 * What moving on from him next offseason would cost, three ways: a release before
 * June 1, a release after June 1 (or designated as one), and a trade. Each card puts
 * the dead money against his cap number that season on one bar, so "cutting him saves
 * $X" or "costs $X more than keeping him" reads at a glance.
 */
export function Release({ r }: { r: ContractRelease }) {
  const scale = Math.max(r.cap, r.cut.dead, r.june1.dead, r.trade.dead, 1);
  const next = r.season + 1;
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      <Card
        title="Cut before June 1"
        dead={r.cut.dead}
        savings={r.cut.savings}
        cap={r.cap}
        scale={scale}
        season={r.season}
        note="All bonus proration still to come and all guaranteed salary land this season."
      />
      <Card
        title="Cut after June 1"
        dead={r.june1.dead}
        savings={r.june1.savings}
        cap={r.cap}
        scale={scale}
        season={r.season}
        note={
          r.june1.dead_next > 0
            ? `${money(r.june1.dead_next)} more dead money moves to ${next}.`
            : `Nothing moves to ${next}.`
        }
      />
      <Card
        title="Traded"
        dead={r.trade.dead}
        savings={r.trade.savings}
        cap={r.cap}
        scale={scale}
        season={r.season}
        note="Only the bonus proration stays behind; his guarantees go with him."
      />
    </ul>
  );
}

function Card({
  title,
  dead,
  savings,
  cap,
  scale,
  season,
  note,
}: {
  title: string;
  dead: number;
  savings: number;
  cap: number;
  scale: number;
  season: number;
  note: string;
}) {
  const saves = savings >= 0;
  return (
    <li className="card flex flex-col p-3.5">
      <p className="text-[13px] font-medium text-ink">{title}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-ink-3">Dead money {season}</p>
          <p className="fig text-[26px] leading-none">{money(dead)}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ink-3">{saves ? "Cap saved" : "Costs more"}</p>
          <p className={`fig text-[26px] leading-none ${saves ? "text-ink" : "text-accent"}`}>{money(Math.abs(savings))}</p>
        </div>
      </div>
      {/* The dead money fills from the left; the mark (and the outline) is his cap number that season. */}
      <div className="relative mt-3 h-2.5" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-[3px] shadow-[inset_0_0_0_1.5px_var(--line-2)]" style={{ width: `${(cap / scale) * 100}%` }} />
        <span className="s-dead bar-grow absolute inset-y-0 left-0 rounded-[3px]" style={{ width: `${(dead / scale) * 100}%` }} />
        <span className="absolute -inset-y-1 w-[2px] rounded-[1px] bg-ink" style={{ left: `calc(${(cap / scale) * 100}% - 1px)` }} />
      </div>
      <p className="num mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-3">
        <span aria-hidden className="inline-block h-3 w-[2px] rounded-[1px] bg-ink" />
        Cap number if kept: {money(cap)}
      </p>
      <p className="mt-2 text-xs text-ink-2">{note}</p>
    </li>
  );
}
