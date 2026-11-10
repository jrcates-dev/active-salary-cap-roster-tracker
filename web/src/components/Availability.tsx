"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { money, pct } from "@/lib/format";
import { reserveLine, SLICE_LABEL, SLICE_ORDER, SLICE_SHORT, type SliceKey, type Slices } from "@/lib/availability";
import { ChartLink } from "./ChartLink";
import { Tip, TipHint, TipRow, TipTitle } from "./Tip";

export { playerSlice, SLICE_LABEL, SLICE_SHORT, slicesOf, type SliceKey, type Slices } from "@/lib/availability";

/**
 * How a chart paints availability. `status` (every page but the matchup) gives each
 * state its own money status hue. `team` (the matchup page, where two teams share a
 * chart) paints every state in the team's own color and tells them apart by
 * pattern: solid, dots, stripes, hollow (globals.css, `.t-*`).
 */
export type Palette = "status" | "team";

/** States with a team-color pattern; practice squad and dead money stay neutral. */
const TEAM_PATTERNED = new Set<SliceKey>(["active", "questionable", "inactive", "year"]);

/** The CSS class that paints one availability state in the given palette. */
export const sliceClass = (k: SliceKey, palette: Palette = "status") =>
  palette === "team" && TEAM_PATTERNED.has(k) ? `t-${k}` : `s-${k}`;

/** States drawn with a texture; a share printed on them sits on a solid chip of the hue. */
const TEXTURED = new Set<SliceKey>(["inactive", "year", "unknown"]);
const TEXTURED_TEAM = new Set<SliceKey>(["questionable", "inactive", "year", "unknown"]);

/**
 * The small key of one state. `team` paints it in that team's pattern (pass the
 * team's `teamVars()`; a swatch in a tooltip sits outside the team's element).
 * `palette="team"` with no `team` draws the pattern in ink, for a legend that
 * covers two teams.
 */
export function Swatch({
  k,
  size = 12,
  width,
  className = "",
  palette,
  team,
}: {
  k: SliceKey;
  size?: number;
  /** Wider than tall, so a pattern shows more of itself. Defaults to `size`. */
  width?: number;
  className?: string;
  palette?: Palette;
  team?: CSSProperties;
}) {
  const p = palette ?? (team ? "team" : "status");
  return (
    <span
      aria-hidden
      className={`sw ${team ? "tc" : ""} ${sliceClass(k, p)} ${className}`}
      style={{ ...team, width: width ?? size, height: size }}
    />
  );
}

/** Width of an element, updated as it resizes; 0 until mounted. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/**
 * The segmented availability bar used at every level. Thin (8 to 12px) beside a
 * row's figures, tall (28px) with its shares printed inside when it stands alone.
 * Each state wears its money status hue (globals.css, `.s-*`), or with `team` the
 * team's color in a pattern per state (`.t-*`). `scale` sets the full
 * width in dollars so bars in a list share one axis; `marker` draws a tick.
 */
export function AvailabilityBar({
  slices,
  scale,
  height = 10,
  title,
  marker,
  markerLabel,
  emphasis,
  labels = false,
  animate = true,
  hrefs,
  subject,
  team,
}: {
  slices: Slices;
  scale?: number;
  height?: number;
  title?: ReactNode;
  marker?: number;
  markerLabel?: string;
  /** When set, every other slice is drawn faded so this one reads first. */
  emphasis?: SliceKey;
  /** Print each share inside its block where it fits (the tall bar). */
  labels?: boolean;
  animate?: boolean;
  /** Where each slice leads (its players in a roster). A slice left out leads nowhere. */
  hrefs?: Partial<Record<SliceKey, string>>;
  /** Who the bar is about, for screen readers: "Seattle Seahawks". Goes with `hrefs`. */
  subject?: string;
  /** The team's `teamVars()`: paint the bar in its color with a pattern per state (matchup page). */
  team?: CSSProperties;
}) {
  const palette: Palette = team ? "team" : "status";
  const textured = team ? TEXTURED_TEAM : TEXTURED;
  const [ref, width] = useWidth<HTMLDivElement>();
  const total = SLICE_ORDER.reduce((acc, k) => acc + (slices[k] ?? 0), 0);
  const full = Math.max(scale ?? total, total, 1);
  const radius = height >= 20 ? 4 : 3;
  return (
    <div ref={ref} className={`relative w-full ${team ? "tc" : ""}`} style={{ ...team, height }}>
      <div
        className={`flex h-full gap-[2px] ${animate ? "bar-grow" : ""}`}
        style={{ width: `${(total / full) * 100}%` }}
        role={hrefs ? "group" : "img"}
        aria-label={
          hrefs
            ? subject
            : SLICE_ORDER.filter((k) => (slices[k] ?? 0) > 0)
                .map((k) => `${SLICE_LABEL[k]} ${money(slices[k] ?? 0)}`)
                .join(", ")
        }
      >
        {SLICE_ORDER.map((k) => {
          const v = slices[k] ?? 0;
          if (v <= 0) return null;
          const px = width * (v / full);
          const share = pct(v / total, 0);
          const href = hrefs?.[k] ?? null;
          const detail = k === "inactive" ? reserveLine(v, slices.reserve ?? 0) : null;
          return (
            <Tip
              key={k}
              className={`${sliceClass(k, palette)} relative h-full min-w-[2px] overflow-hidden transition-opacity duration-(--dur-2)`}
              style={{
                flexGrow: v,
                flexBasis: 0,
                borderRadius: radius,
                ...(emphasis === k ? { boxShadow: "inset 0 0 0 2px var(--ink)" } : {}),
                opacity: emphasis && emphasis !== k ? 0.3 : undefined,
              }}
              content={
                <div>
                  {title && <TipTitle>{title}</TipTitle>}
                  <TipRow label={SLICE_LABEL[k]} value={`${money(v)} · ${pct(v / total)}`} swatch={<Swatch k={k} team={team} />} />
                  {detail && <p className="mt-0.5 text-ink-3">{detail}</p>}
                  {href && <TipHint>{k === "dead" ? "see these charges" : undefined}</TipHint>}
                </div>
              }
            >
              {href && (
                <ChartLink
                  href={href}
                  label={`${subject ? `${subject}, ` : ""}${SLICE_LABEL[k]} ${money(v)}: show these ${k === "dead" ? "charges" : "players"}`}
                  className={SEGMENT_LINK}
                />
              )}
              {labels && px >= 40 && (
                <span className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center">
                  <span
                    className={`num rounded-[3px] text-xs font-semibold ${textured.has(k) ? "px-1" : ""}`}
                    style={{ color: "var(--s-ink)", background: textured.has(k) ? "var(--s)" : undefined }}
                  >
                    {share}
                  </span>
                </span>
              )}
            </Tip>
          );
        })}
      </div>
      {marker !== undefined && marker > 0 && (
        <Tip
          className="absolute -inset-y-1 w-2 -translate-x-1/2 cursor-default"
          style={{ left: `${(marker / full) * 100}%` }}
          content={markerLabel ?? `League median ${money(marker)}`}
        >
          <span
            className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-ink"
            style={{ boxShadow: "0 0 0 2px var(--surface)" }}
          />
        </Tip>
      )}
    </div>
  );
}

/** A link laid over a whole chart segment, ringed on hover and focus so it reads as clickable. */
export const SEGMENT_LINK =
  "absolute inset-0 rounded-[inherit] transition-[box-shadow,background-color] duration-(--dur-1) hover:bg-surface/25 hover:shadow-[inset_0_0_0_2px_var(--ink)] focus-visible:shadow-[inset_0_0_0_2px_var(--ink)]";

export function AvailabilityLegend({
  keys = ["active", "questionable", "inactive", "year", "unknown"],
  extra,
  short = false,
  palette = "status",
}: {
  keys?: SliceKey[];
  extra?: ReactNode;
  short?: boolean;
  /** `team`: key each state by its pattern, drawn in ink, for bars in team colors. */
  palette?: Palette;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
      {keys.map((k) => (
        <span key={k} className="flex items-center gap-1.5 whitespace-nowrap">
          {palette === "team" ? <Swatch k={k} palette="team" size={12} width={22} /> : <Swatch k={k} />}
          {short ? SLICE_SHORT[k] : SLICE_LABEL[k]}
        </span>
      ))}
      {extra}
    </div>
  );
}

