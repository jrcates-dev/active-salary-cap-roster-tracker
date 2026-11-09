/**
 * Design tokens for the salary cap tracker.
 *
 * Color does three jobs and nothing else (PLAN.md, "Color system"):
 *   1. Team identity   - the team's primary color fills its bars and tiles.
 *   2. Availability    - active is solid team color; inactive is the same hue at 35%
 *                        opacity with a diagonal hatch; questionable is solid with a
 *                        dashed outline; dead money is a flat neutral gray.
 *   3. Intensity       - one sequential ramp (deep navy to hot orange) for percent of
 *                        cap in the league heatmap and rank badges. Never for teams.
 * Units get a fixed neutral mark, not a color: offense ●, defense ■, special teams ◆.
 */
import teamsJson from "./teams.json";

export type Unit = "offense" | "defense" | "special_teams";
export type GamedayFlag = "active" | "inactive" | "questionable" | "unknown";

export interface TeamTokens {
  team: string;
  name: string;
  nick: string;
  conference: string;
  division: string;
  color_primary: string;
  color_secondary: string | null;
  color_3: string | null;
  color_4: string | null;
  logo_url: string | null;
}

export const TEAMS: readonly TeamTokens[] = teamsJson as TeamTokens[];
export const TEAM_BY_ABBR: Record<string, TeamTokens> = Object.fromEntries(
  TEAMS.map((t) => [t.team, t]),
);

/** Surface and text colors for the dark broadcast-graphics look. */
export const surface = {
  bg: "#0b0d12",
  panel: "#12151d",
  panelRaised: "#181c26",
  border: "#262b38",
  text: "#f3f4f6",
  textMuted: "#9aa3b5",
  textFaint: "#5f6778",
} as const;

/** Availability treatments. Opacity and hatch are applied on top of the team color. */
export const availability: Record<
  GamedayFlag,
  { opacity: number; hatch: boolean; dashed: boolean; label: string }
> = {
  active: { opacity: 1, hatch: false, dashed: false, label: "Active" },
  questionable: { opacity: 1, hatch: false, dashed: true, label: "Questionable" },
  inactive: { opacity: 0.35, hatch: true, dashed: false, label: "Inactive" },
  unknown: { opacity: 0.2, hatch: false, dashed: true, label: "Not on roster" },
};

/** Dead money is never a team color. */
export const deadMoney = "#6b7280";

/** Sequential ramp for percent-of-cap intensity, deep navy to hot orange. */
export const intensityRamp = [
  "#0f1f3d",
  "#1d3a6e",
  "#2a5596",
  "#4a73a8",
  "#8a7f8f",
  "#c48a5f",
  "#e9803a",
  "#ff6a1a",
] as const;

/** Pick a ramp color for a value in [0, 1]. */
export function intensityColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const idx = Math.min(intensityRamp.length - 1, Math.floor(clamped * intensityRamp.length));
  return intensityRamp[idx];
}

/** Unit marks: shapes, not colors, so they coexist with team colors. */
export const unitMark: Record<Unit, { glyph: string; label: string }> = {
  offense: { glyph: "●", label: "Offense" },
  defense: { glyph: "■", label: "Defense" },
  special_teams: { glyph: "◆", label: "Special teams" },
};

/** Position groups in display order, grouped by unit. */
export const positionGroups: readonly { code: string; label: string; unit: Unit }[] = [
  { code: "QB", label: "Quarterback", unit: "offense" },
  { code: "RB", label: "Running back", unit: "offense" },
  { code: "WR", label: "Wide receiver", unit: "offense" },
  { code: "TE", label: "Tight end", unit: "offense" },
  { code: "OL", label: "Offensive line", unit: "offense" },
  { code: "IDL", label: "Interior defensive line", unit: "defense" },
  { code: "EDGE", label: "Edge rusher", unit: "defense" },
  { code: "LB", label: "Off-ball linebacker", unit: "defense" },
  { code: "CB", label: "Cornerback", unit: "defense" },
  { code: "S", label: "Safety", unit: "defense" },
  { code: "K", label: "Kicker", unit: "special_teams" },
  { code: "P", label: "Punter", unit: "special_teams" },
  { code: "LS", label: "Long snapper", unit: "special_teams" },
];

/** Type scale: condensed grotesque for numbers and headers, plain sans for body. */
export const type = {
  display: "var(--font-display)",
  body: "var(--font-body)",
  heroNumber: "48px",
  tabular: "tabular-nums",
} as const;

/** Layout: 12-column grid, 24px gutters, 1px borders, no shadows. */
export const layout = {
  columns: 12,
  gutter: 24,
  radius: 6,
} as const;

/** $48.2M, never $48,200,000. Values under $1M show as $850K. */
export function formatMoney(dollars: number): string {
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

/** Relative luminance check so text on a team color falls back to white or black. */
export function textOn(hex: string): "#ffffff" | "#0b0d12" {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.35 ? "#0b0d12" : "#ffffff";
}
