/**
 * Beurtengenerator (PRD §2.1A, acceptatietest §8.4)
 *
 * Zet een actief onderhoudscontract om in beurten: werkitems van type
 * "onderhoudsbeurt" (convex/werkitems.ts-conventies) voor een rollende
 * planningshorizon van 12 maanden, gespreid volgens de frequentie per
 * bouwsteen-regel én binnen het seizoensvenster van die regel.
 *
 * Eigenschappen:
 * - Beurten landen ONGEPLAND in de wachtrij: status "gepland", geen
 *   geplandeStart/teamId. `voorzieneDatum` is een richtdatum, geen planning.
 * - Idempotent: elke beurt krijgt een generatieSleutel
 *   `${contractWerkzaamheidId}:${voorzieneDatum}`; bestaande sleutels worden
 *   overgeslagen (ook vervallen/soft-deleted beurten komen niet terug).
 * - De nachtelijke cron (convex/crons.ts → vulHorizonAan) vult de horizon
 *   aan voor alle actieve contracten. De cron mailt NOOIT.
 * - Alleen regels met `frequentiePerJaar` genereren beurten; legacy
 *   seizoenstemplate-regels (zonder dat veld) blijven documentatie.
 */

import { v, ConvexError } from "convex/values";
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requireKantoor } from "./roles";
import { logTijdlijnEvent } from "./tijdlijn";

// ─── Constanten ──────────────────────────────────────────────────────────────

/** Rollende planningshorizon in maanden (PRD §2.1). */
export const HORIZON_MAANDEN = 12;

const DAG_MS = 24 * 60 * 60 * 1000;

export const MAAND_NAMEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
] as const;

// ─── Pure datumhelpers (unit-testbaar zonder ctx) ────────────────────────────

function isoNaarMs(datum: string): number {
  return Date.parse(`${datum}T00:00:00Z`);
}

function msNaarIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Vandaag als "YYYY-MM-DD" (UTC-grens volstaat, zie uurtarieven.ts). */
export function vandaagIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Maanden optellen bij een ISO-datum (YYYY-MM-DD). */
export function addMaanden(datum: string, maanden: number): string {
  const d = new Date(`${datum}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + maanden);
  return d.toISOString().slice(0, 10);
}

/**
 * Seizoensvenster van een regel voor één "seizoensjaar":
 * van de 1e van vensterVanMaand t/m de laatste dag van vensterTotMaand.
 * Zonder venster: het hele kalenderjaar. Het venster mag over de jaargrens
 * lopen (bv. van=10, tot=3 → 1 okt jaar t/m 31 mrt jaar+1).
 */
export function vensterVoorJaar(
  jaar: number,
  vensterVanMaand?: number,
  vensterTotMaand?: number
): { start: string; eind: string } {
  const van = vensterVanMaand ?? 1;
  const tot = vensterTotMaand ?? 12;
  const eindJaar = tot < van ? jaar + 1 : jaar;
  const start = msNaarIso(Date.UTC(jaar, van - 1, 1));
  // Dag 0 van maand+1 = laatste dag van maand `tot`
  const eind = msNaarIso(Date.UTC(eindJaar, tot, 0));
  return { start, eind };
}

/**
 * Spreid `aantal` beurten gelijkmatig over een venster (midpoint-verdeling):
 * beurt i valt op vensterStart + floor((i + 0.5) × dagen / aantal).
 * Voorbeeld §8.4: 26×/jaar in venster mrt–nov (~275 dagen) → elke ~10,6 dagen,
 * feitelijk "wekelijks-achtig" binnen het venster.
 */
export function spreidDatumsInVenster(
  aantal: number,
  vensterStart: string,
  vensterEind: string
): string[] {
  if (aantal < 1) return [];
  const startMs = isoNaarMs(vensterStart);
  const eindMs = isoNaarMs(vensterEind);
  const dagen = Math.floor((eindMs - startMs) / DAG_MS) + 1; // inclusief
  if (dagen < 1) return [];
  const datums: string[] = [];
  for (let i = 0; i < aantal; i++) {
    const offset = Math.min(
      dagen - 1,
      Math.floor(((i + 0.5) * dagen) / aantal)
    );
    datums.push(msNaarIso(startMs + offset * DAG_MS));
  }
  return datums;
}

export interface RegelRitme {
  frequentiePerJaar: number;
  vensterVanMaand?: number;
  vensterTotMaand?: number;
}

export interface GeplandeBeurt {
  datum: string; // voorzieneDatum, YYYY-MM-DD
  volgnummer: number; // positie binnen het seizoensjaar (1-based)
  totaal: number; // totaal beurten in dat seizoensjaar (= frequentiePerJaar)
}

/**
 * Alle beurten van een regel binnen [horizonStart, horizonEind] (inclusief).
 * Volgnummer/totaal zijn per seizoensjaar, zodat een beurt halverwege het
 * jaar bv. "12/26" heet — ook als eerdere beurten buiten de horizon vallen.
 */
export function planBeurtenVoorRegel(
  regel: RegelRitme,
  horizonStart: string,
  horizonEind: string
): GeplandeBeurt[] {
  if (horizonStart > horizonEind) return [];
  const aantal = Math.floor(regel.frequentiePerJaar);
  if (aantal < 1) return [];

  const eersteJaar = Number(horizonStart.slice(0, 4)) - 1; // venster kan wrappen
  const laatsteJaar = Number(horizonEind.slice(0, 4));
  const beurten: GeplandeBeurt[] = [];

  for (let jaar = eersteJaar; jaar <= laatsteJaar; jaar++) {
    const venster = vensterVoorJaar(
      jaar,
      regel.vensterVanMaand,
      regel.vensterTotMaand
    );
    const datums = spreidDatumsInVenster(aantal, venster.start, venster.eind);
    datums.forEach((datum, i) => {
      if (datum >= horizonStart && datum <= horizonEind) {
        beurten.push({ datum, volgnummer: i + 1, totaal: aantal });
      }
    });
  }

  return beurten.sort((a, b) => a.datum.localeCompare(b.datum));
}

/** Idempotentiesleutel van een gegenereerde beurt. */
export function maakGeneratieSleutel(
  werkzaamheidId: string,
  datum: string
): string {
  return `${werkzaamheidId}:${datum}`;
}

/** Titel van een beurt, bv. "Maaibeurt 12/26 — mei". */
export function beurtTitel(
  omschrijving: string,
  volgnummer: number,
  totaal: number,
  datum: string
): string {
  const maand = MAAND_NAMEN[Number(datum.slice(5, 7)) - 1];
  return `${omschrijving} ${volgnummer}/${totaal} — ${maand}`;
}

// ─── Generator (gedeeld door activeren-knop en cron) ─────────────────────────

/**
 * Genereer ontbrekende beurten voor één contract binnen de rollende horizon.
 * Idempotent; retourneert het aantal nieuw aangemaakte beurten.
 */
export async function genereerBeurtenVoorContract(
  ctx: MutationCtx,
  contract: Doc<"onderhoudscontracten">,
  vandaag: string = vandaagIso()
): Promise<number> {
  // Horizon: vandaag + 12 maanden, geklemd op de contractlooptijd
  const horizonStart =
    contract.startDatum > vandaag ? contract.startDatum : vandaag;
  const horizonEindRaw = addMaanden(vandaag, HORIZON_MAANDEN);
  const horizonEind =
    contract.eindDatum < horizonEindRaw ? contract.eindDatum : horizonEindRaw;
  if (horizonStart > horizonEind) return 0;

  const werkzaamheden = await ctx.db
    .query("contractWerkzaamheden")
    .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
    .collect();

  // Bestaande sleutels (incl. vervallen/soft-deleted: die komen niet terug)
  const bestaandeBeurten = await ctx.db
    .query("projecten")
    .withIndex("by_contract", (q) => q.eq("contractId", contract._id))
    .collect();
  const bestaandeSleutels = new Set(
    bestaandeBeurten
      .map((b) => b.generatieSleutel)
      .filter((s): s is string => s !== undefined)
  );

  const now = Date.now();
  const adres = `${contract.locatie.adres}, ${contract.locatie.postcode} ${contract.locatie.plaats}`;
  let aangemaakt = 0;

  for (const regel of werkzaamheden) {
    if (regel.frequentiePerJaar === undefined) continue; // legacy template-regel
    const beurten = planBeurtenVoorRegel(
      {
        frequentiePerJaar: regel.frequentiePerJaar,
        vensterVanMaand: regel.vensterVanMaand,
        vensterTotMaand: regel.vensterTotMaand,
      },
      horizonStart,
      horizonEind
    );

    for (const beurt of beurten) {
      const sleutel = maakGeneratieSleutel(regel._id.toString(), beurt.datum);
      if (bestaandeSleutels.has(sleutel)) continue;
      bestaandeSleutels.add(sleutel);

      await ctx.db.insert("projecten", {
        userId: contract.userId,
        type: "onderhoudsbeurt",
        klantId: contract.klantId,
        naam: beurtTitel(
          regel.omschrijving,
          beurt.volgnummer,
          beurt.totaal,
          beurt.datum
        ),
        status: "gepland",
        contractId: contract._id,
        contractWerkzaamheidId: regel._id,
        generatieSleutel: sleutel,
        voorzieneDatum: beurt.datum,
        // Ongepland: geen geplandeStart/geplandeEind/teamId — wachtrij (§2.2)
        geschatteUren:
          regel.geschatteUrenPerBeurt > 0
            ? regel.geschatteUrenPerBeurt
            : undefined,
        adres,
        createdAt: now,
        updatedAt: now,
      });
      aangemaakt++;
    }
  }

  return aangemaakt;
}

/**
 * Toekomstige ongeplande beurten van een contract op "vervallen" zetten
 * (bij opzeggen/beëindigen, PRD §1.1-status "vervallen"). Beurten die al
 * ingepland, uitgevoerd of gefactureerd zijn blijven staan.
 */
export async function vervalOngeplandeBeurten(
  ctx: MutationCtx,
  contractId: Doc<"onderhoudscontracten">["_id"]
): Promise<number> {
  const beurten = await ctx.db
    .query("projecten")
    .withIndex("by_contract", (q) => q.eq("contractId", contractId))
    .collect();

  const now = Date.now();
  let vervallen = 0;
  for (const beurt of beurten) {
    if (beurt.deletedAt) continue;
    if (beurt.status !== "gepland") continue;
    if (beurt.geplandeStart !== undefined) continue; // al ingepland → laten staan
    await ctx.db.patch(beurt._id, { status: "vervallen", updatedAt: now });
    vervallen++;
  }
  return vervallen;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

/**
 * Contract activeren (kantoor-only): status concept → actief en de
 * beurtengenerator draaien. Op een al actief contract is dit een idempotente
 * her-run (vult alleen ontbrekende beurten aan).
 */
export const activeerContract = mutation({
  args: { id: v.id("onderhoudscontracten") },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);

    const contract = await ctx.db.get(args.id);
    if (
      !contract ||
      contract.deletedAt ||
      contract.userId.toString() !== user._id.toString()
    ) {
      throw new ConvexError("Contract niet gevonden");
    }
    if (contract.status !== "concept" && contract.status !== "actief") {
      throw new ConvexError(
        "Alleen concept- of actieve contracten kunnen geactiveerd worden"
      );
    }

    if (contract.status === "concept") {
      await ctx.db.patch(args.id, { status: "actief", updatedAt: Date.now() });

      // — Klanttijdlijn (PRD §2.3): contract geactiveerd (alleen bij de
      // echte overgang concept → actief; her-runs loggen niet dubbel).
      // Additief en niet-blokkerend.
      await logTijdlijnEvent(ctx, {
        userId: contract.userId,
        klantId: contract.klantId,
        eventType: "contract_geactiveerd",
        auteurId: user._id,
        auteurNaam: user.name,
        tekst: `Onderhoudscontract ${contract.contractNummer} geactiveerd`,
      });
    }

    const aantalNieuweBeurten = await genereerBeurtenVoorContract(ctx, {
      ...contract,
      status: "actief",
    });

    return { contractId: args.id, aantalNieuweBeurten };
  },
});

/**
 * Nachtelijke horizon-aanvulling (cron, convex/crons.ts). Idempotent:
 * bestaat een beurt (generatieSleutel) al, dan wordt hij overgeslagen.
 * Deze job verstuurt NOOIT e-mail en raakt geen mailpaden.
 */
export const vulHorizonAan = internalMutation({
  args: {},
  handler: async (ctx) => {
    const actieveContracten = await ctx.db
      .query("onderhoudscontracten")
      .withIndex("by_status", (q) => q.eq("status", "actief"))
      .collect();

    let totaal = 0;
    for (const contract of actieveContracten) {
      if (contract.deletedAt) continue;
      totaal += await genereerBeurtenVoorContract(ctx, contract);
    }

    console.log(
      `[beurtgenerator] horizon aangevuld: ${totaal} nieuwe beurten over ${actieveContracten.length} actieve contracten`
    );
    return { aantalNieuweBeurten: totaal };
  },
});
