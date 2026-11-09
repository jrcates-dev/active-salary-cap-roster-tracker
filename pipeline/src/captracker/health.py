"""Health checks run after every export: stale sources, reconciliation, day-over-day drift.

The daily job publishes the site first and checks second, so a problem never takes the
site down; a failed check fails the workflow run afterwards, which emails the repo owner.

  error    a source stopped updating, or a team falls outside the reconciliation gate
  warning  a team's total moved more than 1% since the last published run, or the
           hand-entered OverTheCap reference is more than 30 days old
  notice   known, disclosed gaps (data/reference/known_gaps_<season>.csv)
"""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime
from pathlib import Path

DRIFT_TOLERANCE = 0.01
REFERENCE_MAX_AGE_DAYS = 30


@dataclass
class Issue:
    level: str  # error | warning | notice
    title: str
    message: str


def team_totals(data: dict) -> dict[str, int]:
    return {s["team"]: int(s["cap_total"]) for s in data["summary"]}


def read_totals(path: Path) -> dict | None:
    """The totals file published with the previous site build, or None if unreadable."""
    try:
        raw = json.loads(path.read_text())
    except (OSError, ValueError):
        return None
    if not isinstance(raw, dict) or not isinstance(raw.get("teams"), dict):
        return None
    return raw


def write_totals(path: Path, data: dict, totals: dict[str, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "season": data["season"],
                "week": data["week"],
                "generated_at": data["generated_at"],
                "teams": totals,
            },
            indent=1,
        )
    )


def evaluate(
    *,
    week: int,
    freshness: dict,
    reconcile_report: dict | None,
    totals: dict[str, int],
    previous: dict | None,
    today: date | None = None,
) -> list[Issue]:
    today = today or datetime.now(UTC).date()
    issues: list[Issue] = []

    # 1. Stale sources. A week of lag is normal (the roster file adds a week once the
    #    schedule reaches it); two weeks means nflverse stopped updating.
    for key, label in (("roster_week", "Weekly rosters"), ("injury_week", "Injury reports")):
        have = freshness.get(key)
        if week > 1 and (have is None or have < week - 1):
            issues.append(
                Issue(
                    "error",
                    f"{label} are stale",
                    f"{label} stop at week {have or 'none'} but the schedule is at week {week}.",
                )
            )

    # 2. Reconciliation against the hand-entered OverTheCap totals.
    if reconcile_report:
        for t in reconcile_report["teams"]:
            if not t["ok"]:
                allowed = max(reconcile_report["tolerance"], t.get("allowance") or 0)
                issues.append(
                    Issue(
                        "error",
                        f"{t['team']} outside the reconciliation gate",
                        f"{t['team']} counts ${t['nflverse_total']:,} against OverTheCap's "
                        f"${t['otc_active']:,} ({t['diff_pct']:+.1%}, allowed {allowed:.1%}). "
                        "A trade or release since the reference date can cause this; refresh "
                        "the reference table if so.",
                    )
                )
            elif t.get("allowance"):
                issues.append(
                    Issue(
                        "notice",
                        f"{t['team']} known gap",
                        f"{t['team']} is {t['diff_pct']:+.1%} from OverTheCap, inside its "
                        f"disclosed allowance of {t['allowance']:.1%}.",
                    )
                )
        as_of = reconcile_report.get("reference_as_of")
        try:
            age = (today - date.fromisoformat(as_of)).days if as_of else None
        except ValueError:
            age = None
        if age is not None and age > REFERENCE_MAX_AGE_DAYS:
            issues.append(
                Issue(
                    "warning",
                    "OverTheCap reference is getting old",
                    f"The hand-entered team totals (dead money, cap space) are {age} days old. "
                    "Refresh pipeline/src/captracker/data/reference/otc_team_totals_*.csv.",
                )
            )

    # 3. Day-over-day drift against the last published run.
    if previous:
        moved = []
        for team, now in sorted(totals.items()):
            before = previous["teams"].get(team)
            if before and abs(now - before) / before > DRIFT_TOLERANCE:
                moved.append(f"{team} {before / 1e6:.1f}M -> {now / 1e6:.1f}M")
        if moved:
            issues.append(
                Issue(
                    "warning",
                    "Team totals moved more than 1% since the last run",
                    "; ".join(moved)
                    + ". A trade, signing or release explains most moves; if none does, "
                    "check the contracts file.",
                )
            )
    return issues


def write_report(path: Path, issues: list[Issue]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    status = "fail" if any(i.level == "error" for i in issues) else "ok"
    path.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(UTC).isoformat(timespec="seconds"),
                "status": status,
                "issues": [asdict(i) for i in issues],
            },
            indent=2,
        )
    )


def read_report(path: Path) -> list[Issue]:
    raw = json.loads(path.read_text())
    return [Issue(**i) for i in raw["issues"]]


def format_issues(issues: list[Issue]) -> str:
    if not issues:
        return "health: all checks passed"
    return "\n".join(f"health {i.level.upper()}: {i.title}. {i.message}" for i in issues)


def publish_to_github(issues: list[Issue]) -> bool:
    """Annotations, a step summary and a `status` output when running in Actions.

    Returns True when any check failed.
    """
    failed = any(i.level == "error" for i in issues)
    if os.environ.get("GITHUB_ACTIONS") == "true":
        for i in issues:
            print(f"::{i.level} title={i.title}::{i.message}")
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            lines = ["## Data health", ""]
            lines += [f"- **{i.level}**: {i.title}. {i.message}" for i in issues] or [
                "All checks passed."
            ]
            with open(summary, "a") as fh:
                fh.write("\n".join(lines) + "\n")
        out = os.environ.get("GITHUB_OUTPUT")
        if out:
            with open(out, "a") as fh:
                fh.write(f"status={'fail' if failed else 'ok'}\n")
    return failed
