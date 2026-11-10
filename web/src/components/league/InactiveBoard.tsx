"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { money } from "@/lib/format";
import { deadHref, weekStatusHrefs } from "@/lib/rosterLink";
import type { HistoryRow } from "@/lib/types";
import { AvailabilityBar, SLICE_SHORT, slicesOf, Swatch, type SliceKey } from "../Availability";
import { byDir, SortChip, useFocusSort } from "../Sort";
import { TeamChip } from "../TeamChip";
import { Tip, TipRow, TipTitle } from "../Tip";
import { SectionHead } from "../ui";
import { Select, StepButton } from "../ui/controls";

/** The legend entries, each of which ranks the board by its money when clicked. */
const SORT_KEYS: SliceKey[] = ["active", "questionable", "inactive", "season", "year", "unknown", "dead"];

const COLUMN: Partial<Record<SliceKey, keyof HistoryRow>> = {
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
  inactive: "this week",
  questionable: "questionable",
  season: "long-term",
  year: "for season",
  unknown: "practice squad",
  dead: "dead money",
};

/**
 * Every cap dollar not playing this week: this game's absences, every reserve list,
 * and the team's dead money for the year.
 */
const totalOut = (r: HistoryRow, dead: number) =>
  r.cap_inactive_week + r.cap_inactive_season + (r.cap_inactive_year ?? 0) + dead;

/** What the number beside each bar means, by the legend entry that ranks the board. */
const MEANING: Record<string, string> = {
  active: "Cap money on players active for this week's game.",
  questionable: "Cap money on players listed questionable for this week's game.",
  inactive: "Cap money out for this week's game only: ruled out, doubtful or a gameday inactive. Reserve lists are not counted.",
  season: "Cap money on a reserve list (IR, PUP, NFI, suspension) with a way back this season.",
  year: "Cap money on a reserve list that is done for the season.",
  unknown: "Cap money on the practice squad and anyone without a game status.",
  dead: "Dead money: this year's cap charges for players no longer on the team. The same figure every week.",
};

export interface BoardTeam {
  team: string;
  nick: string;
  name: string;
  vars: CSSProperties;
  /** Dead money for the year, 0 when the hand-entered team totals lack it. */
  dead: number;
}

/**
 * All 32 teams on one shared axis, ranked by total money out (this week's absences,
 * every reserve list and the year's dead money) until the reader picks a legend
 * entry. Dead money is a season figure, so every week shows the current one. Clicking an entry ranks teams by that money;
 * a second click flips the order and a third clears the focus, back to this
 * default view. While an entry is picked, its band is outlined and the rest fade.
 * A week picker replays past weeks and keeps the chosen order. Each segment links
 * to that team's roster filtered to those players: the live roster in the current
 * week, and that week's list of who was out in an earlier one.
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
  const [sort, toggleSort] = useFocusSort<SliceKey>("inactive");
  // Bars grow once on first paint; a re-sort moves rows, which must not replay it.
  const [animate, setAnimate] = useState(true);
  const byTeam = Object.fromEntries(teams.map((t) => [t.team, t]));
  const deadOf = (r: HistoryRow) => byTeam[r.team]?.dead ?? 0;
  const amount = (r: HistoryRow, k: SliceKey) => (k === "dead" ? deadOf(r) : Number(r[COLUMN[k]!] ?? 0));
  const outOf = (r: HistoryRow) => totalOut(r, deadOf(r));
  // Unfocused, the board ranks and labels each team by its total money out.
  const value = (r: HistoryRow) => (sort.focused ? amount(r, sort.key) : outOf(r));
  const rows = history
    .filter((h) => h.week === shown && h.unit === "all" && byTeam[h.team])
    .sort(
      (a, b) =>
        byDir(value(a), value(b), sort.dir) ||
        byDir(outOf(a), outOf(b), "desc") ||
        byDir(a.cap_inactive_week, b.cap_inactive_week, "desc") ||
        byTeam[a.team].nick.localeCompare(byTeam[b.team].nick),
    );
  const scale = Math.max(1, ...rows.map((r) => r.cap_total + deadOf(r)));
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
            active={sort.focused && sort.key === k}
            dir={sort.dir}
            onClick={() => {
              setAnimate(false);
              toggleSort(k);
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
                slices={{ ...slicesOf(r), dead: deadOf(r) }}
                emphasis={sort.focused ? sort.key : undefined}
                animate={animate}
                subject={t.name}
                hrefs={{ ...weekStatusHrefs(t.team, shown, week), dead: deadHref(t.team) }}
              />
              <Tip
                as="span"
                className="num cursor-help text-right leading-tight whitespace-nowrap"
                content={<ValueTip team={t.name} week={shown} row={r} dead={t.dead} sortKey={sort.focused ? sort.key : null} />}
              >
                <span className="block text-sm font-medium">{money(value(r))}</span>
                <span className="block text-[11px] text-ink-3">{sort.focused ? SHORT[sort.key] : "total out"}</span>
              </Tip>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The tooltip on the number beside a bar: what the number counts and, for the
 * default total, the three kinds of absence it adds up.
 */
function ValueTip({
  team,
  week,
  row,
  dead,
  sortKey,
}: {
  team: string;
  week: number;
  row: HistoryRow;
  dead: number;
  sortKey: SliceKey | null;
}) {
  if (sortKey) {
    return (
      <>
        <TipTitle>
          {team} · Week {week}
        </TipTitle>
        <p className="text-ink-2">{MEANING[sortKey]}</p>
      </>
    );
  }
  return (
    <>
      <TipTitle>
        {team} · Week {week}
      </TipTitle>
      <p className="mb-1.5 text-ink-2">
        Total out: every cap dollar not on the field this week. Players out for this game, players on a reserve list,
        and dead money for the year.
      </p>
      <TipRow label="Out this week" value={money(row.cap_inactive_week)} swatch={<Swatch k="inactive" />} />
      <TipRow label="Out long-term" value={money(row.cap_inactive_season)} swatch={<Swatch k="season" />} />
      <TipRow label="Out for season" value={money(row.cap_inactive_year ?? 0)} swatch={<Swatch k="year" />} />
      <TipRow label="Dead money" value={money(dead)} swatch={<Swatch k="dead" />} />
      <div className="mt-1 border-t border-line pt-1">
        <TipRow label="Total out" value={money(totalOut(row, dead))} />
      </div>
    </>
  );
}
