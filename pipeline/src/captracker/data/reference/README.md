# Reference data

`otc_team_totals_<season>.csv` holds the 32 published OverTheCap team figures used by
the reconciliation gate. These are typed in by hand from the public team salary cap
page, with the date they were read in `as_of`. Nothing in the pipeline fetches
OverTheCap; refresh this file by hand when the check drifts.

Base salary cap for 2026: $301,200,000.

Columns: `cap_space`, `active_cap_spending` and `dead_money` are whole dollars.
`players` is the count OTC shows for the active cap.
