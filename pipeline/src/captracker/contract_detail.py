"""Contract detail: what the site's contract view shows for one player.

The nflverse contracts file (sourced from OverTheCap) carries two nested lists per
player: `season_history`, his cap ledger year by year (base salary, bonus proration,
roster and workout bonuses, guaranteed salary, cap number and cash), and
`contract_history`, every deal he has signed with its type, length, value, guarantees
and how much of it he earned. Both lists are per player, not per contract: every
contract row of one player carries the same two lists.

Three figures the contract view shows are not in the file and are worked out here:

- **Dead money and cap savings** if he is released or traded. A release leaves the
  bonus proration still to come (signing and restructure bonuses, plus option bonuses
  already paid) and the guaranteed salary still owed; a trade leaves only the
  proration. This is the standard cap rule, applied to the ledger.
- **Which option bonuses are paid.** The ledger gives one option-bonus proration per
  season, the sum of every option exercised so far and those still to come. It is
  split into layers, one per exercise year, each spread over at most five seasons.
- **The signing bonus**: the cash paid in the signing year beyond the salary and the
  listed bonuses. It is kept only when it fits under the proration the ledger shows
  for the seasons it would be spread over; otherwise it is left blank.

Dollar figures in the source are millions; everything here is whole dollars.
"""

from __future__ import annotations

import polars as pl

from . import sources, teams
from .contracts import TOKEN_TAIL_SHARE

MILLION = 1_000_000
# A bonus is prorated over the contract's remaining seasons, five at most.
MAX_PRORATION_YEARS = 5
# Season fields left out of a row: bonuses when zero (the site reads a missing one
# as 0), the rest when blank.
WHEN_ZERO = ("option", "roster", "workout", "per_game", "other")
WHEN_BLANK = ("cap_pct", "dead_cut", "savings_cut")
# Rounding slack when comparing figures read from the ledger (millions, 6 decimals).
SLACK = 20_000

COMPONENTS = (
    "base_salary",
    "prorated_bonus",
    "option_bonus",
    "roster_bonus",
    "workout_bonus",
    "per_game_roster_bonus",
    "other_bonus",
)


def _d(x: float | None) -> int:
    return round((x or 0.0) * MILLION)


def ledger(history: list[dict] | None) -> dict[int, dict[str, int | str | float | None]]:
    """The season_history list as {season: row}, in whole dollars, Total row dropped."""
    out: dict[int, dict] = {}
    for s in history or []:
        y = s.get("year")
        if not y or not y.isdigit():
            continue
        row = {c: _d(s.get(c)) for c in (*COMPONENTS, "guaranteed_salary", "cash_paid")}
        row["cap_number"] = None if s.get("cap_number") is None else _d(s.get("cap_number"))
        row["cap_percent"] = s.get("cap_percent")
        row["team"] = s.get("team")
        out[int(y)] = row
    return out


def option_layers(by: dict[int, dict]) -> list[tuple[int, int, int]]:
    """Split the option-bonus proration into one layer per exercise: (per season, first, last).

    Each season's option proration is the layers covering it. A season that carries
    more than the layers already running starts a new layer for the difference, spread
    over five seasons at most and never past the last season of the ledger. A season
    that carries less ends the oldest layers early (a new deal replaced the old one).
    """
    if not by:
        return []
    last = max(by)
    layers: list[tuple[int, int, int]] = []
    for y in sorted(by):
        want = by[y]["option_bonus"]
        for i, (a, s, e) in enumerate(layers):
            have = sum(a2 for a2, s2, e2 in layers if s2 <= y <= e2)
            if have <= want + SLACK:
                break
            if s <= y <= e:
                layers[i] = (a, s, y - 1)
        have = sum(a for a, s, e in layers if s <= y <= e)
        new = want - have
        if new > SLACK:
            layers.append((new, y, min(y + MAX_PRORATION_YEARS - 1, last)))
    return layers


def paid_proration(
    by: dict[int, dict], layers: list[tuple[int, int, int]], y: int, before: int
) -> int:
    """Season y's bonus proration from bonuses already paid before league year `before`."""
    opt = sum(a for a, s, e in layers if s < before and s <= y <= e)
    return by[y]["prorated_bonus"] + opt


def release_costs(by: dict[int, dict], season: int) -> dict | None:
    """What releasing or trading him at the start of league year `season` would leave.

    - Cut before June 1: all proration still to come and all guaranteed salary from
      `season` on land in `season`.
    - Cut after June 1: `season` keeps its own proration and guaranteed salary; the
      rest lands a year later.
    - Trade: only the proration stays behind; guarantees go with him.

    Savings is his cap number that season less the dead money charged to it.
    """
    if season not in by or by[season]["cap_number"] is None:
        return None
    layers = option_layers(by)
    years = [y for y in sorted(by) if y >= season]
    pro = {y: paid_proration(by, layers, y, season) for y in years}
    gtd = {y: by[y]["guaranteed_salary"] for y in years}
    cap = int(by[season]["cap_number"] or 0)
    proration = sum(pro.values())
    guaranteed = sum(gtd.values())
    cut = proration + guaranteed
    now = pro[season] + gtd[season]
    return {
        "season": season,
        "cap": cap,
        "cut": {"dead": cut, "savings": cap - cut},
        "june1": {"dead": now, "dead_next": cut - now, "savings": cap - now},
        "trade": {"dead": proration, "savings": cap - proration},
    }


def signing_bonus(by: dict[int, dict], signed: int | None) -> int | None:
    """The signing bonus of the deal signed in `signed`.

    A deal with a new team (a draft pick, a free agent) starts with no proration on
    that team's books, so the signing year's proration is the bonus's yearly charge:
    the bonus is that charge times the run of seasons it covers (five at most).

    An extension adds its bonus on top of proration from earlier deals, so there the
    bonus is read from the cash instead: what he was paid in the signing year beyond
    the salary, the listed bonuses and any option bonus exercised that year. It is
    kept only when its yearly charge fits inside that year's proration.

    Returns None when neither reading holds (or the ledger has no signing year).
    """
    if signed is None or signed not in by:
        return None
    s = by[signed]
    prev = by.get(signed - 1)
    new_team = prev is None or prev["team"] != s["team"]
    if new_team:
        per = s["prorated_bonus"]
        if per <= SLACK:
            return 0
        n = 0
        while (
            n < MAX_PRORATION_YEARS
            and signed + n in by
            and by[signed + n]["prorated_bonus"] >= per - SLACK
        ):
            n += 1
        return round(per * n)

    layers = option_layers(by)
    option_now = sum(a * (e - st + 1) for a, st, e in layers if st == signed)
    listed = sum(
        s[c]
        for c in (
            "base_salary",
            "roster_bonus",
            "workout_bonus",
            "per_game_roster_bonus",
            "other_bonus",
        )
    )
    bonus = s["cash_paid"] - listed - option_now
    if bonus <= SLACK:
        # Nothing beyond salary: no signing bonus, unless the ledger shows new
        # proration that year (then the cash does not tell us what it was).
        return 0 if s["prorated_bonus"] <= prev["prorated_bonus"] + SLACK else None
    n = min(MAX_PRORATION_YEARS, max(by) - signed + 1)
    if bonus / n > s["prorated_bonus"] + SLACK:
        return None
    return round(bonus)


def season_rows(
    by: dict[int, dict], start: int, season: int, nick_to_abbr: dict[str, str]
) -> list[dict]:
    """Every season of the ledger from `start` to the end of the deal, one row each.

    Seasons before `season` are `past`. From `season` on, each is tagged as in
    `contracts._outlook_row`: `counted` (a season he is paid for), `token` (a
    placeholder tail season with little cash) or `void` (no cash, only the bonus
    proration accelerating). Seasons after the deal with no cap charge are dropped.
    Future seasons he is paid for carry the dead money and savings of a release before
    June 1 of that league year.
    """
    years = sorted(y for y in by if y >= start)
    if not years:
        return []
    cash = {y: by[y]["cash_paid"] for y in years}
    future = [y for y in years if y >= season]
    paid = [y for y in future if y == season or cash[y] > 0]
    counted: list[int] = []
    for y in paid:
        if counted and y != counted[-1] + 1:
            break
        counted.append(y)
    token: list[int] = []
    while len(counted) > 1:
        before = counted[:-1]
        avg = sum(cash[y] for y in before) / len(before)
        if cash[counted[-1]] < TOKEN_TAIL_SHARE * avg:
            token.insert(0, counted.pop())
        else:
            break
    last_money = max(counted + token) if counted else season
    rows: list[dict] = []
    for y in years:
        r = by[y]
        cap = r["cap_number"]
        if y < season:
            kind = "past"
        elif y in counted:
            kind = "counted"
        elif y in token:
            kind = "token"
        elif y > last_money and cap:
            kind = "void"
        else:
            continue
        if cap is None:
            continue
        release = release_costs(by, y) if y > season and kind in ("counted", "token") else None
        void = kind == "void"
        row = {
            "season": y,
            "team": nick_to_abbr.get(r["team"]) if r["team"] else None,
            "base": 0 if void else r["base_salary"],
            # A void season's whole cap number is bonus proration landing there: its
            # own share plus the later seasons' accelerating into it.
            "prorated": cap if void else r["prorated_bonus"],
            "option": 0 if void else r["option_bonus"],
            "roster": 0 if void else r["roster_bonus"],
            "workout": 0 if void else r["workout_bonus"],
            "per_game": 0 if void else r["per_game_roster_bonus"],
            "other": 0 if void else r["other_bonus"],
            "gtd": 0 if void else r["guaranteed_salary"],
            "cap": cap,
            "cap_pct": r["cap_percent"],
            "cash": 0 if void else cash[y],
            "kind": kind,
            "dead_cut": release["cut"]["dead"] if release else None,
            "savings_cut": release["cut"]["savings"] if release else None,
        }
        # Keep the file small: bonuses a season does not have, and blanks, are left out.
        rows.append(
            {
                k: v
                for k, v in row.items()
                if not (k in WHEN_ZERO and v == 0) and not (k in WHEN_BLANK and v is None)
            }
        )
    return rows


def _team_of(label: str | None, nick_to_abbr: dict[str, str]) -> str | None:
    """'Bills' -> 'BUF'; 'NE/PHI' (traded) -> 'NE', the team that signed him."""
    if not label:
        return None
    if label in nick_to_abbr:
        return nick_to_abbr[label]
    first = label.split("/")[0]
    return first if first in set(nick_to_abbr.values()) else None


def _history_rows(history: list[dict] | None, nick_to_abbr: dict[str, str]) -> list[dict]:
    rows = []
    for h in history or []:
        if h.get("year_signed") is None:
            continue
        rows.append(
            {
                "team": _team_of(h.get("team"), nick_to_abbr),
                "type": h.get("contract_type") or None,
                "status": h.get("status") or None,
                "signed": h.get("year_signed"),
                "years": h.get("yrs"),
                "value": _d(h.get("total")),
                "apy": _d(h.get("apy")),
                "guaranteed": _d(h.get("guarantees")),
                "earned": _d(h.get("amount_earned"))
                if h.get("amount_earned") is not None
                else None,
                "pct_earned": h.get("percent_earned"),
            }
        )
    rows.sort(key=lambda r: (r["signed"], r["value"]), reverse=True)
    return rows


def _match_history(rows: list[dict], signed: int | None, value: int | None) -> dict | None:
    """The contract_history entry for the deal the cap row comes from."""
    active = [r for r in rows if r["status"] == "Active"]
    for pool in (active, rows):
        same = [r for r in pool if r["signed"] == signed]
        if value is not None:
            close = [r for r in same if abs(r["value"] - value) <= max(SLACK, 0.01 * value)]
            if close:
                return close[0]
        if same:
            return max(same, key=lambda r: r["value"])
    return None


def _bio(p: dict | None, c: dict | None, nick_to_abbr: dict[str, str]) -> dict:
    """Who he is: from the nflverse players file, falling back to the contract row."""
    p = p or {}
    c = c or {}
    draft_team = p.get("draft_team") or _team_of(c.get("draft_team"), nick_to_abbr)
    return {
        "birth_date": p.get("birth_date"),
        "height": p.get("height"),
        "weight": p.get("weight"),
        "college": p.get("college_name") or c.get("college"),
        "jersey": p.get("jersey_number"),
        "experience": p.get("years_of_experience"),
        "draft_year": p.get("draft_year") or c.get("draft_year"),
        "draft_round": p.get("draft_round") or c.get("draft_round"),
        "draft_pick": p.get("draft_pick") or c.get("draft_overall"),
        "draft_team": draft_team,
    }


def contract_details(
    fact: pl.DataFrame,
    contracts: pl.DataFrame,
    players: pl.DataFrame,
    season: int,
    nick_to_abbr: dict[str, str],
) -> list[dict]:
    """One contract record per player counting against a cap this week.

    `basis` says what the record can show: `contract` (the full ledger), `rookie_scale`
    (a deal signed this season the free data has not broken down yet: headline terms
    only, cap number derived) or `minimum` (no contract in the free data: counted at
    the league minimum).
    """
    rows = fact.filter(pl.col("counts_against_cap")).select(
        "player_key",
        "team",
        "gsis_id",
        "otc_id",
        "year_signed",
        "contract_value",
        "cap_source",
        "roster_status",
        "player_page",
    )
    active = contracts.filter(pl.col("is_active") & pl.col("otc_id").is_not_null())
    by_otc: dict[int, list[dict]] = {}
    for r in active.iter_rows(named=True):
        by_otc.setdefault(r["otc_id"], []).append(r)
    bio_rows = {
        r["gsis_id"]: r
        for r in players.select(
            "gsis_id",
            "birth_date",
            "height",
            "weight",
            "college_name",
            "jersey_number",
            "years_of_experience",
            "draft_year",
            "draft_round",
            "draft_pick",
            "draft_team",
        )
        .filter(pl.col("gsis_id").is_not_null())
        .unique("gsis_id")
        .iter_rows(named=True)
    }

    out: list[dict] = []
    for f in rows.iter_rows(named=True):
        cands = by_otc.get(f["otc_id"], []) if f["otc_id"] is not None else []
        row = None
        if cands:
            same = [c for c in cands if c["year_signed"] == f["year_signed"]]
            pool = same or cands
            row = max(pool, key=lambda c: c["value"] or 0)
        bio = _bio(bio_rows.get(f["gsis_id"]), row, nick_to_abbr)
        rec: dict = {
            "key": f["player_key"],
            "team": f["team"],
            "basis": "minimum",
            "otc_url": (row or {}).get("player_page") or f["player_page"],
            "bio": bio,
            "deal": None,
            "years": [],
            "release": None,
            "history": [],
        }
        if f["cap_source"] == "estimate_minimum" or row is None:
            out.append(rec)
            continue

        history = _history_rows(row.get("contract_history"), nick_to_abbr)
        value = _d(row["value"]) if row["value"] is not None else None
        entry = _match_history(history, row["year_signed"], value)
        by = ledger(row.get("season_history"))
        has_ledger = season in by and by[season]["cap_number"] is not None
        rows_ = (
            season_rows(by, min(row["year_signed"] or season, season), season, nick_to_abbr)
            if has_ledger
            else []
        )
        paid = [r for r in rows_ if r["kind"] in ("counted", "token")]
        last = max((r["season"] for r in paid), default=None)
        if last is None and row["year_signed"] and row["years"]:
            last = max(season, row["year_signed"] + row["years"] - 1)
        rec.update(
            {
                "basis": "contract" if has_ledger else "rookie_scale",
                "deal": {
                    "type": entry["type"] if entry else None,
                    "team": (entry["team"] if entry else None)
                    or _team_of(row["team"], nick_to_abbr),
                    "signed": row["year_signed"],
                    "years": row["years"],
                    "value": value,
                    "apy": _d(row["apy"]) if row["apy"] is not None else None,
                    "apy_cap_pct": None
                    if row["apy_cap_pct"] is None
                    else round(row["apy_cap_pct"], 4),
                    "guaranteed": _d(row["guaranteed"]) if row["guaranteed"] is not None else None,
                    "signing_bonus": signing_bonus(by, row["year_signed"]) if has_ledger else None,
                    "last_season": last,
                    "earned": entry["earned"] if entry else None,
                    "pct_earned": entry["pct_earned"] if entry else None,
                },
                "years": rows_,
                "release": release_costs(by, season + 1)
                if any(
                    r["season"] == season + 1 and r["kind"] in ("counted", "token") for r in rows_
                )
                else None,
                "history": history,
            }
        )
        out.append(rec)
    return out


def load_contract_details(fact: pl.DataFrame, season: int) -> list[dict]:
    return contract_details(
        fact,
        sources.read("contracts"),
        sources.read("players"),
        season,
        teams.nick_to_abbr(teams.load_teams()),
    )
