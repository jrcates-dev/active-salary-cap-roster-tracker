"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { money, pct } from "@/lib/format";
import { SLICE_LABEL, SLICE_ORDER, type SliceKey, type Slices } from "@/lib/availability";
import { Tip, TipRow, TipTitle } from "./Tip";

export { playerSlice, SLICE_LABEL, SLICE_SHORT, slicesOf, type SliceKey, type Slices } from "@/lib/availability";

/** The CSS class that paints one availability state in the enclosing team color. */
export const sliceClass = (k: SliceKey) => `s-${k}`;

export function Swatch({ k, size = 12, className = "" }: { k: SliceKey; size?: number; className?: string }) {
  return <span aria-hidden className={`sw ${sliceClass(k)} ${className}`} style={{ width: size, height: size }} />;
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
 * It reads the team color from an enclosing `.tc` element. `scale` sets the full
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
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const total = SLICE_ORDER.reduce((acc, k) => acc + (slices[k] ?? 0), 0);
  const full = Math.max(scale ?? total, total, 1);
  const radius = height >= 20 ? 4 : 3;
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <div
        className={`flex h-full gap-[2px] ${animate ? "bar-grow" : ""}`}
        style={{ width: `${(total / full) * 100}%` }}
        role="img"
        aria-label={SLICE_ORDER.filter((k) => (slices[k] ?? 0) > 0)
          .map((k) => `${SLICE_LABEL[k]} ${money(slices[k] ?? 0)}`)
          .join(", ")}
      >
        {SLICE_ORDER.map((k) => {
          const v = slices[k] ?? 0;
          if (v <= 0) return null;
          const px = width * (v / full);
          const share = pct(v / total, 0);
          return (
            <Tip
              key={k}
              className={`${sliceClass(k)} relative h-full min-w-[2px] overflow-hidden transition-opacity duration-(--dur-2)`}
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
                  <TipRow label={SLICE_LABEL[k]} value={`${money(v)} · ${pct(v / total)}`} swatch={<Swatch k={k} />} />
                </div>
              }
            >
              {labels && px >= 40 && (
                <span className="pointer-events-none absolute inset-y-0 left-1.5 flex items-center">
                  <span
                    className={`num rounded-[3px] text-xs font-medium ${k === "active" ? "" : "bg-surface/85 px-1"}`}
                    style={{ color: k === "active" ? "var(--team-ink)" : "var(--ink)" }}
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

export function AvailabilityLegend({
  keys = ["active", "questionable", "inactive", "season", "year", "unknown"],
  extra,
  short = false,
}: {
  keys?: SliceKey[];
  extra?: ReactNode;
  short?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-2">
      {keys.map((k) => (
        <span key={k} className="flex items-center gap-1.5 whitespace-nowrap">
          <Swatch k={k} />
          {short ? SHORT[k] : SLICE_LABEL[k]}
        </span>
      ))}
      {extra}
    </div>
  );
}

const SHORT: Record<SliceKey, string> = {
  active: "Active",
  questionable: "Questionable",
  inactive: "Out this week",
  season: "Out long-term",
  year: "Out for season",
  unknown: "Practice squad",
  dead: "Dead money",
};
