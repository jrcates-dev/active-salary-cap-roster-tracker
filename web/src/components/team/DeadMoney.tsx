import { money, pct } from "@/lib/format";
import { DEAD_ID } from "@/lib/rosterLink";
import type { DeadCharge } from "@/lib/types";
import { SectionHead } from "../ui";

/**
 * Every charge behind a team's dead money, largest first, each with its share of
 * the total. OverTheCap itemizes charges of $100K and up, so whatever the list
 * leaves of the team's total shows as one last line. The dead money band and card
 * on this page, and on the league board, link here.
 */
export function DeadMoney({ charges, total, asOf }: { charges: DeadCharge[]; total: number | null; asOf?: string }) {
  const listed = charges.reduce((acc, c) => acc + c.amount, 0);
  const whole = Math.max(total ?? 0, listed);
  const rest = whole - listed;
  const max = Math.max(1, ...charges.map((c) => c.amount), rest);
  return (
    <section id={DEAD_ID} className="max-w-3xl scroll-mt-28">
      <SectionHead
        title="Dead money"
        count={whole > 0 ? money(whole) : undefined}
        aside={<span>Charges for players no longer on the team{asOf ? `, ${asOf}` : ""}</span>}
      />
      {charges.length === 0 ? (
        <p className="text-sm text-ink-2">
          {whole > 0 ? "The charges behind this total are not in the data yet." : "No dead money this season."}
        </p>
      ) : (
        <div className="card overflow-hidden">
          <table className="tbl w-full text-sm">
            <thead className="bg-surface-2">
              <tr>
                <th className="text-left">Player</th>
                <th className="text-right">Charge</th>
                <th className="hidden w-[40%] text-left sm:table-cell">
                  <span className="sr-only">Share of dead money</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {charges.map((c, i) => (
                <Row key={`${c.name}-${i}`} name={c.name} pos={c.pos} amount={c.amount} whole={whole} max={max} />
              ))}
              {rest > 0 && (
                <Row
                  name="Smaller charges"
                  note="Each under $100K, not listed one by one"
                  amount={rest}
                  whole={whole}
                  max={max}
                  muted
                />
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Row({
  name,
  pos,
  note,
  amount,
  whole,
  max,
  muted = false,
}: {
  name: string;
  pos?: string | null;
  note?: string;
  amount: number;
  whole: number;
  max: number;
  muted?: boolean;
}) {
  return (
    <tr>
      <td>
        <span className={`font-medium ${muted ? "text-ink-2" : ""}`}>{name}</span>
        {pos && <span className="ml-1.5 text-xs text-ink-3">{pos}</span>}
        {note && <span className="block text-xs text-ink-3">{note}</span>}
      </td>
      <td className="text-right whitespace-nowrap">
        <span className="num font-medium">{money(amount)}</span>
        <span className="num ml-2 text-xs text-ink-3">{pct(amount / whole, 0)}</span>
      </td>
      <td className="hidden sm:table-cell">
        <span className="flex h-2 items-center">
          <span className="s-dead block h-2 rounded-[3px]" style={{ width: `${Math.max(1, (amount / max) * 100)}%` }} aria-hidden />
        </span>
      </td>
    </tr>
  );
}
