# Design brief, v3: the board

Written 2026-11-10, after looking at every page on desktop and phone in both themes.

## What the product is for

A gameday reference. A reader arrives with one of three questions and should have the
answer inside ten seconds:

1. **Who is hurting this week?** Which teams have the most cap money sitting out.
2. **How healthy is my team's payroll?** How much of it is on the field, and who is not.
3. **Who has the edge in this game?** Which position groups out-invest the ones across from them.

Before this pass the site answered all three, but in the voice of an admin dashboard:
white cards of equal weight, a small page title, and the same seven numbers shown three
times in a row (tiles, bar, legend). Nothing on a page said "this is the answer".

## Personality

A broadcast scorebug crossed with a ledger. Confident, numeric, a little loud at the top
of the page and quiet and tabular below it.

## Layout and navigation

- **The board.** Every page opens with a dark band (dark in both themes) that holds the
  site bar, the page title and the page's headline answer. Below the band the page is a
  working surface in the reader's theme.
- **Four sections:** League, Teams, Matchups, Methodology. Teams is a real page now
  (all 32 by division on one dollar scale), not only a dropdown.
- **Phones** get the sections as a tab bar at the bottom of the screen, under the thumb.
  The top bar keeps the name, the week and the team switcher.
- The sticky section bar, Back restoring the view, and every deep link stay as they were.

## Visual language

- **Type:** Barlow Condensed, upper case, for titles and standalone figures; Inter for
  everything read in rows. Tabular figures wherever numbers line up.
- **Shape:** tighter corners; sections sit on a 2px ink rule like a ledger instead of
  floating in cards.
- **Color:** unchanged in meaning. Status hues on every page, team colors with status
  patterns on matchup pages, team color for identity, one amber ramp for intensity.
  Inside the board everything uses the dark theme's tokens, so the contrast checks that
  hold for a dark page hold there too.
- **Charts:** bars stay the main mark. The availability bar and its figures are one
  object (a bar with its ledger under it), not three stacked widgets.

## What each page leads with

| Page | Leads with |
| --- | --- |
| League | How much of the league's cap is active this week, on the league bar, with the ledger of every status under it. Then the week's games as a ticker, then who is hurting most. |
| Teams | Every team by division, counted cap and availability on one scale. |
| Team | The team's name on its color, counted cap, cap space, and its availability bar and ledger, all on the board. |
| Matchup | The scorebug: both teams, the score or kickoff, and the two biggest edges as the headline. Both payrolls on one dollar scale follow on the page itself, because the board would repaint each team in its dark-theme color and a team must be one color from top to bottom there. |
| Methodology | Unchanged in content. |

## Left alone on purpose

Data, calculations and every figure. The status palette and the matchup team-color
patterns (settled the same day). The mirrored matchup chart, treemap, heatmap and roster
table keep their mechanics: click-through, sorting, chips, starter stars, week pickers.
