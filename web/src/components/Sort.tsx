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

/** A legend entry that sorts the list below it by that series. */
export function SortChip({
  active,
  dir,
  onClick,
  label,
  swatch,
  ascLabel = "lowest first",
  descLabel = "highest first",
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  label: string;
  swatch: ReactNode;
  ascLabel?: string;
  descLabel?: string;
}) {
  const now = active ? `, sorted ${directionWords(dir, ascLabel, descLabel)}` : "";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${now}`}
      aria-pressed={active}
      className={`group flex h-7 items-center gap-2 rounded-md border px-2 text-[13px] whitespace-nowrap transition-colors duration-(--dur-1) ${
        active ? "border-line-2 bg-surface-2 text-ink" : "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink"
      }`}
    >
      {swatch}
      {label}
      <Arrow active={active} dir={dir} />
    </button>
  );
}
