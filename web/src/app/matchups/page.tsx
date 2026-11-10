import type { Metadata } from "next";
import { Empty, Hero, WRAP } from "@/components/ui";
import { WeekGames } from "@/components/WeekGames";
import { cardTeams, getSnapshot, weekSlates } from "@/lib/data";

export const metadata: Metadata = { title: "Matchups" };

/** Any week's slate: this week's scores, or an early look at a future week. */
export default async function MatchupsPage() {
  const s = await getSnapshot();
  const slates = weekSlates(s);
  return (
    <>
      <Hero eyebrow={`${s.season} season`} title="Matchups" />
      <main className={`${WRAP} py-8 sm:py-10`}>
        {slates.length === 0 ? <Empty>No games on the schedule</Empty> : <WeekGames slates={slates} teams={cardTeams(s)} dataWeek={s.week} initialWeek={s.week} />}
      </main>
    </>
  );
}
