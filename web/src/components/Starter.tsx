/**
 * The starter star: a small filled star after a player's name when he is a starter on
 * his team's depth chart. A player who is out keeps the star if he started before he
 * went out (the pipeline reads the chart from before his absence), so an injured star
 * still reads as one. No "use client": server pages render it too.
 */
import type { Player } from "@/lib/types";

type Depth = Pick<Player, "starter" | "depth_role" | "flag">;

/** "LT1" -> "LT": the spot without its rank, for "Starter at LT". */
const spot = (role: string) => role.replace(/\d+$/, "");

/** One line on the player's place on the chart, or null when the chart has no word. */
export function depthText(p: Depth): string | null {
  if (p.starter) {
    const at = p.depth_role ? ` at ${spot(p.depth_role)}` : "";
    return p.flag === "inactive" ? `Starter${at} before going out` : `Starter${at}`;
  }
  if (p.starter === false) return p.depth_role ? `Backup · ${p.depth_role} on the depth chart` : "Backup";
  return null;
}

function Star({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 12 12" width={size} height={size} aria-hidden className="shrink-0">
      <path
        d="M6 .8l1.55 3.3 3.6.45-2.65 2.5.68 3.57L6 8.85 2.82 10.6l.68-3.57L.85 4.55l3.6-.45z"
        fill="var(--accent)"
      />
    </svg>
  );
}

/** The star after a starter's name; nothing for anyone else. */
export function StarterMark({ player, size = 11, className = "" }: { player: Depth; size?: number; className?: string }) {
  if (!player.starter) return null;
  const text = depthText(player) ?? "Starter";
  return (
    <span role="img" aria-label={text} title={text} className={`inline-flex shrink-0 items-center ${className}`}>
      <Star size={size} />
    </span>
  );
}

/**
 * A name with the star after it, kept on the last word's line so a wrapped name
 * never leaves the star alone on a line of its own.
 */
export function NameWithStar({ player }: { player: Depth & Pick<Player, "name"> }) {
  if (!player.starter) return <>{player.name}</>;
  const cut = player.name.lastIndexOf(" ");
  return (
    <>
      {player.name.slice(0, cut + 1)}
      <span className="whitespace-nowrap">
        {player.name.slice(cut + 1)}
        <StarterMark player={player} className="ml-1 align-[-1px]" />
      </span>
    </>
  );
}

/** The legend line that explains the star. */
export function StarterKey({ out = false, className = "" }: { out?: boolean; className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-xs text-ink-3 ${className}`}>
      <Star size={11} />
      <span>
        {out
          ? "Starter before going out, from the team's depth chart"
          : "Starter on the team's depth chart. Players out keep the role they had before."}
      </span>
    </p>
  );
}
