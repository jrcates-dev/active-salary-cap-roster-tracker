"use client";

import { useMemo, useState } from "react";
import { statusText } from "@/lib/availability";
import { UNIT_LABEL, money } from "@/lib/format";
import type { Group, Player, Unit } from "@/lib/types";
import { playerSlice, SLICE_LABEL, Swatch, type SliceKey } from "../Availability";
import { useMoneyMode } from "./MoneyMode";

type SortKey = "name" | "group" | "cap" | "flag" | "years_left";

type Filter = Exclude<SliceKey, "dead">;
const SLICE_ORDER: Record<Filter, number> = {
  inactive: 0,
  season: 1,
  questionable: 2,
  active: 3,
  unknown: 4,
};
const FILTERS: (Filter | "all")[] = ["all", "active", "questionable", "inactive", "season", "unknown"];
const FILTER_LABEL: Record<Filter, string> = {
  ...SLICE_LABEL,
  season: "Out long-term",
};
/** Rows shown before "Show all"; filters and sorting still apply to every player. */
const PAGE = 30;

export function PlayerTable({
  color,
  players,
  groups,
}: {
  color: string;
  players: Player[];
  groups: Group[];
}) {
  const { fmt } = useMoneyMode();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "cap", desc: true });
  const [flag, setFlag] = useState<Filter | "all">("all");
  const [unit, setUnit] = useState<Unit | "all">("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const groupOrder = useMemo(() => {
    const unitRank: Record<string, number> = { offense: 0, defense: 1, special_teams: 2 };
    return Object.fromEntries(groups.map((g) => [g.code, unitRank[g.unit] * 10 + g.order]));
  }, [groups]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: players.length };
    for (const p of players) {
      const k = playerSlice(p);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [players]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = players.filter(
      (p) =>
        (flag === "all" || playerSlice(p) === flag) &&
        (unit === "all" || p.unit === unit) &&
        (!q || p.name.toLowerCase().includes(q) || (p.pos ?? "").toLowerCase() === q),
    );
    const dir = sort.desc ? -1 : 1;
    const val = (p: Player): number | string => {
      switch (sort.key) {
        case "name":
          return p.name;
        case "group":
          return groupOrder[p.group ?? ""] ?? 99;
        case "cap":
          return p.cap;
        case "flag":
          return SLICE_ORDER[playerSlice(p) as Filter];
        case "years_left":
          return p.years_left ?? -1;
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      const c = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
      return c !== 0 ? c * dir : b.cap - a.cap;
    });
  }, [players, flag, unit, query, sort, groupOrder]);

  const total = rows.reduce((acc, p) => acc + p.cap, 0);

  const header = (key: SortKey, label: string, align = "text-left") => (
    <th
      scope="col"
      aria-sort={sort.key === key ? (sort.desc ? "descending" : "ascending") : "none"}
      className={`px-3 py-2 font-medium ${align}`}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-fg"
        onClick={() =>
          setSort((s) => ({ key, desc: s.key === key ? !s.desc : key === "cap" || key === "years_left" }))
        }
      >
        {label}
        <span aria-hidden className="text-fg-faint">
          {sort.key === key ? (sort.desc ? "▾" : "▴") : ""}
        </span>
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={flag === f}
              onClick={() => setFlag(f)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                flag === f
                  ? "border-fg-muted bg-panel-raised text-fg"
                  : "border-border text-fg-muted hover:text-fg"
              }`}
            >
              {f !== "all" && <Swatch k={f} color={color} size={10} />}
              {f === "all" ? "All" : FILTER_LABEL[f]}
              <span className="num text-fg-faint">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <select
          aria-label="Filter by unit"
          value={unit}
          onChange={(e) => setUnit(e.target.value as Unit | "all")}
          className="rounded-md border border-border bg-panel px-2 py-1 text-sm text-fg"
        >
          <option value="all">All units</option>
          {(["offense", "defense", "special_teams"] as Unit[]).map((u) => (
            <option key={u} value={u}>
              {UNIT_LABEL[u]}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Search players"
          aria-label="Search players"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="ml-auto w-full rounded-md border border-border bg-panel px-3 py-1 text-sm text-fg placeholder:text-fg-faint sm:w-56"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-panel text-fg-muted">
            <tr>
              {header("name", "Player")}
              {header("group", "Group")}
              {header("cap", "Cap number", "text-right")}
              {header("flag", "Status")}
              {header("years_left", "Years left", "text-right")}
            </tr>
          </thead>
          <tbody>
            {(showAll ? rows : rows.slice(0, PAGE)).map((p) => {
              const status = statusText(p);
              return (
                <tr key={p.key} className="border-t border-border hover:bg-panel">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-fg">{p.name}</span>
                      {p.source !== "contract" && (
                        <span
                          className="rounded border border-border px-1.5 text-[11px] text-fg-muted"
                          title={
                            p.source === "derived_rookie_scale"
                              ? "Rookie contract not yet in the free data. Cap number derived from the rookie wage scale."
                              : "No contract in the free data. Counted at the league minimum for the player's experience."
                          }
                        >
                          {p.source === "derived_rookie_scale" ? "rookie est." : "min. est."}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-fg-muted">
                    <span className="num text-base text-fg">{p.group ?? "?"}</span>
                    {p.pos && p.pos !== p.group && <span className="ml-1.5">{p.pos}</span>}
                  </td>
                  <td className="num px-3 py-2 text-right text-base text-fg">
                    {fmt(p.cap)}
                    {p.cap !== p.contract_cap && (
                      <span className="block text-xs text-fg-muted" title="Practice squad pay, prorated">
                        of {money(p.contract_cap)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <Swatch k={playerSlice(p)} color={color} />
                      <span className="text-fg">{status}</span>
                      {p.injury && <span className="text-fg-muted">{p.injury}</span>}
                    </span>
                  </td>
                  <td className="num px-3 py-2 text-right text-base text-fg-muted">
                    {p.years_left ?? "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-border bg-panel text-fg-muted">
            <tr>
              <td className="px-3 py-2" colSpan={2}>
                {rows.length} players{flag !== "all" || unit !== "all" || query ? " match" : ""}
              </td>
              <td className="num px-3 py-2 text-right text-base text-fg">{fmt(total)}</td>
              <td colSpan={2} className="px-3 py-2 text-right">
                {rows.length > PAGE && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="text-fg underline-offset-4 hover:underline"
                  >
                    {showAll ? `Show top ${PAGE}` : `Show all ${rows.length}`}
                  </button>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

