import type { ReactNode } from "react";

/** Page width and gutters, the same on every page. */
export const WRAP = "mx-auto w-full max-w-[1200px] px-4 sm:px-6";

/** Page title block: eyebrow, short noun, and whatever sits beside it. */
export function PageHead({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-[28px] leading-none font-semibold tracking-tight sm:text-[34px]">{title}</h1>
        {children}
      </div>
      {aside && <div className="flex flex-wrap items-center gap-2">{aside}</div>}
    </div>
  );
}

/** Section title with room for a legend or a control on the right. */
export function SectionHead({
  title,
  count,
  aside,
  id,
}: {
  title: ReactNode;
  count?: ReactNode;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <h2 id={id} className="flex items-baseline gap-2 text-lg font-semibold tracking-tight">
        {title}
        {count !== undefined && <span className="num text-sm font-normal text-ink-3">{count}</span>}
      </h2>
      {aside && <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-ink-2">{aside}</div>}
    </div>
  );
}

/**
 * Stat tile: label, value, one line of context. The value uses proportional
 * figures; tabular figures are for columns.
 */
export function Stat({
  label,
  value,
  sub,
  swatch,
  size = "md",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  swatch?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="card px-4 py-3.5">
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
