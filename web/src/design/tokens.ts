/**
 * Design tokens for the salary cap tracker.
 *
 * Color does three jobs and nothing else (PLAN.md, "Color system"):
 *   1. Team identity   - the team's color fills its bars and tiles.
 *   2. Availability    - active is solid team color; questionable is the team color
 *                        inside a dashed light outline; out this week is a bold
 *                        diagonal hatch of the team color; out long-term (IR) is a
 *                        faint flat tint; out for the season is an empty outline
 *                        with faint pinstripes; practice squad is a dotted neutral;
 *                        dead money is a flat neutral gray (see Availability.tsx).
 *   3. Intensity       - one sequential ramp for percent of cap in the league
 *                        heatmap. Never used for team identity.
 * Units get a fixed neutral mark, not a color: offense ●, defense ■, special teams ◆.
 */
import type { Unit } from "@/lib/types";

/** Surface and text colors for the dark broadcast-graphics look. */
export const surface = {
  bg: "#0b0d12",
  panel: "#12151d",
  panelRaised: "#181c26",
  border: "#262b38",
  text: "#f3f4f6",
  textMuted: "#9aa3b5",
  textFaint: "#6b7385",
} as const;

/** Dead money is never a team color. */
export const deadMoney = "#5b6170";

/** Practice squad money: a dotted neutral, so it never reads as team money or dead money. */
export const practiceSquad = { fill: "#1d212b", dot: "#6b7385" } as const;

/**
 * Sequential ramp for percent-of-cap intensity (league heatmap).
 * One hue (orange), dark to bright: on the near-black surface the low end recedes
 * toward the background and the high end glows. Never used for team identity.
 */
export const intensityRamp = [
  "#1f1712",
  "#33200f",
  "#4b2a11",
  "#653513",
  "#824114",
  "#a04e15",
  "#c05c16",
  "#e06b18",
  "#ff7b1c",
] as const;

/** Pick a ramp color for a value in [0, 1]. */
export function intensityColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const idx = Math.min(intensityRamp.length - 1, Math.floor(clamped * intensityRamp.length));
  return intensityRamp[idx];
}

/** Ink to put on a ramp cell so the number stays readable. */
export function intensityInk(t: number): string {
  return t >= 0.66 ? "#0b0d12" : "#f3f4f6";
}

/** Unit marks: shapes, not colors, so they coexist with team colors. */
export const unitMark: Record<Unit, { glyph: string; label: string }> = {
  offense: { glyph: "●", label: "Offense" },
  defense: { glyph: "■", label: "Defense" },
  special_teams: { glyph: "◆", label: "Special teams" },
};

/** Units in display order. */
export const UNITS: Unit[] = ["offense", "defense", "special_teams"];

function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text on a team color falls back to white or near-black, whichever reads. */
export function textOn(hex: string): "#ffffff" | "#0b0d12" {
  return contrast(hex, "#ffffff") >= contrast(hex, "#0b0d12") ? "#ffffff" : "#0b0d12";
}

function rgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
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

/** Mix a color toward white by `t` in [0, 1]. */
function lighten(hex: string, t: number): string {
  return `#${rgb(hex)
    .map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0"))
    .join("")}`;
}

const MIN_CONTRAST = 3;

/**
 * The team color to draw marks with on the dark panel. Several primaries (Eagles
 * green, Giants and Colts blue, Cowboys and Texans navy) nearly vanish on
 * near-black. Prefer the first real hue that clears 3:1; if none does, lighten the
 * team's main hue until it does, rather than falling back to a silver or gray
 * secondary that reads as "no team". Only teams with no hue at all (Raiders) get gray.
 */
export function displayColor(t: {
  color_primary: string;
  color_secondary: string | null;
  color_3: string | null;
  color_4: string | null;
}): string {
  const options = [t.color_primary, t.color_secondary, t.color_3, t.color_4].filter(
    (c): c is string => !!c && /^#[0-9a-f]{6}$/i.test(c),
  );
  const hued = options.filter((c) => saturation(c) >= 0.25);
  const ok = hued.find((c) => contrast(c, surface.panel) >= MIN_CONTRAST);
  if (ok) return ok;
  if (hued.length > 0) {
    for (let step = 1; step <= 20; step++) {
      const c = lighten(hued[0], step * 0.05);
      if (contrast(c, surface.panel) >= MIN_CONTRAST) return c;
    }
  }
  return options.find((c) => contrast(c, surface.panel) >= MIN_CONTRAST) ?? surface.textMuted;
}

/** CSS background for the out-this-week hatch in a given color. */
export function hatch(color: string): string {
  return `repeating-linear-gradient(135deg, ${color}d9 0 2px, ${color}24 2px 6px)`;
}
