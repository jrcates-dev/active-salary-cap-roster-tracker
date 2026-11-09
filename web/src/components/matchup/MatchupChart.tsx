"use client";

import { useState, type CSSProperties } from "react";
import { money, ordinal } from "@/lib/format";
import type { GroupMoney, MatchupMode } from "@/lib/matchup";
import { sliceClass, Swatch, type SliceKey } from "../Availability";
import { Tip, TipRow, TipTitle } from "../Tip";
import { Segmented } from "../ui/controls";

export interface MatchupRow {
  key: string;
  label: string;
  offLabel: string;
  defLabel: string;
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
 * them and points at the side with more money; it turns accent at 1.5x. Out and
 * reserve money stay visible as patterned segments so a reader sees what an
 * injury took away.
 */
export function MatchupChart({ halves }: { halves: MatchupHalf[] }) {
  const [mode, setMode] = useState<MatchupMode>("field");
  const scale = Math.max(1, ...halves.flatMap((h) => h.rows.flatMap((r) => [r.off.total, r.def.total])));
  const v = (m: GroupMoney) => (mode === "field" ? m.field : m.total);
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Position matchups</h2>
        <Segmented<MatchupMode>
          label="Compare"
          value={mode}
          onChange={setMode}
          options={[
            { value: "field", label: "On the field", title: "Active plus questionable money" },
            { value: "full", label: "Full investment", title: "Every dollar in the group, healthy or not" },
          ]}
        />
      </div>
      {halves.map((h) => (
        <section key={h.title} aria-label={h.title}>
          <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-line pb-2">
            <p className="tc flex items-center justify-end gap-2 text-right text-[15px] font-semibold" style={h.offTeam.vars}>
              <span className="text-xs font-normal text-ink-3">Offense</span>
              {h.offTeam.nick}
              <span aria-hidden className="h-3 w-3 rounded-[3px]" style={{ background: "var(--team)" }} />
            </p>
            <span className="text-xs text-ink-3">vs</span>
            <p className="tc flex items-center gap-2 text-[15px] font-semibold" style={h.defTeam.vars}>
              <span aria-hidden className="h-3 w-3 rounded-[3px]" style={{ background: "var(--team)" }} />
              {h.defTeam.nick}
              <span className="text-xs font-normal text-ink-3">Defense</span>
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
                    <Bar money={r.off} vars={h.offTeam.vars} scale={scale} dir="left" title={`${h.offTeam.nick} ${r.offLabel}`} />
                    <span
                      className={`num flex h-6 items-center justify-center gap-0.5 rounded-md text-xs font-semibold ${
                        strong ? "bg-accent text-accent-ink" : even ? "bg-surface-2 text-ink-3" : "bg-surface-2 text-ink"
                      }`}
                      title={even ? "Within 5%" : `${offWins ? h.offTeam.nick : h.defTeam.nick} have ${badge} the money`}
                    >
                      {!even && offWins && <Caret dir="left" />}
                      {badge}
                      {!even && !offWins && <Caret dir="right" />}
                    </span>
                    <Bar money={r.def} vars={h.defTeam.vars} scale={scale} dir="right" title={`${h.defTeam.nick} ${r.defLabel}`} />
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
}: {
  money: GroupMoney;
  vars: CSSProperties;
  scale: number;
  dir: "left" | "right";
  title: string;
}) {
  const total = SLICES.reduce((acc, s) => acc + (m[s.f] as number), 0);
  return (
    <Tip
      className={`tc flex h-4 w-full ${dir === "left" ? "justify-end" : "justify-start"}`}
      style={vars}
      content={
        <div>
          <TipTitle>{title}</TipTitle>
          {SLICES.map((s) =>
            (m[s.f] as number) > 0 ? <TipRow key={s.k} label={s.label} value={money(m[s.f] as number)} swatch={<Swatch k={s.k} />} /> : null,
          )}
        </div>
      }
    >
      <div
        className={`flex h-full gap-[2px] ${dir === "left" ? "grow-r flex-row-reverse" : "grow"}`}
        style={{ width: `${(total / scale) * 100}%` }}
      >
        {SLICES.map((s) => {
          const val = m[s.f] as number;
          if (val <= 0) return null;
          return <div key={s.k} className={`${sliceClass(s.k)} h-full min-w-[2px] rounded-[3px]`} style={{ flexGrow: val, flexBasis: 0 }} />;
        })}
      </div>
    </Tip>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
