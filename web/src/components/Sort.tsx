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
    <span
      aria-hidden
      className={`inline-block w-[0.7em] text-[0.75em] leading-none ${
        active ? "text-fg" : "text-fg-faint opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
      }`}
    >
      {active ? (dir === "desc" ? "▼" : "▲") : "▼"}
    </span>
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
}: {
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  label: string;
  children: ReactNode;
  ascLabel?: string;
  descLabel?: string;
}) {
  const now = active ? `, sorted ${directionWords(dir, ascLabel, descLabel)}` : "";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${now}`}
      className={`group num inline-flex items-center gap-0.5 rounded text-base ${
        active ? "text-fg underline underline-offset-4" : "text-fg-muted hover:text-fg"
      }`}
    >
      {children}
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
      className={`group flex items-center gap-2 rounded-md border px-2 py-1 text-sm transition-colors ${
        active
          ? "border-fg-muted bg-panel-raised text-fg"
          : "border-transparent text-fg-muted hover:border-border hover:text-fg"
      }`}
    >
      {swatch}
      {label}
      <Arrow active={active} dir={dir} />
    </button>
  );
}
