/**
 * Database schema, owned by Drizzle migrations. This is the contract between
 * pipeline/ (which writes these tables) and the web app (which reads them).
 * Table and column names must match the parquet files the pipeline writes
 * (see pipeline/src/captracker/snapshot.py and load.py).
 *
 * Money columns are whole dollars as bigint.
 */
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const UNITS = ["offense", "defense", "special_teams"] as const;
export type Unit = (typeof UNITS)[number];

export const GAMEDAY_FLAGS = ["active", "inactive", "questionable", "unknown"] as const;
export type GamedayFlag = (typeof GAMEDAY_FLAGS)[number];

/** Where a cap number came from: the contracts file, the rookie scale, or a minimum-salary estimate. */
export const CAP_SOURCES = ["contract", "derived_rookie_scale", "estimate_minimum"] as const;
export type CapSource = (typeof CAP_SOURCES)[number];

export const teams = pgTable("teams", {
  team: text("team").primaryKey(), // nflverse abbreviation, e.g. "NE"
  name: text("name").notNull(),
  nick: text("nick").notNull(),
  conference: text("conference").notNull(),
  division: text("division").notNull(),
  colorPrimary: text("color_primary").notNull(),
  colorSecondary: text("color_secondary"),
  color3: text("color_3"),
  color4: text("color_4"),
  logoUrl: text("logo_url"),
  wordmarkUrl: text("wordmark_url"),
});

export const positionGroups = pgTable("position_groups", {
  code: text("code").primaryKey(), // QB, RB, WR, TE, OL, IDL, EDGE, LB, CB, S, K, P, LS
  label: text("label").notNull(),
  unit: text("unit").$type<Unit>().notNull(),
  displayOrder: integer("display_order").notNull(),
});

export const players = pgTable("players", {
  gsisId: text("gsis_id").primaryKey(),
  otcId: integer("otc_id"),
  espnId: integer("espn_id"),
  pfrId: text("pfr_id"),
  pffId: integer("pff_id"),
  esbId: text("esb_id"),
  smartId: text("smart_id"),
  nflId: integer("nfl_id"),
  name: text("name").notNull(),
  playersPosition: text("players_position"),
  playersPositionGroup: text("players_position_group"),
  latestTeam: text("latest_team"),
  playersStatus: text("players_status"),
  headshot: text("headshot"),
  birthDate: date("birth_date"),
  rookieSeason: integer("rookie_season"),
  draftYear: integer("draft_year"),
  draftRound: integer("draft_round"),
  draftPick: integer("draft_pick"),
});

/** One cap row per player per team per season, exploded from the nflverse contracts file. */
export const contractYears = pgTable(
  "contract_years",
  {
    season: integer("season").notNull(),
    team: text("team").notNull(),
    gsisId: text("gsis_id"),
    otcId: integer("otc_id"),
    playerName: text("player_name").notNull(),
    contractPosition: text("contract_position"),
    contractTeamLabel: text("contract_team_label"),
    playerPage: text("player_page"),
    yearSigned: integer("year_signed"),
    contractYears: integer("contract_years"),
    contractValue: bigint("contract_value", { mode: "number" }),
    contractApy: bigint("contract_apy", { mode: "number" }),
    contractGuaranteed: bigint("contract_guaranteed", { mode: "number" }),
    apyCapPct: doublePrecision("apy_cap_pct"),
    baseSalary: bigint("base_salary", { mode: "number" }).notNull(),
    proratedBonus: bigint("prorated_bonus", { mode: "number" }).notNull(),
    optionBonus: bigint("option_bonus", { mode: "number" }).notNull(),
    rosterBonus: bigint("roster_bonus", { mode: "number" }).notNull(),
    workoutBonus: bigint("workout_bonus", { mode: "number" }).notNull(),
    perGameRosterBonus: bigint("per_game_roster_bonus", { mode: "number" }).notNull(),
    otherBonus: bigint("other_bonus", { mode: "number" }).notNull(),
    guaranteedSalary: bigint("guaranteed_salary", { mode: "number" }).notNull(),
    cashPaid: bigint("cash_paid", { mode: "number" }).notNull(),
    capNumber: bigint("cap_number", { mode: "number" }).notNull(),
    capPct: doublePrecision("cap_pct"),
    capSource: text("cap_source").$type<CapSource>().notNull(),
    /** gsis_id when known, else "otc-<otc_id>". */
    playerKey: text("player_key").notNull(),
  },
  (t) => [primaryKey({ columns: [t.season, t.team, t.playerKey] })],
);

/** One row per player per week: roster status + injury report + the derived gameday flag. */
export const playerWeekStatus = pgTable(
  "player_week_status",
  {
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    team: text("team").notNull(),
    gsisId: text("gsis_id").notNull(),
    playerName: text("player_name"),
    rosterPosition: text("roster_position"),
    depthChartPosition: text("depth_chart_position"),
    rosterStatus: text("roster_status"),
    rosterStatusDetail: text("roster_status_detail"),
    injuryPosition: text("injury_position"),
    reportStatus: text("report_status"),
    practiceStatus: text("practice_status"),
    injury: text("injury"),
    gamedayFlag: text("gameday_flag").$type<GamedayFlag>().notNull(),
    inactiveReason: text("inactive_reason"),
  },
  (t) => [primaryKey({ columns: [t.season, t.week, t.gsisId] })],
);

/** The fact table: a contract year row tagged with one week's status. */
export const playerWeekCap = pgTable(
  "player_week_cap",
  {
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    team: text("team").notNull(),
    gsisId: text("gsis_id"),
    otcId: integer("otc_id"),
    playerName: text("player_name").notNull(),
    contractPosition: text("contract_position"),
    contractTeamLabel: text("contract_team_label"),
    playerPage: text("player_page"),
    yearSigned: integer("year_signed"),
    contractYears: integer("contract_years"),
    contractValue: bigint("contract_value", { mode: "number" }),
    contractApy: bigint("contract_apy", { mode: "number" }),
    contractGuaranteed: bigint("contract_guaranteed", { mode: "number" }),
    apyCapPct: doublePrecision("apy_cap_pct"),
    baseSalary: bigint("base_salary", { mode: "number" }).notNull(),
    proratedBonus: bigint("prorated_bonus", { mode: "number" }).notNull(),
    optionBonus: bigint("option_bonus", { mode: "number" }).notNull(),
    rosterBonus: bigint("roster_bonus", { mode: "number" }).notNull(),
    workoutBonus: bigint("workout_bonus", { mode: "number" }).notNull(),
    perGameRosterBonus: bigint("per_game_roster_bonus", { mode: "number" }).notNull(),
    otherBonus: bigint("other_bonus", { mode: "number" }).notNull(),
    guaranteedSalary: bigint("guaranteed_salary", { mode: "number" }).notNull(),
    cashPaid: bigint("cash_paid", { mode: "number" }).notNull(),
    capNumber: bigint("cap_number", { mode: "number" }).notNull(),
    capPct: doublePrecision("cap_pct"),
    capSource: text("cap_source").$type<CapSource>().notNull(),
    playerKey: text("player_key").notNull(),
    playersPosition: text("players_position"),
    name: text("name"),
    espnId: text("espn_id"),
    headshot: text("headshot"),
    playersStatus: text("players_status"),
    latestTeam: text("latest_team"),
    positionGroup: text("position_group"),
    unit: text("unit").$type<Unit>(),
    rosterTeam: text("roster_team"),
    /** The roster week the status came from: the target week, or the last week before a bye. */
    statusWeek: integer("status_week"),
    rosterStatus: text("roster_status"),
    reportStatus: text("report_status"),
    practiceStatus: text("practice_status"),
    injury: text("injury"),
    gamedayFlag: text("gameday_flag").$type<GamedayFlag | "off_roster">().notNull(),
    inactiveReason: text("inactive_reason"),
    /** False for players released, retired or traded away; they drop out of every total. */
    countsAgainstCap: boolean("counts_against_cap").notNull(),
    /** The contract's cap number before the practice squad cap is applied. */
    contractCapNumber: bigint("contract_cap_number", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.season, t.week, t.team, t.playerKey] })],
);

/**
 * Team / unit / position-group totals for a week. `level` says which; `unit` and
 * `positionGroup` are "all" above the level they apply to, never null.
 */
export const rollup = pgTable(
  "rollup",
  {
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    team: text("team").notNull(),
    level: text("level").$type<"team" | "unit" | "group">().notNull(),
    unit: text("unit").$type<Unit | "all">().notNull(),
    positionGroup: text("position_group").notNull(),
    capTotal: bigint("cap_total", { mode: "number" }).notNull(),
    players: integer("players").notNull(),
    capActive: bigint("cap_active", { mode: "number" }).notNull(),
    capInactive: bigint("cap_inactive", { mode: "number" }).notNull(),
    capQuestionable: bigint("cap_questionable", { mode: "number" }).notNull(),
    capUnknown: bigint("cap_unknown", { mode: "number" }).notNull(),
    groupOrder: integer("group_order").notNull(),
  },
  (t) => [
    primaryKey({
      columns: [t.season, t.week, t.team, t.level, t.unit, t.positionGroup],
    }),
  ],
);

/** One row per team per week: counted cap by availability, estimates, and the published dead money. */
export const teamSummary = pgTable(
  "team_summary",
  {
    season: integer("season").notNull(),
    week: integer("week").notNull(),
    team: text("team").notNull(),
    capTotal: bigint("cap_total", { mode: "number" }).notNull(),
    players: integer("players").notNull(),
    capActive: bigint("cap_active", { mode: "number" }).notNull(),
    capInactive: bigint("cap_inactive", { mode: "number" }).notNull(),
    capQuestionable: bigint("cap_questionable", { mode: "number" }).notNull(),
    capUnknown: bigint("cap_unknown", { mode: "number" }).notNull(),
    playersEstimated: integer("players_estimated").notNull(),
    capEstimated: bigint("cap_estimated", { mode: "number" }).notNull(),
    playersRookieDerived: integer("players_rookie_derived").notNull(),
    capRookieDerived: bigint("cap_rookie_derived", { mode: "number" }).notNull(),
    capOffRoster: bigint("cap_off_roster", { mode: "number" }).notNull(),
    statusWeek: integer("status_week").notNull(),
    onBye: boolean("on_bye").notNull(),
    deadMoney: bigint("dead_money", { mode: "number" }),
    capSpace: bigint("cap_space", { mode: "number" }),
    refActiveCap: bigint("ref_active_cap", { mode: "number" }),
    referenceAsOf: text("reference_as_of"),
    adjustedCap: bigint("adjusted_cap", { mode: "number" }),
  },
  (t) => [primaryKey({ columns: [t.season, t.week, t.team] })],
);

/** Published team-level figures (hand-entered from OverTheCap) used by the reconciliation gate. */
export const teamCapReference = pgTable(
  "team_cap_reference",
  {
    season: integer("season").notNull(),
    team: text("team").notNull(),
    capSpace: bigint("cap_space", { mode: "number" }).notNull(),
    activeCapSpending: bigint("active_cap_spending", { mode: "number" }).notNull(),
    deadMoney: bigint("dead_money", { mode: "number" }).notNull(),
    players: integer("players"),
    source: text("source"),
    asOf: date("as_of"),
  },
  (t) => [primaryKey({ columns: [t.season, t.team] })],
);

/** One row per pipeline run per source, for the status page. */
export const sourcePulls = pgTable("source_pulls", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  source: text("source").notNull(),
  season: integer("season"),
  week: integer("week"),
  pulledAt: timestamp("pulled_at", { withTimezone: true }).notNull().defaultNow(),
  ok: boolean("ok").notNull(),
  rows: integer("rows"),
  note: text("note"),
});
