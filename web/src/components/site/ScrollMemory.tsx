"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const keyOf = (path: string) => `scroll:${path}`;

/**
 * Puts the page back where the reader left it on Back and Forward. The browser's
 * own restoration runs while the old page is still on screen, and the new page
 * then shifts it (a team page came back hundreds of pixels lower than it was
 * left), so each page's position is kept for the visit and set again once the
 * page has rendered, for a few frames, until the layout settles or the reader
 * scrolls. Back and Forward within one page (the roster's filters) are left to
 * the roster, which scrolls itself.
 *
 * Positions are saved under the page that is on screen, not the address: while a
 * navigation is under way the two disagree, so saving pauses from the moment a
 * link to another page is followed (or Back is pressed) until the new page is up.
 */
export function ScrollMemory() {
  const pathname = usePathname();
  /** The page on screen. */
  const page = useRef<string | null>(null);
  /** True between leaving one page and the next one rendering. */
  const moving = useRef(false);
  /** A position to put back once the page rendered by Back or Forward is up. */
  const pending = useRef<number | null>(null);

  useEffect(() => {
    const save = () => {
      if (!page.current || moving.current) return;
      try {
        window.sessionStorage.setItem(keyOf(page.current), String(Math.round(window.scrollY)));
      } catch {
        // Storage blocked: Back falls back to the browser's own restoration.
      }
    };
    let raf = 0;
    const onScroll = () => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          save();
        });
    };
    // A link to another page: note where this one was left, then pause saving.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin) return;
      if (a.pathname === page.current) return;
      save();
      moving.current = true;
    };
    const onPop = () => {
      if (window.location.pathname === page.current) return;
      moving.current = true;
      let saved: number | null = null;
      try {
        const raw = window.sessionStorage.getItem(keyOf(window.location.pathname));
        saved = raw === null ? null : Number(raw);
      } catch {
        saved = null;
      }
      pending.current = saved !== null && Number.isFinite(saved) ? saved : null;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("popstate", onPop);
    // Capture, so the position is saved before the router starts moving.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // The new page is up: resume saving, and on Back or Forward hold the saved
  // position while its charts measure themselves and settle.
  useEffect(() => {
    page.current = window.location.pathname;
    moving.current = false;
    const target = pending.current;
    pending.current = null;
    if (target === null) return;
    moving.current = true;
    const start = performance.now();
    let raf = 0;
    const stop = () => {
      moving.current = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };
    const hold = () => {
      if (Math.abs(window.scrollY - target) > 1) window.scrollTo({ top: target, behavior: "instant" });
      if (performance.now() - start < 700) raf = requestAnimationFrame(hold);
      else stop();
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    hold();
    return stop;
  }, [pathname]);

  return null;
}
