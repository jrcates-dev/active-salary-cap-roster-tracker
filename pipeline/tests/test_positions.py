from captracker import positions


def test_thirteen_groups_in_three_units():
    assert len(positions.POSITION_GROUPS) == 13
    by_unit = {}
    for g in positions.POSITION_GROUPS:
        by_unit.setdefault(g.unit, []).append(g.code)
    assert sorted(by_unit) == sorted(positions.UNITS)
    assert by_unit[positions.OFFENSE] == ["QB", "RB", "WR", "TE", "OL"]
    assert by_unit[positions.DEFENSE] == ["IDL", "EDGE", "LB", "CB", "S"]
    assert by_unit[positions.SPECIAL] == ["K", "P", "LS"]


def test_every_raw_label_maps_to_a_known_group():
    for raw, code in positions.RAW_TO_GROUP.items():
        assert code in positions.GROUP_BY_CODE, raw


def test_offensive_line_labels_collapse_to_ol():
    for raw in ["LT", "LG", "C", "RG", "RT", "T", "G", "OT", "OG", "OL"]:
        assert positions.normalize_label(raw) == "OL"


def test_defensive_front_split():
    assert positions.normalize_label("ED") == "EDGE"
    assert positions.normalize_label("DE") == "EDGE"
    assert positions.normalize_label("OLB") == "EDGE"
    assert positions.normalize_label("IDL") == "IDL"
    assert positions.normalize_label("NT") == "IDL"
    assert positions.normalize_label("ILB") == "LB"


def test_unknown_and_return_labels_are_unmapped():
    assert positions.normalize_label("KR") is None
    assert positions.normalize_label("XYZ") is None
    assert positions.normalize_label(None) is None


def test_assign_group_priority():
    overrides = {"00-X": "LB"}
    # override wins over every label
    assert positions.assign_group("00-X", "ED", "DE", overrides=overrides) == "LB"
    # contracts label wins over the players label
    assert positions.assign_group("00-Y", "ED", "LB", overrides=overrides) == "EDGE"
    # fall through when the first label is unknown
    assert positions.assign_group("00-Z", None, "FS", overrides=overrides) == "S"
    assert positions.assign_group("00-Z", None, None, overrides=overrides) is None


def test_override_file_parses():
    positions.load_overrides.cache_clear()
    assert isinstance(positions.load_overrides(), dict)
