"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { scrollToRoster, stickyOffset } from "@/lib/rosterLink";
import { WRAP } from "../ui";

export interface SectionItem {
  id: string;
  label: string;
}

export interface Crumb {
  label: ReactNode;
  href?: string;
  /** Team colors for a small block before the label (`teamVars()`). */
  vars?: CSSProperties;
}

/**
 * The second sticky bar on a long page, the full width of the window (so it sits
 * outside the page column, in the page's outer wrapper, to stay stuck to the end): where you are on the left (a breadcrumb that
 * ends in this page), and every section of the page on the right, with the one in
 * view marked. On a phone the breadcrumb keeps only its last step and the sections
 * scroll sideways, the current one kept in view.
 */
export function SectionNav({ crumbs, items, className = "" }: { crumbs: Crumb[]; items: SectionItem[]; className?: string }) {
  const [active, setActive] = useState(items[0]?.id);
  const list = useRef<HTMLUListElement>(null);
  const ids = items.map((i) => i.id).join(",");

  // Scroll spy: the current section is the last one whose top has passed under the bars.
  useEffect(() => {
    const order = ids.split(",");
    let raf = 0;
    const update = () => {
      raf = 0;
      // A section counts as current once its top is a little way under the bars.
      const line = stickyOffset() + 64;
      let current = order[0];
      for (const id of order) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top - line <= 0) current = id;
      }
      // At the very bottom, a short last section can never reach the line.
      const doc = document.documentElement;
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 4) current = order[order.length - 1];
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ids]);

  // Keep the current section's link in view when the row scrolls sideways.
  useEffect(() => {
    const ul = list.current;
    const el = ul?.querySelector<HTMLElement>("[aria-current]");
    if (!ul || !el) return;
    const left = el.offsetLeft - ul.offsetLeft;
    if (left < ul.scrollLeft || left + el.offsetWidth > ul.scrollLeft + ul.clientWidth) {
      ul.scrollTo({ left: Math.max(0, left - 16), behavior: "smooth" });
    }
  }, [active]);

  return (
    <nav
      aria-label="On this page"
      data-sticky
      className={`sticky top-14 z-30 border-b border-line bg-bg/90 backdrop-blur-md ${className}`}
    >
      <div className={`${WRAP} flex h-11 items-center gap-3 sm:gap-5`}>
        <ol className="flex min-w-0 shrink-0 items-center gap-1.5 text-[13px]" aria-label="You are here">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <Fragment key={i}>
                <li className={`${last ? "flex" : "hidden sm:flex"} min-w-0 items-center gap-1.5`}>
                  {c.vars && <span aria-hidden className="tc h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ ...c.vars, background: "var(--team)" }} />}
                  {c.href && !last ? (
                    <Link href={c.href} className="hit truncate text-ink-3 transition-colors duration-(--dur-1) hover:text-ink">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? "page" : undefined} className="truncate font-semibold text-ink">
                      {c.label}
                    </span>
                  )}
                </li>
                {!last && (
                  <li aria-hidden className="hidden text-ink-4 sm:block">
                    /
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
        <span aria-hidden className="h-4 w-px shrink-0 bg-line-2" />
        <ul ref={list} className="strip flex h-full min-w-0 flex-1 items-center gap-1">
          {items.map((it) => {
            const on = it.id === active;
            return (
              <li key={it.id} className="h-full shrink-0">
                <a
                  href={`#${it.id}`}
                  aria-current={on ? "location" : undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    setActive(it.id);
                    scrollToRoster(it.id);
                    const url = new URL(window.location.href);
                    url.hash = it.id;
                    window.history.replaceState(window.history.state, "", url);
                  }}
                  className={`relative flex h-full items-center px-2 text-[13px] whitespace-nowrap transition-colors duration-(--dur-1) ${
                    on ? "font-medium text-ink" : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {it.label}
                  <span
                    aria-hidden
                    className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink transition-opacity duration-(--dur-2) ${on ? "opacity-100" : "opacity-0"}`}
                  />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
