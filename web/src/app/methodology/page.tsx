import type { Metadata } from "next";
import Link from "next/link";
import { getSnapshot } from "@/lib/data";
import { money, pct } from "@/lib/format";

export const metadata: Metadata = { title: "Methodology · NFL Salary Cap Tracker" };

export default async function MethodologyPage() {
  const s = await getSnapshot();
  const rec = s.reconcile;
  const teamName = Object.fromEntries(s.teams.map((t) => [t.team, t.name]));
  const estimated = s.summary.reduce((a, t) => a + t.players_estimated, 0);
  const derived = s.summary.reduce((a, t) => a + (t.players_rookie_derived ?? 0), 0);
  const generated = new Date(s.generated_at);

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 py-8 sm:px-6">
      <header>
        <h1 className="num text-4xl font-bold sm:text-5xl">Methodology</h1>
        <p className="mt-2 text-fg-muted">
          Data as of the {s.season} season, week {s.week}. Built{" "}
          {generated.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC.
        </p>
      </header>

      <Section title="Sources">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Contracts, players, weekly rosters, injury reports and schedules come from{" "}
            <A href="https://github.com/nflverse">nflverse</A>, released under CC BY 4.0. The contract data in
            nflverse is sourced from <A href="https://overthecap.com">OverTheCap</A>.
          </li>
          <li>
            Team dead money, cap space and the reconciliation targets are read by hand from OverTheCap&apos;s
            public team cap page
            {s.freshness?.reference_as_of ? ` (last read ${s.freshness.reference_as_of})` : ""} and refreshed at
            least monthly; the daily job warns when they are more than 30 days old. This site never scrapes
            OverTheCap or Spotrac.
          </li>
          <li>Team colors and logos come from the nflverse team table.</li>
        </ul>
      </Section>

      <Section title="What counts against the cap">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Every player on a team&apos;s roster in the latest week counts at their {s.season} cap number. That covers
            the 53-man roster, gameday inactives, injured reserve, PUP, NFI and suspended players.
          </li>
          <li>
            Practice squad players count at no more than the practice squad rate of {money(247_500)} a season,
            prorated from the first week they appear.
          </li>
          <li>Released, retired and traded players drop out of their old team&apos;s total.</li>
          <li>Dead money is shown beside the roster total and is never mixed into position groups.</li>
          <li>Teams on a bye keep their statuses from the last week they played.</li>
          <li>
            The week shown is the schedule&apos;s current week: the earliest week with a game still to play. Until
            the league posts a week&apos;s roster, each team&apos;s latest roster carries forward, with last
            week&apos;s gameday inactives back on the active roster.
          </li>
        </ul>
      </Section>

      <Section title="Active, questionable, out">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-fg">Out this week</strong> means ruled out or doubtful on the injury report
            before the game, or on the official gameday inactive list once the game is played. This is the money
            that changes a matchup.
          </li>
          <li>
            <strong className="text-fg">Out long-term</strong> means injured reserve, PUP, NFI, suspension or
            another reserve list. That money is gone for weeks, so it is drawn as its own faint band and does not
            set the order of the league board.
          </li>
          <li>
            <strong className="text-fg">Questionable</strong> means listed questionable on the latest injury report
            for a game not yet played. Questionable players count as on the field until ruled out. Once the game is
            final, every player not on the gameday inactive list counts as active.
          </li>
          <li>
            <strong className="text-fg">Practice squad / other</strong> covers the practice squad and anyone the
            roster file has no gameday status for.
          </li>
        </ul>
      </Section>

      <Section title="Matchups">
        <p>
          Each game pairs every offensive group with the defense it faces: offensive line against the interior line
          and edge rushers, receivers and tight ends against the secondary, running backs against linebackers, and
          quarterbacks against the pass rush and secondary. Bars compare money on the field (active plus
          questionable) by default, or full investment. The two biggest gaps, leaving out the quarterback row, are
          the &ldquo;biggest edges&rdquo;. Money measures investment and availability, not form.
        </p>
      </Section>

      <Section title="Week by week">
        <p>
          Past weeks are rebuilt every day from the nflverse roster and injury files, which keep each week. They use
          today&apos;s contracts, so a player traded since then is missing from his old team&apos;s earlier weeks.
        </p>
      </Section>

      <Section title="Estimates">
        <p>
          The free contract data lags for some players. Where a cap number is missing, the site fills it in and
          marks it in the roster table.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-fg">Rookie scale</strong> ({derived} players). For {s.season} draft picks
            without a cap line, rounds 1 to 3 use 8/11 of the contract&apos;s average per year, and later rounds use
            the average less {money(210_000)}, never below the {money(885_000)} rookie minimum.
          </li>
          <li>
            <strong className="text-fg">League minimum</strong> ({estimated} players). Players with no contract
            at all count at the minimum salary for their years of experience, prorated from the week they joined.
          </li>
        </ul>
      </Section>

      {rec && (
        <Section title="Reconciliation">
          <p>
            Each team&apos;s counted total is checked against OverTheCap&apos;s published active cap as of{" "}
            {rec.reference_as_of}. A team passes within {pct(rec.tolerance, 0)}, or within its own disclosed
            allowance for a gap that is understood.{" "}
            <strong className="text-fg">
              {rec.teams_checked - rec.teams_failing} of {rec.teams_checked} teams pass.
            </strong>{" "}
            The daily job also flags any team whose total moves more than 1% from one day to the next.
          </p>
          {rec.teams.some((t) => t.allowance) && (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {rec.teams
                .filter((t) => t.allowance)
                .map((t) => (
                  <li key={t.team}>
                    <strong className="text-fg">{teamName[t.team] ?? t.team}</strong> ({t.diff_pct > 0 ? "+" : ""}
                    {pct(t.diff_pct)}, allowed {pct(t.allowance ?? 0)}): {t.note}
                  </li>
                ))}
            </ul>
          )}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-panel text-fg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Team</th>
                  <th className="px-3 py-2 text-right font-medium">This site</th>
                  <th className="px-3 py-2 text-right font-medium">OverTheCap</th>
                  <th className="px-3 py-2 text-right font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {[...rec.teams]
                  .sort((a, b) => Math.abs(b.diff_pct) - Math.abs(a.diff_pct))
                  .map((t) => (
                    <tr key={t.team} className="border-t border-border">
                      <td className="px-3 py-1.5">
                        <Link href={`/team/${t.team}`} className="hover:underline">
                          {teamName[t.team] ?? t.team}
                        </Link>
                      </td>
                      <td className="num px-3 py-1.5 text-right text-base">{money(t.nflverse_total)}</td>
                      <td className="num px-3 py-1.5 text-right text-base">{money(t.otc_active)}</td>
                      <td className="num px-3 py-1.5 text-right text-base">
                        <span className={t.ok ? "text-fg-muted" : "font-semibold text-fg"}>
                          {t.diff_pct > 0 ? "+" : ""}
                          {pct(t.diff_pct)}
                        </span>
                        {!t.ok && <span className="ml-2 text-xs text-fg">outside the gate</span>}
                        {t.ok && t.allowance ? <span className="ml-2 text-xs text-fg-muted">known gap</span> : null}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 leading-relaxed text-fg-muted">
      <h2 className="num text-2xl font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-fg underline underline-offset-4 hover:text-fg-muted">
      {children}
    </a>
  );
}
