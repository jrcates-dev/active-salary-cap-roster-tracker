"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useViewState } from "@/lib/viewState";
import { money, reasonLabel } from "@/lib/format";
import { YEAR_NOTE } from "@/lib/availability";
import type { Player } from "@/lib/types";
import { Swatch } from "../Availability";
import { StarterKey, StarterMark } from "../Starter";
import { Empty } from "../ui";
import { Segmented } from "../ui/controls";

export interface OutRow {
  player: Player;
  nick: string;
  vars: CSSProperties;
}

type Tab = "week" | "season" | "year";

/** Rows shown before "Show more"; the page passes up to twice as many. */
const SHOWN = 20;

/**
 * The most expensive players out, top 20 with room to show more: this week's absences (the ones that change a
 * matchup), reserve lists a player can come back from, and players done for the season.
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
  const [tab, setTab] = useViewState<Tab>("players-out-tab", "week", (v) => v === "week" || v === "season" || v === "year");
  const [all, setAll] = useViewState("players-out-all", false);
  const list = tab === "week" ? thisWeek : tab === "season" ? longTerm : forSeason;
  const rows = all ? list : list.slice(0, SHOWN);
  return (
    <div>
      <div className="mb-3">
        <Segmented<Tab>
          label="Which absences"
          value={tab}
          onChange={setTab}
          options={[
            { value: "week", label: `Week ${week}`, title: "Ruled out, doubtful or gameday inactive for this game" },
            { value: "season", label: "Long-term", title: "On a reserve list and able to come back this season" },
            { value: "year", label: "For season", title: YEAR_NOTE },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <Empty>
          {tab === "week"
            ? "No one ruled out yet"
            : tab === "season"
              ? "No one on a reserve list with a way back"
              : "No one known to be out for the season"}
        </Empty>
      ) : (
        <ol className="card divide-y divide-line">
          {rows.map(({ player: p, nick, vars }) => (
            <li key={p.key} className="tc flex items-center gap-3 px-3.5 py-2" style={vars}>
              <Swatch k={tab === "week" ? "inactive" : tab} size={14} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-medium">
                  <span className="truncate">{p.name}</span>
                  <StarterMark player={p} />
                </p>
                <p className="truncate text-xs text-ink-3">
                  <Link href={`/team/${p.team}`} className="text-ink-2 underline decoration-line-2 underline-offset-2 hover:decoration-ink">
                    {nick}
                  </Link>
                  {` · ${p.group ?? p.pos ?? ""} · ${reasonLabel(p.reason) ?? "Inactive"}`}
                  {p.outlook_note ? ` · ${p.outlook_note}` : p.injury ? ` · ${p.injury}` : ""}
                  {p.outlook_basis === "return_window_closed" ? " · window closed" : ""}
                  {p.outlook_basis === "designated_for_return" ? " · designated to return" : ""}
                </p>
              </div>
              <span className="num text-[15px] font-semibold">{money(p.cap)}</span>
            </li>
          ))}
        </ol>
      )}
      {(list.length > SHOWN || list.some((r) => r.player.starter)) && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {list.length > SHOWN && (
            <button
              type="button"
              onClick={() => setAll(!all)}
              aria-expanded={all}
              className="text-[13px] font-medium text-ink-2 underline decoration-line-2 underline-offset-2 hover:text-ink hover:decoration-ink"
            >
              {all ? "Show fewer" : `Show ${list.length - SHOWN} more`}
            </button>
          )}
          {list.some((r) => r.player.starter) && <StarterKey out />}
        </div>
      )}
    </div>
  );
}
