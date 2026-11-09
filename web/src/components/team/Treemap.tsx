"use client";

import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";
import { money, pct } from "@/lib/format";
import type { Group, Player } from "@/lib/types";
import { playerSlice, sliceClass, Swatch } from "../Availability";
import { Tip, TipRow, TipTitle } from "../Tip";
import { statusText } from "@/lib/availability";

type Node = { name: string; code?: string; player?: Player; children?: Node[] };

const HEADER = 26;
/** Tiles narrower or shorter than this are not controls: they keep the hover tip and the list below carries them. */
const MIN_TARGET = 24;
/** Smallest type a tile label may shrink to before the tile goes unlabeled. */
const MIN_TYPE = 10;
const LINE = 1.12;

/** Width of a string in the display font at a size, in px. */
type Measure = (text: string, size: number, weight: number) => number;

/**
 * Every counted player sized by cap number, nested in position groups and filled
 * by availability. Click a group to zoom in; the breadcrumb zooms back out. Zoomed
 * in, a tap on a player shows his details and the group's players are listed below,
 * so the view works on a phone where the small tiles have no room for names.
 * It takes the full page width, and each tile's label is fitted to it: the
 * biggest name that fits, shortened to "C. Davis" or "Davis" when needed, with
 * the cap number, share and status underneath while there is room.
 */
export function Treemap({ groups, players, teamTotal }: { groups: Group[]; players: Player[]; teamTotal: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const fontRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const measure = useDisplayMeasure(fontRef);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Taller than wide on a phone, and growing with the column on wider screens, so
  // more of the contracts get a tile big enough to carry a name.
  const height = width < 640 ? 560 : Math.round(Math.min(780, Math.max(560, width * 0.58)));

  const layout = useMemo(() => {
    if (width === 0) return null;
    const visible = groups.filter((g) => !focus || g.code === focus);
    const data: Node = {
      name: "root",
      children: visible
        .map((g) => ({
          name: g.label,
          code: g.code,
          children: players
            .filter((p) => p.group === g.code && p.cap > 0)
            .map((p) => ({ name: p.name, player: p })),
        }))
        .filter((g) => g.children.length > 0),
    };
    const root = hierarchy<Node>(data)
      .sum((d) => d.player?.cap ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    return treemap<Node>()
      .tile(treemapSquarify.ratio(1.3))
      .size([width, height])
      .paddingOuter(0)
      .paddingInner(2)
      .paddingTop((n) => (n.depth === 1 ? HEADER : 0))
      .round(true)(root);
  }, [width, height, groups, players, focus]);

  const groupNodes = layout?.children ?? [];
  const leaves = layout?.leaves().filter((l) => l.data.player) ?? [];
  const focusGroup = groups.find((g) => g.code === focus);

  return (
    <div>
      <nav aria-label="Treemap level" className="mb-3 flex items-center gap-1.5 text-[13px]">
        <button
          type="button"
          onClick={() => setFocus(null)}
          className={`rounded-md px-2 py-1 transition-colors duration-(--dur-1) ${
            focus ? "text-ink-2 hover:bg-surface-2 hover:text-ink" : "bg-surface-2 font-medium text-ink"
          }`}
        >
          All groups
        </button>
        {focusGroup && (
          <>
            <span className="text-ink-3">/</span>
            <span className="rounded-md bg-surface-2 px-2 py-1 font-medium text-ink">{focusGroup.label}</span>
          </>
        )}
        <span className="ml-auto text-xs text-ink-3">{focus ? "Tap a player" : "Tap a group to zoom"}</span>
      </nav>
      <span ref={fontRef} className="fig" hidden />
      <div ref={ref} className="relative w-full overflow-hidden rounded-lg" style={{ height }}>
        {groupNodes.map((g) => (
          <GroupHeader
            key={g.data.code}
            node={g}
            teamTotal={teamTotal}
            zoomed={!!focus}
            onClick={() => setFocus(focus ? null : (g.data.code ?? null))}
          />
        ))}
        {leaves.map((l) => (
          <Leaf
            key={l.data.player!.key}
            node={l}
            teamTotal={teamTotal}
            measure={measure}
            onClick={focus ? undefined : () => setFocus(l.data.player!.group ?? null)}
          />
        ))}
      </div>
      {focusGroup && (
        <ol className="card mt-3 divide-y divide-line text-sm">
          {players
            .filter((p) => p.group === focusGroup.code)
            .sort((a, b) => b.cap - a.cap)
            .map((p) => (
              <li key={p.key} className="flex items-center gap-3 px-3 py-1.5">
                <Swatch k={playerSlice(p)} />
                <span className="min-w-0 flex-1 truncate">
                  {p.name}
                  <span className="ml-2 text-ink-3">{statusText(p)}</span>
                </span>
                <span className="num font-medium">{money(p.cap)}</span>
              </li>
            ))}
        </ol>
      )}
    </div>
  );
}

function GroupHeader({
  node,
  teamTotal,
  zoomed,
  onClick,
}: {
  node: HierarchyRectangularNode<Node>;
  teamTotal: number;
  zoomed: boolean;
  onClick: () => void;
}) {
  const w = node.x1 - node.x0;
  const v = node.value ?? 0;
  return (
    <button
      type="button"
      onClick={onClick}
      title={zoomed ? "Zoom out" : `Zoom into ${node.data.name}`}
      className="absolute flex items-center gap-2 overflow-hidden px-1.5 text-left text-[11px] whitespace-nowrap text-ink-3 transition-colors duration-(--dur-1) hover:text-ink"
      style={{ left: node.x0, top: node.y0, width: w, height: HEADER - 2 }}
    >
      <span className="num text-xs font-semibold text-ink">{node.data.code}</span>
      {w > 90 && <span className="num">{money(v)}</span>}
      {w > 150 && <span className="num">{pct(v / teamTotal)}</span>}
    </button>
  );
}

function Leaf({
  node,
  teamTotal,
  measure,
  onClick,
}: {
  node: HierarchyRectangularNode<Node>;
  teamTotal: number;
  measure: Measure | null;
  onClick?: () => void;
}) {
  const p = node.data.player!;
  const w = node.x1 - node.x0;
  const h = node.y1 - node.y0;
  const k = playerSlice(p);
  const ink = "var(--s-ink)";
  const status = statusText(p);
  const label = measure ? fitLabel(p, w, h, k !== "active" ? status : null, teamTotal, measure) : null;
  const control = w >= MIN_TARGET && h >= MIN_TARGET;
  const Tag = control ? "button" : "div";
  return (
    <Tip
      className={`${sliceClass(k)} absolute overflow-hidden rounded-[4px] transition-[filter] duration-(--dur-1) hover:brightness-110 ${control ? "cursor-pointer" : ""}`}
      style={{ left: node.x0, top: node.y0, width: w, height: h }}
      content={
        <div>
          <TipTitle>
            {p.name} <span className="font-normal text-ink-3">{p.pos}</span>
          </TipTitle>
          <TipRow label="Cap" value={money(p.cap)} />
          <TipRow label="Share of team" value={pct(p.cap / teamTotal)} />
          <TipRow label={status} value="" swatch={<Swatch k={k} />} />
          {(p.outlook_note ?? p.injury) && <TipRow label="Injury" value={p.outlook_note ?? p.injury} />}
          {p.source !== "contract" && (
            <div className="pt-1 text-xs text-ink-3">
              {p.source === "derived_rookie_scale"
                ? "Cap number estimated from the rookie wage scale"
                : "Cap number estimated at the league minimum"}
            </div>
          )}
        </div>
      }
    >
      <Tag
        {...(control ? { type: "button" as const, onClick, "aria-label": label ? undefined : `${p.name}, ${money(p.cap)}, ${status}` } : {})}
        className="fig block h-full w-full overflow-hidden text-left"
        style={{ color: ink, padding: label?.pad ?? 0 }}
      >
        {label && (
          <>
            {label.name.map((line) => (
              <span
                key={line}
                className="block font-semibold tracking-tight whitespace-nowrap"
                style={{ fontSize: label.size, lineHeight: LINE }}
              >
                {line}
              </span>
            ))}
            {label.cap && (
              <span
                className="num block font-medium whitespace-nowrap opacity-90"
                style={{ fontSize: label.capSize, lineHeight: LINE }}
              >
                {label.cap}
              </span>
            )}
            {label.status && (
              <span
                className="block font-normal whitespace-nowrap opacity-80"
                style={{ fontSize: label.statusSize, lineHeight: LINE }}
              >
                {label.status}
              </span>
            )}
          </>
        )}
      </Tag>
    </Tip>
  );
}

/**
 * Measures text in the site font on a canvas. The family is read from a hidden
 * `.fig` element so it follows the stylesheet, and the cache is dropped once web
 * fonts finish loading so fallback-font widths never stick.
 */
function useDisplayMeasure(fontRef: React.RefObject<HTMLSpanElement | null>): Measure | null {
  const [font, setFont] = useState<{ family: string; version: number } | null>(null);

  useEffect(() => {
    const el = fontRef.current;
    if (!el) return;
    let live = true;
    const read = () => {
      if (live) setFont((f) => ({ family: getComputedStyle(el).fontFamily, version: (f?.version ?? 0) + 1 }));
    };
    read();
    document.fonts?.ready.then(read);
    return () => {
      live = false;
    };
  }, [fontRef]);

  return useMemo(() => {
    if (!font) return null;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return null;
    const cache = new Map<string, number>();
    return (text: string, size: number, weight: number) => {
      const key = `${weight}|${size}|${text}`;
      let v = cache.get(key);
      if (v === undefined) {
        ctx.font = `${weight} ${size}px ${font.family}`;
        v = ctx.measureText(text).width;
        cache.set(key, v);
      }
      return v;
    };
  }, [font]);
}

const SUFFIX = /^(jr\.?|sr\.?|ii|iii|iv|v)$/i;

/**
 * Ways to write a name, most complete first, each as one or two lines:
 * "Carlton Davis III", "Carlton / Davis III", "C. Davis III", "C. Davis", "Davis".
 */
function nameVariants(name: string): string[][] {
  const parts = name.trim().split(/\s+/);
  let core = parts;
  let suffix = "";
  if (parts.length > 2 && SUFFIX.test(parts[parts.length - 1])) {
    suffix = parts[parts.length - 1];
    core = parts.slice(0, -1);
  }
  if (core.length < 2) return [[name]];
  const first = core[0];
  const last = core.slice(1).join(" ");
  const lastFull = suffix ? `${last} ${suffix}` : last;
  const initial = first.includes(".") ? first : `${first[0]}.`;
  const out = [[name], [first, lastFull], [`${initial} ${lastFull}`], [`${initial} ${last}`], [last]];
  const seen = new Set<string>();
  return out.filter((v) => {
    const k = v.join("|");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

type Label = {
  pad: number;
  name: string[];
  size: number;
  cap: string | null;
  capSize: number;
  status: string | null;
  statusSize: number;
};

/**
 * Picks the largest readable label a tile can hold. Each way of writing the name is
 * tried at every size from the tile's ideal down to MIN_TYPE; shorter forms pay a
 * small penalty so a full name wins unless an abbreviation is clearly bigger. The
 * cap number, share of team and (for anyone not active) status follow underneath
 * while there is room.
 */
function fitLabel(
  p: Player,
  w: number,
  h: number,
  status: string | null,
  teamTotal: number,
  measure: Measure,
): Label | null {
  const pad = w >= 72 && h >= 48 ? 6 : 3;
  const aw = w - pad * 2;
  const ah = h - pad * 2;
  if (aw < 18 || ah < MIN_TYPE * LINE) return null;
  const ideal = Math.max(MIN_TYPE, Math.min(24, Math.round(Math.sqrt(w * h) / 6.5)));

  let best: { name: string[]; size: number; score: number } | null = null;
  for (const [i, lines] of nameVariants(p.name).entries()) {
    for (let size = ideal; size >= MIN_TYPE; size--) {
      if (lines.length * size * LINE > ah) continue;
      if (lines.some((l) => measure(l, size, 600) > aw)) continue;
      const score = size - i * 1.5;
      if (!best || score > best.score) best = { name: lines, size, score };
      break;
    }
  }
  if (!best) return null;
  const { name, size } = best;

  let left = ah - name.length * size * LINE;
  const label: Label = { pad, name, size, cap: null, capSize: 0, status: null, statusSize: 0 };

  const capSize = Math.max(MIN_TYPE, Math.round(size * 0.85));
  if (left >= capSize * LINE) {
    const withShare = `${money(p.cap)} · ${pct(p.cap / teamTotal)}`;
    const cap = size >= 15 && measure(withShare, capSize, 400) <= aw ? withShare : money(p.cap);
    if (measure(cap, capSize, 400) <= aw) {
      label.cap = cap;
      label.capSize = capSize;
      left -= capSize * LINE;
    }
  }

  const statusSize = Math.max(MIN_TYPE, Math.round(size * 0.7));
  if (status && label.cap && left >= statusSize * LINE && measure(status, statusSize, 400) <= aw) {
    label.status = status;
    label.statusSize = statusSize;
  }
  return label;
}
