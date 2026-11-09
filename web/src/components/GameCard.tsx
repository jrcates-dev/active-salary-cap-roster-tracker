import Link from "next/link";
import { displayColor } from "@/design/tokens";
import { kickoffLabel, matchupHref } from "@/lib/data";
import { biggestEdges, edgeText, gameEdges } from "@/lib/matchup";
import type { Game, Snapshot } from "@/lib/types";

/** One game of the week: teams, kickoff or final score, and its biggest money edge. */
export function GameCard({ s, g }: { s: Snapshot; g: Game }) {
  const team = (abbr: string) => s.teams.find((t) => t.team === abbr);
  const nick = (abbr: string) => team(abbr)?.nick ?? abbr;
  const final = g.away_score !== null && g.home_score !== null;
  const [edge] = biggestEdges(gameEdges(s, g.away_team, g.home_team));
  const side = (abbr: string, score: number | null) => {
    const t = team(abbr);
    return (
      <span className="flex items-center gap-2">
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: t ? displayColor(t) : "#9aa3b5" }} />
        <span className="num flex-1 text-lg font-semibold">{nick(abbr)}</span>
        {final && <span className="num text-lg">{score}</span>}
      </span>
    );
  };
  return (
    <Link
      href={matchupHref(g)}
      className="block rounded-lg border border-border bg-panel px-4 py-3 transition-colors hover:border-fg-faint"
    >
      <p className="mb-1.5 text-xs text-fg-muted">{final ? "Final" : kickoffLabel(g)}</p>
      {side(g.away_team, g.away_score)}
      {side(g.home_team, g.home_score)}
      {edge && <p className="mt-2 text-xs leading-snug text-fg-muted">{edgeText(edge, nick)}</p>}
    </Link>
  );
}
