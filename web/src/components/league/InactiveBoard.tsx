"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import type { HistoryRow } from "@/lib/types";
import { AvailabilityBar, SLICE_LABEL, slicesOf, Swatch, type SliceKey } from "../Availability";
import { byDir, SortChip, useSort } from "../Sort";
import { TeamChip } from "../TeamChip";

/** The legend entries, each of which ranks the board by its money when clicked. */
const SORT_KEYS: SliceKey[] = ["active", "questionable", "inactive", "season", "unknown"];
const LEGEND_COLOR = "#c9ced8";

const COLUMN: Record<string, keyof HistoryRow> = {
  active: "cap_active",
  questionable: "cap_questionable",
  inactive: "cap_inactive_week",
  season: "cap_inactive_season",
  unknown: "cap_unknown",
};

/** Few words naming the ranked money under each team's number. */
const SHORT: Record<string, string> = {
  active: "active",
  questionable: "questionable",
  season: "long-term",
  unknown: "practice squad",
};

export interface BoardTeam {
  team: string;
  nick: string;
  name: string;
  color: string;
}

/**
 * All 32 teams on one shared axis, ranked by money out for this week's game until
 * the reader picks another legend entry. Clicking an entry ranks teams by that
 * money; clicking it again flips the order. Once the reader has picked, the
 * ranked band is drawn at full strength and the rest fade. A week picker replays
 * past weeks and keeps the chosen order.
 */
export function InactiveBoard({
  teams,
  history,
  week,
}: {
  teams: BoardTeam[];
  history: HistoryRow[];
  week: number;
}) {
  const weeks = useMemo(
    () => [...new Set(history.map((h) => h.week))].sort((a, b) => a - b),
    [history],
  );
  const [shown, setShown] = useState(week);
  const [sort, toggleSort] = useSort<SliceKey>("inactive");
  const [picked, setPicked] = useState(false);
  const byTeam = Object.fromEntries(teams.map((t) => [t.team, t]));
  const value = (r: HistoryRow) => Number(r[COLUMN[sort.key]] ?? 0);
  const rows = history
    .filter((h) => h.week === shown && h.unit === "all" && byTeam[h.team])
    .sort(
      (a, b) =>
        byDir(value(a), value(b), sort.dir) ||
        byDir(a.cap_inactive_week, b.cap_inactive_week, "desc") ||
        byDir(a.cap_inactive_season, b.cap_inactive_season, "desc") ||
        byTeam[a.team].nick.localeCompare(byTeam[b.team].nick),
    );
  const scale = Math.max(1, ...rows.map((r) => r.cap_total));
  const idx = weeks.indexOf(shown);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-1 gap-y-1" role="group" aria-label="Rank teams by">
        <span className="mr-1 text-sm text-fg-faint">Rank by</span>
        {SORT_KEYS.map((k) => (
          <SortChip
            key={k}
            active={sort.key === k}
            dir={sort.dir}
            onClick={() => {
              toggleSort(k);
              setPicked(true);
            }}
            label={SLICE_LABEL[k]}
            swatch={<Swatch k={k} color={LEGEND_COLOR} />}
            ascLabel="least money first"
            descLabel="most money first"
          />
        ))}
      </div>
      {weeks.length > 1 && (
        <div className="mb-4 flex items-center gap-2 text-sm" role="group" aria-label="Week">
          <button
            type="button"
            disabled={idx <= 0}
            onClick={() => setShown(weeks[idx - 1])}
            className="rounded-md border border-border px-2 py-1 text-fg-muted enabled:hover:text-fg disabled:opacity-40"
            aria-label="Previous week"
          >
            ‹
          </button>
          <select
            aria-label="Show week"
            value={shown}
            onChange={(e) => setShown(Number(e.target.value))}
            className="rounded-md border border-border bg-panel px-2 py-1 text-fg"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>
                Week {w}
                {w === week ? " (now)" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={idx >= weeks.length - 1}
            onClick={() => setShown(weeks[idx + 1])}
            className="rounded-md border border-border px-2 py-1 text-fg-muted enabled:hover:text-fg disabled:opacity-40"
            aria-label="Next week"
          >
            ›
          </button>
          {shown !== week && (
            <button
              type="button"
              onClick={() => setShown(week)}
              className="ml-1 text-fg-muted underline-offset-4 hover:text-fg hover:underline"
            >
              Back to week {week}
            </button>
          )}
        </div>
      )}
      <ol className="space-y-2">
        {rows.map((r, i) => {
          const t = byTeam[r.team];
          return (
            <li
              key={r.team}
              className="grid grid-cols-[1.5rem_5.5rem_1fr_4.75rem] items-center gap-3 sm:grid-cols-[1.5rem_8rem_1fr_8.5rem]"
            >
              <span className="num text-right text-fg-faint">{i + 1}</span>
              <TeamChip team={t.team} nick={t.nick} color={t.color} size="sm" />
              <AvailabilityBar
                color={t.color}
                scale={scale}
                height={16}
                title={`${t.name} · week ${shown}`}
                slices={slicesOf(r)}
                emphasis={picked ? sort.key : undefined}
              />
              <span className="num text-right text-lg leading-none">
                {money(value(r))}
                <span className="block text-xs text-fg-muted sm:ml-2 sm:inline">
                  {sort.key === "inactive"
                    ? `+${money(r.cap_inactive_season)} long-term`
                    : SHORT[sort.key]}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
