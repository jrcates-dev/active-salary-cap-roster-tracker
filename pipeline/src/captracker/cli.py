"""Command-line entry point: captracker <command> [--season N] [--week N]."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import polars as pl

from . import (
    contracts,
    crosswalk,
    depth,
    estimates,
    health,
    reconcile,
    rollup,
    rosters,
    snapshot,
    sources,
    summary,
    teams,
)
from .config import DEFAULT_SEASON, OUT_DIR, WEB_DATA, WEB_PUBLIC

log = logging.getLogger("captracker")


def cmd_fetch(args: argparse.Namespace) -> int:
    paths = sources.fetch_all(args.season, force=args.force)
    for name, path in paths.items():
        print(f"{name:<16} {path}")
    return 0


def cmd_check_contracts(args: argparse.Namespace) -> int:
    df = sources.read("contracts")
    info = contracts.describe_cap_fields(df, args.season)
    print(json.dumps(info, indent=2))
    return 0 if info["has_per_year_cap_number"] else 1


def _shared_frames(season: int, week: int | None) -> dict:
    """Everything that does not depend on the week being rolled up."""
    games = sources.read("games")
    wk = week or rosters.current_week(games, season)
    roster_raw = sources.read("rosters_weekly", season)
    injuries = sources.read("injuries", season)
    cy = contracts.load_contract_years(season)
    cy = crosswalk.fill_gsis_by_name(cy, roster_raw)
    status = rosters.player_week_status(
        roster_raw,
        injuries,
        season,
        games=games,
        through_week=wk,
        outlook=rosters.load_season_outlook(season),
    )
    return {
        "season": season,
        "week": wk,
        "games": games,
        "teams": teams.load_teams(),
        "players": sources.read("players"),
        "roster_raw": roster_raw,
        "injuries": injuries,
        "contract_years_base": cy,
        "status": status,
        "depth_chart": depth.load_chart(season),
    }


def _week_frames(shared: dict, week: int) -> dict:
    """Contract rows, fact table and rollup for one week."""
    season = shared["season"]
    est = estimates.estimate_missing(
        shared["contract_years_base"], shared["roster_raw"], season, week
    )
    cy = contracts.with_player_key(pl.concat([shared["contract_years_base"], est]))
    cw = crosswalk.build_crosswalk(shared["players"], cy)
    grouped = rollup.assign_groups(cy, cw)
    fact = rollup.player_week_cap(grouped, shared["status"], week)
    return {"contract_years": cy, "crosswalk": cw, "fact": fact, "rollup": rollup.rollup(fact)}


def team_week_info(shared: dict, week: int) -> pl.DataFrame:
    """Per team for one week: plays?, game final?, injury report out?, roster projected?"""
    season = shared["season"]
    all_teams = shared["teams"].select("team")
    tg = (
        rosters.team_games(shared["games"], season)
        .filter(pl.col("week") == week)
        .select("team", "opponent", "game_final", pl.lit(True).alias("has_game"))
        .unique("team")
    )
    inj = shared["injuries"]
    reported = (
        inj.filter(
            (pl.col("season") == season) & (pl.col("game_type") == "REG") & (pl.col("week") == week)
        )
        .select(pl.col("team").replace(teams.LEGACY_ABBR))
        .unique()
        .with_columns(pl.lit(True).alias("has_report"))
    )
    projected = (
        shared["status"]
        .filter(pl.col("week") == week)
        .group_by("team")
        .agg(pl.col("projected").any())
    )
    return (
        all_teams.join(tg, on="team", how="left")
        .join(reported, on="team", how="left")
        .join(projected, on="team", how="left")
        .with_columns(
            pl.col("has_game").fill_null(False),
            pl.col("game_final").fill_null(False),
            pl.col("has_report").fill_null(False),
            pl.col("projected").fill_null(False),
        )
    )


def _build_frames(season: int, week: int | None) -> dict:
    shared = _shared_frames(season, week)
    wk = shared["week"]
    w = _week_frames(shared, wk)
    try:
        ref = reconcile.load_reference(season)
    except FileNotFoundError:
        ref = None
    tw = team_week_info(shared, wk)
    return {
        **shared,
        **w,
        "reference": ref,
        "team_week": tw,
        "team_summary": summary.team_summary(
            w["rollup"], w["fact"], ref, rollup.team_status_weeks(shared["status"], wk), tw
        ),
        "position_groups": rollup.position_groups_table(),
    }


def _reconcile(f: dict) -> reconcile.ReconcileReport | None:
    if f["reference"] is None:
        return None
    return reconcile.reconcile(
        _team_totals(f["rollup"]),
        f["reference"],
        f["season"],
        known_gaps=reconcile.load_known_gaps(f["season"]),
    )


def _history(f: dict) -> tuple[list[dict], list[dict]]:
    """Every week of the season up to the current one: team and unit totals, and the
    players who were out or questionable in each earlier week.

    Past weeks are rebuilt from the nflverse files, which keep every week's roster and
    injury report, so nothing has to be stored between runs and each daily run adds
    the week just played. Cap numbers are today's. The current week's players are
    already in the snapshot's `players`, so they are not repeated here.
    """
    from . import export

    rows: list[pl.DataFrame] = []
    out_players: list[dict] = []
    for week in range(1, f["week"] + 1):
        if week == f["week"]:
            roll = f["rollup"]
        else:
            w = _week_frames(f, week)
            roll = w["rollup"]
            roles = depth.roles_for(f["depth_chart"], f["status"], f["games"], f["season"], week)
            out_players.extend(export.week_out_players(w["fact"], f["season"], roles))
        rows.append(roll.filter(pl.col("level").is_in(["team", "unit"])))
    if not rows:
        return [], []
    totals = (
        pl.concat(rows)
        .select(
            "week",
            "team",
            "unit",
            "cap_total",
            "cap_active",
            "cap_questionable",
            "cap_inactive_week",
            "cap_inactive_season",
            "cap_inactive_year",
            "cap_unknown",
        )
        .sort(["week", "team", "unit"])
        .to_dicts()
    )
    return totals, out_players


def _team_totals(roll: pl.DataFrame) -> pl.DataFrame:
    return roll.filter(pl.col("level") == "team").select("team", "cap_total", "players")


def cmd_build(args: argparse.Namespace) -> int:
    f = _build_frames(args.season, args.week)
    report = None
    rep = _reconcile(f)
    if rep is not None:
        report = rep.to_dict()
        print(reconcile.format_report(rep))
    else:
        log.warning("no OTC reference for %s; skipping reconciliation", args.season)
    out = snapshot.write_snapshot(
        f["season"],
        f["week"],
        teams=f["teams"],
        position_groups=f["position_groups"],
        crosswalk=f["crosswalk"],
        contract_years=f["contract_years"],
        player_week_status=f["status"],
        fact=f["fact"],
        rollup=f["rollup"],
        team_summary=f["team_summary"],
        reconcile_report=report,
    )
    print(f"snapshot written to {out}")
    if report and not report["passed"] and not args.allow_drift:
        print("reconciliation failed; pass --allow-drift to write anyway", file=sys.stderr)
        return 2
    return 0


def _max_week(df: pl.DataFrame, season: int) -> int | None:
    reg = df.filter((pl.col("season") == season) & (pl.col("game_type") == "REG"))
    return None if reg.is_empty() else int(reg["week"].max())


def cmd_export(args: argparse.Namespace) -> int:
    from . import export

    f = _build_frames(args.season, args.week)
    rep = _reconcile(f)
    report = rep.to_dict() if rep is not None else None
    history, history_players = ([], []) if args.fixture else _history(f)
    freshness = {
        "schedule_week": f["week"],
        "roster_week": _max_week(f["roster_raw"], f["season"]),
        "injury_week": _max_week(f["injuries"], f["season"]),
        "reference_as_of": report["reference_as_of"] if report else None,
    }
    data = export.build_export(
        season=f["season"],
        week=f["week"],
        teams=f["teams"],
        team_summary=f["team_summary"],
        rollup=f["rollup"],
        fact=f["fact"],
        games=f["games"],
        reconcile_report=report,
        freshness=freshness,
        history=history,
        history_players=history_players,
        depth_roles=depth.roles_for(
            f["depth_chart"], f["status"], f["games"], f["season"], f["week"]
        ),
        dead_charges=reconcile.load_dead_charges(f["season"]),
    )
    out = Path(args.out)
    if args.fixture:
        data = export.build_fixture(data)
    export.write_export(data, out)
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB, {len(data['players'])} players)")
    if args.fixture:
        return 0

    totals = health.team_totals(data)
    previous = health.read_totals(Path(args.previous_totals)) if args.previous_totals else None
    issues = health.evaluate(
        week=f["week"],
        freshness=freshness,
        reconcile_report=report,
        totals=totals,
        previous=previous,
    )
    health.write_totals(Path(args.totals_out), data, totals)
    health.write_report(Path(args.health_out), issues)
    print(health.format_issues(issues))
    return 0


def cmd_health(args: argparse.Namespace) -> int:
    issues = health.read_report(Path(args.report))
    print(health.format_issues(issues))
    failed = health.publish_to_github(issues)
    return 1 if failed and args.strict else 0


def cmd_reconcile(args: argparse.Namespace) -> int:
    f = _build_frames(args.season, args.week)
    rep = _reconcile(f)
    if rep is None:
        print(f"no OTC reference file for {args.season}", file=sys.stderr)
        return 1
    print(reconcile.format_report(rep))
    return 0 if rep.passed else 2


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="captracker")
    parser.add_argument("--season", type=int, default=DEFAULT_SEASON)
    parser.add_argument("--week", type=int, default=None)
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("fetch", help="download nflverse source files")
    p.add_argument("--force", action="store_true")
    p.set_defaults(func=cmd_fetch)

    p = sub.add_parser("check-contracts", help="day-one check of the contracts file")
    p.set_defaults(func=cmd_check_contracts)

    p = sub.add_parser("build", help="build the week's snapshot")
    p.add_argument("--allow-drift", action="store_true")
    p.set_defaults(func=cmd_build)

    p = sub.add_parser("reconcile", help="compare team totals with the OTC reference")
    p.set_defaults(func=cmd_reconcile)

    p = sub.add_parser("export", help="write the JSON snapshot the web app reads")
    p.add_argument("--out", default=str(WEB_DATA / "snapshot.json"))
    p.add_argument(
        "--fixture", action="store_true", help="replace player data with synthetic values"
    )
    p.add_argument(
        "--previous-totals",
        default=None,
        help="totals.json from the last published run, for the day-over-day drift check",
    )
    p.add_argument(
        "--totals-out",
        default=str(WEB_PUBLIC / "data" / "totals.json"),
        help="where to write this run's team totals (published with the site)",
    )
    p.add_argument("--health-out", default=str(OUT_DIR / "health.json"))
    p.set_defaults(func=cmd_export)

    p = sub.add_parser("health", help="report the export's health checks (GitHub-aware)")
    p.add_argument("--report", default=str(OUT_DIR / "health.json"))
    p.add_argument("--strict", action="store_true", help="exit 1 when any check fails")
    p.set_defaults(func=cmd_health)

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
