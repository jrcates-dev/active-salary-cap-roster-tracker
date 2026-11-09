"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "League", match: (p: string) => p === "/" },
  { href: "/matchups", label: "Matchups", match: (p: string) => p === "/matchups" || p.startsWith("/matchup/") },
  { href: "/methodology", label: "Methodology", match: (p: string) => p === "/methodology" },
];

/** Strip a trailing slash so "/matchups/" and "/matchups" compare equal. */
export function cleanPath(p: string | null): string {
  if (!p) return "/";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

export function NavLinks() {
  const path = cleanPath(usePathname());
  return (
    <nav aria-label="Sections" className="flex h-full min-w-0 items-center gap-0 sm:gap-1">
      {ITEMS.map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-14 items-center px-1.5 text-[13px] whitespace-nowrap transition-colors duration-(--dur-1) sm:px-2.5 sm:text-sm ${
              active ? "font-medium text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            {it.label}
            {active && <span aria-hidden className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-ink sm:inset-x-2.5" />}
          </Link>
        );
      })}
    </nav>
  );
}
