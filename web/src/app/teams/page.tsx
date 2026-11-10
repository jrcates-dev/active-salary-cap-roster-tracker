import type { Metadata } from "next";
import Link from "next/link";
import { AvailabilityBar, AvailabilityLegend } from "@/components/Availability";
import { Hero, WRAP } from "@/components/ui";
import { teamVars } from "@/design/tokens";
import { slicesOf } from "@/lib/availability";
import { getSnapshot } from "@/lib/data";
import { money } from "@/lib/format";
import { deadHref, statusHrefs } from "@/lib/rosterLink";

export const metadata: Metadata = { title: "Teams" };

const CONFERENCES = ["AFC", "NFC"];
const REGIONS = ["East", "North", "South", "West"];

/**
 * All 32 teams by division: each with its counted cap and its availability bar, on
 * one dollar scale so division rivals compare at a glance. Every name opens the
 * team page and every bar segment opens that team's roster, as on the league board.
 */
export default async function TeamsPage() {
  const s = await getSnapshot();
  const summary = Object.fromEntries(s.summary.map((t) => [t.team, t]));
  // The same axis as the league board: player cap plus the year's dead money.
  const scale = Math.max(1, ...s.summary.map((t) => t.cap_total + (t.dead_money ?? 0)));
  return (
    <>
      <Hero eyebrow={`${s.season} season · Week ${s.week}`} title="Teams" />
      <main className={`${WRAP} space-y-8 py-8 sm:py-10`}>
        <AvailabilityLegend keys={["active", "questionable", "inactive", "year", "unknown", "dead"]} short />
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
          {CONFERENCES.map((conf) => (
            <section key={conf} aria-label={conf} className="space-y-8">
              {REGIONS.map((region) => {
                const division = `${conf} ${region}`;
                const teams = s.teams.filter((t) => t.division === division).sort((a, b) => a.nick.localeCompare(b.nick));
                if (teams.length === 0) return null;
                return (
                  <div key={division}>
                    <h2 className="display mb-1 border-t-2 border-ink pt-2.5 text-[22px] leading-none">{division}</h2>
                    <ul className="divide-y divide-line">
                      {teams.map((t) => {
                        const sum = summary[t.team];
                        return (
                          <li key={t.team} className="tc grid grid-cols-[7.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)_5rem]" style={teamVars(t)}>
                            <Link
                              href={`/team/${t.team}`}
                              className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-sm text-[15px] font-semibold hover:underline"
                            >
                              <span aria-hidden className="h-6 w-1.5 shrink-0 rounded-[2px]" style={{ background: "var(--team)" }} />
                              <span className="truncate">{t.nick}</span>
                            </Link>
                            {sum && (
                              <>
                                <AvailabilityBar
                                  scale={scale}
                                  height={10}
                                  title={t.name}
                                  subject={t.name}
                                  slices={{ ...slicesOf(sum), dead: sum.dead_money ?? 0 }}
                                  hrefs={{ ...statusHrefs(t.team), dead: deadHref(t.team) }}
                                />
                                <span className="num text-right text-sm font-medium" title="Counted cap">
                                  {money(sum.cap_total)}
                                </span>
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        <p className="text-xs text-ink-3">The figure beside each bar is the team&apos;s counted cap. Bars share one dollar scale and include the year&apos;s dead money.</p>
      </main>
    </>
  );
}
