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

const CHEVRON = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-ink-3">
    <path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Styled native select, for lists too long for a segmented control. The browser's
 * own arrow is swapped for the site's chevron so it matches in every browser.
 */
export function Select({
  value,
  onChange,
  label,
  children,
  className = "",
}: {
  value: string | number;
  onChange: (v: string) => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-full cursor-pointer appearance-none rounded-md border border-line bg-surface py-0 pr-7 pl-2.5 text-[13px] text-ink transition-colors duration-(--dur-1) hover:border-line-2"
      >
        {children}
      </select>
      {CHEVRON}
    </span>
  );
}

/** Search box with a magnifier, the same height as the chips and selects beside it. */
export function SearchInput({
  value,
  onChange,
  label,
  placeholder = "Search",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex min-w-0 ${className}`}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 14 14"
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-3"
      >
        <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m9.25 9.25 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-full min-w-0 rounded-md border border-line bg-surface pr-2 pl-8 text-[13px] text-ink placeholder:text-ink-4 transition-colors duration-(--dur-1) hover:border-line-2 focus:border-line-2 focus:outline-none"
      />
    </span>
  );
}
