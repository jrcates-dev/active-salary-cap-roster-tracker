# Reference data

`otc_team_totals_<season>.csv` holds the 32 published OverTheCap team figures used by
the reconciliation gate. These are typed in by hand from the public team salary cap
page, with the date they were read in `as_of`. Nothing in the pipeline fetches
OverTheCap; refresh this file by hand when the check drifts.

Base salary cap for 2026: $301,200,000.

Columns: `cap_space`, `active_cap_spending` and `dead_money` are whole dollars.

`otc_dead_money_<season>.csv` lists the charges behind each team's dead money, one
row per charge, read by hand from the Dead Money table on each OverTheCap team page
(overthecap.com/salary-cap/<team>). OverTheCap itemizes charges of $100K and up, so a
team's rows sum to a little under its `dead_money` total; the site shows the rest as
one "smaller charges" line. A player can appear twice (two separate charges).
`position` is OverTheCap's code, matched from the nflverse contracts file. Refresh it
with the team totals.
`players` is the count OTC shows for the active cap.
