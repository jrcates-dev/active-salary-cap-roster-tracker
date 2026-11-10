import type { CSSProperties, ReactNode } from "react";

/** Page width and gutters, the same on every page. */
export const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";

/**
 * The band that opens every page: part of the board, dark in both themes, holding
 * the page's title and the one thing the page is for. `team` (a team's `teamVars()`)
 * washes it in that team's color. Whatever goes in `children` sits under the title,
 * still on the band.
 */
export function Hero({
  eyebrow,
  title,
  aside,
  before,
  children,
  team,
}: {
  eyebrow?: ReactNode;
  title?: ReactNode;
  aside?: ReactNode;
  /** A row above the title, such as the strip for stepping between teams or games. */
  before?: ReactNode;
  children?: ReactNode;
  team?: CSSProperties;
}) {
  return (
    <div className={`board board-band ${team ? "tc" : ""}`} style={team}>
      <div className={`${WRAP} pt-5 pb-7 sm:pb-9`}>
        {before && <div className="mb-6">{before}</div>}
        {(title || aside) && (
          <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-4 ${before ? "" : "pt-3 sm:pt-5"}`}>
            <div className="min-w-0">
              {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
              <h1 className="display text-[44px] leading-[0.92] sm:text-[64px]">{title}</h1>
            </div>
            {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Section title on a ledger rule, with room for a legend or a control on the right. */
export function SectionHead({
  title,
  count,
  aside,
  id,
  asideClassName = "",
}: {
  title: ReactNode;
  count?: ReactNode;
  aside?: ReactNode;
  id?: string;
  /** Extra classes for the aside, e.g. to let a control bar take the full width on phones. */
  asideClassName?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t-2 border-ink pt-2.5">
      <h2 id={id} className="display flex items-baseline gap-2 text-[24px] leading-none">
        {title}
        {count !== undefined && <span className="num font-sans text-sm font-normal tracking-normal text-ink-3 normal-case">{count}</span>}
      </h2>
      {aside && <div className={`flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-ink-2 ${asideClassName}`}>{aside}</div>}
    </div>
  );
}

/**
 * Stat tile: label, value, one line of context. The value uses proportional
 * figures; tabular figures are for columns. `tone` (a money status hue from
 * STATUS_COLOR) tops the tile with a band of that hue and a faint wash.
 */
export function Stat({
  label,
  value,
  sub,
  swatch,
  tone,
  size = "md",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  swatch?: ReactNode;
  tone?: string;
  size?: "md" | "lg";
}) {
  return (
    <div className={`card px-4 py-3.5 ${tone ? "tone pt-4" : ""}`} style={tone ? ({ "--s": tone } as CSSProperties) : undefined}>
      <p className="flex items-center gap-2 text-[13px] text-ink-2">
        {swatch}
        <span className="truncate">{label}</span>
      </p>
      <p className={`fig mt-1.5 leading-none ${size === "lg" ? "text-[34px]" : "text-[26px] sm:text-[28px]"}`}>{value}</p>
      {sub && <p className="num mt-1.5 truncate text-xs text-ink-3">{sub}</p>}
    </div>
  );
}

/** A quiet line of context under a chart. */
export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-xs text-ink-3">{children}</p>;
}

/** An empty-state line inside a bordered area. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="card px-4 py-6 text-center text-sm text-ink-3">{children}</p>;
}
