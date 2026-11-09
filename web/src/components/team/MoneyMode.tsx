"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { money, pct } from "@/lib/format";

type Mode = "dollars" | "percent";

interface MoneyModeValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  /** Format a dollar amount in the current mode, as a share of `base` in percent mode. */
  fmt: (dollars: number) => string;
  base: number;
}

const Ctx = createContext<MoneyModeValue | null>(null);

/** Shares one $ / % choice across every number on a team page. */
export function MoneyModeProvider({ base, children }: { base: number; children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("dollars");
  const fmt = (d: number) => (mode === "dollars" ? money(d) : pct(base > 0 ? d / base : 0));
  return <Ctx.Provider value={{ mode, setMode, fmt, base }}>{children}</Ctx.Provider>;
}

export function useMoneyMode(): MoneyModeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMoneyMode needs a MoneyModeProvider");
  return v;
}

/** Inline formatted value for server components that sit inside the provider. */
export function Amount({ value, className }: { value: number; className?: string }) {
  const { fmt } = useMoneyMode();
  return <span className={className}>{fmt(value)}</span>;
}

export function MoneyToggle() {
  const { mode, setMode } = useMoneyMode();
  const opts: { m: Mode; label: string; title: string }[] = [
    { m: "dollars", label: "$", title: "Show dollars" },
    { m: "percent", label: "%", title: "Show share of the team's counted cap" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Show amounts as"
      className="inline-flex rounded-md border border-border bg-panel p-0.5"
    >
      {opts.map((o) => (
        <button
          key={o.m}
          type="button"
          role="radio"
          aria-checked={mode === o.m}
          title={o.title}
          onClick={() => setMode(o.m)}
          className={`num min-w-9 rounded px-2.5 py-1 text-base font-semibold transition-colors ${
            mode === o.m ? "bg-panel-raised text-fg" : "text-fg-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
