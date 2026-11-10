"use client";

import { useState } from "react";

/**
 * A team logo. If there is no logo or the CDN fails, `fallback` (the team's
 * abbreviation) shows on a tile of the team color instead, so the header never
 * opens with an empty gap; it needs an enclosing `.tc` for the color. Without a
 * fallback the logo just disappears.
 */
export function Logo({ src, size, className = "", fallback }: { src: string | null; size: number; className?: string; fallback?: string }) {
  const [failed, setFailed] = useState(false);
  const missing = !src || failed;
  if (missing && !fallback) return null;
  // The box keeps its size whether or not the image arrives, so nothing shifts.
  return (
    <span className={`block shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden>
      {missing ? (
        <span
          className="flex h-full w-full items-center justify-center rounded-[22%] font-semibold tracking-tight"
          style={{ background: "var(--team)", color: "var(--team-ink)", fontSize: Math.round(size * 0.3) }}
        >
          {fallback}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: size, height: size }}
        />
      )}
    </span>
  );
}
