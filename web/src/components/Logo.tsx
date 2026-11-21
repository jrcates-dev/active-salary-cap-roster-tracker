"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Where a logo sits: "page" follows the light or dark theme, "board" is the dark band
 * (site bar, page hero, contract sheet header), which is dark in both themes.
 */
export type LogoTone = "page" | "board";

interface Source {
  light: string;
  dark: string;
}

const ESPN = /^https:\/\/a\.espncdn\.com\/i\/(teamlogos\/.+\.png)$/;

/** Small logos are drawn from one 96px copy: sharp up to 32px on a 3x screen, a few KB each. */
const SMALL = 32;
const SMALL_PX = 96;

/**
 * The files to try, best first. Logos come from ESPN's CDN (the nflverse team table
 * links them): `500/` is drawn for light backgrounds and `500-dark/` for dark ones.
 * Small logos ask ESPN's resizer for a small copy; if that fails the full file is
 * used, and if a team has no dark version its usual logo stands in.
 */
function sources(src: string, size: number): Source[] {
  const m = ESPN.exec(src);
  if (!m) return [{ light: src, dark: src }];
  const light = m[1];
  const dark = light.replace("/500/", "/500-dark/");
  const full = (p: string) => `https://a.espncdn.com/i/${p}`;
  const small = (p: string) => `https://a.espncdn.com/combiner/i?img=/i/${p}&w=${SMALL_PX}&h=${SMALL_PX}`;
  const list: Source[] = [];
  if (size <= SMALL) list.push({ light: small(light), dark: small(dark) });
  list.push({ light: full(light), dark: full(dark) });
  if (dark !== light) list.push({ light: full(light), dark: full(light) });
  return list;
}

/**
 * A team logo in a fixed square, so nothing shifts while it loads. If no file loads,
 * `fallback` (the team's abbreviation) shows on a tile of the team color, or without
 * one a small block of the team color, the mark the site used before logos. Both
 * need an enclosing `.tc` for the color. Decorative: the team's name is always
 * written beside it.
 */
export function Logo({
  src,
  size,
  tone = "page",
  className = "",
  fallback,
  inline = false,
}: {
  src: string | null | undefined;
  size: number;
  tone?: LogoTone;
  className?: string;
  fallback?: string;
  /** Sit in a line of text instead of starting a new one. */
  inline?: boolean;
}) {
  const list = src ? sources(src, size) : [];
  // How many files have failed, kept per `src` so a new team starts from the best file again.
  const [failed, setFailed] = useState({ src, step: 0 });
  const step = failed.src === src ? failed.step : 0;
  const img = useRef<HTMLImageElement>(null);
  const current = list[step];

  // Move on to the next file, past any that would ask for the one that just failed.
  const fail = (url: string) => {
    const dark = tone === "board" || (current && url === current.dark && current.dark !== current.light);
    let n = step + 1;
    while (list[n] && (dark ? list[n].dark : list[n].light) === url) n++;
    setFailed({ src, step: n });
  };

  // An image that failed before the page hydrated never reports it, so look once mounted.
  // A lazy image still waiting to load has no currentSrc and is not complete.
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0 && el.currentSrc) fail(el.currentSrc);
  });

  return (
    <span
      className={`${inline ? "inline-flex align-middle" : "flex"} shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}
      aria-hidden
    >
      {current ? (
        <picture key={`${src}:${step}`}>
          {tone === "page" && current.dark !== current.light && <source media="(prefers-color-scheme: dark)" srcSet={current.dark} />}
          <img
            ref={img}
            src={tone === "board" ? current.dark : current.light}
            alt=""
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={(e) => fail(e.currentTarget.currentSrc)}
            className="block object-contain"
            style={{ width: size, height: size }}
          />
        </picture>
      ) : fallback ? (
        <span
          className="flex h-full w-full items-center justify-center rounded-[22%] font-semibold tracking-tight"
          style={{ background: "var(--team)", color: "var(--team-ink)", fontSize: Math.round(size * 0.3) }}
        >
          {fallback}
        </span>
      ) : (
        <span className="rounded-[3px]" style={{ width: Math.round(size * 0.6), height: Math.round(size * 0.6), background: "var(--team)" }} />
      )}
    </span>
  );
}
