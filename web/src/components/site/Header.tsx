import Link from "next/link";
import { teamVars } from "@/design/tokens";
import type { Snapshot } from "@/lib/types";
import { NavLinks } from "./NavLinks";
import { TeamSwitcher, type SwitcherTeam } from "./TeamSwitcher";

/**
 * The bar every page shares: mark, sections, week, and the team switcher. It is
 * part of the board, dark in both themes. On a phone the sections move to the tab
 * bar at the bottom of the screen (BottomTabs) and this bar keeps the name, the
 * week and the switcher.
 */
export function Header({ snapshot: s }: { snapshot: Snapshot }) {
  const teams: SwitcherTeam[] = [...s.teams]
    .sort((a, b) => a.division.localeCompare(b.division) || a.nick.localeCompare(b.nick))
    .map((t) => ({ team: t.team, nick: t.nick, name: t.name, division: t.division, vars: teamVars(t) }));
  return (
    <>
      <header data-sticky className="board sticky top-0 z-40 border-b border-line-2 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-1.5 px-4 sm:gap-5 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-md" aria-label="Cap Tracker, league overview">
            <Mark />
            <span className="display text-[19px] leading-none tracking-[0.04em]">Cap Tracker</span>
          </Link>
          <NavLinks />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="display rounded-sm border border-line-2 px-2 py-1 text-[13px] leading-none tracking-[0.08em] text-ink-2">
              <span className="hidden md:inline">{s.season} · </span>Week {s.week}
            </span>
            <TeamSwitcher teams={teams} />
          </div>
        </div>
      </header>
      {/* Outside the sticky bar, so the bar is always one height and the notice scrolls away. */}
      {s.fixture && (
        <p className="board border-b border-line bg-accent-soft px-4 py-1.5 text-center text-xs text-ink-2">
          Synthetic fixture data. Real names and dollars come from <code>captracker export</code>.
        </p>
      )}
    </>
  );
}

/** Three bars, two of them cut: the site's mark. */
function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="shrink-0">
      <rect width="26" height="26" rx="5" fill="var(--ink)" />
      <rect x="6" y="6" width="14" height="3.2" rx="1.6" fill="var(--surface)" />
      <rect x="6" y="11.4" width="9" height="3.2" rx="1.6" fill="var(--surface)" />
      <rect x="16.5" y="11.4" width="3.5" height="3.2" rx="1.6" fill="var(--st-active)" />
      <rect x="6" y="16.8" width="5" height="3.2" rx="1.6" fill="var(--surface)" />
    </svg>
  );
}
