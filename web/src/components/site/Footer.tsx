import Link from "next/link";
import { stampLabel } from "@/lib/format";
import type { Snapshot } from "@/lib/types";

/** Attribution and freshness, once, at the bottom of every page. */
export function Footer({ snapshot: s }: { snapshot: Snapshot }) {
  const f = s.freshness;
  const injury =
    f?.injury_week == null
      ? "No injury report yet"
      : f.injury_week >= s.week
        ? `Week ${f.injury_week} injury report`
        : `Week ${s.week} injury report pending`;
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 py-6 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          Data from <a className="underline underline-offset-2 hover:text-ink" href="https://github.com/nflverse">nflverse</a> (CC BY 4.0),
          contracts via <a className="underline underline-offset-2 hover:text-ink" href="https://overthecap.com">OverTheCap</a>. Not affiliated with the NFL.{" "}
          <Link href="/methodology" className="underline underline-offset-2 hover:text-ink">
            Methodology
          </Link>
        </p>
        {!s.fixture && (
          <p className="num">
            Updated {stampLabel(s.generated_at)} · {injury}
            {f?.reference_as_of ? ` · Cap space as of ${f.reference_as_of}` : ""}
          </p>
        )}
      </div>
    </footer>
  );
}
