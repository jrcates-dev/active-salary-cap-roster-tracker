"""The 1% gate: every team's active cap total must match OverTheCap's published figure.

The reference numbers are hand-entered in data/reference/otc_team_totals_<season>.csv.
Nothing here fetches OverTheCap.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass

import polars as pl

from .config import PACKAGE_DATA, RECONCILE_TOLERANCE


@dataclass
class TeamCheck:
    team: str
    nflverse_total: int
    otc_active: int
    otc_dead: int
    diff: int
    diff_pct: float
    nflverse_players: int
    otc_players: int
    ok: bool


@dataclass
class ReconcileReport:
    season: int
    tolerance: float
    reference_as_of: str
    teams: list[TeamCheck]

    @property
    def passed(self) -> bool:
        return all(t.ok for t in self.teams) and len(self.teams) == 32

    @property
    def failing(self) -> list[TeamCheck]:
        return [t for t in self.teams if not t.ok]

    def to_dict(self) -> dict:
        return {
            "season": self.season,
            "tolerance": self.tolerance,
            "reference_as_of": self.reference_as_of,
            "passed": self.passed,
            "teams_checked": len(self.teams),
            "teams_failing": len(self.failing),
            "teams": [asdict(t) for t in self.teams],
        }


def load_reference(season: int) -> pl.DataFrame:
    path = PACKAGE_DATA / "reference" / f"otc_team_totals_{season}.csv"
    if not path.exists():
        raise FileNotFoundError(f"no OTC reference file for {season}: {path}")
    return pl.read_csv(path)


def reconcile(
    team_totals: pl.DataFrame,
    reference: pl.DataFrame,
    season: int,
    tolerance: float = RECONCILE_TOLERANCE,
) -> ReconcileReport:
    """team_totals needs columns team, cap_total, players (one row per team)."""
    joined = reference.join(
        team_totals.select("team", "cap_total", "players"), on="team", how="left"
    ).sort("team")
    checks: list[TeamCheck] = []
    for row in joined.iter_rows(named=True):
        ours = int(row["cap_total"] or 0)
        theirs = int(row["active_cap_spending"])
        diff = ours - theirs
        pct = diff / theirs if theirs else 0.0
        checks.append(
            TeamCheck(
                team=row["team"],
                nflverse_total=ours,
                otc_active=theirs,
                otc_dead=int(row["dead_money"]),
                diff=diff,
                diff_pct=round(pct, 4),
                nflverse_players=int(row["players_right"] or 0)
                if "players_right" in row
                else int(row.get("players", 0) or 0),
                otc_players=int(row["players"]),
                ok=abs(pct) <= tolerance,
            )
        )
    as_of = str(reference["as_of"][0]) if "as_of" in reference.columns else ""
    return ReconcileReport(season=season, tolerance=tolerance, reference_as_of=as_of, teams=checks)


def format_report(report: ReconcileReport) -> str:
    lines = [
        f"Reconciliation {report.season}: nflverse active contracts vs OTC active cap spending "
        f"(reference as of {report.reference_as_of}, tolerance {report.tolerance:.0%})",
        f"{'team':<5}{'nflverse':>14}{'otc active':>14}{'diff':>14}"
        f"{'diff%':>8}{'n':>5}{'otc n':>7}  ok",
    ]
    for t in report.teams:
        lines.append(
            f"{t.team:<5}{t.nflverse_total:>14,}{t.otc_active:>14,}{t.diff:>14,}"
            f"{t.diff_pct:>8.1%}{t.nflverse_players:>5}{t.otc_players:>7}"
            f"  {'yes' if t.ok else 'NO'}"
        )
    lines.append(
        f"{'PASS' if report.passed else 'FAIL'}: {len(report.teams) - len(report.failing)}/"
        f"{len(report.teams)} teams within {report.tolerance:.0%}"
    )
    return "\n".join(lines)
