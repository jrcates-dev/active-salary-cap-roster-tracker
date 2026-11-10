"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useViewState } from "@/lib/viewState";
import { statusText, YEAR_NOTE } from "@/lib/availability";
import { parseRosterFilter, PAST_STATUSES, ROSTER_EVENT, ROSTER_ID, rosterQuery, scrollToRoster, type RosterFilter } from "@/lib/rosterLink";
import { UNIT_LABEL, money } from "@/lib/format";
import type { Group, HistoryPlayer, Player, Unit } from "@/lib/types";
import { playerSlice, SLICE_SHORT, Swatch, type SliceKey } from "../Availability";
import { ariaSort, SortHeader, type SortDir } from "../Sort";
import { NameWithStar, StarterKey } from "../Starter";
import { SectionHead } from "../ui";
import { Chip, SearchInput, Select, StepButton } from "../ui/controls";
import { useMoneyMode } from "./MoneyMode";

type SortKey = "name" | "group" | "cap" | "flag" | "years_left";

type Filter = Exclude<SliceKey, "dead">;
const SLICE_RANK: Record<Filter, number> = { inactive: 0, season: 1, year: 2, questionable: 3, active: 4, unknown: 5 };
const FILTERS: (Filter | "all")[] = ["all", "active", "questionable", "inactive", "season", "year", "unknown"];
/** An earlier week lists only who was out or questionable, so only those filters apply. */
const PAST_FILTERS: (Filter | "all")[] = ["all", ...(PAST_STATUSES as Filter[])];
const FILTER_TITLE: Partial<Record<Filter, string>> = {
  season: "On a reserve list and able to come back this season",
  year: YEAR_NOTE,
  unknown: "Practice squad, plus anyone the roster file has no gameday status for",
};
/** Rows shown before "Show all"; filters and sorting still apply to every player. */
const PAGE = 30;
const UNIT_KEYS: Unit[] = ["offense", "defense", "special_teams"];

/**
 * Which players by position: "all", a unit ("defense"), or position groups
 * ("g:IDL,EDGE"). One value, so the select below can show any of them.
 */
type Pos = "all" | Unit | `g:${string}`;
const posOf = (f: RosterFilter): Pos => (f.groups?.length ? `g:${f.groups.join(",")}` : (f.unit ?? "all"));
const groupsOf = (pos: Pos) => (pos.startsWith("g:") ? pos.slice(2).split(",") : null);
const filterOf = (flag: Filter | "all", pos: Pos, week?: number): RosterFilter => ({
  week,
  status: flag === "all" ? undefined : flag,
  groups: groupsOf(pos) ?? undefined,
  unit: pos !== "all" && !pos.startsWith("g:") ? (pos as Unit) : undefined,
});

/**
 * An earlier week's row as a roster row: that week's cap number and status, with the
 * contract details from today's roster when the player is still on it.
 */
function pastRow(h: HistoryPlayer, now: Player | undefined): Player {
  return {
    source: "contract",
    roster_status: null,
    years_left: null,
    contract_apy: null,
    headshot: null,
    ...now,
    ...h,
    // That week's place on the depth chart, never today's.
    starter: h.starter ?? null,
    depth_role: h.depth_role ?? null,
    contract_cap: now && now.cap === h.cap ? now.contract_cap : h.cap,
  };
}

/**
 * The team's roster for the current week, or for an earlier week the list of who was
 * out or questionable then (`pastOut`), picked with the week control or a link from
 * the money-out-by-week chart.
 */
export function PlayerTable({
  players,
  pastOut,
  weeks,
  groups,
  week,
}: {
  players: Player[];
  /** This team's players out or questionable in each earlier week. */
  pastOut: HistoryPlayer[];
  /** Every week with data, the current one included, in order. */
  weeks: number[];
  groups: Group[];
  week: number;
}) {
  const { fmt } = useMoneyMode();
  const [shown, setShown] = useState(week);
  const [sort, setSort] = useViewState<{ key: SortKey; dir: SortDir }>("roster-sort", { key: "cap", dir: "desc" });
  const [flag, setFlag] = useState<Filter | "all">("all");
  const [pos, setPos] = useState<Pos>("all");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  /** Sets the filters a chart link asked for, clearing the rest. */
  const apply = useCallback(
    (f: RosterFilter) => {
      const w = f.week && weeks.includes(f.week) ? f.week : week;
      setShown(w);
      setFlag(w !== week && f.status && !PAST_STATUSES.includes(f.status) ? "all" : (f.status ?? "all"));
    setPos(posOf(f));
    setQuery("");
      setShowAll(false);
    },
    [week, weeks],
  );

  // Links from charts: on arrival (the query string), from a chart on this page
  // (an event, the URL is already updated), and back/forward between filters.
  useEffect(() => {
    const fromUrl = () => parseRosterFilter(window.location.search);
    const arrived = fromUrl();
    const frame = arrived
      ? requestAnimationFrame(() => {
          apply(arrived);
          scrollToRoster();
        })
      : 0;
    const onLink = (e: Event) => {
      apply((e as CustomEvent<RosterFilter>).detail);
      scrollToRoster();
    };
    const onPop = () => apply(fromUrl() ?? {});
    window.addEventListener(ROSTER_EVENT, onLink);
    window.addEventListener("popstate", onPop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(ROSTER_EVENT, onLink);
      window.removeEventListener("popstate", onPop);
    };
  }, [apply]);

  /** Keeps the address in step with the filters the reader picks, so it can be shared. */
  const pick = (nextFlag: Filter | "all", nextPos: Pos, nextWeek = shown) => {
    // Active and practice squad players are not kept for earlier weeks.
    const flagFor = nextWeek !== week && nextFlag !== "all" && !PAST_STATUSES.includes(nextFlag) ? "all" : nextFlag;
    setShown(nextWeek);
    setFlag(flagFor);
    setPos(nextPos);
    if (nextWeek !== shown) setShowAll(false);
    const query = rosterQuery(filterOf(flagFor, nextPos, nextWeek === week ? undefined : nextWeek));
    window.history.replaceState(null, "", `${window.location.pathname}${query}${window.location.hash}`);
  };

  const past = shown !== week;
  const pastIdx = weeks.indexOf(shown);
  const source = useMemo(() => {
    if (shown === week) return players;
    const now = new Map(players.map((p) => [p.key, p]));
    return pastOut.filter((h) => h.week === shown).map((h) => pastRow(h, now.get(h.key)));
  }, [players, pastOut, shown, week]);
  const filters = past ? PAST_FILTERS : FILTERS;

  const groupOrder = useMemo(() => {
    const unitRank: Record<string, number> = { offense: 0, defense: 1, special_teams: 2 };
    return Object.fromEntries(groups.map((g) => [g.code, unitRank[g.unit] * 10 + g.order]));
  }, [groups]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: source.length };
    for (const p of source) {
      const k = playerSlice(p);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [source]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const codes = groupsOf(pos);
    const filtered = source.filter(
      (p) =>
        (flag === "all" || playerSlice(p) === flag) &&
        (codes ? codes.includes(p.group ?? "") : pos === "all" || p.unit === pos) &&
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
  }, [source, flag, pos, query, sort, groupOrder]);

  const total = rows.reduce((acc, p) => acc + p.cap, 0);
  const filtered = flag !== "all" || pos !== "all" || query.trim() !== "";
  const pickedGroups = groupsOf(pos);
  // A link can ask for several groups at once (a matchup's defensive front); the
  // select gets an option for that set so it always shows what is applied.
  const combo = pickedGroups && pickedGroups.length > 1 ? pos : null;

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
    <section id={ROSTER_ID} className="scroll-mt-28">
      <SectionHead
        title="Roster"
        count={past ? `Week ${shown} · who was out` : `Week ${week}`}
        asideClassName="w-full flex-wrap sm:w-auto sm:flex-nowrap"
        aside={
          <>
            {weeks.length > 1 && (
              <div className="flex items-center gap-1" role="group" aria-label="Week">
                <StepButton dir="prev" label="Previous week" disabled={pastIdx <= 0} onClick={() => pick(flag, pos, weeks[pastIdx - 1])} />
                <Select label="Show week" value={shown} onChange={(v) => pick(flag, pos, Number(v))}>
                  {[...weeks].reverse().map((w) => (
                    <option key={w} value={w}>
                      Week {w}
                      {w === week ? " · now" : ""}
                    </option>
                  ))}
                </Select>
                <StepButton
                  dir="next"
                  label="Next week"
                  disabled={pastIdx < 0 || pastIdx >= weeks.length - 1}
                  onClick={() => pick(flag, pos, weeks[pastIdx + 1])}
                />
              </div>
            )}
            <Select label="Filter by position" value={pos} onChange={(v) => pick(flag, v as Pos)}>
              <option value="all">All positions</option>
              {combo && <option value={combo}>{pickedGroups!.join(" + ")}</option>}
              {UNIT_KEYS.map((u) => (
                <optgroup key={u} label={UNIT_LABEL[u]}>
                  <option value={u}>All {UNIT_LABEL[u].toLowerCase()}</option>
                  {groups
                    .filter((g) => g.unit === u)
                    .sort((a, b) => a.order - b.order)
                    .map((g) => (
                      <option key={g.code} value={`g:${g.code}`}>
                        {g.code} · {g.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
            <SearchInput label="Search players" placeholder="Search players" value={query} onChange={setQuery} className="flex-1 sm:w-52 sm:flex-none" />
          </>
        }
      />
      {/* One row that scrolls sideways on phones; wraps from small screens up. */}
      <div className="strip -mx-4 -mt-1 mb-2 px-4 py-1 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1.5 sm:w-auto sm:flex-wrap" role="group" aria-label="Filter by status">
          {filters.map((f) => (
            <Chip
              key={f}
              active={flag === f}
              onClick={() => pick(f, pos)}
              count={counts[f] ?? 0}
              title={f === "all" ? undefined : FILTER_TITLE[f]}
              swatch={f !== "all" ? <Swatch k={f} size={10} /> : undefined}
            >
              {f === "all" ? (past ? "All out" : "All") : past && f === "inactive" ? "Out that week" : SLICE_SHORT[f]}
            </Chip>
          ))}
        </div>
      </div>
      {past && (
        <p className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px] text-ink-2">
          <span>Players who were out or questionable in week {shown}, at this season&rsquo;s cap numbers.</span>
          <button type="button" onClick={() => pick("all", pos, week)} className="font-medium text-ink underline-offset-4 hover:underline">
            Back to the week {week} roster
          </button>
        </p>
      )}
      <StarterKey className="mb-2" />
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
                      <span className="font-medium">
                        <NameWithStar player={p} />
                      </span>
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
