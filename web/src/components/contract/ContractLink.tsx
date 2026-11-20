"use client";

import type { ReactNode } from "react";
import { loadContract, openContract, type ContractOpen } from "@/lib/contract";

/**
 * A player's name as the way into his contract. It is a real link (to this page with
 * `?player=<key>`), so it can be opened in a new tab or copied; a plain click opens
 * the contract sheet over the page instead of navigating.
 */
export function ContractLink({
  player,
  children,
  className = "",
}: {
  player: NonNullable<ContractOpen["player"]>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      // Relative to this page, so a new tab opens the same page with the contract.
      href={`?player=${encodeURIComponent(player.key)}`}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openContract({ key: player.key, player });
      }}
      // Start loading on hover or focus, so a click opens it at once.
      onMouseEnter={() => void loadContract(player.key).catch(() => {})}
      onFocus={() => void loadContract(player.key).catch(() => {})}
      aria-haspopup="dialog"
      className={`cursor-pointer decoration-line-2 underline-offset-[3px] transition-colors duration-(--dur-1) hover:underline hover:decoration-ink focus-visible:underline ${className}`}
    >
      {children}
    </a>
  );
}

