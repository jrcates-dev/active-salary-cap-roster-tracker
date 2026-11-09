import type { CSSProperties } from "react";

/**
 * A game as a card shows it, with the money edge already worked out on the server.
 * Plain data only, so a client component can switch weeks without the snapshot.
 */
export interface CardSide {
  abbr: string;
  score: number | null;
}

/** Name and colors per team, sent once rather than on every card. */
export type CardTeams = Record<string, { nick: string; vars: CSSProperties }>;

export interface CardGame {
  id: string;
  href: string;
  /** "Final" or the kickoff, e.g. "Sun Nov 15 · 1:00 PM ET". */
  when: string;
  final: boolean;
  away: CardSide;
  home: CardSide;
  /** "SEA front 6th vs GB OL 28th", and the same with nicknames for the tooltip. */
  edge: { short: string; title: string } | null;
}

/** One week of the schedule. */
export interface WeekSlate {
  week: number;
  /** First and last game day, "YYYY-MM-DD" in Eastern time as the schedule lists it. */
  firstDay: string;
  lastDay: string;
  games: CardGame[];
  /** Nicknames of the teams on bye. */
  byes: string[];
}

/**
 * Hours after midnight Eastern, on the day after a week's last game, before the
 * default moves on. A Monday night game can run past midnight; by 4 AM it is over.
 */
const ROLLOVER_HOUR_ET = 4;

/** "YYYY-MM-DD" for a moment, in Eastern time. */
function easternDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * The week to open on: a week stays up, scores and all, through its last game
 * (usually Monday night). From the next morning (Tuesday) the default is the
 * coming week. Before the season it is week 1; after it, the last week.
 */
export function defaultWeek(slates: Pick<WeekSlate, "week" | "lastDay">[], now: Date): number {
  if (slates.length === 0) return 0;
  // Shift the clock back so "the day after the last game" starts at the rollover hour.
  const today = easternDate(new Date(now.getTime() - ROLLOVER_HOUR_ET * 3_600_000));
  const open = slates.find((s) => today <= s.lastDay);
  return (open ?? slates[slates.length - 1]).week;
}

/** "Nov 5–9" or "Nov 26 – Dec 1", from schedule dates. */
export function dateRange(first: string, last: string): string {
  const d = (x: string) => new Date(`${x}T12:00:00Z`);
  const month = (x: string) => d(x).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const day = (x: string) => d(x).getUTCDate();
  if (first === last) return `${month(first)} ${day(first)}`;
  if (month(first) === month(last)) return `${month(first)} ${day(first)}–${day(last)}`;
  return `${month(first)} ${day(first)} – ${month(last)} ${day(last)}`;
}
