import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Player, RollupRow, Snapshot, Team, TeamSummary } from "./types";

/**
 * The site reads one JSON snapshot per build. `data/snapshot.json` is the real one
 * (`captracker export`, gitignored so it never enters git history); `data/fixture.json`
 * is synthetic data with the same shape, used by CI and fresh clones.
 *
 * The deploy sets REQUIRE_SNAPSHOT=1 so a missing or broken real snapshot fails the
 * build instead of quietly publishing the synthetic numbers.
 */
const DATA_DIR = path.join(process.cwd(), "data");
const REQUIRE_SNAPSHOT = process.env.REQUIRE_SNAPSHOT === "1";

let cached: Promise<Snapshot> | null = null;

/** Read once per build process; every page shares the parsed snapshot. */
export function getSnapshot(): Promise<Snapshot> {
  cached ??= readSnapshot();
  return cached;
}

async function readSnapshot(): Promise<Snapshot> {
  if (REQUIRE_SNAPSHOT) {
    const raw = await readFile(path.join(DATA_DIR, "snapshot.json"), "utf8");
    const s = JSON.parse(raw) as Snapshot;
    if (s.fixture) throw new Error("REQUIRE_SNAPSHOT is set but snapshot.json holds fixture data.");
    return normalize(s);
  }
  for (const file of ["snapshot.json", "fixture.json"]) {
    try {
      const raw = await readFile(path.join(DATA_DIR, file), "utf8");
      return normalize(JSON.parse(raw) as Snapshot);
    } catch {
      // try the next file
    }
  }
  throw new Error("No data snapshot found. Run `captracker export` in pipeline/.");
}

/** Fill fields an older snapshot may lack, so pages never branch on them. */
function normalize(s: Snapshot): Snapshot {
  return { ...s, history: s.history ?? [], freshness: s.freshness ?? null };
}

export interface TeamView {
  team: Team;
  summary: TeamSummary;
  rollup: RollupRow[];
  players: Player[];
}

export function teamView(s: Snapshot, abbr: string): TeamView | null {
  const team = s.teams.find((t) => t.team === abbr);
  const summary = s.summary.find((t) => t.team === abbr);
  if (!team || !summary) return null;
  return {
    team,
    summary,
    rollup: s.rollup.filter((r) => r.team === abbr),
    players: s.players.filter((p) => p.team === abbr),
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export interface GroupLeagueStat {
  median: number;
  max: number;
  ranks: Record<string, number>;
}

/** League median and max spend per position group, and each team's rank (1 = most). */
export function groupLeagueStats(s: Snapshot): Record<string, GroupLeagueStat> {
  const out: Record<string, GroupLeagueStat> = {};
  for (const g of s.groups) {
    const rows = s.rollup.filter((r) => r.level === "group" && r.position_group === g.code);
    const byTeam = s.teams.map((t) => ({
      team: t.team,
      cap: rows.find((r) => r.team === t.team)?.cap_total ?? 0,
    }));
    const sorted = [...byTeam].sort((a, b) => b.cap - a.cap);
    out[g.code] = {
      median: median(byTeam.map((x) => x.cap)),
      max: sorted[0]?.cap ?? 0,
      ranks: Object.fromEntries(sorted.map((x, i) => [x.team, i + 1])),
    };
  }
  return out;
}

export function teamGame(s: Snapshot, abbr: string, week: number) {
  const g = s.games.find((x) => x.week === week && (x.home_team === abbr || x.away_team === abbr));
  if (!g) return null;
  const home = g.home_team === abbr;
  const opponent = home ? g.away_team : g.home_team;
  const us = home ? g.home_score : g.away_score;
  const them = home ? g.away_score : g.home_score;
  return { ...g, home, opponent, us, them, played: us !== null && them !== null };
}

/** This week's games, in kickoff order. */
export function weekGames(s: Snapshot, week = s.week) {
  return s.games
    .filter((g) => g.week === week)
    .sort((a, b) => `${a.gameday} ${a.gametime ?? ""}`.localeCompare(`${b.gameday} ${b.gametime ?? ""}`));
}

/** URL slug for a game's matchup page. */
export function matchupHref(g: { away_team: string; home_team: string; week: number }) {
  return `/matchup/${g.week}-${g.away_team}-${g.home_team}`;
}

/** "Sun Nov 15 · 1:00 PM ET" from the schedule's local-to-ET date and 24h time. */
export function kickoffLabel(g: { gameday: string; gametime: string | null }) {
  const d = new Date(`${g.gameday}T12:00:00Z`);
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (!g.gametime) return day;
  const [h, m] = g.gametime.split(":").map(Number);
  const hour = ((h + 11) % 12) + 1;
  return `${day} · ${hour}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"} ET`;
}
