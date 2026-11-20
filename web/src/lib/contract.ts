/**
 * The contract view: any player name on the site opens his contract in a sheet over
 * the page. Each player's contract is a small static file, `/data/contracts/<key>.json`
 * (written at build time by `app/data/contracts/[file]/route.ts`), fetched when the
 * sheet opens, so no page carries every contract. The open sheet is in the address as
 * `?player=<key>`, so a contract can be linked to and Back closes it. Kept free of
 * "use client" so server pages can build the links.
 */
import type { ContractRecord, ContractYear, Player } from "./types";

/** The query parameter that holds the open contract. */
export const PLAYER_PARAM = "player";

/** Fired to open the sheet. Detail: `ContractOpen`. */
export const CONTRACT_EVENT = "contract:open";

/** The fields the sheet's header shows before the contract file arrives. */
export type ContractPlayer = Pick<
  Player,
  | "key"
  | "team"
  | "name"
  | "pos"
  | "group"
  | "unit"
  | "cap"
  | "contract_cap"
  | "source"
  | "flag"
  | "reason"
  | "absence"
  | "outlook_basis"
  | "outlook_note"
  | "roster_status"
  | "report_status"
  | "injury"
  | "headshot"
  | "starter"
  | "depth_role"
  | "out_tag"
>;

/** Just the header fields of a player, so a server page passes little to a link. */
export function contractPreview(p: ContractPlayer): ContractPlayer {
  return {
    key: p.key,
    team: p.team,
    name: p.name,
    pos: p.pos,
    group: p.group,
    unit: p.unit,
    cap: p.cap,
    contract_cap: p.contract_cap,
    source: p.source,
    flag: p.flag,
    reason: p.reason,
    absence: p.absence,
    outlook_basis: p.outlook_basis ?? null,
    outlook_note: p.outlook_note ?? null,
    roster_status: p.roster_status,
    report_status: p.report_status,
    injury: p.injury,
    headshot: p.headshot,
    starter: p.starter ?? null,
    depth_role: p.depth_role ?? null,
    out_tag: p.out_tag ?? null,
  };
}

export interface ContractOpen {
  key: string;
  /** What the opener already knows, so the header shows at once. */
  player?: Partial<ContractPlayer> & Pick<Player, "key" | "name" | "team">;
}

/** One player's contract file. */
export interface ContractFile {
  season: number;
  week: number;
  player: ContractPlayer;
  team: { abbr: string; name: string; nick: string; logo_url: string | null; vars: Record<string, string> };
  contract: ContractRecord | null;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Where a player's contract file is served. */
export function contractFileUrl(key: string): string {
  return `${BASE}/data/contracts/${encodeURIComponent(key)}.json`;
}

const files = new Map<string, Promise<ContractFile>>();

/** A player's contract file, fetched once per visit. A failed fetch is forgotten so it can be retried. */
export function loadContract(key: string): Promise<ContractFile> {
  let f = files.get(key);
  if (!f) {
    f = fetch(contractFileUrl(key)).then((r) => {
      if (!r.ok) throw new Error(`contract ${key}: ${r.status}`);
      return r.json() as Promise<ContractFile>;
    });
    f.catch(() => files.delete(key));
    files.set(key, f);
  }
  return f;
}

/** The file name for a key (the route's static param). */
export const contractFileName = (key: string) => `${key}.json`;

/** The current address with the contract open (or closed, for null). */
export function contractHref(key: string | null, loc: { pathname: string; search: string; hash: string }): string {
  const p = new URLSearchParams(loc.search);
  if (key) p.set(PLAYER_PARAM, key);
  else p.delete(PLAYER_PARAM);
  const q = p.toString();
  return `${loc.pathname}${q ? `?${q}` : ""}${loc.hash}`;
}

/** Opens a player's contract: adds it to the address (one Back closes it) and tells the sheet. */
export function openContract(detail: ContractOpen) {
  const href = contractHref(detail.key, window.location);
  const already = new URLSearchParams(window.location.search).get(PLAYER_PARAM);
  // Moving from one open contract to another replaces the entry, so Back still closes.
  if (already) window.history.replaceState(window.history.state, "", href);
  else window.history.pushState(window.history.state, "", href);
  window.dispatchEvent(new CustomEvent<ContractOpen>(CONTRACT_EVENT, { detail }));
}

/** Bonus money charged in a season beyond base salary and proration: roster, workout, per-game and other. */
export const otherBonuses = (y: ContractYear) => (y.roster ?? 0) + (y.workout ?? 0) + (y.per_game ?? 0) + (y.other ?? 0);

/** All bonus proration charged in a season: signing, restructure and option bonuses. */
export const proration = (y: ContractYear) => y.prorated + (y.option ?? 0);

/** Whole years old on a date. */
export function ageOn(birth: string | null, on: Date): number | null {
  if (!birth) return null;
  const b = new Date(`${birth.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(b.getTime())) return null;
  let age = on.getUTCFullYear() - b.getUTCFullYear();
  if (on.getUTCMonth() < b.getUTCMonth() || (on.getUTCMonth() === b.getUTCMonth() && on.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

/** 77 -> 6′5″ */
export const heightLabel = (inches: number | null) => (inches ? `${Math.floor(inches / 12)}′${inches % 12}″` : null);

/** OverTheCap's deal labels in words. */
const DEAL_TYPE: Record<string, string> = {
  Drafted: "Rookie contract",
  UFA: "Free agent signing",
  RFA: "Restricted free agent tender",
  ERFA: "Exclusive rights tender",
  SFA: "Street free agent signing",
  UDFA: "Undrafted free agent signing",
  Extension: "Extension",
  Franchise: "Franchise tag",
  Transition: "Transition tag",
  Practice: "Practice squad contract",
  Other: "Reworked contract",
};

export const dealTypeLabel = (t: string | null) => (t ? (DEAL_TYPE[t] ?? t) : "Contract");
