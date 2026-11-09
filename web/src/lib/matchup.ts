import { ordinal } from "./format";
import type { Snapshot } from "./types";

/**
 * Position-group matchups: each offensive group set against the defensive groups it
 * plays against (PLAN.md, "Head-to-head matchup").
 */
export interface Pair {
  key: string;
  label: string;
  off: string[];
  def: string[];
  offLabel: string;
  defLabel: string;
}

export const PAIRS: Pair[] = [
  {
    key: "trenches",
    label: "Line of scrimmage",
    off: ["OL"],
    def: ["IDL", "EDGE"],
    offLabel: "offensive line",
    defLabel: "defensive front",
  },
  {
    key: "coverage",
    label: "Pass catchers vs coverage",
    off: ["WR", "TE"],
    def: ["CB", "S"],
    offLabel: "receivers and tight ends",
    defLabel: "secondary",
  },
  {
    key: "run",
    label: "Backfield vs linebackers",
    off: ["RB"],
    def: ["LB"],
    offLabel: "running backs",
    defLabel: "linebackers",
  },
  {
    key: "passgame",
    label: "Quarterback vs pass defense",
    off: ["QB"],
    def: ["EDGE", "CB", "S"],
    offLabel: "quarterbacks",
    defLabel: "pass rush and secondary",
  },
];

export type MatchupMode = "field" | "full";

export interface GroupMoney {
  total: number;
  active: number;
  questionable: number;
  out: number;
  season: number;
  year: number;
  unknown: number;
  /** Money expected on the field: active plus questionable (counted until ruled out). */
  field: number;
}

export function groupMoney(s: Snapshot, team: string, codes: string[]): GroupMoney {
  const m: GroupMoney = {
    total: 0,
    active: 0,
    questionable: 0,
    out: 0,
    season: 0,
    year: 0,
    unknown: 0,
    field: 0,
  };
  for (const r of s.rollup) {
    if (r.team !== team || r.level !== "group" || !codes.includes(r.position_group)) continue;
    m.total += r.cap_total;
    m.active += r.cap_active;
    m.questionable += r.cap_questionable;
    m.out += r.cap_inactive_week ?? 0;
    m.season += r.cap_inactive_season ?? 0;
    m.year += r.cap_inactive_year ?? 0;
    m.unknown += r.cap_unknown;
  }
  m.field = m.active + m.questionable;
  return m;
}

export function valueOf(m: GroupMoney, mode: MatchupMode): number {
  return mode === "field" ? m.field : m.total;
}

const rankCache = new WeakMap<Snapshot, Map<string, Record<string, number>>>();

/** Rank (1 = most) of each team's money in a group set, across the league. */
export function leagueRanks(s: Snapshot, codes: string[], mode: MatchupMode): Record<string, number> {
  const key = `${mode}:${codes.join("+")}`;
  let cache = rankCache.get(s);
  if (!cache) rankCache.set(s, (cache = new Map()));
  const hit = cache.get(key);
  if (hit) return hit;
  const vals = s.teams.map((t) => ({ team: t.team, v: valueOf(groupMoney(s, t.team, codes), mode) }));
  vals.sort((a, b) => b.v - a.v);
  const out = Object.fromEntries(vals.map((x, i) => [x.team, i + 1]));
  cache.set(key, out);
  return out;
}

export interface Edge {
  pair: Pair;
  offTeam: string;
  defTeam: string;
  off: GroupMoney;
  def: GroupMoney;
  /** Larger side over smaller side, at least 1. */
  ratio: number;
  /** League rank (1 = most money) of each side's group set, same measure. */
  offRank: number;
  defRank: number;
  /** The side ranked higher in the league for its own group set. */
  favors: "off" | "def";
}

/** Both halves of a game: away offense vs home defense, then home offense vs away defense. */
export function gameEdges(s: Snapshot, away: string, home: string, mode: MatchupMode = "field"): Edge[] {
  const out: Edge[] = [];
  for (const [offTeam, defTeam] of [
    [away, home],
    [home, away],
  ]) {
    for (const pair of PAIRS) {
      const off = groupMoney(s, offTeam, pair.off);
      const def = groupMoney(s, defTeam, pair.def);
      const a = valueOf(off, mode);
      const b = valueOf(def, mode);
      const hi = Math.max(a, b);
      const lo = Math.max(Math.min(a, b), 1);
      const offRank = leagueRanks(s, pair.off, mode)[offTeam];
      const defRank = leagueRanks(s, pair.def, mode)[defTeam];
      out.push({
        pair,
        offTeam,
        defTeam,
        off,
        def,
        ratio: hi / lo,
        offRank,
        defRank,
        favors: offRank <= defRank ? "off" : "def",
      });
    }
  }
  return out;
}

/**
 * The most lopsided rows, for the edge summary, measured by the gap in league rank
 * between the two sides. Ranks put a one-group set (running backs) and a two-group
 * set (interior line plus edge) on the same footing, which raw dollar ratios do not.
 * The quarterback row compares one player with three groups, so it is left out.
 */
export function biggestEdges(edges: Edge[], n = 2): Edge[] {
  const gap = (e: Edge) => Math.abs(e.offRank - e.defRank);
  return edges
    .filter((e) => e.pair.key !== "passgame")
    .sort((a, b) => gap(b) - gap(a) || b.ratio - a.ratio)
    .slice(0, n);
}

/** The winning and losing side of an edge. */
export function edgeSides(e: Edge) {
  return e.favors === "off"
    ? { win: e.offTeam, winLabel: e.pair.offLabel, winRank: e.offRank, winMoney: e.off, lose: e.defTeam, loseLabel: e.pair.defLabel, loseRank: e.defRank, loseMoney: e.def }
    : { win: e.defTeam, winLabel: e.pair.defLabel, winRank: e.defRank, winMoney: e.def, lose: e.offTeam, loseLabel: e.pair.offLabel, loseRank: e.offRank, loseMoney: e.off };
}

/** "Patriots defensive front (6th) vs Packers offensive line (28th)" */
export function edgeText(e: Edge, nick: (team: string) => string): string {
  const x = edgeSides(e);
  return `${nick(x.win)} ${x.winLabel} (${ordinal(x.winRank)}) vs ${nick(x.lose)} ${x.loseLabel} (${ordinal(x.loseRank)})`;
}
