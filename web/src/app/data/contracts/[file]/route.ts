import { teamVars } from "@/design/tokens";
import { contractFileName, contractPreview, type ContractFile } from "@/lib/contract";
import { getSnapshot } from "@/lib/data";
import type { ContractRecord, Player } from "@/lib/types";

/**
 * One static JSON file per counted player, `/data/contracts/<key>.json`: his contract
 * and the header details the contract sheet shows. Written at build time; the sheet
 * fetches the one it opens.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const s = await getSnapshot();
  return s.players.map((p) => ({ file: contractFileName(p.key) }));
}

let indexed: Promise<{ players: Map<string, Player>; contracts: Map<string, ContractRecord> }> | null = null;

/** Players and contracts by key, built once per build for the 2,500-odd files. */
function index() {
  indexed ??= getSnapshot().then((s) => ({
    players: new Map(s.players.map((p) => [p.key, p])),
    contracts: new Map(s.contracts.map((c) => [c.key, c])),
  }));
  return indexed;
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const key = decodeURIComponent(file).replace(/\.json$/, "");
  const s = await getSnapshot();
  const { players, contracts } = await index();
  const p = players.get(key);
  if (!p) return Response.json({ error: "not found" }, { status: 404 });
  const t = s.teams.find((x) => x.team === p.team)!;
  const body: ContractFile = {
    season: s.season,
    week: s.week,
    player: contractPreview(p),
    team: { abbr: t.team, name: t.name, nick: t.nick, logo_url: t.logo_url, vars: teamVars(t) as Record<string, string> },
    contract: contracts.get(p.key) ?? null,
  };
  return Response.json(body);
}
