"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { parseRosterFilter, ROSTER_EVENT, scrollToRoster } from "@/lib/rosterLink";

const trimSlash = (p: string) => p.replace(/\/+$/, "") || "/";

/**
 * A chart mark that opens the players behind it. With a mouse or keyboard it
 * follows the link at once. A tap first shows the mark's tooltip (the enclosing
 * Tip opens on the same tap) and a second tap follows it, so phones keep their
 * tooltips. On the roster's own page it filters and scrolls in place instead of
 * reloading.
 */
export function ChartLink({
  href,
  label,
  className = "",
  style,
  children,
  tapPreview = true,
}: {
  href: string;
  /** What a screen reader hears: the mark's value and where it leads. Leave out when the link has text. */
  label?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  /** False for a link with no tooltip to preview (a label), so one tap follows it. */
  tapPreview?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const touch = useRef(false);
  const armed = useRef(false);
  const el = useRef<HTMLAnchorElement>(null);

  const disarm = useRef<((e: PointerEvent) => void) | null>(null);
  const stopListening = () => {
    if (disarm.current) document.removeEventListener("pointerdown", disarm.current);
    disarm.current = null;
  };
  useEffect(() => stopListening, []);

  const [target, hash] = href.split("#");
  const [path, search = ""] = target.split("?");
  const samePage = trimSlash(path) === trimSlash(pathname ?? "");

  return (
    <Link
      ref={el}
      href={href}
      scroll={!samePage}
      aria-label={label}
      className={`cursor-pointer ${className}`}
      style={style}
      onPointerDown={(e) => {
        touch.current = e.pointerType !== "mouse";
      }}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (tapPreview && touch.current && !armed.current) {
          e.preventDefault();
          armed.current = true;
          // A tap anywhere else disarms, so the next tap here shows the tip again.
          disarm.current = (ev: PointerEvent) => {
            if (el.current?.contains(ev.target as Node)) return;
            armed.current = false;
            stopListening();
          };
          document.addEventListener("pointerdown", disarm.current);
          return;
        }
        armed.current = false;
        stopListening();
        if (!samePage) return;
        e.preventDefault();
        router.push(href, { scroll: false });
        // A link to a section of this page (the dead money list) scrolls to it.
        if (hash) return scrollToRoster(hash);
        window.dispatchEvent(new CustomEvent(ROSTER_EVENT, { detail: parseRosterFilter(search) ?? {} }));
      }}
    >
      {children}
    </Link>
  );
}
