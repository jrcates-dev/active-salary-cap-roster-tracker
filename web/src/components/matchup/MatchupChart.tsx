"use client";

import { useState } from "react";
import { money, ordinal } from "@/lib/format";
import type { GroupMoney, MatchupMode } from "@/lib/matchup";
import { sliceStyle, Swatch, type SliceKey } from "../Availability";
import { Tip, TipRow } from "../Tip";

export interface MatchupRow {
  key: string;
  label: string;
  offLabel: string;
  defLabel: string;
  off: GroupMoney;
  def: GroupMoney;
  ranks: Record<MatchupMode, { off: number; def: number }>;
}

export interface MatchupHalf {
  title: string;
  offTeam: { abbr: string; nick: string; color: string };
  defTeam: { abbr: string; nick: string; color: string };
  rows: MatchupRow[];
}

const SLICES: { k: SliceKey; f: keyof GroupMoney; label: string }[] = [
  { k: "active", f: "active", label: "Active" },
  { k: "questionable", f: "questionable", label: "Questionable" },
  { k: "inactive", f: "out", label: "Out this week" },
  { k: "season", f: "season", label: "Out long-term" },
];

const MODES: { m: MatchupMode; label: string; title: string }[] = [
  { m: "field", label: "On the field", title: "Active plus questionable money" },
  { m: "full", label: "Full investment", title: "Every dollar in the group, healthy or not" },
];

/**
 * Mirrored bars: the offense's group runs left from the spine, the defense it faces
 * runs right, one shared scale for the whole game. The ratio badge sits on the side
 * with more money. Out and long-term money stay visible as hatched and faint segments
 * so a reader sees what an injury took away.
 */
export function MatchupChart({ halves }: { halves: MatchupHalf[] }) {
  const [mode, setMode] = useState<MatchupMode>("field");
  const scale = Math.max(
    1,
    ...halves.flatMap((h) => h.rows.flatMap((r) => [r.off.total, r.def.total])),
  );
  const v = (m: GroupMoney) => (mode === "field" ? m.field : m.total);
  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Compare" className="inline-flex rounded-md border border-border bg-panel p-0.5">
          {MODES.map((o) => (
            <button
              key={o.m}
              type="button"
              role="radio"
              aria-checked={mode === o.m}
              title={o.title}
              onClick={() => setMode(o.m)}
              className={`rounded px-3 py-1 text-sm ${mode === o.m ? "bg-panel-raised text-fg" : "text-fg-muted hover:text-fg"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-fg-muted">
          {mode === "field"
            ? "Comparing money expected on the field: active plus questionable."
            : "Comparing everything each group costs, injured or not."}
        </p>
      </div>
      {halves.map((h) => (
        <section key={h.title}>
          <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3 border-b border-border pb-2">
            <p className="num text-right text-lg font-semibold">
              <span className="text-sm font-normal text-fg-muted">Offense · </span>
              {h.offTeam.nick}
            </p>
            <span className="text-xs text-fg-faint">vs</span>
            <p className="num text-lg font-semibold">
              {h.defTeam.nick}
              <span className="text-sm font-normal text-fg-muted"> · Defense</span>
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
              const badge = ratio >= 1.05 ? `${ratio.toFixed(1)}x` : "Even";
              return (
                <div key={r.key}>
                  <p className="mb-1 text-center text-xs tracking-wider text-fg-muted uppercase">{r.label}</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] items-center gap-2">
                    <Bar money={r.off} color={h.offTeam.color} scale={scale} dir="left" title={`${h.offTeam.nick} ${r.offLabel}`} />
                    <span
                      className={`num rounded px-1 py-0.5 text-center text-sm font-semibold ${
                        ratio >= 1.5 ? "bg-[#ff7b1c] text-[#0b0d12]" : "bg-panel-raised text-fg"
                      }`}
                      title={ratio >= 1.05 ? `${offWins ? h.offTeam.nick : h.defTeam.nick} have ${badge} the money` : "Within 5%"}
                    >
                      {ratio >= 1.05 ? (offWins ? `◀ ${badge}` : `${badge} ▶`) : badge}
                    </span>
                    <Bar money={r.def} color={h.defTeam.color} scale={scale} dir="right" title={`${h.defTeam.nick} ${r.defLabel}`} />
                  </div>
                  <div className="mt-1 grid grid-cols-[minmax(0,1fr)_3.5rem_minmax(0,1fr)] gap-2 text-xs text-fg-muted">
                    <p className="text-right">
                      <span>{cap(r.offLabel)}</span>{" "}
                      <span className="num text-base text-fg">{money(a)}</span> · {ordinal(r.ranks[mode].off)}
                    </p>
                    <span />
                    <p>
                      {ordinal(r.ranks[mode].def)} · <span className="num text-base text-fg">{money(b)}</span>{" "}
                      <span>{cap(r.defLabel)}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="text-xs text-fg-faint">
        Ranks are out of 32 teams for the same group and the same measure. The badge points at the side with more money;
        orange means at least 1.5x.
      </p>
    </div>
  );
}

function Bar({
  money: m,
  color,
  scale,
  dir,
  title,
}: {
  money: GroupMoney;
  color: string;
  scale: number;
  dir: "left" | "right";
  title: string;
}) {
  const total = SLICES.reduce((acc, s) => acc + (m[s.f] as number), 0);
  return (
    <Tip
      className={`flex h-6 w-full ${dir === "left" ? "justify-end" : "justify-start"}`}
      content={
        <div className="space-y-1">
          <div className="mb-1 font-semibold">{title}</div>
          {SLICES.map((s) =>
            (m[s.f] as number) > 0 ? (
              <TipRow key={s.k} label={s.label} value={money(m[s.f] as number)} swatch={<Swatch k={s.k} color={color} />} />
            ) : null,
          )}
        </div>
      }
    >
      <div
        className={`flex h-full gap-[2px] ${dir === "left" ? "flex-row-reverse" : ""}`}
        style={{ width: `${(total / scale) * 100}%` }}
      >
        {SLICES.map((s) => {
          const val = m[s.f] as number;
          if (val <= 0) return null;
          return (
            <div
              key={s.k}
              className="h-full min-w-[2px] rounded-[3px]"
              style={{ flexGrow: val, flexBasis: 0, ...sliceStyle(s.k, color) }}
            />
          );
        })}
      </div>
    </Tip>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
