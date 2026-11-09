"use client";

import { useState } from "react";

/** A team logo that disappears instead of showing a broken image if the CDN fails. */
export function Logo({ src, size, className = "" }: { src: string | null; size: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src) return null;
  // The box keeps its size whether or not the image arrives, so nothing shifts.
  return (
    <span className={`block shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden>
      {!failed && (
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
