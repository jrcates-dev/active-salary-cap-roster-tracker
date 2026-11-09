"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { money } from "@/lib/format";
import { statusHrefs } from "@/lib/rosterLink";
import type { HistoryRow } from "@/lib/types";
import { AvailabilityBar, SLICE_SHORT, slicesOf, Swatch, type SliceKey } from "../Availability";
import { byDir, SortChip, useSort } from "../Sort";
import { TeamChip } from "../TeamChip";
import { SectionHead } from "../ui";
import { Select, StepButton } from "../ui/controls";

/** The legend entries, each of which ranks the board by its money when clicked. */
const SORT_KEYS: SliceKey[] = ["active", "questionable", "inactive", "season", "year", "unknown"];

const COLUMN: Record<string, keyof HistoryRow> = {
  active: "cap_active",
  questionable: "cap_questionable",
  inactive: "cap_inactive_week",
  season: "cap_inactive_season",
  year: "cap_inactive_year",
  unknown: "cap_unknown",
};

/** A word or two naming the ranked money under each team's number. */
const SHORT: Record<string, string> = {
  active: "active",
  questionable: "questionable",
  season: "long-term",
  year: "for season",
  unknown: "practice squad",
};

/** Every reserve-list dollar: can come back plus done for the season. */
const reserve = (r: HistoryRow) => r.cap_inactive_season + (r.cap_inactive_year ?? 0);

export interface BoardTeam {
  team: string;
  nick: string;
  name: string;
  vars: CSSProperties;
}

/**
 * All 32 teams on one shared axis, ranked by money out for this week's game until
 * the reader picks another legend entry. Clicking an entry ranks teams by that
 * money; clicking it again flips the order. Once the reader has picked, the
 * ranked band is drawn at full strength and the rest fade. A week picker replays
 * past weeks and keeps the chosen order. In the current week each segment links to
 * that team's roster filtered to those players; past weeks have no roster to show.
 */
export function InactiveBoard({
  title,
  teams,
  history,
  week,
}: {
  title: string;
  teams: BoardTeam[];
  history: HistoryRow[];
  week: number;
}) {
  const weeks = useMemo(() => [...new Set(history.map((h) => h.week))].sort((a, b) => a - b), [history]);
  const [shown, setShown] = useState(week);
  const [sort, toggleSort] = useSort<SliceKey>("inactive");
  const [picked, setPicked] = useState(false);
  // Bars grow once on first paint; a re-sort moves rows, which must not replay it.
  const [animate, setAnimate] = useState(true);
  const byTeam = Object.fromEntries(teams.map((t) => [t.team, t]));
  const value = (r: HistoryRow) => Number(r[COLUMN[sort.key]] ?? 0);
  const rows = history
    .filter((h) => h.week === shown && h.unit === "all" && byTeam[h.team])
    .sort(
      (a, b) =>
        byDir(value(a), value(b), sort.dir) ||
        byDir(a.cap_inactive_week, b.cap_inactive_week, "desc") ||
        byDir(reserve(a), reserve(b), "desc") ||
        byTeam[a.team].nick.localeCompare(byTeam[b.team].nick),
    );
  const scale = Math.max(1, ...rows.map((r) => r.cap_total));
  const idx = weeks.indexOf(shown);
  const pickWeek = (w: number) => {
    setAnimate(false);
    setShown(w);
  };

  return (
    <div>
      <SectionHead
        title={title}
        aside={
          weeks.length > 1 && (
            <div className="flex items-center gap-1" role="group" aria-label="Week">
              <StepButton dir="prev" label="Previous week" disabled={idx <= 0} onClick={() => pickWeek(weeks[idx - 1])} />
              <Select label="Show week" value={shown} onChange={(v) => pickWeek(Number(v))}>
                {weeks.map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                    {w === week ? " · now" : ""}
                  </option>
                ))}
              </Select>
              <StepButton dir="next" label="Next week" disabled={idx >= weeks.length - 1} onClick={() => pickWeek(weeks[idx + 1])} />
            </div>
          )
        }
      />
      <div className="mb-3 -ml-2 flex flex-wrap items-center gap-0.5" role="group" aria-label="Rank teams by">
        {SORT_KEYS.map((k) => (
          <SortChip
            key={k}
            active={sort.key === k}
            dir={sort.dir}
            onClick={() => {
              setAnimate(false);
              toggleSort(k);
              setPicked(true);
            }}
            label={SLICE_SHORT[k]}
            swatch={<Swatch k={k} />}
            ascLabel="least money first"
            descLabel="most money first"
          />
        ))}
      </div>
      <ol className="space-y-1">
        {rows.map((r, i) => {
          const t = byTeam[r.team];
          return (
            <li
              key={r.team}
              className="tc grid grid-cols-[1.25rem_5.25rem_minmax(0,1fr)_5.75rem] items-center gap-x-3 sm:grid-cols-[1.5rem_7.5rem_minmax(0,1fr)_8.5rem]"
              style={t.vars}
            >
              <span className="num text-right text-xs text-ink-3">{i + 1}</span>
              <TeamChip team={t.team} nick={t.nick} vars={t.vars} size="sm" />
              <AvailabilityBar
                scale={scale}
                height={10}
                title={`${t.name} · Week ${shown}`}
                slices={slicesOf(r)}
                emphasis={picked ? sort.key : undefined}
                animate={animate}
                subject={t.name}
                hrefs={shown === week ? statusHrefs(t.team) : undefined}
              />
              <span className="num text-right leading-tight whitespace-nowrap">
                <span className="block text-sm font-medium">{money(value(r))}</span>
                <span className="block text-[11px] text-ink-3">
                  {sort.key === "inactive" ? `+${money(reserve(r))} reserve` : SHORT[sort.key]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
