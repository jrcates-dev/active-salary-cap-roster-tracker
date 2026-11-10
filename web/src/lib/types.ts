/** Shapes of web/data/snapshot.json, written by `captracker export`. */

export type Unit = "offense" | "defense" | "special_teams";
export type Flag = "active" | "inactive" | "questionable" | "unknown";
/**
 * Why an inactive player is out: this game only (`week`), a reserve list he can come
 * back from this season (`season`: IR, PUP, NFI, suspension), or a reserve list he is
 * done for the year on (`year`).
 */
export type Absence = "week" | "season" | "year";
/** What decided `season` vs `year`: the hand-kept table, or a roster code. */
export type OutlookBasis = "table" | "designated_for_return" | "return_window_closed";
/** Where a team's statuses for the week come from. */
export type StatusSource = "final" | "injury_report" | "no_report" | "bye";
export type CapSource = "contract" | "derived_rookie_scale" | "estimate_minimum";

export interface Group {
  code: string;
  label: string;
  unit: Unit;
  order: number;
}

export interface Team {
  team: string;
  name: string;
  nick: string;
  conference: string;
  division: string;
  color_primary: string;
  color_secondary: string | null;
  color_3: string | null;
  color_4: string | null;
  logo_url: string | null;
  wordmark_url: string | null;
}

export interface TeamSummary {
  team: string;
  cap_total: number;
  players: number;
  cap_active: number;
  cap_inactive: number;
  cap_questionable: number;
  cap_unknown: number;
  cap_inactive_week: number;
  cap_inactive_season: number;
  /** Reserve-list money done for the year. Older snapshots lack it. */
  cap_inactive_year?: number;
  players_estimated: number;
  cap_estimated: number;
  players_rookie_derived: number;
  cap_rookie_derived: number;
  cap_off_roster: number;
  status_week: number;
  on_bye: boolean;
  status_source: StatusSource | null;
  dead_money: number | null;
  cap_space: number | null;
  ref_active_cap: number | null;
  reference_as_of: string | null;
  adjusted_cap: number | null;
}

export interface RollupRow {
  team: string;
  level: "team" | "unit" | "group";
  unit: Unit | "all";
  position_group: string;
  cap_total: number;
  players: number;
  cap_active: number;
  cap_inactive: number;
  cap_questionable: number;
  cap_unknown: number;
  cap_inactive_week: number;
  cap_inactive_season: number;
  /** Reserve-list money done for the year. Older snapshots lack it. */
  cap_inactive_year?: number;
}

export interface Player {
  team: string;
  key: string;
  name: string;
  pos: string | null;
  group: string | null;
  unit: Unit | null;
  cap: number;
  contract_cap: number;
  source: CapSource;
  flag: Flag;
  reason: string | null;
  absence: Absence | null;
  outlook_basis?: OutlookBasis | null;
  /** The injury note from the out-for-season table, when it decided. */
  outlook_note?: string | null;
  roster_status: string | null;
  report_status: string | null;
  injury: string | null;
  years_left: number | null;
  contract_apy: number | null;
  headshot: string | null;
  /**
   * A starter on the team's depth chart (top of a slot: the 11 on offense, the base
   * defense plus the nickel, K, P and LS). A player who is out carries the role he had
   * before he went out. Null when the chart does not list him; older snapshots lack it.
   */
  starter?: boolean | null;
  /** His main spot on the chart with its rank: "LT1", "QB2", "WR4". */
  depth_role?: string | null;
}

export interface Game {
  game_id: string;
  week: number;
  gameday: string;
  gametime: string | null;
  away_team: string;
  home_team: string;
  away_score: number | null;
  home_score: number | null;
}

export interface ReconcileTeam {
  team: string;
  nflverse_total: number;
  otc_active: number;
  otc_dead: number;
  diff: number;
  diff_pct: number;
  nflverse_players: number;
  otc_players: number;
  ok: boolean;
  allowance?: number;
  note?: string;
}

/** Team (unit "all") and unit totals for one week of the season. */
export interface HistoryRow {
  week: number;
  team: string;
  unit: Unit | "all";
  cap_total: number;
  cap_active: number;
  cap_questionable: number;
  cap_inactive_week: number;
  cap_inactive_season: number;
  /** Reserve-list money done for the year. Older snapshots lack it. */
  cap_inactive_year?: number;
  cap_unknown: number;
}

/**
 * A player who was out or questionable in an earlier week, as that week saw him.
 * The players behind one week's bar in "Money out by week".
 */
export type HistoryPlayer = Pick<
  Player,
  | "team"
  | "key"
  | "name"
  | "pos"
  | "group"
  | "unit"
  | "cap"
  | "flag"
  | "reason"
  | "absence"
  | "outlook_basis"
  | "outlook_note"
  | "report_status"
  | "injury"
  | "starter"
  | "depth_role"
> & { week: number };

export interface Freshness {
  schedule_week: number;
  roster_week: number | null;
  injury_week: number | null;
  reference_as_of: string | null;
}

export interface Snapshot {
  season: number;
  week: number;
  generated_at: string;
  fixture: boolean;
  groups: Group[];
  teams: Team[];
  summary: TeamSummary[];
  rollup: RollupRow[];
  players: Player[];
  games: Game[];
  freshness: Freshness | null;
  history: HistoryRow[];
  /** Who was out or questionable in each earlier week. Older snapshots lack it. */
  history_players: HistoryPlayer[];
  reconcile: {
    season: number;
    tolerance: number;
    reference_as_of: string;
    passed: boolean;
    teams_checked: number;
    teams_failing: number;
    teams: ReconcileTeam[];
  } | null;
}
