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
    estimates,
    reconcile,
    rollup,
    rosters,
    snapshot,
    sources,
    summary,
    teams,
)
from .config import DEFAULT_SEASON, OUT_DIR, WEB_DATA

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


def _build_frames(season: int, week: int | None) -> dict:
    team_df = teams.load_teams()
    roster_raw = sources.read("rosters_weekly", season)
    cy = contracts.load_contract_years(season)
    cy = crosswalk.fill_gsis_by_name(cy, roster_raw)
    status = rosters.player_week_status(roster_raw, sources.read("injuries", season), season)
    wk = week or rosters.latest_week(status)
    est = estimates.estimate_missing(cy, roster_raw, season, wk)
    cy = contracts.with_player_key(pl.concat([cy, est]))
    cw = crosswalk.load_crosswalk(cy)
    grouped = rollup.assign_groups(cy, cw)
    fact = rollup.player_week_cap(grouped, status, wk)
    roll = rollup.rollup(fact)
    try:
        ref = reconcile.load_reference(season)
    except FileNotFoundError:
        ref = None
    return {
        "reference": ref,
        "team_summary": summary.team_summary(roll, fact, ref, rollup.team_status_weeks(status, wk)),
        "season": season,
        "week": wk,
        "teams": team_df,
        "position_groups": rollup.position_groups_table(),
        "crosswalk": cw,
        "contract_years": cy,
        "status": status,
        "fact": fact,
        "rollup": roll,
    }


def _team_totals(roll: pl.DataFrame) -> pl.DataFrame:
    return roll.filter(pl.col("level") == "team").select("team", "cap_total", "players")


def cmd_build(args: argparse.Namespace) -> int:
    f = _build_frames(args.season, args.week)
    report = None
    if f["reference"] is not None:
        rep = reconcile.reconcile(_team_totals(f["rollup"]), f["reference"], args.season)
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


def cmd_export(args: argparse.Namespace) -> int:
    from . import export

    f = _build_frames(args.season, args.week)
    report = None
    if f["reference"] is not None:
        report = reconcile.reconcile(
            _team_totals(f["rollup"]), f["reference"], args.season
        ).to_dict()
    data = export.build_export(
        season=f["season"],
        week=f["week"],
        teams=f["teams"],
        team_summary=f["team_summary"],
        rollup=f["rollup"],
        fact=f["fact"],
        games=sources.read("games"),
        reconcile_report=report,
    )
    out = Path(args.out)
    if args.fixture:
        data = export.build_fixture(data)
    export.write_export(data, out)
    print(f"wrote {out} ({out.stat().st_size / 1024:.0f} KB, {len(data['players'])} players)")
    return 0


def cmd_reconcile(args: argparse.Namespace) -> int:
    f = _build_frames(args.season, args.week)
    if f["reference"] is None:
        print(f"no OTC reference file for {args.season}", file=sys.stderr)
        return 1
    rep = reconcile.reconcile(_team_totals(f["rollup"]), f["reference"], args.season)
    print(reconcile.format_report(rep))
    return 0 if rep.passed else 2


def cmd_load(args: argparse.Namespace) -> int:
    from . import load

    if args.week is None:
        latest = json.loads((OUT_DIR / str(args.season) / "latest.json").read_text())
        path = OUT_DIR / latest["path"]
    else:
        path = snapshot.snapshot_dir(args.season, args.week)
    counts = load.load_snapshot(Path(path))
    for table, n in counts.items():
        print(f"{table:<20} {n:>8} rows")
    return 0


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
    p.set_defaults(func=cmd_export)

    p = sub.add_parser("load", help="load a snapshot into Postgres")
    p.set_defaults(func=cmd_load)

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
