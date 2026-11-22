"""The 1% gate: every team's active cap total must match OverTheCap's published figure.

The reference numbers are hand-entered in data/reference/otc_team_totals_<season>.csv.
Nothing here fetches OverTheCap.

A hand-entered figure describes the roster on the day it was read. Trades, cuts and new
contracts after that move a team's total here and on OverTheCap alike, so a gap that
opens later is not by itself an error. Each team outside tolerance is one of:

  failing  the reference is fresh (REFERENCE_FRESH_DAYS) and no roster move since its
           date explains the gap: fails the run
  moved    the team has made a roster move worth $1M+ in or after the reference week, or the
           reference is older than REFERENCE_FRESH_DAYS (new contracts and restructures
           leave no trace in the roster file): reported, with the moves, until the
           reference is refreshed
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date

import polars as pl

from .config import PACKAGE_DATA, RECONCILE_TOLERANCE, REFERENCE_FRESH_DAYS
from .rollup import CAP_COUNTING_STATUS, team_status_weeks

# A move smaller than this does not explain a gap: practice squad churn, minimum deals.
MATERIAL_MOVE = 1_000_000

# How a player who left a team's books shows in the move list, by his roster status.
LEFT_AS = {"CUT": "cut", "RET": "retired", "TRD": "traded", "TRT": "traded", "TRC": "traded"}


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
    ok: bool  # does not fail the gate: within tolerance or allowance, or moved
    allowance: float = 0.0
    note: str = ""
    moved: bool = False  # outside tolerance, but the reference no longer fits this roster
    moves: list[str] = field(default_factory=list)  # roster moves since the reference


@dataclass
class ReconcileReport:
    season: int
    tolerance: float
    reference_as_of: str
    teams: list[TeamCheck]
    reference_week: int | None = None
    reference_age_days: int | None = None
    fresh_days: int = REFERENCE_FRESH_DAYS

    @property
    def reference_fresh(self) -> bool:
        return self.reference_age_days is None or self.reference_age_days <= self.fresh_days

    @property
    def passed(self) -> bool:
        return all(t.ok for t in self.teams) and len(self.teams) == 32

    @property
    def failing(self) -> list[TeamCheck]:
        return [t for t in self.teams if not t.ok]

    @property
    def moved(self) -> list[TeamCheck]:
        return [t for t in self.teams if t.moved]

    def to_dict(self) -> dict:
        return {
            "season": self.season,
            "tolerance": self.tolerance,
            "reference_as_of": self.reference_as_of,
            "reference_week": self.reference_week,
            "reference_age_days": self.reference_age_days,
            "reference_fresh": self.reference_fresh,
            "passed": self.passed,
            "teams_checked": len(self.teams),
            "teams_failing": len(self.failing),
            "teams_moved": len(self.moved),
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


def reference_date(reference: pl.DataFrame) -> date | None:
    """The day the reference was read (its `as_of`), or None if it carries none."""
    if "as_of" not in reference.columns or reference.is_empty():
        return None
    try:
        return date.fromisoformat(str(reference["as_of"][0]))
    except ValueError:
        return None


def reference_week(games: pl.DataFrame, season: int, as_of: date) -> int | None:
    """The regular-season week the reference describes: the last one that had kicked off
    by `as_of`. None when the reference predates the season."""
    starts = (
        games.filter((pl.col("season") == season) & (pl.col("game_type") == "REG"))
        .group_by("week")
        .agg(pl.col("gameday").cast(pl.String).min().alias("first_game"))
        .filter(pl.col("first_game") <= as_of.isoformat())
    )
    return None if starts.is_empty() else int(starts["week"].max())


def _books(status: pl.DataFrame, week: int) -> pl.DataFrame:
    """Who is on each team's books as of `week`: its latest roster at or before it."""
    weeks = team_status_weeks(status, week)
    return (
        status.join(weeks, on="team")
        .filter(pl.col("week") == pl.col("status_week"))
        .select("team", "gsis_id", "player_name", "roster_status")
        .filter(pl.col("gsis_id").is_not_null())
        .unique(subset=["team", "gsis_id"], keep="last")
    )


def roster_moves(
    status: pl.DataFrame,
    fact: pl.DataFrame,
    since_week: int,
    week: int,
    min_amount: int = MATERIAL_MOVE,
) -> dict[str, list[str]]:
    """Per team, the players worth `min_amount` or more who came onto or left its cap
    after `since_week`'s roster, largest first: "Jessie Bates (to JAX)", "Mike Evans
    (from TB)".

    `status` is the weekly roster status table, `fact` the current week's cap rows. A
    departure is sized by his contract (cap number or average per year, whichever is
    larger, since a traded player's cap row now only holds his new team's share), an
    arrival by what he counts for his new team.
    """
    counting = list(CAP_COUNTING_STATUS)
    then_all = _books(status, since_week)
    now_all = _books(status, week)
    then = then_all.filter(pl.col("roster_status").is_in(counting))
    now = now_all.filter(pl.col("roster_status").is_in(counting))

    size = fact.group_by("gsis_id").agg(
        pl.max_horizontal(pl.col("contract_cap_number").max(), pl.col("contract_apy").max()).alias(
            "size"
        )
    )
    counted = fact.filter(pl.col("counts_against_cap")).select(
        "team", "gsis_id", pl.col("cap_number").alias("size")
    )
    where_now = now.select("gsis_id", pl.col("team").alias("now_team")).unique(
        "gsis_id", keep="last"
    )
    listed_now = now_all.select(
        "gsis_id", pl.col("team").alias("listed_team"), pl.col("roster_status").alias("listed")
    ).unique("gsis_id", keep="last")
    where_then = then.select("gsis_id", pl.col("team").alias("then_team")).unique(
        "gsis_id", keep="last"
    )

    left = (
        then.join(now, on=["team", "gsis_id"], how="anti")
        .join(size, on="gsis_id", how="left")
        .join(where_now, on="gsis_id", how="left")
        .join(listed_now, on="gsis_id", how="left")
    )
    joined = (
        now.join(then, on=["team", "gsis_id"], how="anti")
        .join(counted, on=["team", "gsis_id"], how="left")
        .join(where_then, on="gsis_id", how="left")
    )

    moves: dict[str, list[tuple[int, str]]] = {}
    for r in left.iter_rows(named=True):
        amount = int(r["size"] or 0)
        if amount < min_amount:
            continue
        if r["now_team"]:
            how = f"to {r['now_team']}"
        elif r["listed"]:
            how = LEFT_AS.get(r["listed"], r["listed"].lower())
        else:
            how = "released"
        moves.setdefault(r["team"], []).append((amount, f"{r['player_name']} ({how})"))
    for r in joined.iter_rows(named=True):
        amount = int(r["size"] or 0)
        if amount < min_amount:
            continue
        how = f"from {r['then_team']}" if r["then_team"] else "added"
        moves.setdefault(r["team"], []).append((amount, f"{r['player_name']} ({how})"))
    return {
        team: [text for _, text in sorted(rows, key=lambda x: -x[0])]
        for team, rows in moves.items()
    }


def reconcile(
    team_totals: pl.DataFrame,
    reference: pl.DataFrame,
    season: int,
    tolerance: float = RECONCILE_TOLERANCE,
    known_gaps: dict[str, tuple[float, str]] | None = None,
    *,
    moves: dict[str, list[str]] | None = None,
    since_week: int | None = None,
    today: date | None = None,
    fresh_days: int = REFERENCE_FRESH_DAYS,
) -> ReconcileReport:
    """team_totals needs columns team, cap_total, players (one row per team).

    `moves` (from `roster_moves`) are each team's roster moves since the reference
    week `since_week`. `today` dates the run; without it the reference counts as fresh.
    """
    known_gaps = known_gaps or {}
    moves = moves or {}
    as_of_day = reference_date(reference)
    age = (today - as_of_day).days if today and as_of_day else None
    stale = age is not None and age > fresh_days
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
        within = abs(pct) <= max(tolerance, allowance)
        team_moves = moves.get(row["team"], [])
        moved = not within and (stale or bool(team_moves))
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
                ok=within or moved,
                allowance=allowance,
                note=note,
                moved=moved,
                moves=team_moves if not within else [],
            )
        )
    as_of = str(reference["as_of"][0]) if "as_of" in reference.columns else ""
    return ReconcileReport(
        season=season,
        tolerance=tolerance,
        reference_as_of=as_of,
        teams=checks,
        reference_week=since_week,
        reference_age_days=age,
        fresh_days=fresh_days,
    )


def format_report(report: ReconcileReport) -> str:
    age = (
        f", {report.reference_age_days} days old"
        + ("" if report.reference_fresh else f", past the {report.fresh_days}-day gate")
        if report.reference_age_days is not None
        else ""
    )
    week = f", week {report.reference_week}" if report.reference_week else ""
    lines = [
        f"Reconciliation {report.season}: nflverse active contracts vs OTC active cap spending "
        f"(reference as of {report.reference_as_of}{week}{age}, "
        f"tolerance {report.tolerance:.0%})",
        f"{'team':<5}{'nflverse':>14}{'otc active':>14}{'diff':>14}"
        f"{'diff%':>8}{'n':>5}{'otc n':>7}  ok",
    ]
    for t in report.teams:
        lines.append(
            f"{t.team:<5}{t.nflverse_total:>14,}{t.otc_active:>14,}{t.diff:>14,}"
            f"{t.diff_pct:>8.1%}{t.nflverse_players:>5}{t.otc_players:>7}"
            f"  {'moved' if t.moved else 'yes' if t.ok else 'NO'}"
            + (f" (known gap, allowed {t.allowance:.1%})" if t.allowance and not t.moved else "")
            + (f": {', '.join(t.moves[:4])}" if t.moves else "")
        )
    within = len(report.teams) - len(report.failing) - len(report.moved)
    lines.append(
        f"{'PASS' if report.passed else 'FAIL'}: {within}/{len(report.teams)} teams within "
        f"{report.tolerance:.0%} or their allowance, {len(report.moved)} moved since the "
        f"reference, {len(report.failing)} failing"
    )
    return "\n".join(lines)
