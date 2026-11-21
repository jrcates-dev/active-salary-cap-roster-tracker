/** $48.2M, never $48,200,000. Under $1M shows as $850K. */
export function money(dollars: number, digits = 1): string {
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${Math.round(abs)}`;
}

export function pct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

const REASONS: Record<string, string> = {
  injured_reserve: "Injured reserve",
  pup: "PUP list",
  nfi: "Non-football injury",
  suspended: "Suspended",
  inactive_list: "Gameday inactive",
  reserve_other: "Reserve list",
  out: "Ruled out",
  out_last_game: "Out last game",
  doubtful: "Doubtful",
};

export function reasonLabel(reason: string | null): string | null {
  return reason ? (REASONS[reason] ?? reason) : null;
}

export const FLAG_LABEL: Record<string, string> = {
  active: "Active",
  questionable: "Questionable",
  inactive: "Inactive",
  unknown: "Practice squad / other",
};

export const UNIT_LABEL: Record<string, string> = {
  offense: "Offense",
  defense: "Defense",
  special_teams: "Special teams",
};

/** "Mon Nov 9, 07:30 UTC" from an ISO timestamp; fixed to UTC so the build is stable. */
export function stampLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${day}, ${time} UTC`;
}

/** "Nov 9" from "2026-11-09". */
export function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Where a team's statuses for the week come from, in words. */
export const SOURCE_LABEL: Record<string, string> = {
  final: "Game final: official gameday inactives",
  injury_report: "Pre-game: latest injury report",
  no_report: "Pre-game: injury report not out yet, reserve lists only",
  bye: "Bye week",
};

/**
 * Exact age in years on a date: whole years since his last birthday plus the share
 * of the way to the next one. Someone born on February 29 has his birthday on
 * February 28 in other years. Null when the birth date is missing or unreadable.
 */
export function exactAge(birth: string | null | undefined, on: Date): number | null {
  const m = birth ? /^(\d{4})-(\d{2})-(\d{2})/.exec(birth) : null;
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const birthday = (year: number) => Date.UTC(year, mo, Math.min(d, new Date(Date.UTC(year, mo + 1, 0)).getUTCDate()));
  const today = Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate());
  let years = on.getUTCFullYear() - y;
  if (birthday(y + years) > today) years -= 1;
  if (years < 0 || Number.isNaN(years)) return null;
  const last = birthday(y + years);
  return years + (today - last) / (birthday(y + years + 1) - last);
}

/**
 * Age to the tenth of a year, rounded down the way ages are: 30.0 from his 30th
 * birthday until about five weeks after it, never 30.0 the week before.
 */
export function ageOn(birth: string | null | undefined, on: Date): number | null {
  const a = exactAge(birth, on);
  return a == null ? null : Math.floor(a * 10 + 1e-9) / 10;
}

/** 25.3, 30.0: always one decimal place. */
export const ageLabel = (age: number) => age.toFixed(1);
