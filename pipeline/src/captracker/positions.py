"""Position groups: the 13 groups, their 3 units, and how raw labels map into them.

Priority when a player carries several labels:
  1. the hand-maintained override table (data/position_overrides.csv)
  2. the contracts file position (OverTheCap already splits ED / IDL)
  3. the players file position
  4. the weekly roster position
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from functools import lru_cache

from .config import PACKAGE_DATA

OFFENSE = "offense"
DEFENSE = "defense"
SPECIAL = "special_teams"


@dataclass(frozen=True)
class PositionGroup:
    code: str
    label: str
    unit: str
    order: int  # display order within the unit


POSITION_GROUPS: tuple[PositionGroup, ...] = (
    PositionGroup("QB", "Quarterback", OFFENSE, 1),
    PositionGroup("RB", "Running back", OFFENSE, 2),
    PositionGroup("WR", "Wide receiver", OFFENSE, 3),
    PositionGroup("TE", "Tight end", OFFENSE, 4),
    PositionGroup("OL", "Offensive line", OFFENSE, 5),
    PositionGroup("IDL", "Interior defensive line", DEFENSE, 1),
    PositionGroup("EDGE", "Edge rusher", DEFENSE, 2),
    PositionGroup("LB", "Off-ball linebacker", DEFENSE, 3),
    PositionGroup("CB", "Cornerback", DEFENSE, 4),
    PositionGroup("S", "Safety", DEFENSE, 5),
    PositionGroup("K", "Kicker", SPECIAL, 1),
    PositionGroup("P", "Punter", SPECIAL, 2),
    PositionGroup("LS", "Long snapper", SPECIAL, 3),
)

GROUP_BY_CODE = {g.code: g for g in POSITION_GROUPS}
UNITS = (OFFENSE, DEFENSE, SPECIAL)

# Raw label -> group. Labels that are genuinely ambiguous get a documented default:
#   OLB  -> EDGE  (3-4 outside linebackers are edge rushers; a 4-3 OLB is fixed by
#                  the contracts position or the override table)
#   DL   -> IDL   (roster feed collapses the whole line into DL)
#   DB   -> CB    (roster feed collapses the secondary into DB)
RAW_TO_GROUP: dict[str, str] = {
    # offense
    "QB": "QB",
    "RB": "RB",
    "HB": "RB",
    "FB": "RB",
    "WR": "WR",
    "TE": "TE",
    "T": "OL",
    "OT": "OL",
    "LT": "OL",
    "RT": "OL",
    "G": "OL",
    "OG": "OL",
    "LG": "OL",
    "RG": "OL",
    "C": "OL",
    "OL": "OL",
    # defense
    "DT": "IDL",
    "NT": "IDL",
    "IDL": "IDL",
    "DL": "IDL",
    "DE": "EDGE",
    "ED": "EDGE",
    "EDGE": "EDGE",
    "OLB": "EDGE",
    "LB": "LB",
    "ILB": "LB",
    "MLB": "LB",
    "CB": "CB",
    "DB": "CB",
    "S": "S",
    "FS": "S",
    "SS": "S",
    "SAF": "S",
    # special teams
    "K": "K",
    "PK": "K",
    "P": "P",
    "LS": "LS",
}

# Labels we know about and deliberately leave unmapped (return-only roles, etc.).
UNGROUPED = {"KR", "PR", "ST", "SPEC"}


def normalize_label(raw: str | None) -> str | None:
    """Map a raw position label to a group code, or None if unknown."""
    if raw is None:
        return None
    key = raw.strip().upper()
    if key in UNGROUPED:
        return None
    return RAW_TO_GROUP.get(key)


@lru_cache(maxsize=1)
def load_overrides() -> dict[str, str]:
    """gsis_id -> group code, from the hand-maintained CSV."""
    path = PACKAGE_DATA / "position_overrides.csv"
    out: dict[str, str] = {}
    with path.open(newline="") as fh:
        for row in csv.DictReader(fh):
            if not row.get("gsis_id") or row["gsis_id"].startswith("#"):
                continue
            code = row["group"].strip().upper()
            if code not in GROUP_BY_CODE:
                raise ValueError(f"unknown group {code!r} in position_overrides.csv")
            out[row["gsis_id"].strip()] = code
    return out


def assign_group(
    gsis_id: str | None,
    *labels: str | None,
    overrides: dict[str, str] | None = None,
) -> str | None:
    """Pick the group for a player given labels in priority order."""
    overrides = load_overrides() if overrides is None else overrides
    if gsis_id and gsis_id in overrides:
        return overrides[gsis_id]
    for label in labels:
        code = normalize_label(label)
        if code:
            return code
    return None


def unit_for(group: str | None) -> str | None:
    return GROUP_BY_CODE[group].unit if group in GROUP_BY_CODE else None
