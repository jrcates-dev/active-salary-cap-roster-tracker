import type { Metadata } from "next";
import Link from "next/link";
import { Hero, WRAP } from "@/components/ui";
import { getSnapshot } from "@/lib/data";
import { money, pct, stampLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Methodology" };

export default async function MethodologyPage() {
  const s = await getSnapshot();
  const rec = s.reconcile;
  const teamName = Object.fromEntries(s.teams.map((t) => [t.team, t.name]));
  const estimated = s.summary.reduce((a, t) => a + t.players_estimated, 0);
  const derived = s.summary.reduce((a, t) => a + (t.players_rookie_derived ?? 0), 0);

  return (
    <>
    <Hero eyebrow={`${s.season} season · Week ${s.week} · built ${stampLabel(s.generated_at)}`} title="Methodology" />
    <main className={`${WRAP} py-8 sm:py-10`}>
      <div className="max-w-2xl space-y-12">

        <Section title="Sources">
          <li>
            Contracts, players, weekly rosters, injury reports, depth charts and schedules: <A href="https://github.com/nflverse">nflverse</A> (CC BY
            4.0).
            Contract data in nflverse comes from <A href="https://overthecap.com">OverTheCap</A>.
          </li>
          <li>
            Dead money (each team&apos;s total and its charges of $100K and up), cap space and reconciliation targets: read by hand from OverTheCap&apos;s public team cap pages
            {s.freshness?.reference_as_of && s.freshness.reference_as_of !== "fixture" ? ` (last read ${s.freshness.reference_as_of})` : ""}, refreshed at least
            monthly. Nothing here scrapes OverTheCap or Spotrac.
          </li>
          <li>Team colors and logos: the nflverse team table.</li>
        </Section>

        <Section title="What counts">
          <li>Every player on the latest roster, at his {s.season} cap number: the 53, gameday inactives, injured reserve, PUP, NFI and suspended.</li>
          <li>Practice squad players at no more than {money(247_500)} a season, prorated from their first week.</li>
          <li>Released, retired and traded players leave their old team&apos;s total.</li>
          <li>Dead money sits beside the roster total and never inside a position group.</li>
          <li>Teams on a bye keep their statuses from the last week they played.</li>
          <li>
            The week shown is the earliest with a game still to play. Until the league posts a week&apos;s roster, the latest roster carries forward with
            last week&apos;s inactives back on the active list.
          </li>
        </Section>

        <Section title="Availability">
          <li>
            <B>Out</B>: money missing from this game but not for good. That is anyone ruled out or doubtful before the game, on the official inactive
            list once it is played (if he was on that week&apos;s injury report), or on injured reserve, PUP, NFI, suspension or another reserve list with a way back this season.
          </li>
          <li>
            A healthy scratch, inactive on gameday without being on the injury report, counts as active.
          </li>
          <li>
            A player who missed his team&apos;s last game hurt (ruled out, or listed doubtful or questionable and then inactive) stays out between games, tagged &ldquo;Out last game&rdquo;, until the new week&apos;s
            report says otherwise: listed questionable moves him to Questionable, ruled out or doubtful keeps him out, and a game-status report
            without him on it means he was cleared and counts as active. A bye in between does not reset it.
          </li>
          <li>
            Each player who is out carries a tag that says which: &ldquo;Inactive this week&rdquo; (or ruled out, or doubtful) for this game only, or the
            reserve list with when he can come back, like &ldquo;IR, eligible week 12&rdquo;. IR, PUP and NFI hold a player out at least four games, so
            the eligible week is the fifth game after the first week he showed up on the list. The free data has no placement date, so that week is an
            estimate. A player designated to return, with his practice window open, says so. Tooltips on the out band split it the same way: how much
            is on a reserve list and how much is out for this game only.
          </li>
          <li>
            <B>Out for season</B>: reserve-list money that will not play again this year, drawn as a pinstriped band. No free feed says an injury ends
            a season, so two signals decide: a hand-kept table of reported season-ending injuries (torn ACL, patellar tendon, Achilles and the like),
            checked by date, and the roster codes, since a player whose 21-day return window closes without activation must stay on reserve all
            season. Everyone else on a reserve list counts as able to return. The table can lag the news by a few days, so a player shut down quietly
            stays in &ldquo;Out&rdquo; until it is updated.
          </li>
          <li>
            <B>Questionable</B>: listed questionable on the latest report for a game not yet played. Counts as on the field until ruled out. Once a
            game is final, everyone not on the inactive list counts as active, and so does a healthy scratch.
          </li>
          <li>
            <B>Practice squad</B>: the practice squad and anyone the roster file has no gameday status for.
          </li>
        </Section>

        <Section title="Starters">
          <li>
            <B>The star</B> next to a name marks a starter: the first name in a slot on the team&apos;s depth chart (ESPN&apos;s, via nflverse,
            refreshed daily). That is the 11 on offense in a three-receiver set, the base defense plus the nickel back, and the kicker, punter and long
            snapper. A fullback, holder and the return men are not counted as starters.
          </li>
          <li>
            A player who is out keeps the role he had before he went out: the chart from his last available game, or from before the opener if he has
            been out all season. Teams move injured players down the chart, which would otherwise hide the absences that cost the most.
          </li>
        </Section>

        <Section title="Matchups">
          <li>
            Each offensive group faces the defense it plays against: offensive line against interior line and edge, receivers and tight ends against the
            secondary, running backs against linebackers, quarterback against pass rush and secondary.
          </li>
          <li>Bars compare money on the field (active plus questionable) by default, or full investment. Practice squad money is left out of every matchup bar.</li>
          <li>
            The two biggest edges are the rows with the widest gap in league rank, leaving out the quarterback row. Money measures investment and
            availability, not form.
          </li>
        </Section>

        <Section title="Week by week">
          <li>
            Past weeks are rebuilt daily from the nflverse roster and injury files, which keep each week. They use today&apos;s contracts, so a player
            traded since then is missing from his old team&apos;s earlier weeks.
          </li>
        </Section>

        <Section title="Estimates">
          <li>
            <B>Rookie scale</B> ({derived} players): {s.season} draft picks without a cap line. Rounds 1 to 3 take 8/11 of the contract&apos;s average per
            year; later rounds take the average less {money(210_000)}, never below the {money(885_000)} minimum.
          </li>
          <li>
            <B>League minimum</B> ({estimated} players): players with no contract at all, at the minimum for their experience, prorated from the week
            they joined.
          </li>
          <li>Estimated players carry an &ldquo;est&rdquo; tag in the roster table.</li>
        </Section>

        {rec && (
          <Section title="Reconciliation">
            <li>
              Each team&apos;s counted total is checked against OverTheCap&apos;s published active cap as of {rec.reference_as_of}. A team passes within{" "}
              {pct(rec.tolerance, 0)}, or within its own disclosed allowance for a gap that is understood.{" "}
              <B>
                {rec.teams_checked - rec.teams_failing} of {rec.teams_checked} teams pass.
              </B>{" "}
              The daily job also flags any team whose total moves more than 1% day over day.
            </li>
            {rec.teams
              .filter((t) => t.allowance)
              .map((t) => (
                <li key={t.team}>
                  <B>{teamName[t.team] ?? t.team}</B> ({t.diff_pct > 0 ? "+" : ""}
                  {pct(t.diff_pct)}, allowed {pct(t.allowance ?? 0)}): {t.note}
                </li>
              ))}
            <li className="list-none">
              <div className="card mt-2 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="tbl w-full min-w-[520px] text-sm">
                    <thead className="bg-surface-2">
                      <tr>
                        <th className="text-left">Team</th>
                        <th className="text-right">This site</th>
                        <th className="text-right">OverTheCap</th>
                        <th className="text-right">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...rec.teams]
                        .sort((a, b) => Math.abs(b.diff_pct) - Math.abs(a.diff_pct))
                        .map((t) => (
                          <tr key={t.team}>
                            <td>
                              <Link href={`/team/${t.team}`} className="text-ink hover:underline">
                                {teamName[t.team] ?? t.team}
                              </Link>
                            </td>
                            <td className="num text-right">{money(t.nflverse_total)}</td>
                            <td className="num text-right">{money(t.otc_active)}</td>
                            <td className="num text-right">
                              <span className={t.ok ? "text-ink-2" : "font-semibold text-ink"}>
                                {t.diff_pct > 0 ? "+" : ""}
                                {pct(t.diff_pct)}
                              </span>
                              {!t.ok && <span className="ml-2 text-xs text-accent">outside gate</span>}
                              {t.ok && t.allowance ? <span className="ml-2 text-xs text-ink-3">known gap</span> : null}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </li>
          </Section>
        )}
      </div>
    </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="display mb-3 border-t-2 border-ink pt-2.5 text-[24px] leading-none">{title}</h2>
      <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-ink-2 marker:text-ink-3">{children}</ul>
    </section>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-ink underline decoration-line-2 underline-offset-4 transition-colors duration-(--dur-1) hover:decoration-ink">
      {children}
    </a>
  );
}
