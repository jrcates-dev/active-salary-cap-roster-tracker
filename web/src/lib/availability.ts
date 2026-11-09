/**
 * Availability states shared by server pages and client charts. Kept out of the
 * "use client" components so server components can call these helpers.
 */
import { FLAG_LABEL, reasonLabel } from "./format";
import type { Player } from "./types";

/**
 * Availability states, in bar order. `inactive` is money out for this game only
 * (ruled out, doubtful, gameday inactive); `season` is money on a reserve list
 * (IR, PUP, NFI, suspension) that will be out for weeks.
 */
export type SliceKey = "active" | "questionable" | "inactive" | "season" | "unknown" | "dead";

export interface Slices {
  active: number;
  questionable: number;
  inactive: number;
  season?: number;
  unknown?: number;
  dead?: number;
}

export const SLICE_LABEL: Record<SliceKey, string> = {
  active: "Active",
  questionable: "Questionable",
  inactive: "Out this week",
  season: "Out long-term (IR, PUP)",
  unknown: "Practice squad / other",
  dead: "Dead money",
};

export const SLICE_ORDER: SliceKey[] = ["active", "questionable", "inactive", "season", "unknown", "dead"];

/** The slice a player's money falls in. */
export function playerSlice(p: Pick<Player, "flag" | "absence">): SliceKey {
  if (p.flag === "inactive") return p.absence === "season" ? "season" : "inactive";
  return p.flag;
}

/** Slices from any row that carries the rollup's money columns. */
export function slicesOf(r: {
  cap_active: number;
  cap_questionable: number;
  cap_inactive_week: number;
  cap_inactive_season: number;
  cap_unknown: number;
}): Slices {
  return {
    active: r.cap_active,
    questionable: r.cap_questionable,
    inactive: r.cap_inactive_week,
    season: r.cap_inactive_season,
    unknown: r.cap_unknown,
  };
}


/** Reason when out, the report designation when questionable, else the flag. */
export function statusText(p: Player): string {
  if (p.flag === "inactive") return reasonLabel(p.reason) ?? "Inactive";
  if (p.flag === "questionable") return "Questionable";
  return FLAG_LABEL[p.flag];
}
