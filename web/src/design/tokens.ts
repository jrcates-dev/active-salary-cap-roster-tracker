/**
 * Design tokens for the salary cap tracker.
 *
 * Color does three jobs and nothing else (PLAN.md, "Color system"):
 *   1. Team identity   - the team's color fills its bars and tiles.
 *   2. Availability    - active is solid team color; questionable is the team color
 *                        with a dashed outline; inactive is a diagonal hatch of the
 *                        team color; practice squad / other is a faint tint; dead
 *                        money is a flat neutral gray.
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

/**
 * The team color to draw marks with on the dark panel. Several primaries (Raiders,
 * Steelers, Texans, Bears, Patriots navy) nearly vanish on near-black, so take the
 * first of the team's colors that clears 3:1 against the panel.
 */
export function displayColor(t: {
  color_primary: string;
  color_secondary: string | null;
  color_3: string | null;
  color_4: string | null;
}): string {
  const options = [t.color_primary, t.color_secondary, t.color_3, t.color_4].filter(
    (c): c is string => !!c,
  );
  return options.find((c) => contrast(c, surface.panel) >= 3) ?? surface.textMuted;
}

/** CSS background for the inactive hatch in a given color. */
export function hatch(color: string): string {
  return `repeating-linear-gradient(135deg, ${color}66 0 2px, ${color}1f 2px 6px)`;
}
