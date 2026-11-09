"use client";

import Link from "next/link";
import { useState } from "react";
import { money, reasonLabel } from "@/lib/format";
import { YEAR_NOTE } from "@/lib/availability";
import type { Player } from "@/lib/types";
import { Swatch } from "../Availability";

export interface OutRow {
  player: Player;
  nick: string;
  color: string;
}

type Tab = "week" | "season" | "year";

/**
 * The most expensive players out, split into this week's absences (the ones that
 * change a matchup), reserve lists a player can come back from this season, and
 * players done for the season.
 */
export function PlayersOut({
  week,
  thisWeek,
  longTerm,
  forSeason,
}: {
  week: number;
  thisWeek: OutRow[];
  longTerm: OutRow[];
  forSeason: OutRow[];
}) {
  const [tab, setTab] = useState<Tab>("week");
  const rows = tab === "week" ? thisWeek : tab === "season" ? longTerm : forSeason;
  const tabs: { k: Tab; label: string; title: string }[] = [
    { k: "week", label: `Out week ${week}`, title: "Ruled out, doubtful or gameday inactive for this game" },
    { k: "season", label: "Out long-term", title: "On a reserve list and able to come back this season" },
    { k: "year", label: "Out for season", title: YEAR_NOTE },
  ];
  return (
    <div>
      <div role="tablist" aria-label="Which absences" className="mb-3 inline-flex rounded-md border border-border bg-panel p-0.5">
        {tabs.map((t) => (
          <button
            key={t.k}
            type="button"
            role="tab"
            aria-selected={tab === t.k}
            title={t.title}
            onClick={() => setTab(t.k)}
            className={`rounded px-3 py-1 text-sm ${tab === t.k ? "bg-panel-raised text-fg" : "text-fg-muted hover:text-fg"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-panel px-4 py-6 text-sm text-fg-muted">
          {tab === "week"
            ? "Nobody is ruled out yet. This fills in as the week's injury reports and gameday inactives arrive."
            : tab === "season"
              ? "No one is on a reserve list with a way back this season."
              : "No one is known to be out for the season."}
        </p>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-panel">
          {rows.map(({ player: p, nick, color }) => (
            <li key={p.key} className="flex items-center gap-3 px-4 py-2.5">
              <Swatch k={tab === "week" ? "inactive" : tab} color={color} size={14} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-fg-muted">
                  <Link href={`/team/${p.team}`} className="hover:underline">
                    {nick}
                  </Link>{" "}
                  · {p.group} · {reasonLabel(p.reason) ?? "Inactive"}
                  {p.outlook_note ? ` · ${p.outlook_note}` : p.injury ? ` · ${p.injury}` : ""}
                  {p.outlook_basis === "return_window_closed" ? " · return window closed" : ""}
                  {p.outlook_basis === "designated_for_return" ? " · designated to return" : ""}
                </p>
              </div>
              <span className="num text-xl">{money(p.cap)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
