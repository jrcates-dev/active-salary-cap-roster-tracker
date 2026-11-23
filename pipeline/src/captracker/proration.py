"""How much of a season a player's pay covers, from the weekly rosters.

Salaries are paid in 18 weekly checks, one per week of the regular season, bye
included. A player who joins a team after week 1 is paid, and charged against the cap,
only for the weeks he is on its books: OverTheCap counts a week-8 signing on a
$885K deal at 11/18 of it ($540,833). Most deals in the contracts file already carry
that figure; this module supplies it for the rows the pipeline has to work out itself
(this year's new deals with no cap line, and minimum-salary estimates).
"""

from __future__ import annotations

import polars as pl

REGULAR_SEASON_WEEKS = 18

PRACTICE_SQUAD = "DEV"
RESERVE = "RES"

# Roster statuses on a team's books. A week in any other status (cut, traded,
# retired) ends a stint.
ON_BOOKS = {"ACT", "INA", "RES", "PUP", "NFI", "DEV", "EXE"}

# A practice squad player can be elevated to the game-day roster at most three times
# a season. The weekly roster shows him active (or inactive) those weeks, but he stays
# on his practice squad deal, so up to three such weeks do not end his time on it.
MAX_ELEVATIONS = 3
ELEVATED = {"ACT", "INA"}

STINT_SCHEMA = {
    "gsis_id": pl.String,
    "team": pl.String,
    "stint_start": pl.Int32,
    "roster_start": pl.Int32,
    "reserve_start": pl.Int32,
    "squad_start": pl.Int32,
}


def weeks_paid(start: pl.Expr) -> pl.Expr:
    """Weeks from `start` to the end of the regular season, 18 when unknown."""
    return (
        (REGULAR_SEASON_WEEKS - start.fill_null(1) + 1).clip(0, REGULAR_SEASON_WEEKS).cast(pl.Int64)
    )


def prorate(amount: pl.Expr, start: pl.Expr) -> pl.Expr:
    """`amount` (a full season's pay) for the weeks from `start` on."""
    return (amount * weeks_paid(start) / REGULAR_SEASON_WEEKS).round(0).cast(pl.Int64)


def _trailing_run(
    weeks: list[int], statuses: list[str], match, *, allowance: int = 0, tolerate=None
):
    """First week of the run at the end of `weeks` whose status `match`es.

    Up to `allowance` weeks in all whose status does not match but is `tolerate`d may
    sit inside the run (or at its end) without ending it. Null when the run is empty.
    """
    start = None
    spent = 0
    pending: list[int] = []
    for w, st in zip(reversed(weeks), reversed(statuses), strict=True):
        if match(st):
            start = w
            spent += len(pending)
            pending = []
        else:
            pending.append(w)
            if tolerate is None or not tolerate(st) or spent + len(pending) > allowance:
                break
    return start


def stints(rows: pl.DataFrame, week: int, *, status_col: str = "roster_status") -> pl.DataFrame:
    """For each player and team at or before `week`, where his current stint began.

    `rows` holds one row per player, team and week (`gsis_id`, `team`, `week` and a
    roster status). A stint is the player's unbroken run on the team's books up to his
    latest week there: a week the team played without him (or with him cut) ends it,
    a bye does not.

    - `stint_start`: the first week of that run, on the practice squad or off it.
    - `roster_start`: the first week of the run's last stretch off the practice squad
      (on the 53, a reserve list or the exempt list); null while he is on the squad.
      A promoted player's standard contract starts here.
    - `reserve_start`: the first week of the run's last stretch on a reserve list
      (`RES`); null unless he is on one now.
    - `squad_start`: the first week of the run's last stretch on the practice squad,
      allowing for up to three elevations; null if he is not on his squad deal now.
    """
    df = rows.filter((pl.col("week") <= week) & pl.col("gsis_id").is_not_null()).select(
        "gsis_id", "team", "week", pl.col(status_col).alias("_status")
    )
    if df.is_empty():
        return pl.DataFrame(schema=STINT_SCHEMA)
    team_weeks: dict[str, list[int]] = {
        t: sorted(ws) for t, ws in df.group_by("team").agg(pl.col("week").unique()).iter_rows()
    }
    df = df.filter(pl.col("_status").is_in(list(ON_BOOKS))).unique(
        subset=["gsis_id", "team", "week"], keep="last"
    )
    out: list[dict] = []
    grouped = (
        df.sort("week").group_by("gsis_id", "team", maintain_order=True).agg("week", "_status")
    )
    for gsis_id, team, weeks, statuses in grouped.iter_rows():
        by_week = dict(zip(weeks, statuses, strict=True))
        played = [w for w in team_weeks[team] if w <= weeks[-1]]
        run: list[int] = []
        for w in reversed(played):
            if w not in by_week:
                break
            run.insert(0, w)
        run_status = [by_week[w] for w in run]
        off_squad = _trailing_run(run, run_status, lambda st: st != PRACTICE_SQUAD)
        out.append(
            {
                "gsis_id": gsis_id,
                "team": team,
                "stint_start": run[0],
                "roster_start": off_squad if run_status[-1] != PRACTICE_SQUAD else None,
                "reserve_start": _trailing_run(run, run_status, lambda st: st == RESERVE)
                if run_status[-1] == RESERVE
                else None,
                "squad_start": _trailing_run(
                    run,
                    run_status,
                    lambda st: st == PRACTICE_SQUAD,
                    allowance=MAX_ELEVATIONS,
                    tolerate=lambda st: st in ELEVATED,
                ),
            }
        )
    return pl.DataFrame(out, schema=STINT_SCHEMA)
