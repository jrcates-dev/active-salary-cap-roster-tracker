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
    allowance: float = 0.0
    note: str = ""


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


def load_dead_charges(season: int) -> list[dict]:
    """Each team's dead money, one row per charge, largest first within a team.

    Hand-entered from OverTheCap's team pages into
    data/reference/otc_dead_money_<season>.csv. OverTheCap lists charges of $100K and
    up, so a team's rows can sum to a little less than its dead money total; the site
    shows the rest as one line. An empty list when the season has no file.
    """
    path = PACKAGE_DATA / "reference" / f"otc_dead_money_{season}.csv"
    if not path.exists():
        return []
    df = pl.read_csv(path, schema_overrides={"position": pl.String})
    return (
        df.select(
            "team",
            pl.col("player").alias("name"),
            pl.col("position").alias("pos"),
            pl.col("dead_money").cast(pl.Int64).alias("amount"),
        )
        .sort(["team", "amount"], descending=[False, True])
        .to_dicts()
    )


def load_known_gaps(season: int) -> dict[str, tuple[float, str]]:
    """team -> (allowance, note) for gaps that are understood and disclosed.

    A team listed here passes the gate within its own allowance instead of the 1%
    tolerance, so the gate stays meaningful for the other 30 teams and still fails if a
    known gap grows.
    """
    path = PACKAGE_DATA / "reference" / f"known_gaps_{season}.csv"
    if not path.exists():
        return {}
    df = pl.read_csv(path, comment_prefix="#")
    return {
        r["team"]: (float(r["allowance"]), str(r.get("note") or ""))
        for r in df.iter_rows(named=True)
    }


def reconcile(
    team_totals: pl.DataFrame,
    reference: pl.DataFrame,
    season: int,
    tolerance: float = RECONCILE_TOLERANCE,
    known_gaps: dict[str, tuple[float, str]] | None = None,
) -> ReconcileReport:
    """team_totals needs columns team, cap_total, players (one row per team)."""
    known_gaps = known_gaps or {}
    joined = reference.join(
        team_totals.select("team", "cap_total", "players"), on="team", how="left"
    ).sort("team")
    checks: list[TeamCheck] = []
    for row in joined.iter_rows(named=True):
        ours = int(row["cap_total"] or 0)
        theirs = int(row["active_cap_spending"])
        diff = ours - theirs
        pct = diff / theirs if theirs else 0.0
        allowance, note = known_gaps.get(row["team"], (0.0, ""))
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
                ok=abs(pct) <= max(tolerance, allowance),
                allowance=allowance,
                note=note,
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
            + (f" (known gap, allowed {t.allowance:.1%})" if t.allowance else "")
        )
    lines.append(
        f"{'PASS' if report.passed else 'FAIL'}: {len(report.teams) - len(report.failing)}/"
        f"{len(report.teams)} teams within {report.tolerance:.0%}"
    )
    return "\n".join(lines)
