"use client";

import type { CSSProperties } from "react";
import { useViewState } from "@/lib/viewState";
import { money, ordinal } from "@/lib/format";
import { statusHrefs, type RosterStatus } from "@/lib/rosterLink";
import type { GroupMoney, MatchupMode } from "@/lib/matchup";
import { SEGMENT_LINK, sliceClass, Swatch, type SliceKey } from "../Availability";
import { ChartLink } from "../ChartLink";
import { Tip, TipHint, TipRow, TipTitle } from "../Tip";
import { Segmented } from "../ui/controls";

export interface MatchupRow {
  key: string;
  label: string;
  offLabel: string;
  defLabel: string;
  /** Position-group codes on each side, for links to those players. */
  offGroups: string[];
  defGroups: string[];
  off: GroupMoney;
  def: GroupMoney;
  ranks: Record<MatchupMode, { off: number; def: number }>;
}

export interface MatchupSide {
  abbr: string;
  nick: string;
  vars: CSSProperties;
}

export interface MatchupHalf {
  title: string;
  offTeam: MatchupSide;
  defTeam: MatchupSide;
  rows: MatchupRow[];
}

const SLICES: { k: SliceKey; f: keyof GroupMoney; label: string }[] = [
  { k: "active", f: "active", label: "Active" },
  { k: "questionable", f: "questionable", label: "Questionable" },
  { k: "inactive", f: "out", label: "Out this week" },
  { k: "season", f: "season", label: "Out long-term" },
  { k: "year", f: "year", label: "Out for season" },
];

/**
 * Mirrored bars: the offense's group runs left from the spine, the defense it faces
 * runs right, one shared scale for the whole game. The ratio badge sits between
 * them and points at the side with more money; it turns accent at 1.5x. Every
 * segment wears its own team's color, and the status reads from its pattern
 * (solid active, dotted questionable, striped out), so out and reserve money stay
 * visible and a reader sees what an injury took away. Each segment links to the team's roster filtered to the
 * groups and that status.
 */
export function MatchupChart({ halves }: { halves: MatchupHalf[] }) {
  const [mode, setMode] = useViewState<MatchupMode>("matchup-mode", "field", (v) => v === "field" || v === "full");
  const scale = Math.max(1, ...halves.flatMap((h) => h.rows.flatMap((r) => [r.off.total, r.def.total])));
  const v = (m: GroupMoney) => (mode === "field" ? m.field : m.total);
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink pt-2.5">
        <h2 className="display text-[24px] leading-none">Position matchups</h2>
        <Segmented<MatchupMode>
          label="Compare"
          value={mode}
          onChange={setMode}
          options={[
            { value: "field", label: "On the field", title: "Active plus questionable money" },
            { value: "full", label: "Full investment", title: "Every dollar in the group, healthy or not, practice squad aside" },
          ]}
        />
      </div>
      {halves.map((h) => (
        <section key={h.title} aria-label={h.title}>
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-line pb-2.5">
            <p className="tc display flex flex-wrap items-center justify-end gap-x-2 text-right text-[20px] leading-none sm:text-[22px]" style={h.offTeam.vars}>
              <span>
                {h.offTeam.nick} <span className="text-ink-3">offense</span>
              </span>
              <span aria-hidden className="h-4 w-1.5 rounded-[2px]" style={{ background: "var(--team)" }} />
            </p>
            <span className="display w-[3.25rem] text-center text-sm text-ink-3">vs</span>
            <p className="tc display flex flex-wrap items-center gap-x-2 text-[20px] leading-none sm:text-[22px]" style={h.defTeam.vars}>
              <span aria-hidden className="h-4 w-1.5 rounded-[2px]" style={{ background: "var(--team)" }} />
              <span>
                {h.defTeam.nick} <span className="text-ink-3">defense</span>
              </span>
            </p>
          </div>
          <div className="space-y-5">
            {h.rows.map((r) => {
              const a = v(r.off);
              const b = v(r.def);
              const hi = Math.max(a, b);
              const lo = Math.max(Math.min(a, b), 1);
              const ratio = hi / lo;
              const offWins = a >= b;
              const strong = ratio >= 1.5;
              const even = ratio < 1.05;
              const badge = even ? "Even" : `${ratio.toFixed(1)}×`;
              return (
                <div key={r.key}>
                  <p className="eyebrow mb-1.5 text-center">{r.label}</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)] items-center gap-2">
                    <Bar
                      money={r.off}
                      vars={h.offTeam.vars}
                      scale={scale}
                      dir="left"
                      title={`${h.offTeam.nick} ${r.offLabel}`}
                      hrefs={statusHrefs(h.offTeam.abbr, { groups: r.offGroups })}
                    />
                    <span
                      className={`num flex h-6 items-center justify-center gap-0.5 rounded-sm text-xs font-semibold ${
                        strong ? "bg-accent text-accent-ink" : even ? "bg-surface-2 text-ink-3" : "bg-surface-2 text-ink"
                      }`}
                      title={even ? "Within 5%" : `${offWins ? h.offTeam.nick : h.defTeam.nick} have ${badge} the money`}
                    >
                      {!even && offWins && <Caret dir="left" />}
                      {badge}
                      {!even && !offWins && <Caret dir="right" />}
                    </span>
                    <Bar
                      money={r.def}
                      vars={h.defTeam.vars}
                      scale={scale}
                      dir="right"
                      title={`${h.defTeam.nick} ${r.defLabel}`}
                      hrefs={statusHrefs(h.defTeam.abbr, { groups: r.defGroups })}
                    />
                  </div>
                  <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_3.25rem_minmax(0,1fr)] gap-2 text-xs text-ink-3">
                    <p className="num truncate text-right">
                      <span className="hidden sm:inline">{cap(r.offLabel)} · </span>
                      <span className="font-medium text-ink">{money(a)}</span> · {ordinal(r.ranks[mode].off)}
                    </p>
                    <span />
                    <p className="num truncate">
                      {ordinal(r.ranks[mode].def)} · <span className="font-medium text-ink">{money(b)}</span>
                      <span className="hidden sm:inline"> · {cap(r.defLabel)}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Caret({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
      <path d={dir === "left" ? "M6 1 2 4l4 3z" : "M2 1l4 3-4 3z"} fill="currentColor" />
    </svg>
  );
}

function Bar({
  money: m,
  vars,
  scale,
  dir,
  title,
  hrefs,
}: {
  money: GroupMoney;
  vars: CSSProperties;
  scale: number;
  dir: "left" | "right";
  title: string;
  hrefs: Record<RosterStatus, string>;
}) {
  const total = SLICES.reduce((acc, s) => acc + (m[s.f] as number), 0);
  return (
    <Tip
      className={`tc flex h-5 w-full ${dir === "left" ? "justify-end" : "justify-start"}`}
      style={vars}
      content={
        <div>
          <TipTitle>{title}</TipTitle>
          {SLICES.map((s) =>
            (m[s.f] as number) > 0 ? <TipRow key={s.k} label={s.label} value={money(m[s.f] as number)} swatch={<Swatch k={s.k} team={vars} />} /> : null,
          )}
          {total > 0 && <TipHint />}
        </div>
      }
    >
      <div
        className={`flex h-full gap-[2px] ${dir === "left" ? "bar-grow-r flex-row-reverse" : "bar-grow"}`}
        style={{ width: `${(total / scale) * 100}%` }}
      >
        {SLICES.map((s) => {
          const val = m[s.f] as number;
          if (val <= 0) return null;
          return (
            <div key={s.k} className={`${sliceClass(s.k, "team")} relative h-full min-w-[2px] rounded-[3px]`} style={{ flexGrow: val, flexBasis: 0 }}>
              <ChartLink
                href={hrefs[s.k as RosterStatus]}
                label={`${title}, ${s.label} ${money(val)}: show these players`}
                className={SEGMENT_LINK}
              />
            </div>
          );
        })}
      </div>
    </Tip>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
