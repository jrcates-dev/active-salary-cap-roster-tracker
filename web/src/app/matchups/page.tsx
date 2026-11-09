import type { Metadata } from "next";
import { Empty, PageHead, WRAP } from "@/components/ui";
import { WeekGames } from "@/components/WeekGames";
import { cardTeams, getSnapshot, weekSlates } from "@/lib/data";

export const metadata: Metadata = { title: "Matchups" };

/** Any week's slate: this week's scores, or an early look at a future week. */
export default async function MatchupsPage() {
  const s = await getSnapshot();
  const slates = weekSlates(s);
  return (
    <main className={`${WRAP} space-y-8 py-8 sm:py-10`}>
      <PageHead eyebrow={`${s.season} season`} title="Matchups" />
      <section>
        {slates.length === 0 ? <Empty>No games on the schedule</Empty> : <WeekGames slates={slates} teams={cardTeams(s)} dataWeek={s.week} initialWeek={s.week} />}
      </section>
    </main>
  );
}
