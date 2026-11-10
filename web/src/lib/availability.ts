/**
 * Availability states shared by server pages and client charts. Kept out of the
 * "use client" components so server components can call these helpers.
 */
import { FLAG_LABEL, money, reasonLabel } from "./format";
import type { Player } from "./types";

/**
 * Availability states, in bar order. `inactive` ("Out") is money out for this game
 * but not for good: ruled out (or still out from last game), doubtful, a gameday
 * inactive, or a reserve list (IR, PUP, NFI, suspension) the player can come back from
 * this season. Which of those it
 * is shows as a tag on each player (`outTag`) and a line in the tooltip, not as its
 * own band. `year` is reserve-list money done for the season.
 */
export type SliceKey = "active" | "questionable" | "inactive" | "year" | "unknown" | "dead";

export interface Slices {
  active: number;
  questionable: number;
  /** Out, this week's absences and reserve lists with a way back together. */
  inactive: number;
  /** The part of `inactive` on a reserve list, for the tooltip's detail line. */
  reserve?: number;
  year?: number;
  unknown?: number;
  dead?: number;
}

export const SLICE_LABEL: Record<SliceKey, string> = {
  active: "Active",
  questionable: "Questionable",
  inactive: "Out",
  year: "Out for season",
  unknown: "Practice squad / other",
  dead: "Dead money",
};

export const SLICE_ORDER: SliceKey[] = ["active", "questionable", "inactive", "year", "unknown", "dead"];

/** Short names for chips and filters, where the legend's longer label does not fit. */
export const SLICE_SHORT: Record<SliceKey, string> = {
  ...SLICE_LABEL,
  unknown: "Practice squad",
};

/** One line on what counts as out, for chips and filters. */
export const OUT_NOTE =
  "Out for this game: ruled out (or out last game, with no status yet), doubtful, an injured gameday inactive, or on a reserve list (IR, PUP, NFI, suspension) with a way back this season.";

/** One line on how the site decides a reserve-list player is done for the season. */
export const YEAR_NOTE =
  "Done for the season: reported season-ending injuries, plus anyone whose 21-day return window closed without being activated.";

/** The slice a player's money falls in. */
export function playerSlice(p: Pick<Player, "flag" | "absence">): SliceKey {
  if (p.flag === "inactive") return p.absence === "year" ? "year" : "inactive";
  return p.flag;
}

/** The money columns every rollup, summary and history row carries. */
export interface MoneyColumns {
  cap_active: number;
  cap_questionable: number;
  cap_inactive_week: number;
  cap_inactive_season: number;
  cap_inactive_year?: number;
  cap_unknown: number;
}

/** Money out but not for good: this week's absences plus reserve lists with a way back. */
export const outOf = (r: Pick<MoneyColumns, "cap_inactive_week" | "cap_inactive_season">) =>
  r.cap_inactive_week + r.cap_inactive_season;

/** Slices from any row that carries the rollup's money columns. */
export function slicesOf(r: MoneyColumns): Slices {
  return {
    active: r.cap_active,
    questionable: r.cap_questionable,
    inactive: outOf(r),
    reserve: r.cap_inactive_season,
    year: r.cap_inactive_year ?? 0,
    unknown: r.cap_unknown,
  };
}

/** The tooltip line under "Out": how much of it is on a reserve list. */
export function reserveLine(out: number, reserve: number): string | null {
  if (out <= 0 || reserve <= 0) return null;
  if (reserve >= out) return "All on a reserve list, can return";
  return `${money(reserve)} on a reserve list, ${money(out - reserve)} this game only`;
}

/** Reserve lists that hold a player out at least four games before he can return. */
const FOUR_GAME_LISTS = new Set(["injured_reserve", "pup", "nfi"]);

/**
 * Why a player is out, in a few words: "Inactive this week", "IR, eligible week 12",
 * "IR, designated to return", "IR, out for season". Null for anyone not out.
 */
export function outTag(
  p: Pick<Player, "flag" | "absence" | "reason" | "outlook_basis">,
  week: number,
  returnWeek: number | null,
): string | null {
  if (p.flag !== "inactive") return null;
  if (p.absence !== "season" && p.absence !== "year") {
    if (p.reason === "out") return "Ruled out this week";
    if (p.reason === "out_last_game") return "Out last game, no status yet";
    if (p.reason === "doubtful") return "Doubtful this week";
    return "Inactive this week";
  }
  const list = RESERVE_SHORT[p.reason ?? ""] ?? "Reserve list";
  if (p.absence === "year") return `${list}, out for season`;
  if (p.outlook_basis === "designated_for_return") return `${list}, designated to return`;
  if (returnWeek && FOUR_GAME_LISTS.has(p.reason ?? "")) {
    return returnWeek <= week ? `${list}, eligible to return` : `${list}, eligible week ${returnWeek}`;
  }
  return `${list}, can return this season`;
}

const RESERVE_SHORT: Record<string, string> = {
  injured_reserve: "IR",
  pup: "PUP",
  nfi: "NFI",
  suspended: "Suspended",
  reserve_other: "Reserve list",
};

/** Why he is out when out (`out_tag`), the report designation when questionable, else the flag. */
export function statusText(p: Pick<Player, "flag" | "absence" | "reason" | "out_tag">): string {
  if (p.flag === "inactive") {
    if (p.out_tag) return p.out_tag;
    const reason = reasonLabel(p.reason) ?? "Inactive";
    return p.absence === "year" ? `${reason}, out for season` : reason;
  }
  if (p.flag === "questionable") return "Questionable";
  return FLAG_LABEL[p.flag];
}
