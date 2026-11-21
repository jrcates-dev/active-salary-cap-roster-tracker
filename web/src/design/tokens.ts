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
 *                        green active, amber questionable, red out, violet out
 *                        for season, neutral practice squad and dead money.
 *                        Textures repeat the hue's meaning.
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
  inactive: "var(--st-out)",
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

/** A real hue, not black, white, gray or silver. */
function isHue(hex: string): boolean {
  return saturation(hex) >= 0.25;
}

/** OKLCH for a hex color: lightness in [0, 1], chroma, hue in radians. */
function oklch(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), Math.atan2(B, A)];
}

/** Linear sRGB for an OKLCH color; a channel outside [0, 1] is out of gamut. */
function oklchToLinear(L: number, C: number, h: number): [number, number, number] {
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Hex for an OKLCH color, giving up chroma (never hue or lightness) to fit sRGB. */
function fromOklch(L: number, C: number, h: number): string {
  const fits = (c: number) => oklchToLinear(L, c, h).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  let chroma = C;
  if (!fits(chroma)) {
    let [lo, hi] = [0, C];
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    chroma = lo;
  }
  const encode = (v: number) => {
    const c = Math.min(1, Math.max(0, v));
    return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  };
  return toHex(oklchToLinear(L, chroma, h).map(encode) as [number, number, number]);
}

const MIN_CONTRAST = 3;
const HEX = /^#[0-9a-f]{6}$/i;

/** Chroma a lifted hue keeps at least, so a navy lifts to a clear blue, not slate. */
const LIFT_MIN_CHROMA = 0.08;

/**
 * Dark-theme lifts picked by eye, where holding the hue is not enough. A deep indigo
 * reads as purple but turns periwinkle once lightened, so the Ravens' purple lifts
 * toward violet instead. Keyed by the source color; each clears 3:1 on SURFACE.dark.
 */
const DARK_LIFT: Record<string, string> = {
  "#241773": "#6c4bd1",
};

/**
 * `hex` as it should read on a theme's surface: unchanged when it already clears
 * 3:1, else moved in lightness only, hue held, until it does (darker on light,
 * lighter on dark). A lighter color with the same chroma reads grayer, so a lift
 * raises chroma in step and to a floor: the Cowboys' navy lifts to a navy blue
 * rather than slate, and the Packers' green to a green rather than sage.
 */
function readable(hex: string, theme: Theme): string {
  const surface = SURFACE[theme];
  if (contrast(hex, surface) >= MIN_CONTRAST) return hex;
  if (theme === "dark" && DARK_LIFT[hex.toLowerCase()]) return DARK_LIFT[hex.toLowerCase()];
  const [L, C, h] = oklch(hex);
  const floor = C >= 0.02 ? LIFT_MIN_CHROMA : 0;
  for (let step = 1; step <= 200; step++) {
    const L2 = theme === "dark" ? L + step * 0.005 : L - step * 0.005;
    if (L2 <= 0 || L2 >= 1) break;
    const C2 = theme === "dark" ? Math.max(C * (1 + (0.5 * (L2 - L)) / Math.max(L, 0.1)), floor) : C;
    const c = fromOklch(L2, C2, h);
    if (contrast(c, surface) >= MIN_CONTRAST) return c;
  }
  return theme === "dark" ? "#8a94a6" : "#64748b";
}

export interface TeamColors {
  color_primary: string;
  color_secondary: string | null;
  color_3: string | null;
  color_4: string | null;
}

/**
 * The team color to draw marks with on a theme's surface: the team's primary color
 * in both themes, so a team looks the same everywhere (PLAN.md, "Color system": the
 * secondary is an accent only).
 *
 * Most primaries read on white as they are; one too light for white (the Saints'
 * gold) is darkened, hue held, until it clears 3:1. On near-black many primaries
 * (Rams and Bills blue, Ravens and Vikings purple, Commanders burgundy, Packers and
 * Eagles green, every navy) nearly vanish, so they are lightened the same way rather
 * than swapped for a gold or orange secondary that reads as a different team.
 *
 * A black primary is identity on white (Steelers, Raiders). On near-black it cannot
 * be lightened into anything but gray, so there the team takes its first other hue
 * (Steelers gold), or with none, its first color that reads (Raiders silver).
 */
export function displayColor(t: TeamColors, theme: Theme = "dark"): string {
  const surface = SURFACE[theme];
  const options = [t.color_primary, t.color_secondary, t.color_3, t.color_4].filter(
    (c): c is string => !!c && HEX.test(c),
  );
  const primary = options[0];
  if (primary && isHue(primary)) return readable(primary, theme);
  if (primary && theme === "light" && luminance(primary) <= 0.03) return primary;
  const hued = options.filter(isHue);
  const ok = hued.find((c) => contrast(c, surface) >= MIN_CONTRAST);
  if (ok) return ok;
  if (hued.length > 0) return readable(hued[0], theme);
  return options.find((c) => contrast(c, surface) >= MIN_CONTRAST) ?? (theme === "dark" ? "#8a94a6" : "#64748b");
}

/**
 * CSS variables for one team, to put on an element with the `tc` class. The theme
 * picks `--team` and `--team-ink` from these in globals.css.
 */
export function teamVars(t: TeamColors): CSSProperties {
  return varsFor(displayColor(t, "light"), displayColor(t, "dark"));
}

function varsFor(light: string, dark: string): CSSProperties {
  return {
    "--tc": light,
    "--tc-ink": textOn(light),
    "--tc-d": dark,
    "--tc-d-ink": textOn(dark),
  } as CSSProperties;
}

/** CIE Lab for a hex color (D65), for telling two colors apart. */
function lab(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const xyz = [
    (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
    0.2126 * r + 0.7152 * g + 0.0722 * b,
    (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883,
  ].map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}

/** Perceptual distance between two colors (CIE76 ΔE). */
function deltaE(a: string, b: string): number {
  const [x, y] = [lab(a), lab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Two team colors closer than this read as one team when they share a chart. */
const MIN_TEAM_DISTANCE = 25;

/**
 * A color for `t` on `theme` that reads on the surface and stands apart from
 * `other`: its usual display color when that is already far enough, else its
 * other hues (each made readable the same way), the first that is.
 */
function distinctColor(t: TeamColors, theme: Theme, other: string): string {
  const usual = displayColor(t, theme);
  if (deltaE(usual, other) >= MIN_TEAM_DISTANCE) return usual;
  const hued = [t.color_primary, t.color_secondary, t.color_3, t.color_4].filter(
    (c): c is string => !!c && HEX.test(c) && isHue(c),
  );
  for (const c of hued) {
    const v = readable(c, theme);
    if (deltaE(v, other) >= MIN_TEAM_DISTANCE) return v;
  }
  return usual;
}

/**
 * Team variables for the two teams of a matchup, where every chart wears both
 * colors. Some pairs land on nearly the same color in a theme (Cowboys and
 * Seahawks share a navy, Packers and Jets a dark green), so the home team takes its
 * next hue that stands apart, per theme. When the home team has none (the Jets have
 * only green and black), the away team takes its next hue instead (Packers gold).
 * Elsewhere teams keep `teamVars`.
 */
export function matchupVars(away: TeamColors, home: TeamColors): [CSSProperties, CSSProperties] {
  const pair = (theme: Theme): [string, string] => {
    const a = displayColor(away, theme);
    const h = distinctColor(home, theme, a);
    if (deltaE(a, h) >= MIN_TEAM_DISTANCE) return [a, h];
    return [distinctColor(away, theme, h), h];
  };
  const [aLight, hLight] = pair("light");
  const [aDark, hDark] = pair("dark");
  return [varsFor(aLight, aDark), varsFor(hLight, hDark)];
}
