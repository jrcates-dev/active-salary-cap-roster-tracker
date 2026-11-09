"""Command-line entry point: captracker <command> [--season N] [--week N]."""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

import polars as pl

from . import contracts, crosswalk, reconcile, rollup, rosters, snapshot, sources, teams
from .config import DEFAULT_SEASON, OUT_DIR

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
    cy = contracts.load_contract_years(season)
    cw = crosswalk.load_crosswalk(cy)
    status = rosters.load_player_week_status(season)
    wk = week or rosters.latest_week(status)
    grouped = rollup.assign_groups(cy, cw)
    fact = rollup.player_week_cap(grouped, status, wk)
    roll = rollup.rollup(fact)
    return {
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
    try:
        ref = reconcile.load_reference(args.season)
        rep = reconcile.reconcile(_team_totals(f["rollup"]), ref, args.season)
        report = rep.to_dict()
        print(reconcile.format_report(rep))
    except FileNotFoundError as exc:
        log.warning("%s; skipping reconciliation", exc)
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
        reconcile_report=report,
    )
    print(f"snapshot written to {out}")
    if report and not report["passed"] and not args.allow_drift:
        print("reconciliation failed; pass --allow-drift to write anyway", file=sys.stderr)
        return 2
    return 0


def cmd_reconcile(args: argparse.Namespace) -> int:
    f = _build_frames(args.season, args.week)
    ref = reconcile.load_reference(args.season)
    rep = reconcile.reconcile(_team_totals(f["rollup"]), ref, args.season)
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
