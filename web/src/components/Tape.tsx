import type { ReactNode } from "react";
import type { SliceKey } from "@/lib/availability";
import { ChartLink } from "./ChartLink";

export interface TapeCell {
  k: SliceKey;
  label: string;
  value: ReactNode;
  /** One quiet line under the figure: a share, a head count, a date. */
  sub?: ReactNode;
  /** Where the cell leads: those players in a roster, or the dead money list. */
  href?: string;
}

/**
 * The tape: one availability bar with its ledger directly under it, a cell per
 * money status in bar order. It is the bar, its legend and its figures as one
 * object, used wherever a page leads with "how much of this money is playing":
 * the league page and each team page. The first cell (active) is set larger, since
 * it is the headline. Each cell is keyed by a rule in its status fill (hue and
 * texture, as in the bar), so no separate legend is needed.
 */
export function Tape({ bar, cells }: { bar: ReactNode; cells: TapeCell[] }) {
  return (
    <div className="space-y-4">
      {bar}
      <ul className="grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-5 lg:grid-cols-[1.35fr_repeat(5,minmax(0,1fr))] lg:gap-x-5">
        {cells.map((c, i) => {
          const lead = i === 0;
          const body = (
            <>
              <span aria-hidden className={`s-${c.k} mb-2 block h-1.5 w-full rounded-[2px]`} />
              <p className="truncate text-[13px] leading-tight text-ink-2">{c.label}</p>
              <p className={`fig tape-fig mt-1 leading-none ${lead ? "text-[40px] sm:text-[44px]" : "text-[26px] sm:text-[30px]"}`}>{c.value}</p>
              {c.sub && <p className="num mt-1.5 truncate text-xs text-ink-3">{c.sub}</p>}
            </>
          );
          const span = lead ? "col-span-3 sm:col-span-5 lg:col-span-1" : "";
          return (
            <li key={c.k} className={`min-w-0 ${span}`}>
              {c.href ? (
                <ChartLink
                  href={c.href}
                  tapPreview={false}
                  className="block rounded-sm [&_.tape-fig]:underline-offset-4 hover:[&_.tape-fig]:underline"
                >
                  {body}
                </ChartLink>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
