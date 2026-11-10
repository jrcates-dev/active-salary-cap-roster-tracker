"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cleanPath } from "./NavLinks";

export interface SwitcherTeam {
  team: string;
  nick: string;
  name: string;
  division: string;
  vars: CSSProperties;
}

const DIVISIONS = ["AFC East", "AFC North", "AFC South", "AFC West", "NFC East", "NFC North", "NFC South", "NFC West"];

/**
 * Jump to any team from any page. The button names the current team on a team page,
 * so it doubles as the location cue; the panel lists all 32 by division and filters
 * as you type.
 */
export function TeamSwitcher({ teams }: { teams: SwitcherTeam[] }) {
  const path = cleanPath(usePathname());
  const current = teams.find((t) => path === `/team/${t.team}`);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const toggle = () => {
    setQuery("");
    setOpen((v) => !v);
  };
  const close = () => setOpen(false);

  // Close on Escape and on a click anywhere else; a pick closes through its link.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => input.current?.focus());
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      q
        ? teams.filter((t) => `${t.name} ${t.team} ${t.division}`.toLowerCase().includes(q))
        : teams,
    [teams, q],
  );

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={current ? `${current.nick}: switch team` : "Teams: switch team"}
        onClick={toggle}
        className={`hit flex h-8 max-w-[7.5rem] items-center gap-1.5 rounded-md border px-2 text-[13px] transition-colors duration-(--dur-1) sm:max-w-none sm:gap-2 sm:px-2.5 sm:text-sm ${
          current || open
            ? "border-line-2 bg-surface text-ink"
            : "border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink"
        }`}
      >
        {current ? (
          <>
            <span aria-hidden className="tc h-3 w-3 shrink-0 rounded-[3px]" style={{ ...current.vars, background: "var(--team)" }} />
            <span className="truncate font-medium">{current.nick}</span>
          </>
        ) : (
          <span>Teams</span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={`shrink-0 text-ink-3 transition-transform duration-(--dur-2) ${open ? "rotate-180" : ""}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Teams"
          className="pop-in absolute right-0 top-[calc(100%+8px)] z-50 w-[min(92vw,680px)] rounded-lg bg-surface p-3 shadow-pop"
        >
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams"
            aria-label="Search teams"
            className="mb-3 h-9 w-full rounded-md border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-4 focus:border-line-2 focus:outline-none"
          />
          {q ? (
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {shown.map((t) => (
                <TeamItem key={t.team} t={t} active={t.team === current?.team} onPick={close} full />
              ))}
              {shown.length === 0 && <li className="col-span-full px-2 py-3 text-sm text-ink-3">No team matches.</li>}
            </ul>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
              {DIVISIONS.map((d) => (
                <div key={d}>
                  <p className="eyebrow mb-1 px-2">{d}</p>
                  <ul>
                    {teams
                      .filter((t) => t.division === d)
                      .map((t) => (
                        <TeamItem key={t.team} t={t} active={t.team === current?.team} onPick={close} />
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamItem({ t, active, onPick, full }: { t: SwitcherTeam; active: boolean; onPick: () => void; full?: boolean }) {
  return (
    <li>
      <Link
        href={`/team/${t.team}`}
        onClick={onPick}
        aria-current={active ? "page" : undefined}
        className={`tc flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-(--dur-1) hover:bg-surface-2 ${
          active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"
        }`}
        style={t.vars}
      >
        <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: "var(--team)" }} />
        <span className="truncate">{full ? t.name : t.nick}</span>
      </Link>
    </li>
  );
}
