import polars as pl

from captracker.teams import fix_colors


def test_fix_colors_sets_the_primary_each_team_leads_with():
    teams = pl.DataFrame(
        {
            "team": ["ATL", "DEN", "TB"],
            "color_primary": ["#A71930", "#002244", "#A71930"],
            "color_secondary": ["#000000", "#FB4F14", "#322F2B"],
        }
    )
    fixed = {r["team"]: r for r in fix_colors(teams).iter_rows(named=True)}
    # The Bucs get their own red, not the Falcons'; the Falcons keep theirs.
    assert fixed["TB"]["color_primary"] == "#D50A0A"
    assert fixed["TB"]["color_secondary"] == "#322F2B"
    assert fixed["ATL"]["color_primary"] == "#A71930"
    # The Broncos lead with orange, navy second.
    assert fixed["DEN"]["color_primary"] == "#FB4F14"
    assert fixed["DEN"]["color_secondary"] == "#002244"
