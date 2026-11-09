"use client";

import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";
import { textOn } from "@/design/tokens";
import { FLAG_LABEL, money, pct, reasonLabel } from "@/lib/format";
import type { Group, Player } from "@/lib/types";
import { sliceStyle, Swatch, type SliceKey } from "../Availability";
import { Tip, TipRow } from "../Tip";

type Node = { name: string; code?: string; player?: Player; children?: Node[] };

const HEADER = 20;

/**
 * Every counted player sized by cap number, nested in position groups and filled
 * by availability. Click a group to zoom in; the breadcrumb zooms back out.
 */
export function Treemap({
  color,
  groups,
  players,
  teamTotal,
}: {
  color: string;
  groups: Group[];
  players: Player[];
  teamTotal: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = width < 640 ? 420 : 520;

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
      <nav aria-label="Treemap level" className="mb-3 flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setFocus(null)}
          className={focus ? "text-fg-muted underline-offset-4 hover:text-fg hover:underline" : "text-fg"}
        >
          All groups
        </button>
        {focusGroup && (
          <>
            <span className="text-fg-faint">/</span>
            <span className="text-fg">{focusGroup.label}</span>
          </>
        )}
        <span className="ml-auto text-xs text-fg-faint">
          {focus ? "Click the breadcrumb to zoom out" : "Click a group to zoom in"}
        </span>
      </nav>
      <div ref={ref} className="relative w-full" style={{ height }}>
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
            color={color}
            teamTotal={teamTotal}
            onClick={() => setFocus(focus ? null : (l.data.player!.group ?? null))}
          />
        ))}
      </div>
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
      className="absolute flex items-center gap-2 overflow-hidden px-1 text-left text-xs whitespace-nowrap text-fg-muted hover:text-fg"
      style={{ left: node.x0, top: node.y0, width: w, height: HEADER - 2 }}
    >
      <span className="num text-sm font-semibold text-fg">{node.data.code}</span>
      {w > 90 && <span className="num">{money(v)}</span>}
      {w > 150 && <span>{pct(v / teamTotal)}</span>}
    </button>
  );
}

function Leaf({
  node,
  color,
  teamTotal,
  onClick,
}: {
  node: HierarchyRectangularNode<Node>;
  color: string;
  teamTotal: number;
  onClick: () => void;
}) {
  const p = node.data.player!;
  const w = node.x1 - node.x0;
  const h = node.y1 - node.y0;
  const k = p.flag as SliceKey;
  const ink = k === "active" ? textOn(color) : "#f3f4f6";
  const status = reasonLabel(p.reason) ?? p.report_status ?? FLAG_LABEL[p.flag];
  return (
    <Tip
      className="absolute cursor-pointer overflow-hidden rounded-[3px]"
      style={{ left: node.x0, top: node.y0, width: w, height: h, ...sliceStyle(k, color) }}
      content={
        <div className="space-y-1">
          <div className="font-semibold">
            {p.name} <span className="text-fg-muted">{p.pos}</span>
          </div>
          <TipRow label="Cap number" value={money(p.cap)} />
          <TipRow label="Share of team" value={pct(p.cap / teamTotal)} />
          <TipRow label={status} value="" swatch={<Swatch k={k} color={color} />} />
          {p.injury && <TipRow label="Injury" value={p.injury} />}
          {p.source !== "contract" && (
            <div className="pt-1 text-xs text-fg-muted">
              {p.source === "derived_rookie_scale"
                ? "Cap number estimated from the rookie wage scale"
                : "Cap number estimated at the league minimum"}
            </div>
          )}
        </div>
      }
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={`${p.name}, ${money(p.cap)}, ${status}`}
        className="block h-full w-full p-1.5 text-left"
        style={{ color: ink }}
      >
        {w > 64 && h > 30 && (
          <>
            <span className="block truncate text-xs leading-tight font-semibold">{p.name}</span>
            {h > 44 && <span className="num block text-sm leading-tight">{money(p.cap)}</span>}
          </>
        )}
      </button>
    </Tip>
  );
}
