import Link from "next/link";
import type { CSSProperties } from "react";
import { Logo, type LogoTone } from "./Logo";

/** A team's logo and nickname, as a link unless told otherwise. */
export function TeamChip({
  team,
  nick,
  logo,
  vars,
  href = true,
  size = "md",
  tone = "page",
  className = "",
}: {
  team: string;
  nick?: string;
  /** The team's logo (`Team.logo_url`); without one, a block of the team color. */
  logo: string | null;
  vars: CSSProperties;
  href?: boolean;
  size?: "sm" | "md" | "lg";
  tone?: LogoTone;
  className?: string;
}) {
  const px = size === "sm" ? 18 : size === "md" ? 20 : 24;
  const text = size === "sm" ? "text-[13px]" : size === "md" ? "text-sm" : "text-base";
  const inner = (
    <span className={`tc flex min-w-0 max-w-full items-center gap-2 ${className}`} style={vars}>
      <Logo src={logo} size={px} tone={tone} />
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
