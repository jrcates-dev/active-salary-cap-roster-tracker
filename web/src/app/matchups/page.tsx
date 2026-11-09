import type { Metadata } from "next";
import { GameCard } from "@/components/GameCard";
import { Empty, PageHead, SectionHead, WRAP } from "@/components/ui";
import { getSnapshot, weekGames } from "@/lib/data";

export const metadata: Metadata = { title: "Matchups" };

/** This week's slate and an early look at next week's. */
export default async function MatchupsPage() {
  const s = await getSnapshot();
  const now = weekGames(s);
  const next = weekGames(s, s.week + 1);
  const finals = now.filter((g) => g.away_score !== null && g.home_score !== null).length;
  return (
    <main className={`${WRAP} space-y-12 py-8 sm:py-10`}>
      <PageHead eyebrow={`${s.season} season`} title="Matchups" />
      <section>
        <SectionHead title={`Week ${s.week}`} count={now.length ? `${finals} of ${now.length} final` : undefined} />
        {now.length === 0 ? (
          <Empty>No games this week</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {now.map((g) => (
              <GameCard key={g.game_id} s={s} g={g} />
            ))}
          </div>
        )}
      </section>
      {next.length > 0 && (
        <section>
          <SectionHead title={`Week ${s.week + 1}`} aside={<span>Early look · this week&apos;s statuses</span>} />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {next.map((g) => (
              <GameCard key={g.game_id} s={s} g={g} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
