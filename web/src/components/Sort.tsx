"use client";

import { useState, type ReactNode } from "react";

/**
 * One sort pattern for every ranked list on the site. Clicking a new key sorts by
 * it in that key's natural direction (biggest money first, team names A to Z);
 * clicking the same key again flips the order. The active key always shows an
 * arrow pointing the way the list runs.
 */
export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

export function useSort<K extends string>(
  initial: K,
  naturalDir: (k: K) => SortDir = () => "desc",
): [SortState<K>, (k: K) => void] {
  const [state, setState] = useState<SortState<K>>({ key: initial, dir: naturalDir(initial) });
  const toggle = (k: K) =>
    setState((s) =>
      s.key === k ? { key: k, dir: s.dir === "desc" ? "asc" : "desc" } : { key: k, dir: naturalDir(k) },
    );
  return [state, toggle];
}

export interface FocusSortState<K extends string> extends SortState<K> {
  /** True once the reader has picked a legend entry; false is the plain default view. */
  focused: boolean;
}

/**
 * The sort for a chart whose legend entries rank it. Each entry cycles through
 * three states: its natural order, the reverse, then back to unfocused, the
 * chart's default order with no entry picked and nothing faded. Picking another
 * entry starts that one at its natural order.
 */
export function useFocusSort<K extends string>(
  initial: K,
  naturalDir: (k: K) => SortDir = () => "desc",
): [FocusSortState<K>, (k: K) => void] {
  const unfocused: FocusSortState<K> = { key: initial, dir: naturalDir(initial), focused: false };
  const [state, setState] = useState<FocusSortState<K>>(unfocused);
  const toggle = (k: K) =>
    setState((s) => {
      const natural = naturalDir(k);
      if (!s.focused || s.key !== k) return { key: k, dir: natural, focused: true };
      if (s.dir === natural) return { key: k, dir: natural === "desc" ? "asc" : "desc", focused: true };
      return unfocused;
    });
  return [state, toggle];
}

/** Compare two numbers in the given direction. */
export function byDir(a: number, b: number, dir: SortDir) {
  return dir === "desc" ? b - a : a - b;
}

/** The value for an `aria-sort` attribute on a column header. */
export function ariaSort(active: boolean, dir: SortDir): "ascending" | "descending" | "none" {
  return active ? (dir === "asc" ? "ascending" : "descending") : "none";
}

function Arrow({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden
      className={`shrink-0 transition-opacity duration-(--dur-1) ${
        active ? "text-ink" : "text-ink-3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
      } ${active && dir === "asc" ? "rotate-180" : ""}`}
    >
      <path d="M2 3.5 5 6.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function directionWords(dir: SortDir, ascLabel: string, descLabel: string) {
  return dir === "desc" ? descLabel : ascLabel;
}

/** A column header that sorts. Used in tables. */
export function SortHeader({
  active,
  dir,
  onClick,
  label,
  children,
  ascLabel = "lowest first",
  descLabel = "highest first",
  align = "left",
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  label: string;
  children: ReactNode;
  ascLabel?: string;
  descLabel?: string;
  align?: "left" | "right" | "center";
}) {
  const now = active ? `, sorted ${directionWords(dir, ascLabel, descLabel)}` : "";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${now}`}
      className={`group inline-flex max-w-full items-center gap-1 rounded transition-colors duration-(--dur-1) ${
        align === "right" ? "flex-row-reverse" : ""
      } ${active ? "text-ink" : "hover:text-ink"}`}
    >
      <span className={active ? "underline decoration-line-2 underline-offset-4" : ""}>{children}</span>
      <Arrow active={active} dir={dir} />
    </button>
  );
}

/**
 * A legend entry that ranks the chart below it by that series. Used with
 * `useFocusSort`: the first click ranks in the natural order, the second reverses
 * it, the third clears the focus. The label says what the next click will do.
 */
export function SortChip({
  active,
  dir,
  onClick,
  label,
  swatch,
  ascLabel = "lowest first",
  descLabel = "highest first",
  naturalDir = "desc",
  tone,
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  label: string;
  swatch: ReactNode;
  ascLabel?: string;
  descLabel?: string;
  /** The order a first click ranks in. */
  naturalDir?: SortDir;
  /** The series color. When set, the active chip wears it as a ring and a light wash. */
  tone?: string;
}) {
  const now = active ? `, ranked ${directionWords(dir, ascLabel, descLabel)}` : "";
  const toned = active && tone;
  const flipped: SortDir = naturalDir === "desc" ? "asc" : "desc";
  const next = !active
    ? `Click to rank by ${label}, ${directionWords(naturalDir, ascLabel, descLabel)}`
    : dir === naturalDir
      ? `Click to rank ${directionWords(flipped, ascLabel, descLabel)}`
      : "Click to clear the focus";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}${now}. ${next}`}
      title={next}
      aria-pressed={active}
      style={
        toned
          ? {
              borderColor: tone,
              background: `color-mix(in srgb, ${tone} 14%, var(--surface))`,
              boxShadow: `inset 0 0 0 1px ${tone}`,
            }
          : undefined
      }
      className={`group flex h-7 items-center gap-2 rounded-md border px-2 text-[13px] whitespace-nowrap transition-colors duration-(--dur-1) ${
        active
          ? `text-ink ${toned ? "font-medium" : "border-line-2 bg-surface-2"}`
          : "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {swatch}
      {label}
      <Arrow active={active} dir={dir} />
    </button>
  );
}
