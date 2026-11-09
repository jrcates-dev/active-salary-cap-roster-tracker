# Phase 0 findings: the day-one data check

> **Update, same day (follow-up work):** 30 of 32 teams now reconcile within 1%. The
> first diagnosis in section 2 below was incomplete; see
> [section 6](#6-update-closing-the-gap) for what actually closed the gap, the two teams
> still outside the line, and the verified `INA` status.

Date: 2026-11-09. Season: 2026, data through week 9. Source files: the nflverse
`historical_contracts`, `players`, `roster_weekly_2026`, `injuries_2026` releases, the
nflverse `games.csv` and `teams_colors_logos.csv`, plus OverTheCap's public team totals
read once by hand for the reconciliation reference.

## 1. The contracts file carries per-year cap numbers

The question the plan said to settle first is settled: yes. Each contract row in the
nflverse file has a nested `season_history` list with, per season: `base_salary`,
`prorated_bonus`, `option_bonus`, `roster_bonus`, `workout_bonus`,
`per_game_roster_bonus`, `other_bonus`, `guaranteed_salary`, `cash_paid`, `cap_number`
and `cap_percent`. The MVP can show true cap hits, not APY estimates.

| Measure | Value |
| --- | --- |
| Contract rows in the file | 53,624 |
| Active contracts | 2,545 |
| 2026 season rows with a cap number | 2,077 (2,071 after collapsing 6 duplicated contracts) |
| Active contracts with no `gsis_id` | 19 |
| Seasons covered | 2005 to 2042 (future years are void years and extensions) |

Details that matter for the pipeline:

- Dollar figures are in millions as floats. The pipeline stores whole dollars.
- `season_history.team` is the team that carries the cap hit that season, so a traded
  player's 2026 money lands on the right team even when the top-level `team` says
  `NE/PHI`.
- Each `season_history` list ends with a `Total` pseudo-row that must be filtered out.
- Teams are keyed by nickname (`Bengals`), mapped to abbreviations through the nflverse
  teams file.
- Positions are OverTheCap's: `ED` and `IDL` are already split, which makes the 13-group
  mapping clean. Every 2026 contract row mapped to a group with no overrides needed.

## 2. The 1% reconciliation gate fails everywhere, for one explainable reason

Summing 2026 cap numbers per team and comparing with OverTheCap's "Active Cap Spending"
column: all 32 teams come in under OTC, by 2.2% (Broncos) to 20.4% (Dolphins), median
about 5%. Zero teams pass the 1% gate.

The gap is players who are on rosters but missing from the contracts file, not an
accounting difference. For the Patriots, the week 9 roster has 81 players and 63 of them
have a 2026 contract row. The 18 missing are undrafted rookies and fringe veterans on
minimum deals (8 active, 5 practice squad, 3 IR, 2 inactive). At roughly $0.8M to $1.1M
each, 13 of them on the 53/IR explain the Patriots' $13.8M shortfall almost exactly. The
same pattern holds league wide: OTC counts 74 to 85 players per team, the contracts file
55 to 71.

Two consequences:

1. **Position group totals are slightly low for the cheapest players only.** Stars and
   starters are all present, so the shape of every chart is right; the long tail is
   thin. Phase 1 should add an "estimated minimum" row per missing rostered player
   (minimum salary by accrued seasons, labeled as an estimate) and re-test the gate.
   That should bring most teams inside 1%.
2. **Dead money is not in the file at all.** The Dolphins carry $190M of dead money in
   2026 against $114M of active cap, which is why their total looks broken. Team-level
   dead money has to come from the hand-entered reference table (now in
   `pipeline/src/captracker/data/reference/otc_team_totals_2026.csv`, read once from
   the public team page, no scraping). The UI shows it as its own gray slice, as planned.

Full per-team table from the run:

| Team | nflverse 2026 | OTC active | Diff | Diff % |
| --- | ---: | ---: | ---: | ---: |
| ARI | 204,865,069 | 213,428,393 | -8,563,324 | -4.0% |
| ATL | 219,007,933 | 226,598,683 | -7,590,750 | -3.4% |
| BAL | 275,656,417 | 286,601,993 | -10,945,576 | -3.8% |
| BUF | 236,693,639 | 246,005,809 | -9,312,170 | -3.8% |
| CAR | 271,302,253 | 284,669,172 | -13,366,919 | -4.7% |
| CHI | 267,295,229 | 280,799,726 | -13,504,497 | -4.8% |
| CIN | 287,749,587 | 297,061,734 | -9,312,147 | -3.1% |
| CLE | 186,193,116 | 204,580,334 | -18,387,218 | -9.0% |
| DAL | 250,421,065 | 266,121,173 | -15,700,108 | -5.9% |
| DEN | 284,316,111 | 290,655,650 | -6,339,539 | -2.2% |
| DET | 240,746,174 | 254,134,282 | -13,388,108 | -5.3% |
| GB | 250,717,806 | 258,802,372 | -8,084,566 | -3.1% |
| HOU | 213,933,109 | 227,320,884 | -13,387,775 | -5.9% |
| IND | 200,166,124 | 217,562,940 | -17,396,816 | -8.0% |
| JAX | 230,881,847 | 244,041,887 | -13,160,040 | -5.4% |
| KC | 259,112,429 | 284,298,721 | -25,186,292 | -8.9% |
| LA | 285,149,530 | 298,630,147 | -13,480,617 | -4.5% |
| LAC | 255,287,782 | 270,168,444 | -14,880,662 | -5.5% |
| LV | 224,190,135 | 244,864,152 | -20,674,017 | -8.4% |
| MIA | 90,584,564 | 113,776,714 | -23,192,150 | -20.4% |
| MIN | 237,129,521 | 251,585,289 | -14,455,768 | -5.8% |
| NE | 285,725,093 | 299,557,871 | -13,832,778 | -4.6% |
| NO | 175,354,894 | 188,232,359 | -12,877,465 | -6.8% |
| NYG | 222,421,174 | 246,480,833 | -24,059,659 | -9.8% |
| NYJ | 170,497,266 | 196,418,026 | -25,920,760 | -13.2% |
| PHI | 212,647,221 | 222,404,012 | -9,756,791 | -4.4% |
| PIT | 271,508,779 | 287,618,849 | -16,110,070 | -5.6% |
| SEA | 295,193,771 | 303,214,382 | -8,020,611 | -2.6% |
| SF | 246,557,543 | 259,377,542 | -12,819,999 | -4.9% |
| TB | 268,773,637 | 284,346,738 | -15,573,101 | -5.5% |
| TEN | 233,683,304 | 252,536,552 | -18,853,248 | -7.5% |
| WAS | 262,444,598 | 276,800,617 | -14,356,019 | -5.2% |

Until the gap is closed, the daily ingest runs with `--allow-drift`: the report is
printed and attached to the run, but it does not block the snapshot.

## 3. The weekly roster file already carries gameday inactives

The plan assumed no free source had the 90-minute inactive list. The nflverse weekly
roster file has a roster status `INA` on about 170 to 200 players per week, which is
the size of the league-wide inactive list (7 per team), and the names fit: emergency
third quarterbacks and healthy scratches on offensive line depth. In week 9 A.J. Brown
is `INA` for the Patriots while the injury report lists him as Out. This needs a check
against a published inactives list for one week before the site relies on it, but if it
holds, the gameday layer gets official inactives from a supported CC BY 4.0 source
instead of the unofficial ESPN flag. The pipeline already treats `INA` as inactive with
the reason `inactive_list`.

Caveat: the roster file for a week appears after the games, so it is a record of what
happened, not a pre-kickoff signal. The injury report (Out, Doubtful, Questionable) is
the pre-kickoff signal. Both are in the status table with their own fields.

## 4. Jake's example, from the real week 9 snapshot

Patriots wide receivers, week 9:

| Player | Cap hit | Status | Reason |
| --- | ---: | --- | --- |
| Romeo Doubs | $8.6M | Inactive | Injured reserve |
| A.J. Brown | $7.0M | Inactive | Inactive list (Out on the report) |
| Mack Hollins | $5.0M | Questionable | |
| Demario Douglas | $3.7M | Active | |
| Kyle Williams | $1.5M | Active | |
| Efton Chism III | $1.0M | Active | |

$15.6M of the $27.5M the Patriots spend on receivers was inactive, with another $5.0M
questionable. The Packers' secondary the same week: $14.1M of $14.6M at safety active,
and $8.2M of $15.9M at cornerback active with Keisean Nixon ($7.2M) questionable and no
cornerback out. That is exactly the kind of lopsided matchup the site is meant to
surface.

## 5. Other things learned

- The nflverse `players` file has `otc_id` for 9,830 players and `espn_id` for most, so
  the id crosswalk is mostly a join. 2,526 of 2,545 active contracts join to a player
  record by `gsis_id`; the 19 without a `gsis_id` are matched by name in a later phase.
- The weekly roster file lags: on Sunday 2026-11-09 it runs through week 9. The injury
  file also stops at week 9. The daily job runs 30 minutes after nflverse's 07:00 UTC
  update, and the week shown on the site should come from the snapshot, not the calendar.
- Players on another team's roster who still carry cap on their original team (two for
  the Patriots) are kept on the paying team, as cap accounting does.
- Practice squad players (`DEV`) have contract rows in some cases and not others. They
  are flagged `unknown` and excluded from active and inactive, but counted in team
  totals, which matches how OTC's active cap treats them.

## 6. Update: closing the gap

The section 2 diagnosis (minimum-salary players missing from the file) explained only
part of the gap. The bigger piece was the **2026 draft class**: the contracts file
ships this year's rookie deals with an empty `season_history`, so 457 rostered rookies
had no 2026 cap number at all. Four changes closed it:

1. **Rookie scale derivation** (`contracts.derive_first_year`). For active deals signed
   this season with no cap line: rounds 1 to 3 count 8/11 of APY (the rookie signing
   bonus prorates over four years while salary rises, so year one sits below APY);
   later rounds count APY less $210K, floored at the $885K rookie minimum. Rows carry
   `cap_source = "derived_rookie_scale"`. 457 players, $512.7M league wide. A player
   promoted from the practice squad can carry two active deals signed this season; only
   the richest counts.
2. **Minimum-salary estimates** (`estimates.py`) for rostered players with no contract
   row at all: the minimum for their years of experience, prorated from the first week
   they appear. `cap_source = "estimate_minimum"`. 41 players, $8.9M.
3. **Practice squad pay.** `DEV` players count at most $247,500 a season (prorated),
   not their full contract figure, matching how OverTheCap counts them.
4. **Roster rules.** Released, retired and traded players drop out of their old team's
   total; teams on a bye keep their last week's statuses instead of falling out of the
   week.

Result against the same reference (OTC active cap spending, as of 2026-11-09):

| Team | This site | OTC active | Diff % |
| --- | ---: | ---: | ---: |
| BAL | 293,435,135 | 286,601,993 | +2.4% |
| IND | 213,544,019 | 217,562,940 | -1.8% |
| LV | 246,951,487 | 244,864,152 | +0.9% |
| ARI | 214,971,650 | 213,428,393 | +0.7% |
| LA | 300,463,065 | 298,630,147 | +0.6% |
| SF | 260,882,851 | 259,377,542 | +0.6% |
| The other 26 teams | | | under 0.6% either way |

**Still open:** Baltimore and Indianapolis. Both are off by more than a single minimum
contract, so the likely cause is a restructure or release the free contracts file has
not caught up with yet. They are listed on the methodology page. The daily ingest keeps
running with `--allow-drift`, so the snapshot still publishes while those two are
outside the line.

**Dead money** and cap space come from the hand-entered reference table and are stored
per team in the new `team_summary` table, shown as their own gray slice.

**`INA` verified.** The roster file's `INA` status matched the Chiefs' published week 7
inactives list. It is the official gameday inactive list, but it is only written after
the game. The injury report stays the pre-kickoff signal, and the site labels `INA`
players "Gameday inactive".

## What this changes in the plan

- Risk "nflverse contracts file lacks per-year cap numbers": closed.
- Phase 0 gate ("all 32 teams within 1%"): 30 of 32. Baltimore and Indianapolis stay
  open and are disclosed on the methodology page.
- Phase 2 gameday layer: the roster `INA` status is the official inactive list, so the
  ESPN adapter is only needed for a pre-kickoff signal beyond the injury report.
- Dead money: team-level only, from the hand-entered reference table, refreshed by hand
  when the check drifts.
