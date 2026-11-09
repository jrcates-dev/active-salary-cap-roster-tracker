import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Player, RollupRow, Snapshot, Team, TeamSummary } from "./types";

/**
 * The site reads one JSON snapshot per build. `data/snapshot.json` is the real one
 * (`captracker export`, gitignored because the repo is public); `data/fixture.json`
 * is synthetic data with the same shape, used by CI and fresh clones.
 */
const DATA_DIR = path.join(process.cwd(), "data");

export async function getSnapshot(): Promise<Snapshot> {
  "use cache";
  for (const file of ["snapshot.json", "fixture.json"]) {
    try {
      const raw = await readFile(path.join(DATA_DIR, file), "utf8");
      return JSON.parse(raw) as Snapshot;
    } catch {
      // try the next file
    }
  }
  throw new Error("No data snapshot found. Run `captracker export` in pipeline/.");
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
