import Link from "next/link";
import type { CardGame, CardSide, CardTeams } from "@/lib/schedule";

/** One game: both teams, kickoff or final score, and the biggest money edge. */
export function GameCard({ game: g, teams }: { game: CardGame; teams: CardTeams }) {
  const winner = g.final
    ? g.away.score! > g.home.score!
      ? g.away.abbr
      : g.home.score! > g.away.score!
        ? g.home.abbr
        : null
    : null;
  const side = (t: CardSide) => {
    const won = winner === t.abbr;
    const team = teams[t.abbr];
    return (
      <span className="tc flex items-center gap-2.5" style={team?.vars}>
        <span aria-hidden className="h-5 w-1.5 shrink-0 rounded-[2px]" style={{ background: "var(--team)" }} />
        <span className={`flex-1 truncate text-[15px] ${won || !g.final ? "font-semibold text-ink" : "font-medium text-ink-3"}`}>
          {team?.nick ?? t.abbr}
        </span>
        {g.final && <span className={`fig text-[20px] leading-none ${won ? "text-ink" : "text-ink-3"}`}>{t.score}</span>}
      </span>
    );
  };
  return (
    <Link
      href={g.href}
      className="card block px-4 py-3 transition-[border-color,transform,box-shadow] duration-(--dur-2) ease-(--ease) hover:-translate-y-px hover:border-line-2 hover:shadow-[0_6px_16px_-10px_rgb(17_24_39/0.35)]"
    >
      <p className="eyebrow mb-2 !text-[12px]">{g.when}</p>
      <div className="space-y-1.5">
        {side(g.away)}
        {side(g.home)}
      </div>
      {g.edge && (
        <p className="mt-2.5 truncate border-t border-line pt-2 text-xs text-ink-3" title={g.edge.title}>
          <span className="font-medium text-ink-2">Edge</span> {g.edge.short}
        </p>
      )}
    </Link>
  );
}
