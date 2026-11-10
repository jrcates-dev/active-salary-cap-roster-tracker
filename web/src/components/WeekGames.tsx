"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dateRange, defaultWeek, type CardTeams, type WeekSlate } from "@/lib/schedule";
import { GameCard } from "./GameCard";
import { StepButton } from "./ui/controls";

/**
 * One week's games, with a picker for every week of the season. It opens on the
 * week that matters now: the current week through Monday night, then the coming
 * week from Tuesday. The site is built once a day, so the browser works that out
 * from today's date instead of trusting the build. The chosen week rides in the
 * address (?week=12), so a shared link or the back button keeps it.
 */
export function WeekGames({
  slates,
  teams,
  dataWeek,
  initialWeek,
  more,
  id,
  cols = "grid-cols-2 lg:grid-cols-4",
  ticker = false,
}: {
  slates: WeekSlate[];
  teams: CardTeams;
  /** The week the rosters and statuses are from. */
  dataWeek: number;
  /** The build's best guess, shown until the browser knows the date. */
  initialWeek: number;
  /** A link onward ("All matchups"), which carries the chosen week. */
  more?: { href: string; label: string };
  id?: string;
  /** Grid columns for the game cards, for when the list shares its row with something else. */
  cols?: string;
  /**
   * The league page's score ticker: one row that swipes sideways on a phone, and a
   * tight five-across grid on a desktop, so the whole week sits above the fold.
   */
  ticker?: boolean;
}) {
  const [week, setWeek] = useState(initialWeek);
  const [nowWeek, setNowWeek] = useState(initialWeek);

  useEffect(() => {
    const today = defaultWeek(slates, new Date());
    const asked = Number(new URLSearchParams(window.location.search).get("week"));
    // Settle the week from the clock and the address once the page is in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowWeek(today);
    setWeek(slates.some((s) => s.week === asked) ? asked : today);
  }, [slates]);

  const idx = Math.max(
    0,
    slates.findIndex((s) => s.week === week),
  );
  const slate = slates[idx];
  if (!slate) return null;

  const pick = (w: number) => {
    setWeek(w);
    const url = new URL(window.location.href);
    url.searchParams.set("week", String(w));
    window.history.replaceState(window.history.state, "", url);
  };

  const finals = slate.games.filter((g) => g.final).length;
  const range = dateRange(slate.firstDay, slate.lastDay);
  const count = finals > 0 ? `${finals} of ${slate.games.length} final` : `${range} · ${slate.games.length} games`;
  const basis =
    slate.week > dataWeek
      ? `Early look: money and injury statuses are from week ${dataWeek} and update as the game nears.`
      : slate.week < dataWeek
        ? `Scores are from week ${slate.week}; money and edges use the current week ${dataWeek} rosters.`
        : null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t-2 border-ink pt-2.5">
        <h2 id={id} className="display flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[24px] leading-none">
          <span className="hit-field relative inline-flex items-center gap-1.5 rounded-md border border-line-2 px-2.5 py-1 transition-colors duration-(--dur-1) focus-within:border-ink hover:border-line-2">
            Week {slate.week}
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="text-ink-2">
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <select
              aria-label="Week"
              value={slate.week}
              onChange={(e) => pick(Number(e.target.value))}
              className="hit-overlay absolute inset-0 cursor-pointer appearance-none bg-surface text-ink opacity-0"
            >
              {slates.map((s) => (
                <option key={s.week} value={s.week}>
                  Week {s.week} · {dateRange(s.firstDay, s.lastDay)}
                  {s.week === nowWeek ? " · this week" : ""}
                </option>
              ))}
            </select>
          </span>
          <span>games</span>
          <span className="num font-sans text-sm font-normal tracking-normal text-ink-3 normal-case">{count}</span>
        </h2>
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-ink-2">
          <div className="flex items-center gap-1" role="group" aria-label="Step through weeks">
            <StepButton dir="prev" label="Previous week" disabled={idx <= 0} onClick={() => pick(slates[idx - 1].week)} />
            {slate.week !== nowWeek && (
              <button
                type="button"
                onClick={() => pick(nowWeek)}
                className="hit h-7 rounded-md border border-line px-2 text-xs font-medium text-ink-2 transition-colors duration-(--dur-1) hover:border-line-2 hover:text-ink"
              >
                This week
              </button>
            )}
            <StepButton dir="next" label="Next week" disabled={idx >= slates.length - 1} onClick={() => pick(slates[idx + 1].week)} />
          </div>
          {more && (
            <Link href={`${more.href}?week=${slate.week}`} className="font-medium text-ink-2 hover:text-ink">
              {more.label} →
            </Link>
          )}
        </div>
      </div>
      {(basis || slate.byes.length > 0) && (
        <p className="mb-3 text-[13px] text-ink-3">
          {basis}
          {basis && slate.byes.length > 0 && " "}
          {slate.byes.length > 0 && <>Bye: {slate.byes.join(", ")}.</>}
        </p>
      )}
      {ticker ? (
        <ul className="strip -mx-4 flex snap-x gap-2.5 px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-5" aria-label={`Week ${slate.week} games`}>
          {slate.games.map((g) => (
            <li key={g.id} className="w-[13.5rem] shrink-0 snap-start scroll-ml-4 sm:w-auto">
              <GameCard game={g} teams={teams} />
            </li>
          ))}
        </ul>
      ) : (
        <div className={`grid gap-3 ${cols}`}>
          {slate.games.map((g) => (
            <GameCard key={g.id} game={g} teams={teams} />
          ))}
        </div>
      )}
    </div>
  );
}
