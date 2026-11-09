"use client";

import { useMemo, useState } from "react";
import { statusText, YEAR_NOTE } from "@/lib/availability";
import { UNIT_LABEL, money } from "@/lib/format";
import type { Group, Player, Unit } from "@/lib/types";
import { playerSlice, SLICE_SHORT, Swatch, type SliceKey } from "../Availability";
import { ariaSort, SortHeader, type SortDir } from "../Sort";
import { SectionHead } from "../ui";
import { Chip, SearchInput, Select } from "../ui/controls";
import { useMoneyMode } from "./MoneyMode";

type SortKey = "name" | "group" | "cap" | "flag" | "years_left";

type Filter = Exclude<SliceKey, "dead">;
const SLICE_RANK: Record<Filter, number> = { inactive: 0, season: 1, year: 2, questionable: 3, active: 4, unknown: 5 };
const FILTERS: (Filter | "all")[] = ["all", "active", "questionable", "inactive", "season", "year", "unknown"];
const FILTER_TITLE: Partial<Record<Filter, string>> = {
  season: "On a reserve list and able to come back this season",
  year: YEAR_NOTE,
  unknown: "Practice squad, plus anyone the roster file has no gameday status for",
};
/** Rows shown before "Show all"; filters and sorting still apply to every player. */
const PAGE = 30;

export function PlayerTable({ players, groups, week }: { players: Player[]; groups: Group[]; week: number }) {
  const { fmt } = useMoneyMode();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "cap", dir: "desc" });
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
    const dir = sort.dir === "desc" ? -1 : 1;
    const val = (p: Player): number | string => {
      switch (sort.key) {
        case "name":
          return p.name;
        case "group":
          return groupOrder[p.group ?? ""] ?? 99;
        case "cap":
          return p.cap;
        case "flag":
          return SLICE_RANK[playerSlice(p) as Filter];
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
  const filtered = flag !== "all" || unit !== "all" || query.trim() !== "";

  const header = (key: SortKey, label: string, align: "left" | "right" = "left", natural: SortDir = "asc") => (
    <th scope="col" aria-sort={ariaSort(sort.key === key, sort.dir)} className={align === "right" ? "text-right" : "text-left"}>
      <SortHeader
        active={sort.key === key}
        dir={sort.dir}
        label={label}
        align={align}
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === "desc" ? "asc" : "desc") : natural }))}
      >
        {label}
      </SortHeader>
    </th>
  );

  return (
    <section>
      <SectionHead
        title="Roster"
        count={`Week ${week}`}
        asideClassName="w-full flex-nowrap sm:w-auto"
        aside={
          <>
            <Select label="Filter by unit" value={unit} onChange={(v) => setUnit(v as Unit | "all")}>
              <option value="all">All units</option>
              {(["offense", "defense", "special_teams"] as Unit[]).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </Select>
            <SearchInput label="Search players" placeholder="Search players" value={query} onChange={setQuery} className="flex-1 sm:w-52 sm:flex-none" />
          </>
        }
      />
      {/* One row that scrolls sideways on phones; wraps from small screens up. */}
      <div className="strip -mx-4 -mt-1 mb-2 px-4 py-1 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <Chip
              key={f}
              active={flag === f}
              onClick={() => setFlag(f)}
              count={counts[f] ?? 0}
              title={f === "all" ? undefined : FILTER_TITLE[f]}
              swatch={f !== "all" ? <Swatch k={f} size={10} /> : undefined}
            >
              {f === "all" ? "All" : SLICE_SHORT[f]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl w-full min-w-[640px] text-sm">
            <thead className="bg-surface-2">
              <tr>
                {header("name", "Player")}
                {header("group", "Group")}
                {header("cap", "Cap", "right", "desc")}
                {header("flag", "Status")}
                {header("years_left", "Years", "right", "desc")}
              </tr>
            </thead>
            <tbody>
              {(showAll ? rows : rows.slice(0, PAGE)).map((p) => (
                <tr key={p.key}>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{p.name}</span>
                      {p.source !== "contract" && (
                        <span
                          className="rounded border border-line px-1 text-[10px] leading-4 text-ink-3 uppercase"
                          title={
                            p.source === "derived_rookie_scale"
                              ? "Rookie contract not yet in the free data. Cap number derived from the rookie wage scale."
                              : "No contract in the free data. Counted at the league minimum for the player's experience."
                          }
                        >
                          est
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="text-ink-2">
                    <span className="num font-medium text-ink">{p.group ?? "?"}</span>
                    {p.pos && p.pos !== p.group && <span className="ml-1.5 text-xs">{p.pos}</span>}
                  </td>
                  <td className="num text-right font-medium">
                    {fmt(p.cap)}
                    {p.cap !== p.contract_cap && (
                      <span className="block text-[11px] font-normal text-ink-3" title="Practice squad pay, prorated">
                        of {money(p.contract_cap)}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <Swatch k={playerSlice(p)} />
                      <span>{statusText(p)}</span>
                      {(p.outlook_note ?? p.injury) && <span className="text-ink-3">{p.outlook_note ?? p.injury}</span>}
                    </span>
                  </td>
                  <td className="num text-right text-ink-2">{p.years_left ?? "–"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line bg-surface-2 text-ink-2">
              <tr>
                <td colSpan={2} className="num">
                  {rows.length} players{filtered ? " match" : ""}
                </td>
                <td className="num text-right font-semibold text-ink">{fmt(total)}</td>
                <td colSpan={2} className="text-right">
                  {rows.length > PAGE && (
                    <button type="button" onClick={() => setShowAll((v) => !v)} className="font-medium text-ink underline-offset-4 hover:underline">
                      {showAll ? `Show top ${PAGE}` : `Show all ${rows.length}`}
                    </button>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
