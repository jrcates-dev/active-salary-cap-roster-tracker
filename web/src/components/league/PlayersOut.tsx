"use client";

import Link from "next/link";
import { useState } from "react";
import { money, reasonLabel } from "@/lib/format";
import type { Player } from "@/lib/types";
import { Swatch } from "../Availability";

export interface OutRow {
  player: Player;
  nick: string;
  color: string;
}

/**
 * The most expensive players out, split into this week's absences (the ones that
 * change a matchup) and the long-term reserve lists (the same names every week).
 */
export function PlayersOut({ week, thisWeek, longTerm }: { week: number; thisWeek: OutRow[]; longTerm: OutRow[] }) {
  const [tab, setTab] = useState<"week" | "season">("week");
  const rows = tab === "week" ? thisWeek : longTerm;
  const tabs = [
    { k: "week" as const, label: `Out for week ${week}` },
    { k: "season" as const, label: "Out long-term" },
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
            : "No one is on a reserve list."}
        </p>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-panel">
          {rows.map(({ player: p, nick, color }) => (
            <li key={p.key} className="flex items-center gap-3 px-4 py-2.5">
              <Swatch k={tab === "week" ? "inactive" : "season"} color={color} size={14} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-xs text-fg-muted">
                  <Link href={`/team/${p.team}`} className="hover:underline">
                    {nick}
                  </Link>{" "}
                  · {p.group} · {reasonLabel(p.reason) ?? "Inactive"}
                  {p.injury ? ` · ${p.injury}` : ""}
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
