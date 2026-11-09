import Link from "next/link";
import type { CSSProperties } from "react";

/** A team's color block and nickname, as a link unless told otherwise. */
export function TeamChip({
  team,
  nick,
  vars,
  href = true,
  size = "md",
  className = "",
}: {
  team: string;
  nick?: string;
  vars: CSSProperties;
  href?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dot = size === "sm" ? "h-2.5 w-2.5 rounded-[3px]" : size === "md" ? "h-3 w-3 rounded-[3px]" : "h-4 w-4 rounded-[4px]";
  const text = size === "sm" ? "text-[13px]" : size === "md" ? "text-sm" : "text-base";
  const inner = (
    <span className={`tc flex min-w-0 max-w-full items-center gap-2 ${className}`} style={vars}>
      <span aria-hidden className={`shrink-0 ${dot}`} style={{ background: "var(--team)" }} />
      <span className={`truncate font-medium ${text}`}>{nick ?? team}</span>
    </span>
  );
  if (!href) return inner;
  return (
    <Link href={`/team/${team}`} className="block min-w-0 max-w-full rounded transition-colors duration-(--dur-1) hover:text-ink-2">
      {inner}
    </Link>
  );
}
