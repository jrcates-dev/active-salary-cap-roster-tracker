"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cleanPath, NAV_ITEMS } from "./NavLinks";

/** One 22px line icon per section. */
const ICONS: Record<string, React.ReactNode> = {
  // Three ranked bars: the league board.
  "/": (
    <>
      <path d="M4 6h14" />
      <path d="M4 11h10" />
      <path d="M4 16h6" />
    </>
  ),
  // A shield: a team.
  "/teams": <path d="M11 3 4.5 5.5v5.2c0 4 2.7 6.9 6.5 8.3 3.8-1.4 6.5-4.3 6.5-8.3V5.5Z" />,
  // Two bars meeting at a spine: the mirrored matchup chart.
  "/matchups": (
    <>
      <path d="M11 3.5v15" />
      <path d="M8 8H3.5" />
      <path d="M8 14H5.5" />
      <path d="M14 8h3" />
      <path d="M14 14h4.5" />
    </>
  ),
  // A page with lines: how the numbers are made.
  "/methodology": (
    <>
      <rect x="5" y="3.5" width="12" height="15" rx="1.5" />
      <path d="M8 8h6" />
      <path d="M8 11.5h6" />
      <path d="M8 15h3.5" />
    </>
  ),
};

/**
 * The sections as a tab bar fixed to the bottom of a phone screen, under the thumb.
 * Part of the board, so it is dark in both themes. Wider screens use the links in
 * the top bar instead. The body leaves room for it (layout.tsx).
 */
export function BottomTabs() {
  const path = cleanPath(usePathname());
  return (
    <nav
      aria-label="Sections"
      className="board fixed inset-x-0 bottom-0 z-40 border-t border-line-2 bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      <ul className="mx-auto grid h-14 max-w-md grid-cols-4">
        {NAV_ITEMS.map((it) => {
          const active = it.match(path);
          return (
            <li key={it.href} className="h-full">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 transition-colors duration-(--dur-1) ${
                  active ? "text-ink" : "text-ink-3"
                }`}
              >
                {active && <span aria-hidden className="absolute inset-x-5 top-0 h-[3px] bg-ink" />}
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {ICONS[it.href]}
                </svg>
                <span className="display text-[12px] leading-none tracking-[0.08em]">{it.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
