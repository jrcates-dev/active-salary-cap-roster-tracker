import Link from "next/link";
import { teamVars } from "@/design/tokens";
import { kickoffLabel, matchupHref } from "@/lib/data";
import { biggestEdges, edgeShort, gameEdges } from "@/lib/matchup";
import type { Game, Snapshot } from "@/lib/types";

/** One game: both teams, kickoff or final score, and the biggest money edge. */
export function GameCard({ s, g, current = false }: { s: Snapshot; g: Game; current?: boolean }) {
  const team = (abbr: string) => s.teams.find((t) => t.team === abbr);
  const nick = (abbr: string) => team(abbr)?.nick ?? abbr;
  const final = g.away_score !== null && g.home_score !== null;
  const [edge] = biggestEdges(gameEdges(s, g.away_team, g.home_team));
  const winner = final ? (g.away_score! > g.home_score! ? g.away_team : g.home_score! > g.away_score! ? g.home_team : null) : null;
  const side = (abbr: string, score: number | null) => {
    const t = team(abbr);
    const won = winner === abbr;
    return (
      <span className="tc flex items-center gap-2.5" style={t ? teamVars(t) : undefined}>
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: "var(--team)" }} />
        <span className={`flex-1 truncate text-[15px] ${won || !final ? "font-semibold text-ink" : "font-medium text-ink-3"}`}>
          {nick(abbr)}
        </span>
        {final && <span className={`num text-[15px] ${won ? "font-semibold text-ink" : "text-ink-3"}`}>{score}</span>}
      </span>
    );
  };
  return (
    <Link
      href={matchupHref(g)}
      aria-current={current ? "page" : undefined}
      className={`card block px-4 py-3 transition-[border-color,transform,box-shadow] duration-(--dur-2) ease-(--ease) hover:-translate-y-px hover:border-line-2 hover:shadow-[0_6px_16px_-10px_rgb(17_24_39/0.35)] ${
        current ? "border-ink" : ""
      }`}
    >
      <p className="num mb-2 text-xs text-ink-3">{final ? "Final" : kickoffLabel(g)}</p>
      <div className="space-y-1.5">
        {side(g.away_team, g.away_score)}
        {side(g.home_team, g.home_score)}
      </div>
      {edge && (
        <p className="mt-2.5 truncate border-t border-line pt-2 text-xs text-ink-3" title={edgeShort(edge, nick)}>
          <span className="font-medium text-ink-2">Edge</span> {edgeShort(edge, (a) => a)}
        </p>
      )}
    </Link>
  );
}
