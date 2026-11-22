/** Shapes of web/data/snapshot.json, written by `captracker export`. */

export type Unit = "offense" | "defense" | "special_teams";
export type Flag = "active" | "inactive" | "questionable" | "unknown";
/**
 * Why an inactive player is out: this game only (`week`), a reserve list he can come
 * back from this season (`season`: IR, PUP, NFI, suspension), or a reserve list he is
 * done for the year on (`year`). The site draws `week` and `season` as one "Out" band
 * and tells them apart with a tag on each player (`out_tag`).
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

/**
 * One season of a contract from this one on. `counted` seasons make up the per-year
 * average; a `token` season is a placeholder year at the end of a deal (listed, not
 * averaged); a `void` season pays nothing and only carries bonus proration.
 */
export interface MoneyYear {
  season: number;
  cap: number;
  cash: number;
  gtd: boolean;
  kind: "counted" | "token" | "void";
}

export interface Player {
  team: string;
  key: string;
  name: string;
  /** From the nflverse players file. Older snapshots lack it. */
  birth_date?: string | null;
  /**
   * Age to the tenth of a year on the day the data was pulled, rounded down the way
   * ages are (`ageOn`). Filled in when the snapshot is read (data.ts), not by the pipeline.
   */
  age?: number | null;
  pos: string | null;
  group: string | null;
  unit: Unit | null;
  cap: number;
  contract_cap: number;
  source: CapSource;
  flag: Flag;
  reason: string | null;
  /**
   * "gameday" when a team's posted gameday inactive list (ESPN, unofficial) settled his
   * flag before the game. Older snapshots lack it.
   */
  flag_source?: "gameday" | null;
  absence: Absence | null;
  outlook_basis?: OutlookBasis | null;
  /** The injury note from the out-for-season table, when it decided. */
  outlook_note?: string | null;
  roster_status: string | null;
  report_status: string | null;
  injury: string | null;
  years_left: number | null;
  contract_apy: number | null;
  /**
   * What he is paid a season from here on: the average cash of this season and the
   * rest of the deal ("cash"), or the contract's APY when the data has no
   * year-by-year breakdown, as for most new rookie deals ("apy"). Null for practice
   * squad players and estimated minimum rows. Older snapshots lack these fields.
   */
  per_year?: number | null;
  per_year_basis?: "cash" | "apy" | null;
  /** Last season of the deal he is paid for. */
  deal_thru?: number | null;
  /** Last season after this one with guaranteed salary; null when none is. */
  gtd_thru?: number | null;
  /** Dead cap if released after this season: bonus proration to come plus guaranteed salary owed. */
  dead_if_cut?: number | null;
  /** This season and every later one, with what kind of season it is. */
  money_years?: MoneyYear[] | null;
  year_signed?: number | null;
  contract_years?: number | null;
  contract_value?: number | null;
  contract_guaranteed?: number | null;
  headshot: string | null;
  /**
   * A starter on the team's depth chart (top of a slot: the 11 on offense, the base
   * defense plus the nickel, K, P and LS). A player who is out carries the role he had
   * before he went out. Null when the chart does not list him; older snapshots lack it.
   */
  starter?: boolean | null;
  /** His main spot on the chart with its rank: "LT1", "QB2", "WR4". */
  depth_role?: string | null;
  /**
   * Why he is out, in a few words ("Inactive this week", "IR, eligible week 12").
   * Filled in when the snapshot is read (data.ts), not by the pipeline.
   */
  out_tag?: string | null;
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
  | "birth_date"
  | "age"
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
  | "out_tag"
> & { week: number };

/** Which games' gameday inactive lists are in (ESPN, unofficial), per team. */
export interface Gameday {
  checked_at: string;
  source: string;
  games: { game_id: string; fetched_at: string; posted: Record<string, boolean> }[];
}

export interface Freshness {
  schedule_week: number;
  roster_week: number | null;
  injury_week: number | null;
  reference_as_of: string | null;
}

/** One dead money charge on a team's cap this season (hand-entered from OverTheCap). */
export interface DeadCharge {
  team: string;
  name: string;
  /** OverTheCap's position code (ED, LT, ...), when known. */
  pos: string | null;
  amount: number;
}

/**
 * One season of a player's contract, from OverTheCap's ledger in the nflverse file.
 * `past` seasons are paid out; from this season on, `counted` seasons are paid,
 * a `token` season is a placeholder at the end of the deal, and a `void` season pays
 * nothing and only carries bonus proration landing there. Bonuses a season does not
 * have are left out (read them as 0).
 */
export interface ContractYear {
  season: number;
  /** The team carrying the cap charge that season. */
  team: string | null;
  base: number;
  /** Signing and restructure bonus proration. A void season's whole cap number. */
  prorated: number;
  /** Option bonus proration. */
  option?: number;
  roster?: number;
  workout?: number;
  per_game?: number;
  other?: number;
  /** Salary guaranteed that season. */
  gtd: number;
  cap: number;
  /** Share of that season's cap, when the cap is set (this season and earlier). */
  cap_pct?: number;
  cash: number;
  kind: "past" | "counted" | "token" | "void";
  /** Released before June 1 of that league year: dead money and cap savings. Future paid seasons only. */
  dead_cut?: number;
  savings_cut?: number;
}

/** What releasing or trading him at the start of next league year would cost. */
export interface ContractRelease {
  season: number;
  cap: number;
  cut: { dead: number; savings: number };
  june1: { dead: number; dead_next: number; savings: number };
  trade: { dead: number; savings: number };
}

/** One deal from the player's contract history. */
export interface CareerContract {
  team: string | null;
  /** OverTheCap's label: Drafted, UFA, Extension, SFA, Practice, Franchise, ... */
  type: string | null;
  /** Active, Expired, Extended, Terminated, Traded, ... */
  status: string | null;
  signed: number;
  years: number | null;
  value: number;
  apy: number;
  guaranteed: number;
  earned: number | null;
  pct_earned: number | null;
}

export interface ContractDeal {
  type: string | null;
  /** The team that signed him to it. */
  team: string | null;
  signed: number | null;
  years: number | null;
  value: number | null;
  apy: number | null;
  /** APY as a share of the cap the year it was signed. */
  apy_cap_pct: number | null;
  /** Total guarantees at signing, as OverTheCap reports them (full and injury). */
  guaranteed: number | null;
  /** Worked out by the pipeline (contract_detail.signing_bonus); null when it could not be. */
  signing_bonus: number | null;
  /** The last season he is paid for. */
  last_season: number | null;
  /** Paid on this deal through last season, and that share of its value. */
  earned: number | null;
  pct_earned: number | null;
}

export interface ContractBio {
  birth_date: string | null;
  /** Inches. */
  height: number | null;
  weight: number | null;
  college: string | null;
  jersey: string | null;
  experience: number | null;
  draft_year: number | null;
  draft_round: number | null;
  draft_pick: number | null;
  draft_team: string | null;
}

/**
 * A player's contract as the contract view shows it. `basis`: the full ledger
 * (`contract`), a deal signed this season the free data has not broken down yet
 * (`rookie_scale`: terms only), or no contract in the free data (`minimum`).
 */
export interface ContractRecord {
  key: string;
  team: string;
  basis: "contract" | "rookie_scale" | "minimum";
  otc_url: string | null;
  bio: ContractBio;
  deal: ContractDeal | null;
  years: ContractYear[];
  release: ContractRelease | null;
  history: CareerContract[];
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
  /** Each team's dead money, charge by charge. Older snapshots lack it. */
  dead_charges: DeadCharge[];
  /** Every counted player's contract, for the contract view. Older snapshots lack it. */
  contracts: ContractRecord[];
  /** Gameday inactive lists read so far this week; null when none. Older snapshots lack it. */
  gameday: Gameday | null;
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
