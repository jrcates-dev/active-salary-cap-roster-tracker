/**
 * Deep links into a team's roster table. Every chart segment that stands for a set
 * of players links here: `/team/SEA/?status=inactive`, `/team/LA/?unit=defense`,
 * `/team/NE/?group=IDL,EDGE&status=season`. `week` opens an earlier week's list of
 * who was out: `/team/GB/?week=3&status=year`. The roster reads these on load, sets
 * its filters and scrolls itself into view. Kept free of "use client" so server
 * pages can build links too.
 */
import type { Unit } from "./types";

/** The id on the team page's roster section, the scroll target of every link. */
export const ROSTER_ID = "roster";

/** Status filters the roster offers: every availability state except dead money. */
export type RosterStatus = "active" | "questionable" | "inactive" | "season" | "year" | "unknown";
export const ROSTER_STATUSES: RosterStatus[] = ["active", "questionable", "inactive", "season", "year", "unknown"];
/** The statuses an earlier week keeps: only the players who were out or questionable. */
export const PAST_STATUSES: RosterStatus[] = ["questionable", "inactive", "season", "year"];
const UNITS: Unit[] = ["offense", "defense", "special_teams"];

export interface RosterFilter {
  /** An earlier week. Left out for the current week, whose roster is the default. */
  week?: number;
  status?: RosterStatus;
  unit?: Unit;
  /** Position-group codes. A matchup side can span several (IDL and EDGE). */
  groups?: string[];
}

/** The query string for a filter, "" when nothing is filtered. Groups win over unit. */
export function rosterQuery(f: RosterFilter): string {
  const parts: string[] = [];
  if (f.week) parts.push(`week=${f.week}`);
  if (f.status) parts.push(`status=${f.status}`);
  if (f.groups?.length) parts.push(`group=${f.groups.map(encodeURIComponent).join(",")}`);
  else if (f.unit) parts.push(`unit=${f.unit}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

/** A link to a team's roster with its filters preset. */
export function rosterHref(team: string, f: RosterFilter = {}): string {
  return `/team/${team}/${rosterQuery(f)}`;
}

/** A roster link for each status, for a chart whose segments are statuses. */
export function statusHrefs(team: string, f: Omit<RosterFilter, "status"> = {}): Record<RosterStatus, string> {
  return Object.fromEntries(ROSTER_STATUSES.map((status) => [status, rosterHref(team, { ...f, status })])) as Record<
    RosterStatus,
    string
  >;
}

/**
 * Roster links for the statuses of one week's money out. The current week (`week`
 * equal to `current`) links to the live roster; an earlier one to that week's list.
 */
export function weekStatusHrefs(team: string, week: number, current: number): Partial<Record<RosterStatus, string>> {
  if (week === current) return statusHrefs(team);
  return Object.fromEntries(PAST_STATUSES.map((status) => [status, rosterHref(team, { week, status })]));
}

/** Filters from a query string, or null when it carries none the roster knows. */
export function parseRosterFilter(search: string): RosterFilter | null {
  const p = new URLSearchParams(search);
  const out: RosterFilter = {};
  const week = Number(p.get("week"));
  if (Number.isInteger(week) && week > 0) out.week = week;
  const status = p.get("status");
  if (status && (ROSTER_STATUSES as string[]).includes(status)) out.status = status as RosterStatus;
  const groups = (p.get("group") ?? "")
    .split(",")
    .map((g) => g.trim().toUpperCase())
    .filter(Boolean);
  if (groups.length) out.groups = groups;
  const unit = p.get("unit");
  if (!groups.length && unit && (UNITS as string[]).includes(unit)) out.unit = unit as Unit;
  return out.week || out.status || out.groups || out.unit ? out : null;
}

/** Fired on the team page when a chart there links to its own roster. Detail: RosterFilter. */
export const ROSTER_EVENT = "roster:filter";

/**
 * Scrolls the roster section to just below the sticky site header (whose height
 * changes with the fixture-data banner), smoothly unless the reader asked for less motion.
 */
export function scrollToRoster() {
  const el = document.getElementById(ROSTER_ID);
  if (!el) return;
  const header = document.querySelector("header.sticky");
  const offset = (header?.getBoundingClientRect().bottom ?? 0) + 16;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: still ? "auto" : "smooth" });
}
