"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { money, pct } from "@/lib/format";
import { Segmented } from "../ui/controls";

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
  return (
    <Segmented<Mode>
      label="Show amounts as"
      value={mode}
      onChange={setMode}
      options={[
        { value: "dollars", label: "$", title: "Dollars" },
        { value: "percent", label: "%", title: "Share of counted cap" },
      ]}
    />
  );
}
