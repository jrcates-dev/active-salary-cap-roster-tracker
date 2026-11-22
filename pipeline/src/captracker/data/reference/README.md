# Reference data

`otc_team_totals_<season>.csv` holds the 32 published OverTheCap team figures used by
the reconciliation gate. These are typed in by hand from the public team salary cap
page, with the date they were read in `as_of`. Nothing in the pipeline fetches
OverTheCap; refresh this file by hand when the check drifts.

The gate fails the daily run only while this file is fresh (7 days or newer, set by
`REFERENCE_FRESH_DAYS`) and a team is more than 1% off with no roster move since
`as_of` to explain it. Trades, cuts and new contracts after `as_of` move a team's total
here and on OverTheCap alike, so once a team has made a $1M+ roster move, or the file
is older than 7 days, its gap is reported as "moved since the reference" (a warning,
with the moves) instead of failing the run. Refreshing the file re-arms the gate for
every team; the push that commits it runs the check at once.

`known_gaps_<season>.csv` lists teams whose gap against this file is understood; they
pass within their own allowance. Review it whenever the totals are refreshed.

Base salary cap for 2026: $301,200,000.

Columns: `cap_space`, `active_cap_spending` and `dead_money` are whole dollars.

The league table and a team's own page can be cached at different times. When a team
page is newer (its cap space differs and its rosters add up to a different active total),
use the team page's figures for that team and say so in `source`, so the totals match
the dead money rows read from the same page.

`otc_dead_money_<season>.csv` lists the charges behind each team's dead money, one
row per charge, read by hand from the Dead Money table on each OverTheCap team page
(overthecap.com/salary-cap/<team>). OverTheCap itemizes charges of $100K and up, so a
team's rows sum to a little under its `dead_money` total; the site shows the rest as
one "smaller charges" line. A player can appear twice (two separate charges).
`position` is OverTheCap's code, matched from the nflverse contracts file. Refresh it
with the team totals.
`players` is the count OTC shows for the active cap.
