"use client";

import type { ReactNode } from "react";

/** One control style for every pick-one choice on the site. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-surface-2 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`rounded-[7px] font-medium whitespace-nowrap transition-colors duration-(--dur-1) ${
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[13px]"
            } ${active ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06),0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pill filter with an optional count. */
export function Chip({
  active,
  onClick,
  children,
  count,
  title,
  swatch,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  title?: string;
  swatch?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={`flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] whitespace-nowrap transition-colors duration-(--dur-1) ${
        active ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:border-line-2 hover:text-ink"
      }`}
    >
      {swatch}
      {children}
      {count !== undefined && <span className={`num text-xs ${active ? "text-bg/70" : "text-ink-3"}`}>{count}</span>}
    </button>
  );
}

/** Small icon button for stepping through weeks, teams or games. */
export function StepButton({
  dir,
  onClick,
  disabled,
  label,
}: {
  dir: "prev" | "next";
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-2 transition-colors duration-(--dur-1) enabled:hover:border-line-2 enabled:hover:text-ink disabled:opacity-35"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path
          d={dir === "prev" ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6l-3.5 3.5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/** Styled native select, for lists too long for a segmented control. */
export function Select({
  value,
  onChange,
  label,
  children,
}: {
  value: string | number;
  onChange: (v: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 rounded-md border border-line bg-surface px-2 text-[13px] text-ink transition-colors duration-(--dur-1) hover:border-line-2"
    >
      {children}
    </select>
  );
}
