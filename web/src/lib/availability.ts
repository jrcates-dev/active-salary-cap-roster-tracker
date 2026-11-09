/**
 * Availability states shared by server pages and client charts. Kept out of the
 * "use client" components so server components can call these helpers.
 */
import { FLAG_LABEL, reasonLabel } from "./format";
import type { Player } from "./types";

/**
 * Availability states, in bar order. `inactive` is money out for this game only
 * (ruled out, doubtful, gameday inactive); `season` is money on a reserve list
 * (IR, PUP, NFI, suspension) that will be out for weeks but can come back this
 * season; `year` is reserve-list money done for the season.
 */
export type SliceKey = "active" | "questionable" | "inactive" | "season" | "year" | "unknown" | "dead";

export interface Slices {
  active: number;
  questionable: number;
  inactive: number;
  season?: number;
  year?: number;
  unknown?: number;
  dead?: number;
}

export const SLICE_LABEL: Record<SliceKey, string> = {
  active: "Active",
  questionable: "Questionable",
  inactive: "Out this week",
  season: "Out long-term, can return",
  year: "Out for season",
  unknown: "Practice squad / other",
  dead: "Dead money",
};

export const SLICE_ORDER: SliceKey[] = ["active", "questionable", "inactive", "season", "year", "unknown", "dead"];

/** Short names for chips and filters, where the legend's longer label does not fit. */
export const SLICE_SHORT: Record<SliceKey, string> = {
  ...SLICE_LABEL,
  season: "Out long-term",
  unknown: "Practice squad",
};

/** One line on how the site decides a reserve-list player is done for the season. */
export const YEAR_NOTE =
  "Done for the season: reported season-ending injuries, plus anyone whose 21-day return window closed without being activated.";

/** The slice a player's money falls in. */
export function playerSlice(p: Pick<Player, "flag" | "absence">): SliceKey {
  if (p.flag === "inactive") {
    if (p.absence === "season") return "season";
    if (p.absence === "year") return "year";
    return "inactive";
  }
  return p.flag;
}

/** Slices from any row that carries the rollup's money columns. */
export function slicesOf(r: {
  cap_active: number;
  cap_questionable: number;
  cap_inactive_week: number;
  cap_inactive_season: number;
  cap_inactive_year?: number;
  cap_unknown: number;
}): Slices {
  return {
    active: r.cap_active,
    questionable: r.cap_questionable,
    inactive: r.cap_inactive_week,
    season: r.cap_inactive_season,
    year: r.cap_inactive_year ?? 0,
    unknown: r.cap_unknown,
  };
}


/** Reason when out, the report designation when questionable, else the flag. */
export function statusText(p: Player): string {
  if (p.flag === "inactive") {
    const reason = reasonLabel(p.reason) ?? "Inactive";
    return p.absence === "year" ? `${reason}, out for season` : reason;
  }
  if (p.flag === "questionable") return "Questionable";
  return FLAG_LABEL[p.flag];
}
