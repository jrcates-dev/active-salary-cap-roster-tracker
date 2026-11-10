import { readFile } from "node:fs/promises";
import path from "node:path";
import { teamVars } from "@/design/tokens";
import { biggestEdges, edgeShort, gameEdges } from "./matchup";
import type { CardGame, CardSide, CardTeams, WeekSlate } from "./schedule";
import { outTag } from "./availability";
import type { Game, HistoryPlayer, HistoryRow, Player, RollupRow, Snapshot, Team, TeamSummary } from "./types";

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
  const history_players = s.history_players ?? [];
  const tag = outTagger(s.games, history_players);
  return {
    ...s,
    players: s.players.map((p) => (p.flag === "inactive" ? { ...p, out_tag: tag(p, s.week) } : p)),
    history: s.history ?? [],
    history_players: history_players.map((h) => (h.flag === "inactive" ? { ...h, out_tag: tag(h, h.week) } : h)),
    dead_charges: s.dead_charges ?? [],
    freshness: s.freshness ?? null,
  };
}

/** Games a player on IR, PUP or NFI must miss before he can be activated. */
const GAMES_HELD_OUT = 4;

/**
 * Tags each player who is out with why (`outTag`). For a reserve list with a way back
 * it estimates the week he can return: the run of weeks he has been on a reserve list
 * (a bye does not break it) gives the week he went on, and he can come back for the
 * fifth game after that. The free data has no placement date, so this is an estimate.
 */
function outTagger(games: Game[], history: HistoryPlayer[]) {
  const gameWeeks = new Map<string, number[]>();
  for (const g of games) {
    for (const t of [g.away_team, g.home_team]) {
      const list = gameWeeks.get(t) ?? [];
      list.push(g.week);
      gameWeeks.set(t, list);
    }
  }
  for (const list of gameWeeks.values()) list.sort((a, b) => a - b);
  /** Weeks each player was on a reserve list, by player key. */
  const reserveWeeks = new Map<string, Set<number>>();
  for (const h of history) {
    if (h.flag !== "inactive" || (h.absence !== "season" && h.absence !== "year")) continue;
    const set = reserveWeeks.get(h.key) ?? new Set<number>();
    set.add(h.week);
    reserveWeeks.set(h.key, set);
  }
  const returnWeek = (p: Pick<Player, "key" | "team">, week: number): number | null => {
    const played = gameWeeks.get(p.team) ?? [];
    const onList = reserveWeeks.get(p.key);
    let since = week;
    for (let w = week - 1; w >= 1; w--) {
      if (onList?.has(w)) since = w;
      else if (played.includes(w)) break;
    }
    return played.filter((w) => w >= since)[GAMES_HELD_OUT] ?? null;
  };
  return (p: Pick<Player, "key" | "team" | "flag" | "absence" | "reason" | "outlook_basis">, week: number) =>
    outTag(p, week, p.absence === "season" ? returnWeek(p, week) : null);
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

/**
 * The average team's money in each week of the history: every dollar field of the
 * whole-roster rows, averaged over the teams with a row that week. Averaging each
 * field (rather than one total) lets a chart sum whichever bands it stacks.
 */
export function leagueHistoryAverage(s: Snapshot): HistoryRow[] {
  const byWeek = new Map<number, HistoryRow[]>();
  for (const r of s.history) {
    if (r.unit !== "all") continue;
    byWeek.set(r.week, [...(byWeek.get(r.week) ?? []), r]);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, rows]) => {
      const sums: Record<string, number> = {};
      for (const r of rows) {
        for (const [k, v] of Object.entries(r)) {
          if (k !== "week" && typeof v === "number") sums[k] = (sums[k] ?? 0) + v;
        }
      }
      const avg = Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v / rows.length]));
      return { ...avg, week, team: "NFL", unit: "all" } as unknown as HistoryRow;
    });
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

/** A game as a card shows it: plain data, with the money edge from today's rosters. */
export function cardGame(s: Snapshot, g: Game): CardGame {
  const nick = (abbr: string) => s.teams.find((t) => t.team === abbr)?.nick ?? abbr;
  const final = g.away_score !== null && g.home_score !== null;
  const [edge] = biggestEdges(gameEdges(s, g.away_team, g.home_team));
  const side = (abbr: string, score: number | null): CardSide => ({ abbr, score });
  return {
    id: g.game_id,
    href: matchupHref(g),
    when: final ? "Final" : kickoffLabel(g),
    final,
    away: side(g.away_team, g.away_score),
    home: side(g.home_team, g.home_score),
    edge: edge ? { short: edgeShort(edge, (a) => a), title: edgeShort(edge, nick) } : null,
  };
}

/** Name and colors for every team, for game cards. */
export function cardTeams(s: Snapshot): CardTeams {
  return Object.fromEntries(s.teams.map((t) => [t.team, { nick: t.nick, vars: teamVars(t) }]));
}

/** Every week of the schedule, each with its games as cards and its byes. */
export function weekSlates(s: Snapshot): WeekSlate[] {
  const weeks = [...new Set(s.games.map((g) => g.week))].sort((a, b) => a - b);
  return weeks.map((week) => {
    const games = weekGames(s, week);
    const playing = new Set(games.flatMap((g) => [g.away_team, g.home_team]));
    const days = games.map((g) => g.gameday).sort();
    return {
      week,
      firstDay: days[0],
      lastDay: days[days.length - 1],
      games: games.map((g) => cardGame(s, g)),
      byes: s.teams
        .filter((t) => !playing.has(t.team))
        .map((t) => t.nick)
        .sort(),
    };
  });
}
