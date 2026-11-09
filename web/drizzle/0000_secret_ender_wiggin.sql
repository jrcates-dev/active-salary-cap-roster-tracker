CREATE TABLE "contract_years" (
	"season" integer NOT NULL,
	"team" text NOT NULL,
	"gsis_id" text,
	"otc_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"contract_position" text,
	"contract_team_label" text,
	"player_page" text,
	"year_signed" integer,
	"contract_years" integer,
	"contract_value" bigint,
	"contract_apy" bigint,
	"contract_guaranteed" bigint,
	"apy_cap_pct" double precision,
	"base_salary" bigint NOT NULL,
	"prorated_bonus" bigint NOT NULL,
	"option_bonus" bigint NOT NULL,
	"roster_bonus" bigint NOT NULL,
	"workout_bonus" bigint NOT NULL,
	"per_game_roster_bonus" bigint NOT NULL,
	"other_bonus" bigint NOT NULL,
	"guaranteed_salary" bigint NOT NULL,
	"cash_paid" bigint NOT NULL,
	"cap_number" bigint NOT NULL,
	"cap_pct" double precision,
	CONSTRAINT "contract_years_season_team_otc_id_pk" PRIMARY KEY("season","team","otc_id")
);
--> statement-breakpoint
CREATE TABLE "player_week_cap" (
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"team" text NOT NULL,
	"gsis_id" text,
	"otc_id" integer NOT NULL,
	"player_name" text NOT NULL,
	"contract_position" text,
	"contract_team_label" text,
	"player_page" text,
	"year_signed" integer,
	"contract_years" integer,
	"contract_value" bigint,
	"contract_apy" bigint,
	"contract_guaranteed" bigint,
	"apy_cap_pct" double precision,
	"base_salary" bigint NOT NULL,
	"prorated_bonus" bigint NOT NULL,
	"option_bonus" bigint NOT NULL,
	"roster_bonus" bigint NOT NULL,
	"workout_bonus" bigint NOT NULL,
	"per_game_roster_bonus" bigint NOT NULL,
	"other_bonus" bigint NOT NULL,
	"guaranteed_salary" bigint NOT NULL,
	"cash_paid" bigint NOT NULL,
	"cap_number" bigint NOT NULL,
	"cap_pct" double precision,
	"players_position" text,
	"name" text,
	"espn_id" integer,
	"headshot" text,
	"position_group" text,
	"unit" text,
	"roster_team" text,
	"roster_status" text,
	"report_status" text,
	"practice_status" text,
	"injury" text,
	"gameday_flag" text NOT NULL,
	"inactive_reason" text,
	CONSTRAINT "player_week_cap_season_week_team_otc_id_pk" PRIMARY KEY("season","week","team","otc_id")
);
--> statement-breakpoint
CREATE TABLE "player_week_status" (
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"team" text NOT NULL,
	"gsis_id" text NOT NULL,
	"player_name" text,
	"roster_position" text,
	"depth_chart_position" text,
	"roster_status" text,
	"roster_status_detail" text,
	"injury_position" text,
	"report_status" text,
	"practice_status" text,
	"injury" text,
	"gameday_flag" text NOT NULL,
	"inactive_reason" text,
	CONSTRAINT "player_week_status_season_week_gsis_id_pk" PRIMARY KEY("season","week","gsis_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"gsis_id" text PRIMARY KEY NOT NULL,
	"otc_id" integer,
	"espn_id" integer,
	"pfr_id" text,
	"pff_id" integer,
	"esb_id" text,
	"smart_id" text,
	"nfl_id" integer,
	"name" text NOT NULL,
	"players_position" text,
	"players_position_group" text,
	"latest_team" text,
	"players_status" text,
	"headshot" text,
	"birth_date" date,
	"rookie_season" integer,
	"draft_year" integer,
	"draft_round" integer,
	"draft_pick" integer
);
--> statement-breakpoint
CREATE TABLE "position_groups" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"unit" text NOT NULL,
	"display_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rollup" (
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"team" text NOT NULL,
	"level" text NOT NULL,
	"unit" text NOT NULL,
	"position_group" text NOT NULL,
	"cap_total" bigint NOT NULL,
	"players" integer NOT NULL,
	"cap_active" bigint NOT NULL,
	"cap_inactive" bigint NOT NULL,
	"cap_questionable" bigint NOT NULL,
	"cap_unknown" bigint NOT NULL,
	"group_order" integer NOT NULL,
	CONSTRAINT "rollup_season_week_team_level_unit_position_group_pk" PRIMARY KEY("season","week","team","level","unit","position_group")
);
--> statement-breakpoint
CREATE TABLE "source_pulls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "source_pulls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source" text NOT NULL,
	"season" integer,
	"week" integer,
	"pulled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean NOT NULL,
	"rows" integer,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "team_cap_reference" (
	"season" integer NOT NULL,
	"team" text NOT NULL,
	"cap_space" bigint NOT NULL,
	"active_cap_spending" bigint NOT NULL,
	"dead_money" bigint NOT NULL,
	"players" integer,
	"source" text,
	"as_of" date,
	CONSTRAINT "team_cap_reference_season_team_pk" PRIMARY KEY("season","team")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"team" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"nick" text NOT NULL,
	"conference" text NOT NULL,
	"division" text NOT NULL,
	"color_primary" text NOT NULL,
	"color_secondary" text,
	"color_3" text,
	"color_4" text,
	"logo_url" text,
	"wordmark_url" text
);
