/**
 * Color logic for the salary cap tracker. The CSS tokens live in globals.css; this
 * file holds what has to be computed per team: the team color that reads on each
 * theme's surface, and the ink that reads on that color.
 *
 * Color does five jobs and nothing else (PLAN.md, "Color system"):
 *   1. Team identity   - the team's color marks the team: chips, switcher, headers.
 *                        Set per element with the `tc` class and `teamVars()`, read
 *                        as `var(--team)`.
 *   2. Money status    - one fixed hue per availability state, the same on every
 *                        page and every team (globals.css, `--st-*` and `.s-*`):
 *                        teal active, amber questionable, red out this week, berry
 *                        out long-term, violet out for season, neutral practice
 *                        squad and dead money. Textures repeat the hue's meaning.
 *   3. Intensity       - one amber ramp for share of cap (globals.css, `--ramp-N`).
 *   4. Accent          - one orange, only where it carries meaning.
 *   5. Unit            - blue offense, green defense, gold special teams, only on
 *                        charts that split money by unit and on the unit marks
 *                        (offense ●, defense ■, special teams ◆) that label them.
 */
import type { CSSProperties } from "react";
import type { SliceKey } from "@/lib/availability";
import type { Unit } from "@/lib/types";

/** The chart surfaces each theme draws on; team colors must clear 3:1 on them. */
export const SURFACE = { light: "#ffffff", dark: "#141821" } as const;
export type Theme = keyof typeof SURFACE;

/** Unit marks: a shape and a hue, so a unit never depends on color alone. */
export const unitMark: Record<Unit, { glyph: string; label: string; short: string }> = {
  offense: { glyph: "●", label: "Offense", short: "OFF" },
  defense: { glyph: "■", label: "Defense", short: "DEF" },
  special_teams: { glyph: "◆", label: "Special teams", short: "ST" },
};

/** Unit hues (globals.css, `--unit-*`), stepped per theme. */
export const UNIT_COLOR: Record<Unit, string> = {
  offense: "var(--unit-off)",
  defense: "var(--unit-def)",
  special_teams: "var(--unit-st)",
};

/** Money status hues (globals.css, `--st-*`), stepped per theme. */
export const STATUS_COLOR: Record<SliceKey, string> = {
  active: "var(--st-active)",
  questionable: "var(--st-questionable)",
  inactive: "var(--st-week)",
  season: "var(--st-long)",
  year: "var(--st-year)",
  unknown: "var(--ps-dot)",
  dead: "var(--dead)",
};

/** Units in display order. */
export const UNITS: Unit[] = ["offense", "defense", "special_teams"];

/** Index into the 9-step intensity ramp for a value in [0, 1]. */
export function rampStep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return Math.min(8, Math.floor(clamped * 9));
}

function rgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text on a team color: white or near-black, whichever reads. */
export function textOn(hex: string): "#ffffff" | "#111827" {
  return contrast(hex, "#ffffff") >= contrast(hex, "#111827") ? "#ffffff" : "#111827";
}

/** HSL saturation in [0, 1]: silver, white and black score near 0. */
function saturation(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  return (max - min) / (1 - Math.abs(2 * l - 1));
}

/** Mix toward white (t > 0) or black (t < 0). */
function shade(hex: string, t: number): string {
  const target = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  return toHex(rgb(hex).map((v) => v + (target - v) * k) as [number, number, number]);
}

const MIN_CONTRAST = 3;
const HEX = /^#[0-9a-f]{6}$/i;

export interface TeamColors {
  color_primary: string;
  color_secondary: string | null;
  color_3: string | null;
  color_4: string | null;
}

/**
 * The team color to draw marks with on a theme's surface.
 *
 * Light: the first listed color that clears 3:1 on white and is either a real hue
 * or near-black (Steelers and Raiders black is identity too; silver is not). Most
 * primaries pass as they are. A team whose hues are all too light (none today) has
 * its primary darkened until it reads.
 *
 * Dark: several primaries (Eagles green, Giants and Colts blue, Cowboys and Texans
 * navy) nearly vanish on near-black, so prefer the first real hue that clears 3:1;
 * if none does, lighten the main hue until it does rather than fall back to a
 * silver secondary that reads as "no team". Only a team with no hue at all gets gray.
 */
export function displayColor(t: TeamColors, theme: Theme = "dark"): string {
  const surface = SURFACE[theme];
  const options = [t.color_primary, t.color_secondary, t.color_3, t.color_4].filter(
    (c): c is string => !!c && HEX.test(c),
  );
  const hued = options.filter((c) => saturation(c) >= 0.25);
  if (theme === "light") {
    const identity = options.filter((c) => saturation(c) >= 0.25 || luminance(c) <= 0.03);
    const ok = identity.find((c) => contrast(c, surface) >= MIN_CONTRAST);
    if (ok) return ok;
    const base = hued[0] ?? options[0];
    if (base) {
      for (let step = 1; step <= 20; step++) {
        const c = shade(base, -step * 0.05);
        if (contrast(c, surface) >= MIN_CONTRAST) return c;
      }
    }
    return "#64748b";
  }
  const ok = hued.find((c) => contrast(c, surface) >= MIN_CONTRAST);
  if (ok) return ok;
  if (hued.length > 0) {
    for (let step = 1; step <= 20; step++) {
      const c = shade(hued[0], step * 0.05);
      if (contrast(c, surface) >= MIN_CONTRAST) return c;
    }
  }
  return options.find((c) => contrast(c, surface) >= MIN_CONTRAST) ?? "#8a94a6";
}

/**
 * CSS variables for one team, to put on an element with the `tc` class. The theme
 * picks `--team` and `--team-ink` from these in globals.css.
 */
export function teamVars(t: TeamColors): CSSProperties {
  const light = displayColor(t, "light");
  const dark = displayColor(t, "dark");
  return {
    "--tc": light,
    "--tc-ink": textOn(light),
    "--tc-d": dark,
    "--tc-d-ink": textOn(dark),
  } as CSSProperties;
}
