"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent, type ReactNode } from "react";

/**
 * A tap on a field's invisible touch margin (the wrapper's `.hit` area, outside the
 * field itself) opens or focuses the field, as a tap on the field would.
 */
function openField(field: HTMLSelectElement | HTMLInputElement | null, target: EventTarget) {
  if (!field || target === field) return;
  field.focus();
  if (field instanceof HTMLSelectElement) {
    try {
      field.showPicker?.();
    } catch {
      // Older browsers: focus alone is the fallback.
    }
  }
}

/** One control style for every pick-one choice on the site. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-surface-2 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`hit rounded-[7px] font-medium whitespace-nowrap transition-colors duration-(--dur-1) ${
              size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[13px]"
            } ${active ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06),0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** How long a finger rests on a chip before it adds to the picked chips. */
const HOLD_MS = 450;
/** How far a finger may drift (px) and still count as holding, not scrolling. */
const HOLD_SLOP = 8;

/**
 * Pill filter with an optional count (or any short figure, such as a dollar total).
 * With `onAdd`, the chip can join the chips already picked rather than replace them:
 * Ctrl-click or Cmd-click (Ctrl-click on a Mac too, which the browser turns into a
 * right click), or on a touch screen, press and hold.
 */
export function Chip({
  active,
  onClick,
  onAdd,
  children,
  count,
  title,
  swatch,
}: {
  active: boolean;
  onClick: () => void;
  onAdd?: () => void;
  children: ReactNode;
  count?: ReactNode;
  title?: string;
  swatch?: ReactNode;
}) {
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null);
  /** A hold just added this chip, so the click that ends it does nothing more. */
  const held = useRef(false);
  const touch = useRef(false);
  const letGo = () => {
    if (hold.current) window.clearTimeout(hold.current.timer);
    hold.current = null;
  };
  useEffect(() => letGo, []);

  const adds = onAdd
    ? {
        onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
          held.current = false;
          touch.current = e.pointerType !== "mouse";
          letGo();
          if (!touch.current) return;
          const timer = window.setTimeout(() => {
            hold.current = null;
            held.current = true;
            navigator.vibrate?.(10);
            onAdd();
          }, HOLD_MS);
          hold.current = { timer, x: e.clientX, y: e.clientY };
        },
        // Sliding the row sideways is a scroll, not a hold.
        onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
          const h = hold.current;
          if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > HOLD_SLOP) letGo();
        },
        onPointerUp: letGo,
        onPointerCancel: letGo,
        onPointerLeave: letGo,
        onKeyDown: () => {
          held.current = false;
        },
        onContextMenu: (e: MouseEvent<HTMLButtonElement>) => {
          // A long press on Android opens the menu; the hold handles it instead.
          if (touch.current) return e.preventDefault();
          if (e.ctrlKey) {
            e.preventDefault();
            onAdd();
          }
        },
      }
    : {};

  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      {...adds}
      onClick={(e) => {
        if (held.current) {
          held.current = false;
          return;
        }
        if (onAdd && (e.ctrlKey || e.metaKey)) return onAdd();
        onClick();
      }}
      className={`hit flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[13px] whitespace-nowrap transition-colors duration-(--dur-1) ${
        onAdd ? "select-none [-webkit-touch-callout:none]" : ""
      } ${active ? "border-ink bg-ink text-bg" : "border-line text-ink-2 hover:border-line-2 hover:text-ink"}`}
    >
      {swatch}
      {children}
      {count !== undefined && <span className={`num text-xs ${active ? "text-bg/70" : "text-ink-3"}`}>{count}</span>}
    </button>
  );
}

/** Small icon button for stepping through weeks, teams or games. */
export function StepButton({
  dir,
  onClick,
  disabled,
  label,
}: {
  dir: "prev" | "next";
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="hit hit-sq flex h-7 w-7 items-center justify-center rounded-md border border-line text-ink-2 transition-colors duration-(--dur-1) enabled:hover:border-line-2 enabled:hover:text-ink disabled:opacity-35"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path
          d={dir === "prev" ? "M7.5 2.5 4 6l3.5 3.5" : "M4.5 2.5 8 6l-3.5 3.5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

const CHEVRON = (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="pointer-events-none absolute top-1/2 right-2 z-[2] -translate-y-1/2 text-ink-3">
    <path d="M3 4.5 6 7.5l3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Styled native select, for lists too long for a segmented control. The browser's
 * own arrow is swapped for the site's chevron so it matches in every browser.
 */
export function Select({
  value,
  onChange,
  label,
  children,
  className = "",
}: {
  value: string | number;
  onChange: (v: string) => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const field = useRef<HTMLSelectElement>(null);
  return (
    <span className={`hit relative inline-flex shrink-0 ${className}`} onClick={(e) => openField(field.current, e.target)}>
      <select
        ref={field}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="relative z-[1] h-7 min-h-full w-full cursor-pointer appearance-none rounded-md border border-line bg-surface py-0 pr-7 pl-2.5 text-[13px] text-ink transition-colors duration-(--dur-1) hover:border-line-2"
      >
        {children}
      </select>
      {CHEVRON}
    </span>
  );
}

/** Search box with a magnifier, the same height as the chips and selects beside it. */
export function SearchInput({
  value,
  onChange,
  label,
  placeholder = "Search",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}) {
  const field = useRef<HTMLInputElement>(null);
  return (
    <span className={`hit relative inline-flex min-w-0 ${className}`} onClick={(e) => openField(field.current, e.target)}>
      <svg
        width="13"
        height="13"
        viewBox="0 0 14 14"
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 z-[2] -translate-y-1/2 text-ink-3"
      >
        <circle cx="6" cy="6" r="4.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="m9.25 9.25 3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        ref={field}
        type="search"
        placeholder={placeholder}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="relative z-[1] h-7 min-h-full w-full min-w-0 rounded-md border border-line bg-surface pr-2 pl-8 text-[13px] text-ink placeholder:text-ink-4 transition-colors duration-(--dur-1) hover:border-line-2 focus:border-line-2 focus:outline-none"
      />
    </span>
  );
}
