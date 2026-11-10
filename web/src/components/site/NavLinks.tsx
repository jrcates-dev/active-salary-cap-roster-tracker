"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/", label: "League", short: "League", match: (p: string) => p === "/" },
  { href: "/teams", label: "Teams", short: "Teams", match: (p: string) => p === "/teams" || p.startsWith("/team/") },
  { href: "/matchups", label: "Matchups", short: "Matchups", match: (p: string) => p === "/matchups" || p.startsWith("/matchup/") },
  { href: "/methodology", label: "Methodology", short: "Method", match: (p: string) => p === "/methodology" },
];

/** Strip a trailing slash so "/matchups/" and "/matchups" compare equal. */
export function cleanPath(p: string | null): string {
  if (!p) return "/";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/** The sections, in the top bar. Hidden on a phone, where BottomTabs carries them. */
export function NavLinks() {
  const path = cleanPath(usePathname());
  return (
    <nav aria-label="Sections" className="hidden h-full min-w-0 items-center gap-1 sm:flex">
      {NAV_ITEMS.map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`display relative flex h-14 items-center px-2.5 text-[16px] tracking-[0.06em] whitespace-nowrap transition-colors duration-(--dur-1) ${
              active ? "text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            {it.label}
            {active && <span aria-hidden className="absolute inset-x-2.5 -bottom-px h-[3px] bg-ink" />}
          </Link>
        );
      })}
    </nav>
  );
}
