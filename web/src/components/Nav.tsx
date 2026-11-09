import Link from "next/link";
import { stampLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { TeamPicker } from "./TeamPicker";

export function Nav({ snapshot }: { snapshot: Snapshot }) {
  const teams = [...snapshot.teams]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((t) => ({ team: t.team, name: t.name }));
  return (
    <header className="border-b border-border bg-bg/95">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <Link href="/" className="num text-xl font-bold tracking-wide">
          CAP<span className="text-[#ff7b1c]">/</span>TRACKER
        </Link>
        <nav className="flex items-center gap-5 text-sm text-fg-muted">
          <Link href="/" className="hover:text-fg">
            League
          </Link>
          <Link href="/#games" className="hover:text-fg">
            Matchups
          </Link>
          <Link href="/methodology" className="hover:text-fg">
            Methodology
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <span className="num text-sm text-fg-muted">
            {snapshot.season} · Week {snapshot.week}
          </span>
          <TeamPicker teams={teams} />
        </div>
      </div>
      <Freshness snapshot={snapshot} />
      {snapshot.fixture && (
        <div className="border-t border-border bg-panel px-4 py-2 text-center text-sm text-fg-muted">
          Showing synthetic fixture data. Run <code className="text-fg">captracker export</code>{" "}
          in <code className="text-fg">pipeline/</code> to load the real snapshot.
        </div>
      )}
    </header>
  );
}

/** Every page says how fresh its numbers are: build time and the newest source weeks. */
function Freshness({ snapshot: s }: { snapshot: Snapshot }) {
  if (s.fixture) return null;
  const f = s.freshness;
  const injury =
    f?.injury_week == null
      ? "no injury report yet"
      : f.injury_week >= s.week
        ? `injury report for week ${f.injury_week}`
        : `week ${s.week} injury report not out yet`;
  return (
    <div className="border-t border-border/60">
      <p className="mx-auto max-w-7xl px-4 py-1.5 text-xs text-fg-faint sm:px-6">
        Updated {stampLabel(s.generated_at)} · {injury}
        {f?.reference_as_of ? ` · dead money and cap space as of ${f.reference_as_of}` : ""}
      </p>
    </div>
  );
}
