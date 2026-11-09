"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/format";
import type { HistoryRow } from "@/lib/types";
import { AvailabilityBar, slicesOf } from "../Availability";
import { TeamChip } from "../TeamChip";

export interface BoardTeam {
  team: string;
  nick: string;
  name: string;
  color: string;
}

/**
 * All 32 teams ranked by money out for this week's game, on one shared axis. Money
 * on reserve lists (IR, PUP) is drawn as its own faint band and does not set the
 * order, since it barely changes week to week. A week picker replays past weeks.
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
  const byTeam = Object.fromEntries(teams.map((t) => [t.team, t]));
  const rows = history
    .filter((h) => h.week === shown && h.unit === "all" && byTeam[h.team])
    .sort(
      (a, b) =>
        b.cap_inactive_week - a.cap_inactive_week || b.cap_inactive_season - a.cap_inactive_season,
    );
  const scale = Math.max(1, ...rows.map((r) => r.cap_total));
  const idx = weeks.indexOf(shown);

  return (
    <div>
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
              />
              <span className="num text-right text-lg leading-none">
                {money(r.cap_inactive_week)}
                <span className="block text-xs text-fg-muted sm:ml-2 sm:inline">
                  +{money(r.cap_inactive_season)} long-term
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
