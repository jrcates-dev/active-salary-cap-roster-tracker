"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CONTRACT_EVENT, contractHref, loadContract, PLAYER_PARAM, type ContractFile, type ContractOpen } from "@/lib/contract";
import { ContractBody, ContractHeader, type Preview } from "./ContractView";

const keyInUrl = () => new URLSearchParams(window.location.search).get(PLAYER_PARAM);

/** How long the sheet takes to slide away (globals.css, `.sheet-out`). */
const LEAVE_MS = 180;

/**
 * The contract sheet, mounted once for the whole site. Any player name (a
 * `ContractLink`) opens it over the page: a panel from the right on wider screens,
 * a sheet from the bottom on a phone. The open player is in the address
 * (`?player=<key>`), so the page can be shared with the contract open, and Back,
 * Escape, the close button or a click outside closes it.
 */
export function ContractSheet() {
  const pathname = usePathname();
  const [open, setOpen] = useState<Preview | null>(null);
  /** The last file fetched (or the fetch that failed), by player key. */
  const [loaded, setLoaded] = useState<{ key: string; file: ContractFile | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);
  /** True when this visit added the history entry, so closing goes Back to the page. */
  const pushed = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const key = open?.player.key ?? null;
  /** The open player's key, for the listeners below. */
  const openKey = useRef<string | null>(null);
  const leaveTimer = useRef(0);

  const show = useCallback((detail: ContractOpen | { key: string; player?: undefined }) => {
    window.clearTimeout(leaveTimer.current);
    if (!openKey.current) returnFocus.current = document.activeElement as HTMLElement | null;
    // Arriving by address, the header waits for the file; a link passes what it knows.
    const player = detail.player ?? (openKey.current === detail.key ? null : { key: detail.key, name: "", team: "" });
    openKey.current = detail.key;
    setLeaving(false);
    if (player) setOpen({ player });
  }, []);

  const hide = useCallback(() => {
    if (!openKey.current) return;
    openKey.current = null;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => {
      setOpen(null);
      setLeaving(false);
      const back = returnFocus.current;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    }, LEAVE_MS);
  }, []);

  // The address decides: on arrival, on Back and Forward, and after moving to another page.
  useEffect(() => {
    const sync = () => {
      const k = keyInUrl();
      if (k) show({ key: k });
      else {
        pushed.current = false;
        hide();
      }
    };
    sync();
    const onOpen = (e: Event) => {
      if (!openKey.current) pushed.current = true;
      show((e as CustomEvent<ContractOpen>).detail);
    };
    window.addEventListener("popstate", sync);
    window.addEventListener(CONTRACT_EVENT, onOpen);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(CONTRACT_EVENT, onOpen);
    };
  }, [pathname, show, hide]);

  // Load the file for the open player.
  useEffect(() => {
    if (!key) return;
    let live = true;
    loadContract(key)
      .then((f) => live && setLoaded({ key, file: f }))
      .catch(() => live && setLoaded({ key, file: null }));
    scroller.current?.scrollTo({ top: 0 });
    return () => {
      live = false;
    };
  }, [key, attempt]);
  const file = loaded && loaded.key === key ? loaded.file : null;
  const failed = !!loaded && loaded.key === key && loaded.file === null;

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(window.history.state, "", contractHref(null, window.location));
      hide();
    }
  }, [hide]);

  // While open: the page behind stays still, Escape closes, Tab stays in the sheet.
  useEffect(() => {
    if (!key) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]");
    first?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      document.removeEventListener("keydown", onKey);
    };
  }, [key, close]);

  if (!open) return null;
  const preview: Preview = file ? { player: file.player, team: file.team } : open;
  return (
    <div className="fixed inset-0 z-[60]">
      <div aria-hidden className={`absolute inset-0 bg-black/55 ${leaving ? "sheet-fade-out" : "sheet-fade-in"}`} onClick={close} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-0 bottom-0 top-[max(12px,env(safe-area-inset-top))] flex flex-col overflow-hidden rounded-t-xl bg-bg shadow-pop sm:inset-y-0 sm:left-auto sm:w-[min(800px,100vw)] sm:rounded-none sm:rounded-l-xl ${
          leaving ? "sheet-out" : "sheet-in"
        }`}
      >
        <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <ContractHeader preview={preview} file={file} titleId={titleId} onClose={close} />
          {file ? (
            <div className="tc" style={file.team.vars}>
              <ContractBody file={file} />
            </div>
          ) : failed ? (
            <div className="px-4 py-10 text-center text-sm text-ink-2 sm:px-6">
              <p>This contract did not load.</p>
              <button
                type="button"
                onClick={() => {
                  setLoaded(null);
                  setAttempt((n) => n + 1);
                }}
                className="mt-2 font-medium text-ink underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          ) : (
            <Skeleton />
          )}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4 px-4 py-6 sm:px-6" aria-label="Loading contract">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-14 rounded-md bg-surface-2" />
        ))}
      </div>
      <div className="h-48 rounded-lg bg-surface-2" />
      <div className="h-40 rounded-lg bg-surface-2" />
    </div>
  );
}
