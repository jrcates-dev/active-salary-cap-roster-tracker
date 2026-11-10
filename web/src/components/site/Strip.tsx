"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";

export interface StripItem {
  key: string;
  href: string;
  label: string;
  title?: string;
  vars?: CSSProperties;
  current?: boolean;
}

/**
 * A scrolling row of links for stepping sideways: every team on a team page, every
 * game of the week on a matchup page. The current item is filled in its team color
 * and scrolled into view; the arrows at the ends go to its neighbours.
 */
export function Strip({ items, label }: { items: StripItem[]; label: string }) {
  const ref = useRef<HTMLUListElement>(null);
  const idx = items.findIndex((i) => i.current);

  useEffect(() => {
    const list = ref.current;
    const el = list?.querySelector<HTMLElement>("[aria-current]");
    if (!list || !el) return;
    list.scrollLeft = el.offsetLeft - list.clientWidth / 2 + el.offsetWidth / 2;
  }, [idx]);

  const prev = idx > 0 ? items[idx - 1] : null;
  const next = idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null;

  return (
    <nav aria-label={label} className="flex items-center gap-1">
      <Arrow item={prev} dir="prev" />
      <ul ref={ref} className="strip flex min-w-0 flex-1 gap-1 py-1">
        {items.map((it) => (
          <li key={it.key} className="shrink-0">
            <Link
              href={it.href}
              title={it.title}
              aria-current={it.current ? "page" : undefined}
              className={`tc hit flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors duration-(--dur-1) ${
                it.current ? "" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
              }`}
              style={{
                ...it.vars,
                ...(it.current ? { background: "var(--team)", color: "var(--team-ink)" } : {}),
              }}
            >
              {it.vars && !it.current && <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: "var(--team)" }} />}
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
      <Arrow item={next} dir="next" />
    </nav>
  );
}

function Arrow({ item, dir }: { item: StripItem | null; dir: "prev" | "next" }) {
  const path = dir === "prev" ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6l-3.5 3.5";
  const cls = "hit hit-sq flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line";
  if (!item) return <span aria-hidden className={`${cls} opacity-35`}><Chevron d={path} /></span>;
  return (
    <Link href={item.href} aria-label={`${dir === "prev" ? "Previous" : "Next"}: ${item.title ?? item.label}`} className={`${cls} text-ink-2 transition-colors duration-(--dur-1) hover:border-line-2 hover:text-ink`}>
      <Chevron d={path} />
    </Link>
  );
}

function Chevron({ d }: { d: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
