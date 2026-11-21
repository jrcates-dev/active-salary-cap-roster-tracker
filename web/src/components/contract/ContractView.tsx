"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { statusText } from "@/lib/availability";
import { dealTypeLabel, heightLabel, otherBonuses, proration, type ContractFile, type ContractPlayer } from "@/lib/contract";
import { ageLabel, ageOn, money, ordinal, pct } from "@/lib/format";
import type { CareerContract, ContractRecord, ContractYear } from "@/lib/types";
import { playerSlice, Swatch } from "../Availability";
import { Logo } from "../Logo";
import { depthText, StarterMark } from "../Starter";
import { CapChart, CapChartKey, GtdMark } from "./CapChart";
import { Ledger } from "./Ledger";
import { Release } from "./Release";

/** The header the sheet can draw before the file arrives: name, team, status. */
export interface Preview {
  player: Partial<ContractPlayer> & Pick<ContractPlayer, "key" | "name" | "team">;
  team?: ContractFile["team"];
}

/** The sheet's dark band: who he is, his status, and the deal in one line of figures. */
export function ContractHeader({
  preview,
  file,
  titleId,
  onClose,
}: {
  preview: Preview;
  file: ContractFile | null;
  titleId: string;
  onClose: () => void;
}) {
  const p: Partial<ContractPlayer> & Pick<ContractPlayer, "key" | "name" | "team"> = file?.player ?? preview.player;
  const team = file?.team ?? preview.team;
  const c = file?.contract ?? null;
  const vars = (team?.vars ?? {}) as CSSProperties;
  const bio = c?.bio;
  // Worked out at build time for the day the data was pulled, like every age on the site.
  const age = p.age ?? ageOn(bio?.birth_date, new Date());
  const facts = [
    age != null ? `Age ${ageLabel(age)}` : null,
    [heightLabel(bio?.height ?? null), bio?.weight ? `${bio.weight} lb` : null].filter(Boolean).join(", ") || null,
    bio?.college ? bio.college.split(";")[0] : null,
    bio?.draft_year
      ? bio.draft_round
        ? `Drafted ${bio.draft_year}, round ${bio.draft_round}${bio.draft_pick ? `, pick ${bio.draft_pick}` : ""}${bio.draft_team && bio.draft_team !== p.team ? ` (${bio.draft_team})` : ""}`
        : `Undrafted, ${bio.draft_year}`
      : null,
    bio?.experience != null ? (bio.experience <= 0 ? "Rookie" : `${ordinal(bio.experience + 1)} season`) : null,
  ].filter(Boolean);
  const slice = p.flag ? playerSlice({ flag: p.flag, absence: p.absence ?? null }) : null;
  const role = p.flag ? depthText({ starter: p.starter ?? null, depth_role: p.depth_role ?? null, flag: p.flag }) : null;

  return (
    <div className="board board-band tc" style={vars}>
      <div className="px-4 pt-3 pb-5 sm:px-6 sm:pt-4 sm:pb-6">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Contract</p>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label="Close contract"
            className="hit hit-sq -mr-1.5 flex h-8 w-8 items-center justify-center rounded-md text-ink-2 transition-colors duration-(--dur-1) hover:bg-surface-2 hover:text-ink"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="mt-2 flex items-center gap-4">
          <Headshot src={p.headshot ?? null} name={p.name} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13px] text-ink-2">
              {team && <Logo src={team.logo_url} size={18} fallback={team.abbr} />}
              <span className="truncate">
                {[team?.nick ?? p.team, p.pos ?? p.group, bio?.jersey ? `#${bio.jersey}` : null].filter(Boolean).join(" · ")}
              </span>
            </p>
            <h2 id={titleId} className="display mt-0.5 text-[32px] leading-[0.95] sm:text-[42px]">
              {p.name || <span className="inline-block h-8 w-48 animate-pulse rounded bg-surface-2 align-middle" aria-label="Loading" />}
            </h2>
            {p.flag && slice && (
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <Swatch k={slice} size={10} />
                  {statusText({ flag: p.flag, absence: p.absence ?? null, reason: p.reason ?? null, out_tag: p.out_tag ?? null })}
                </span>
                {(p.outlook_note ?? p.injury) && <span className="text-ink-3">{p.outlook_note ?? p.injury}</span>}
                {role && (
                  <span className="inline-flex items-center gap-1 text-ink-3">
                    {p.starter && <StarterMark player={{ starter: true, depth_role: p.depth_role ?? null, flag: p.flag }} />}
                    {role}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        {facts.length > 0 && <p className="mt-3 text-xs leading-relaxed text-ink-3">{facts.join(" · ")}</p>}
        {c?.deal ? <DealLine c={c} season={file!.season} /> : file && <NoDeal c={c} p={p} />}
        {!file && <div className="mt-5 h-[76px] animate-pulse rounded-lg bg-surface-2/60" />}
      </div>
    </div>
  );
}

function Headshot({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return (
    <span className="relative flex h-[68px] w-[68px] shrink-0 items-end justify-center overflow-hidden rounded-xl bg-surface-2 shadow-[inset_0_0_0_1px_var(--line-2)] sm:h-[84px] sm:w-[84px]">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover object-top" onError={() => setFailed(true)} />
      ) : (
        <span className="display self-center text-[26px] text-ink-3">{initials}</span>
      )}
      {/* A rule in the team color along the bottom, like a name plate. */}
      <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: "var(--team)" }} />
    </span>
  );
}

/** The deal as the headlines report it: years, total, per year, guaranteed. */
function DealLine({ c, season }: { c: ContractRecord; season: number }) {
  const d = c.deal!;
  const last = d.last_season;
  const figures: { label: string; value: string; lead?: boolean }[] = [
    { label: "Total value", value: d.value != null ? money(d.value) : "–", lead: true },
    { label: d.years === 1 ? "Year" : "Years", value: d.years != null ? String(d.years) : "–" },
    { label: "Per year", value: d.apy != null ? money(d.apy) : "–" },
    { label: "Guaranteed", value: d.guaranteed != null ? money(d.guaranteed) : "–" },
  ];
  const signedWith = d.team && d.team !== c.team ? ` with ${d.team}` : "";
  return (
    <div className="mt-4">
      <p className="text-[13px] text-ink-2">
        <span className="font-medium text-ink">{dealTypeLabel(d.type)}</span>
        {d.signed ? `, signed ${d.signed}${signedWith}` : ""}
        {last ? ` · runs through ${last}` : ""}
        {last && last >= season ? ` · free agent in ${last + 1}` : ""}
      </p>
      <dl className="mt-2.5 grid grid-cols-[1.3fr_0.7fr_1fr_1fr] gap-x-3 sm:gap-x-5">
        {figures.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="truncate text-[11px] text-ink-3 sm:text-xs">{f.label}</dt>
            <dd className={`fig leading-none ${f.lead ? "text-[30px] sm:text-[40px]" : "text-[22px] text-ink-2 sm:text-[30px]"}`}>{f.value}</dd>
          </div>
        ))}
      </dl>
      {d.value != null && d.value > 0 && d.guaranteed != null && (
        <GuaranteeBar value={d.value} guaranteed={d.guaranteed} apyPct={d.apy_cap_pct} />
      )}
    </div>
  );
}

/** How much of the deal is guaranteed, as one bar. */
function GuaranteeBar({ value, guaranteed, apyPct }: { value: number; guaranteed: number; apyPct: number | null }) {
  const share = Math.min(1, guaranteed / value);
  return (
    <div className="mt-3.5">
      <div className="flex h-2 gap-[2px] overflow-hidden rounded-full" aria-hidden>
        <span className="bar-grow h-full rounded-l-full" style={{ width: `${share * 100}%`, background: "var(--team)" }} />
        <span className="h-full flex-1 rounded-r-full bg-surface-3" />
      </div>
      <p className="num mt-1.5 text-[11px] text-ink-3">
        {pct(share, 0)} guaranteed
        {apyPct ? ` · ${pct(apyPct)} of the cap a year when signed` : ""}
      </p>
    </div>
  );
}

function NoDeal({ c, p }: { c: ContractRecord | null; p: Partial<ContractPlayer> }) {
  if (c?.basis === "minimum" || !c) {
    const cap = p.cap ? `: ${money(p.cap)} this season.` : ".";
    return (
      <p className="mt-4 text-[13px] text-ink-2">
        No contract for him in the free data yet.{" "}
        {p.roster_status === "DEV" ? `He counts at practice squad pay${cap}` : `He counts at the league minimum for his experience${cap}`}
      </p>
    );
  }
  return null;
}

/** One figure in the key-figures row, keyed by a rule like the tape's cells. */
function Figure({ label, value, sub, rule = "bg-line-2" }: { label: string; value: ReactNode; sub?: ReactNode; rule?: string }) {
  return (
    <li className="min-w-0">
      <span aria-hidden className={`mb-2 block h-1 w-full rounded-[2px] ${rule}`} />
      <p className="truncate text-[12px] leading-tight text-ink-2">{label}</p>
      <p className="fig mt-1 text-[24px] leading-none sm:text-[28px]">{value}</p>
      {sub && <p className="num mt-1 text-[11px] leading-snug text-ink-3">{sub}</p>}
    </li>
  );
}

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-7">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t-2 border-ink pt-2">
        <h3 className="display text-[19px] leading-none">{title}</h3>
        {aside && <div className="text-xs text-ink-3">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** Everything under the band: key figures, the chart, the ledger, release costs, history. */
export function ContractBody({ file }: { file: ContractFile }) {
  const c = file.contract;
  const p = file.player;
  const season = file.season;
  const ps = p.roster_status === "DEV";
  if (!c || c.basis === "minimum") {
    return (
      <div className="px-4 pb-8 sm:px-6">
        <Notice>
          {ps
            ? `OverTheCap has not published a contract for him, so the free data has none. He is on the practice squad, so the site counts him at practice squad pay, ${money(p.cap)} this season, prorated from the week he joined.`
            : `OverTheCap has not published a contract for him, so the free data has none. The site counts him at the league minimum salary for his years of experience, ${money(p.cap)} this season, prorated from the week he joined the roster.`}
        </Notice>
        <Sources c={c} />
      </div>
    );
  }
  const now = c.years.find((y) => y.season === season);
  const ahead = c.years.filter((y) => y.season >= season && y.kind !== "void");
  const left = ahead.reduce((n, y) => n + y.cash, 0);
  const gtdLeft = c.years.filter((y) => y.season > season && y.kind !== "void").reduce((n, y) => n + y.gtd, 0);
  const gtdThru = Math.max(0, ...c.years.filter((y) => y.season > season && y.gtd > 0).map((y) => y.season));
  const d = c.deal!;
  return (
    <div className="px-4 pb-8 sm:px-6">
      {ps && (
        <Notice>
          On the practice squad: he counts {money(p.cap)} against the cap this season (practice squad pay, prorated), not the contract figures below.
        </Notice>
      )}
      {c.basis === "rookie_scale" && (
        <Notice>
          OverTheCap&rsquo;s year-by-year breakdown of this deal is not in the free data yet. His {season} cap number, {money(p.contract_cap)}, is estimated
          from the rookie wage scale; the terms above are the signed deal.
        </Notice>
      )}
      <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3">
        <Figure
          label={`${season} cap number`}
          value={money(now?.cap ?? p.contract_cap)}
          sub={now?.cap_pct ? `${pct(now.cap_pct)} of the cap` : c.basis === "rookie_scale" ? "estimated" : undefined}
          rule="c-base"
        />
        {now && <Figure label={`${season} cash`} value={money(now.cash)} sub={cashSub(now)} rule="bg-ink" />}
        <Figure
          label="Signing bonus"
          value={d.signing_bonus != null ? money(d.signing_bonus) : "–"}
          sub={d.signing_bonus ? `Paid ${d.signed}, charged over ${spread(c.years, d.signed)}` : d.signing_bonus === 0 ? "None on this deal" : "Not in the free data"}
          rule="c-bonus"
        />
        {c.basis === "contract" && (
          <Figure
            label="Guaranteed still owed"
            value={money(gtdLeft)}
            sub={gtdLeft > 0 ? `Salary guaranteed through ${gtdThru}` : `Nothing guaranteed after ${season}`}
            rule="bg-ink-3"
          />
        )}
        {c.basis === "contract" && ahead.length > 0 && (
          <Figure
            label="Left on the deal"
            value={money(left)}
            sub={ahead.length > 1 ? `Cash ${ahead[0].season}–${ahead[ahead.length - 1].season}` : `Cash in ${season}, the final year`}
            rule="bg-ink-4"
          />
        )}
        {c.release ? (
          <Figure
            label={`Dead money if cut in ${c.release.season}`}
            value={money(c.release.cut.dead)}
            sub={c.release.cut.savings >= 0 ? `Saves ${money(c.release.cut.savings)} (before June 1)` : `Costs ${money(-c.release.cut.savings)} more than keeping him`}
            rule="s-dead"
          />
        ) : (
          c.basis === "contract" && <Figure label="Deal ends" value={String(d.last_season ?? season)} sub={`Free agent in ${(d.last_season ?? season) + 1}`} rule="s-dead" />
        )}
      </ul>

      {c.years.length > 0 && (
        <Section title="Cap number by season" aside={<span className="hidden sm:inline">Hover or tap a season for its parts</span>}>
          <CapChart years={c.years} season={season} />
          <div className="mt-3">
            <CapChartKey />
          </div>
          <CapStory years={c.years} season={season} />
        </Section>
      )}

      {c.years.length > 0 && (
        <Section
          title="Year by year"
          aside={c.years.length > 7 ? "Scroll sideways for more" : c.years.length > 2 ? <span className="sm:hidden">Scroll sideways for more</span> : null}
        >
          <Ledger years={c.years} season={season} team={c.team} />
          <p className="mt-2 text-xs text-ink-3">
            <GtdMark className="mr-1 inline align-[-1px] text-ink-3" />
            Guaranteed salary. Dead money and savings are for a release before June 1 of that league year.
          </p>
        </Section>
      )}

      {c.release && (
        <Section title={`Moving on in ${c.release.season}`} aside="Before that league year starts">
          <Release r={c.release} />
        </Section>
      )}

      {c.history.length > 0 && (
        <Section title="Contract history" aside={`${c.history.length} deal${c.history.length === 1 ? "" : "s"}`}>
          <History rows={c.history} deal={d} />
        </Section>
      )}

      <Sources c={c} />
    </div>
  );
}

/** "5 seasons" from the proration the ledger shows starting the signing year. */
function spread(years: ContractYear[], signed: number | null): string {
  if (!signed) return "up to 5 seasons";
  const n = Math.min(5, years.filter((y) => y.season >= signed && y.prorated > 0).length);
  return n > 1 ? `${n} seasons` : "this season";
}

function cashSub(y: ContractYear): string {
  const parts = [`${money(y.base)} salary`];
  const bonus = y.cash - y.base;
  if (bonus > 50_000) parts.push(`${money(bonus)} bonuses`);
  return parts.join(" + ");
}

/** One sentence under the chart on why cap and cash differ, when they do much. */
function CapStory({ years, season }: { years: ContractYear[]; season: number }) {
  const now = years.find((y) => y.season === season);
  const voids = years.filter((y) => y.kind === "void");
  const lines: string[] = [];
  if (now && now.cash > 0 && now.cap < now.cash * 0.7) {
    lines.push(`His ${season} cap number is ${money(now.cash - now.cap)} under his pay, because bonus money paid now is charged over later seasons.`);
  } else if (now && now.cash > 0 && now.cap > now.cash * 1.3) {
    lines.push(`His ${season} cap number is ${money(now.cap - now.cash)} over his pay, because bonus money paid in earlier seasons is still being charged.`);
  }
  if (voids.length > 0) {
    lines.push(
      `The deal adds void year${voids.length > 1 ? "s" : ""} (${voids.map((v) => v.season).join(", ")}) to spread bonus money thinner; ${money(
        voids.reduce((n, v) => n + v.cap, 0),
      )} lands there as dead money unless he is extended first.`,
    );
  }
  const totalProration = years.reduce((n, y) => n + proration(y), 0);
  const totalOther = years.reduce((n, y) => n + otherBonuses(y), 0);
  if (lines.length === 0 && totalProration === 0 && totalOther === 0) lines.push("No bonus money: his cap number is his salary each season.");
  if (lines.length === 0) return null;
  return <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{lines.join(" ")}</p>;
}

const HISTORY_SHOWN = 5;

function History({ rows, deal }: { rows: CareerContract[]; deal: ContractRecord["deal"] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, HISTORY_SHOWN);
  const isCurrent = (r: CareerContract) => r.status === "Active" && r.signed === deal?.signed;
  return (
    <>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl w-full min-w-[560px] text-[13px]">
            <thead className="bg-surface-2">
              <tr>
                <th className="text-left">Signed</th>
                <th className="text-left">Deal</th>
                <th className="text-right">Value</th>
                <th className="text-right">Per year</th>
                <th className="text-right">Guaranteed</th>
                <th className="text-right">Earned</th>
              </tr>
            </thead>
            <tbody className="num">
              {shown.map((r, i) => (
                <tr key={`${r.signed}-${r.type}-${i}`} className={isCurrent(r) ? "bg-surface-2" : ""}>
                  <td className="whitespace-nowrap">
                    <span className="font-medium">{r.signed}</span>
                    {r.team && <span className="ml-1.5 text-ink-3">{r.team}</span>}
                  </td>
                  <td>
                    <span className={isCurrent(r) ? "font-medium" : ""}>{dealTypeLabel(r.type)}</span>
                    <span className="ml-1.5 text-ink-3">
                      {r.years ? `${r.years} yr${r.years === 1 ? "" : "s"}` : ""}
                      {r.status ? ` · ${r.status === "Active" ? "current" : r.status.toLowerCase()}` : ""}
                    </span>
                  </td>
                  <td className="text-right font-medium whitespace-nowrap">{money(r.value)}</td>
                  <td className="text-right whitespace-nowrap">{money(r.apy)}</td>
                  <td className="text-right whitespace-nowrap">{money(r.guaranteed)}</td>
                  <td className="text-right whitespace-nowrap text-ink-2">
                    {r.earned != null ? money(r.earned) : "–"}
                    {r.pct_earned != null && <span className="ml-1 text-ink-3">{pct(r.pct_earned, 0)}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length > HISTORY_SHOWN && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          className="mt-2 text-[13px] font-medium text-ink-2 underline decoration-line-2 underline-offset-2 hover:text-ink hover:decoration-ink"
        >
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
      <p className="mt-2 text-xs text-ink-3">Earned: what he was paid on each deal through last season, and its share of the deal&rsquo;s value.</p>
    </>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return <p className="mt-5 rounded-lg border border-line bg-surface px-3.5 py-3 text-[13px] leading-relaxed text-ink-2">{children}</p>;
}

/** Where the figures come from, which ones are worked out here, and the link to OverTheCap. */
function Sources({ c }: { c: ContractRecord | null }) {
  return (
    <footer className="mt-8 border-t border-line pt-3 text-xs leading-relaxed text-ink-3">
      <p>
        Contract figures are OverTheCap&rsquo;s, from the nflverse contracts file (CC BY 4.0). Dead money, cap savings and the signing bonus are worked out
        here from the bonus proration, guarantees and cash in that file. Guarantees are OverTheCap&rsquo;s total (full and injury); the free data does not
        split them or give vesting dates, and it carries no incentives.
      </p>
      {c?.otc_url && (
        <p className="mt-2">
          <a href={c.otc_url} target="_blank" rel="noreferrer" className="font-medium text-ink-2 underline decoration-line-2 underline-offset-2 hover:text-ink hover:decoration-ink">
            Full contract on OverTheCap ↗
          </a>
        </p>
      )}
    </footer>
  );
}
