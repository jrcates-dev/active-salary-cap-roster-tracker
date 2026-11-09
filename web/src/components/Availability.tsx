"use client";

import type { CSSProperties, ReactNode } from "react";
import { deadMoney, hatch } from "@/design/tokens";
import { money, pct } from "@/lib/format";
import { Tip, TipRow } from "./Tip";

export type SliceKey = "active" | "questionable" | "inactive" | "unknown" | "dead";

export interface Slices {
  active: number;
  questionable: number;
  inactive: number;
  unknown?: number;
  dead?: number;
}

export const SLICE_LABEL: Record<SliceKey, string> = {
  active: "Active",
  questionable: "Questionable",
  inactive: "Inactive",
  unknown: "Practice squad / other",
  dead: "Dead money",
};

/** Fill style for one availability state in a team's color. */
export function sliceStyle(key: SliceKey, color: string): CSSProperties {
  switch (key) {
    case "active":
      return { background: color };
    case "questionable":
      return {
        background: `${color}73`,
        outline: `1.5px dashed ${color}`,
        outlineOffset: "-1.5px",
      };
    case "inactive":
      return { background: hatch(color) };
    case "unknown":
      return { background: `${color}2e` };
    case "dead":
      return { background: deadMoney };
  }
}

export function Swatch({ k, color, size = 12 }: { k: SliceKey; color: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-[3px]"
      style={{ width: size, height: size, ...sliceStyle(k, color) }}
    />
  );
}

/**
 * The stacked availability bar used at every level: league row, team header,
 * position group. Segments are separated by a 2px gap. `scale` sets the bar's
 * full width in dollars so bars in a list share one axis.
 */
export function AvailabilityBar({
  color,
  slices,
  scale,
  height = 22,
  title,
  marker,
  markerLabel,
}: {
  color: string;
  slices: Slices;
  scale?: number;
  height?: number;
  title?: ReactNode;
  marker?: number;
  markerLabel?: string;
}) {
  const order: SliceKey[] = ["active", "questionable", "inactive", "unknown", "dead"];
  const total = order.reduce((acc, k) => acc + (slices[k] ?? 0), 0);
  const full = Math.max(scale ?? total, total, 1);
  return (
    <div className="relative w-full" style={{ height }}>
      <div className="flex h-full gap-[2px]" style={{ width: `${(total / full) * 100}%` }}>
        {order.map((k) => {
          const v = slices[k] ?? 0;
          if (v <= 0) return null;
          return (
            <Tip
              key={k}
              className="h-full min-w-[2px] rounded-[3px]"
              style={{ flexGrow: v, flexBasis: 0, ...sliceStyle(k, color) }}
              content={
                <div className="space-y-1">
                  {title && <div className="mb-1 font-semibold">{title}</div>}
                  <TipRow
                    label={SLICE_LABEL[k]}
                    value={`${money(v)} · ${pct(v / total)}`}
                    swatch={<Swatch k={k} color={color} />}
                  />
                </div>
              }
            />
          );
        })}
      </div>
      {marker !== undefined && marker > 0 && (
        <Tip
          className="absolute -top-1 -bottom-1 w-[6px] -translate-x-1/2 cursor-default"
          style={{ left: `${(marker / full) * 100}%` }}
          content={markerLabel ?? `League median ${money(marker)}`}
        >
          <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 rounded bg-fg" />
        </Tip>
      )}
    </div>
  );
}

export function AvailabilityLegend({
  color,
  keys = ["active", "questionable", "inactive", "unknown"],
  extra,
}: {
  color: string;
  keys?: SliceKey[];
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-fg-muted">
      {keys.map((k) => (
        <span key={k} className="flex items-center gap-2">
          <Swatch k={k} color={color} />
          {SLICE_LABEL[k]}
        </span>
      ))}
      {extra}
    </div>
  );
}
