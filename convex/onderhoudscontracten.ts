/**
 * Onderhoudscontracten — CRUD for recurring maintenance contracts
 *
 * Manages contract lifecycle: concept → actief → verlopen/opgezegd
 * Includes werkzaamheden per seizoen and termijnfactuur planning.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth, requireAuthUserId } from "./auth";
import {
  requireDirectieOrProjectleider,
  requireKantoor,
} from "./roles";
import { upgradeKlantPipeline } from "./pipelineHelpers";
import { berekenPrijsPerBeurt } from "./bouwstenen";
import { bepaalTariefOpDatum } from "./uurtarieven";
import { vervalOngeplandeBeurten, addMaanden, vandaagIso } from "./beurtgenerator";
import { logTijdlijnEvent } from "./tijdlijn";
import { laadDocsMap } from "./lib/batchLoad";

// ============================================
// VALIDATORS
// ============================================

const locatieValidator = v.object({
  adres: v.string(),
  postcode: v.string(),
  plaats: v.string(),
  notities: v.optional(v.string()),
});

const betalingsfrequentieValidator = v.union(
  v.literal("maandelijks"),
  v.literal("per_kwartaal"),
  v.literal("halfjaarlijks"),
  v.literal("jaarlijks")
);

const statusValidator = v.union(
  v.literal("concept"),
  v.literal("actief"),
  v.literal("verlopen"),
  v.literal("opgezegd")
);

const seizoenValidator = v.union(
  v.literal("voorjaar"),
  v.literal("zomer"),
  v.literal("herfst"),
  v.literal("winter")
);

/**
 * Facturatiemodus per contract (PRD §2.1). Alleen de datastructuur — de
 * facturatie-engine zelf is §2.8 (latere stap). Default: "per_bezoek".
 */
const facturatiemodusValidator = v.union(
  v.literal("per_bezoek"),
  v.literal("maandelijks_verzameld"),
  v.literal("vast_maandbedrag")
);

/**
 * Bouwsteen-regel van een contract (PRD §2.1 + bijlage A). Het legacy
 * seizoen-enum is optioneel geworden; nieuwe regels sturen op
 * frequentiePerJaar + seizoensvenster (maandnummers, mag over de jaargrens).
 */
const werkzaamheidInputValidator = v.object({
  omschrijving: v.string(),
  scope: v.optional(v.string()),
  bouwsteenId: v.optional(v.id("bouwstenen")),
  frequentiePerJaar: v.optional(v.number()),
  prijsPerBeurt: v.optional(v.number()),
  prijsPerBeurtHandmatig: v.optional(v.boolean()),
  vensterVanMaand: v.optional(v.number()),
  vensterTotMaand: v.optional(v.number()),
  seizoen: v.optional(seizoenValidator),
  frequentie: v.optional(v.number()),
  frequentieEenheid: v.optional(
    v.union(
      v.literal("per_seizoen"),
      v.literal("per_maand"),
      v.literal("per_week")
    )
  ),
  geschatteUrenPerBeurt: v.number(),
});

// ============================================
// HELPERS
// ============================================

/**
 * Calculate the number of termijnen (invoicing periods) per year
 * based on betalingsfrequentie.
 */
function getTermijnenPerJaar(
  frequentie: "maandelijks" | "per_kwartaal" | "halfjaarlijks" | "jaarlijks"
): number {
  switch (frequentie) {
    case "maandelijks":
      return 12;
    case "per_kwartaal":
      return 4;
    case "halfjaarlijks":
      return 2;
    case "jaarlijks":
      return 1;
  }
}

/**
 * Bepaal het volgende contractnummer uit een lijst bestaande nummers met
 * hetzelfde prefix. Pure functie (unit-testbaar).
 */
export function volgendContractNummer(
  prefix: string,
  bestaandeNummers: string[]
): string {
  const maxNum = bestaandeNummers.reduce((max, nummer) => {
    if (!nummer.startsWith(prefix)) return max;
    const num = parseInt(nummer.slice(prefix.length), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `${prefix}${(maxNum + 1).toString().padStart(3, "0")}`;
}

/**
 * Generate the next contract number in the format OHC-YYYY-NNN.
 *
 * Leest via de by_contractnummer-index alleen de nummers van het lopende
 * jaar (prefix-scan) i.p.v. een collect() over alle contracten — dat schaalt
 * en verkleint het conflictvenster; Convex' OCC serialiseert gelijktijdige
 * mutations op deze range zodat dubbele nummers uitblijven.
 */
async function generateContractNummer(ctx: MutationCtx): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OHC-${year}-`;

  const jaargenoten = await ctx.db
    .query("onderhoudscontracten")
    .withIndex("by_contractnummer", (q) =>
      q.gte("contractNummer", prefix).lt("contractNummer", prefix + "\uffff")
    )
    .collect();

  return volgendContractNummer(
    prefix,
    jaargenoten.map((c) => c.contractNummer)
  );
}

/**
 * Indexatieclausule (AV V2.0 art. 5.3): automatisch van toepassing bij een
 * looptijd langer dan 3 maanden. Pure functie (unit-testbaar).
 */
export function isIndexatieVanToepassing(
  startDatum: string,
  eindDatum: string
): boolean {
  return eindDatum > addMaanden(startDatum, 3);
}

/** Zichtbare clausuletekst (offerte, contract, PDF — PRD bijlage A regel 6). */
export const INDEXATIE_CLAUSULE_TEKST =
  "Op dit contract is de jaarlijkse prijsindexatie van toepassing conform " +
  "Algemene Voorwaarden V2.0, artikel 5.3 (contracten met een looptijd " +
  "langer dan 3 maanden).";

/** Effectieve facturatiemodus: undefined (legacy) telt als "per_bezoek". */
export function getFacturatiemodus(
  contract: Pick<Doc<"onderhoudscontracten">, "facturatiemodus">
): "per_bezoek" | "maandelijks_verzameld" | "vast_maandbedrag" {
  return contract.facturatiemodus ?? "per_bezoek";
}

/**
 * Jaarprijs van de bouwsteen-regels: Σ frequentiePerJaar × prijsPerBeurt.
 * Regels zonder frequentie/prijs tellen niet mee. Pure functie.
 */
export function berekenJaarprijsBouwstenen(
  regels: Array<{ frequentiePerJaar?: number; prijsPerBeurt?: number }>
): number {
  return regels.reduce(
    (som, r) => som + (r.frequentiePerJaar ?? 0) * (r.prijsPerBeurt ?? 0),
    0
  );
}

/** Valideer een bouwsteen-regel (frequentie/prijs/venster). Gooit ConvexError. */
export function valideerWerkzaamheidInput(w: {
  omschrijving: string;
  frequentiePerJaar?: number;
  prijsPerBeurt?: number;
  vensterVanMaand?: number;
  vensterTotMaand?: number;
}): void {
  if (!w.omschrijving.trim()) {
    throw new ConvexError("Omschrijving van de werkzaamheid is verplicht");
  }
  if (
    w.frequentiePerJaar !== undefined &&
    (!Number.isFinite(w.frequentiePerJaar) ||
      w.frequentiePerJaar < 1 ||
      w.frequentiePerJaar > 366)
  ) {
    throw new ConvexError("Frequentie per jaar moet tussen 1 en 366 zijn");
  }
  if (
    w.prijsPerBeurt !== undefined &&
    (w.prijsPerBeurt < 0 || !Number.isFinite(w.prijsPerBeurt))
  ) {
    throw new ConvexError("Prijs per beurt kan niet negatief zijn");
  }
  for (const maand of [w.vensterVanMaand, w.vensterTotMaand]) {
    if (
      maand !== undefined &&
      (!Number.isInteger(maand) || maand < 1 || maand > 12)
    ) {
      throw new ConvexError("Venstermaanden moeten 1 t/m 12 zijn");
    }
  }
  if ((w.vensterVanMaand === undefined) !== (w.vensterTotMaand === undefined)) {
    throw new ConvexError(
      "Geef het seizoensvenster met een van- én een tot-maand op"
    );
  }
}

/**
 * Add months to a YYYY-MM-DD date string and return a new YYYY-MM-DD string.
 */
function addMonthsToDate(dateStr: string, months: number): string {
  const date = new Date(dateStr + "T00:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().split("T")[0];
}

/**
 * Generate planned termijnfacturen for a contract period.
 */
function generateTermijnPeriodes(
  startDatum: string,
  eindDatum: string,
  betalingsfrequentie:
    | "maandelijks"
    | "per_kwartaal"
    | "halfjaarlijks"
    | "jaarlijks",
  tariefPerTermijn: number
): Array<{
  termijnNummer: number;
  periodeStart: string;
  periodeEinde: string;
  bedrag: number;
}> {
  const maandenPerTermijn =
    betalingsfrequentie === "maandelijks"
      ? 1
      : betalingsfrequentie === "per_kwartaal"
        ? 3
        : betalingsfrequentie === "halfjaarlijks"
          ? 6
          : 12;

  const periodes: Array<{
    termijnNummer: number;
    periodeStart: string;
    periodeEinde: string;
    bedrag: number;
  }> = [];

  let current = startDatum;
  let termijn = 1;

  while (current < eindDatum) {
    const nextDate = addMonthsToDate(current, maandenPerTermijn);
    // Clamp to eindDatum
    const periodeEinde = nextDate > eindDatum ? eindDatum : nextDate;

    periodes.push({
      termijnNummer: termijn,
      periodeStart: current,
      periodeEinde,
      bedrag: tariefPerTermijn,
    });

    current = nextDate;
    termijn++;
  }

  return periodes;
}

// ============================================
// QUERIES
// ============================================

/**
 * List all contracts for authenticated user.
 * Supports optional status filter.
 */
export const list = query({
  args: {
    status: v.optional(statusValidator),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    let contracts;
    if (args.status) {
      contracts = await ctx.db
        .query("onderhoudscontracten")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    } else {
      contracts = await ctx.db
        .query("onderhoudscontracten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    // Filter out archived/deleted
    let filtered = contracts.filter((c) => !c.deletedAt);
    if (!args.includeArchived) {
      filtered = filtered.filter((c) => !c.isArchived);
    }

    // Enrich with klant naam.
    // N+1 weg (audit §5): één klant kan meerdere contracten hebben, dus de
    // unieke klanten in één ronde ophalen.
    const klantMap = await laadDocsMap(
      ctx,
      filtered.map((c) => c.klantId)
    );

    return filtered.map((contract) => {
      const klant = klantMap.get(contract.klantId.toString());
      return {
        ...contract,
        klantNaam: klant?.naam ?? "Onbekende klant",
        klantPlaats: klant?.plaats ?? "",
      };
    });
  },
});

/**
 * List contracts with cursor-based pagination.
 */
export const listPaginated = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit || 25;

    let queryBuilder;
    if (args.status) {
      queryBuilder = ctx.db
        .query("onderhoudscontracten")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", args.status!)
        );
    } else {
      queryBuilder = ctx.db
        .query("onderhoudscontracten")
        .withIndex("by_user", (q) => q.eq("userId", userId));
    }

    const result = await queryBuilder
      .order("desc")
      .paginate({ numItems: limit, cursor: args.cursor ?? null });

    // Filter out deleted
    const filtered = result.page.filter((c) => !c.deletedAt);

    // Enrich — N+1 weg (audit §5), unieke klanten in één ronde
    const klantMap = await laadDocsMap(
      ctx,
      filtered.map((c) => c.klantId)
    );
    const enriched = filtered.map((contract) => {
      const klant = klantMap.get(contract.klantId.toString());
      return {
        ...contract,
        klantNaam: klant?.naam ?? "Onbekende klant",
        klantPlaats: klant?.plaats ?? "",
      };
    });

    return {
      items: enriched,
      nextCursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  },
});

/**
 * Get contract by ID with werkzaamheden, facturen and klant details.
 */
export const getById = query({
  args: { id: v.id("onderhoudscontracten") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const contract = await ctx.db.get(args.id);
    if (!contract || contract.deletedAt) {
      throw new ConvexError("Contract niet gevonden");
    }

    // Get klant
    const klant = await ctx.db.get(contract.klantId);

    // Get werkzaamheden
    const werkzaamheden = await ctx.db
      .query("contractWerkzaamheden")
      .withIndex("by_contract", (q) => q.eq("contractId", args.id))
      .collect();

    // Get facturen
    const facturen = await ctx.db
      .query("contractFacturen")
      .withIndex("by_contract", (q) => q.eq("contractId", args.id))
      .collect();

    // Gegenereerde beurten (werkitems) van dit contract, per status
    const beurten = await ctx.db
      .query("projecten")
      .withIndex("by_contract", (q) => q.eq("contractId", args.id))
      .collect();
    const actieveBeurten = beurten.filter((b) => !b.deletedAt);
    const beurtenStats = {
      totaal: actieveBeurten.length,
      gepland: actieveBeurten.filter((b) => b.status === "gepland").length,
      uitgevoerd: actieveBeurten.filter((b) => b.status === "uitgevoerd")
        .length,
      gefactureerd: actieveBeurten.filter((b) => b.status === "gefactureerd")
        .length,
      vervallen: actieveBeurten.filter((b) => b.status === "vervallen").length,
    };

    return {
      ...contract,
      klant: klant
        ? {
            _id: klant._id,
            naam: klant.naam,
            adres: klant.adres,
            postcode: klant.postcode,
            plaats: klant.plaats,
            email: klant.email,
            telefoon: klant.telefoon,
          }
        : null,
      werkzaamheden: werkzaamheden.sort((a, b) => a.volgorde - b.volgorde),
      facturen: facturen.sort((a, b) => a.termijnNummer - b.termijnNummer),
      // PRD §2.1: facturatiemodus + zichtbare indexatieclausule
      facturatiemodusEffectief: getFacturatiemodus(contract),
      indexatieVanToepassing: isIndexatieVanToepassing(
        contract.startDatum,
        contract.eindDatum
      ),
      indexatieClausule: isIndexatieVanToepassing(
        contract.startDatum,
        contract.eindDatum
      )
        ? INDEXATIE_CLAUSULE_TEKST
        : null,
      beurtenStats,
    };
  },
});

/**
 * Get all contracts for a specific klant.
 */
export const getByKlant = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const contracts = await ctx.db
      .query("onderhoudscontracten")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .order("desc")
      .collect();

    return contracts.filter((c) => !c.deletedAt);
  },
});

/**
 * Get contracts expiring within X days.
 */
export const getExpiringContracts = query({
  args: {
    dagenVooruit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const days = args.dagenVooruit ?? 90;

    const now = new Date();
    const futureDate = new Date(now);
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateStr = futureDate.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    // Get active contracts
    const contracts = await ctx.db
      .query("onderhoudscontracten")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "actief")
      )
      .collect();

    // Filter those expiring within the window
    const expiring = contracts.filter(
      (c) => c.eindDatum >= todayStr && c.eindDatum <= futureDateStr
    );

    // Enrich with klant naam — N+1 weg (audit §5)
    const klantMap = await laadDocsMap(
      ctx,
      expiring.map((c) => c.klantId)
    );
    const enriched = expiring.map((contract) => ({
      ...contract,
      klantNaam:
        klantMap.get(contract.klantId.toString())?.naam ?? "Onbekende klant",
    }));

    return enriched.sort((a, b) => a.eindDatum.localeCompare(b.eindDatum));
  },
});

/**
 * Get werkzaamheden for current/next season across all active contracts.
 */
export const getUpcomingWork = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Determine current season
    const month = new Date().getMonth(); // 0-11
    let currentSeason: "voorjaar" | "zomer" | "herfst" | "winter";
    if (month >= 2 && month <= 4) currentSeason = "voorjaar";
    else if (month >= 5 && month <= 7) currentSeason = "zomer";
    else if (month >= 8 && month <= 10) currentSeason = "herfst";
    else currentSeason = "winter";

    // Get active contracts
    const contracts = await ctx.db
      .query("onderhoudscontracten")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "actief")
      )
      .collect();

    // N+1 weg (audit §5): de klanten één keer voor álle contracten ophalen
    // i.p.v. één get per contract binnen de lus.
    const klantMap = await laadDocsMap(
      ctx,
      contracts.map((c) => c.klantId)
    );

    // Get werkzaamheden for current season across all contracts
    const werkzaamhedenPerContract = await Promise.all(
      contracts.map((contract) =>
        ctx.db
          .query("contractWerkzaamheden")
          .withIndex("by_contract_seizoen", (q) =>
            q.eq("contractId", contract._id).eq("seizoen", currentSeason)
          )
          .collect()
      )
    );

    const allWork = contracts.map((contract, i) =>
      werkzaamhedenPerContract[i].map((w) => ({
        ...w,
        contractNaam: contract.naam,
        contractNummer: contract.contractNummer,
        klantNaam:
          klantMap.get(contract.klantId.toString())?.naam ?? "Onbekende klant",
        locatie: contract.locatie,
      }))
    );

    return {
      seizoen: currentSeason,
      werkzaamheden: allWork.flat(),
    };
  },
});

/**
 * Dashboard statistics for contracts.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const contracts = await ctx.db
      .query("onderhoudscontracten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const active = contracts.filter((c) => !c.deletedAt);

    const totaalActief = active.filter((c) => c.status === "actief").length;
    const totaalConcept = active.filter((c) => c.status === "concept").length;
    const totaalVerlopen = active.filter((c) => c.status === "verlopen").length;
    const totaalOpgezegd = active.filter((c) => c.status === "opgezegd").length;

    // Total annual value of active contracts
    const jaarlijkseWaarde = active
      .filter((c) => c.status === "actief")
      .reduce((sum, c) => sum + c.jaarlijksTarief, 0);

    // Maandelijkse waarde
    const maandelijkseWaarde = jaarlijkseWaarde / 12;

    // Expiring within 30 days
    const now = new Date();
    const in30Days = new Date(now);
    in30Days.setDate(in30Days.getDate() + 30);
    const todayStr = now.toISOString().split("T")[0];
    const in30DaysStr = in30Days.toISOString().split("T")[0];

    const verlopendBinnen30Dagen = active.filter(
      (c) =>
        c.status === "actief" &&
        c.eindDatum >= todayStr &&
        c.eindDatum <= in30DaysStr
    ).length;

    return {
      totaal: active.length,
      totaalActief,
      totaalConcept,
      totaalVerlopen,
      totaalOpgezegd,
      jaarlijkseWaarde,
      maandelijkseWaarde,
      verlopendBinnen30Dagen,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new contract with werkzaamheden.
 */
export const create = mutation({
  args: {
    klantId: v.id("klanten"),
    naam: v.string(),
    locatie: locatieValidator,
    startDatum: v.string(),
    eindDatum: v.string(),
    opzegtermijnDagen: v.number(),
    tariefPerTermijn: v.number(),
    betalingsfrequentie: betalingsfrequentieValidator,
    indexatiePercentage: v.optional(v.number()),
    facturatiemodus: v.optional(facturatiemodusValidator),
    autoVerlenging: v.boolean(),
    verlengingsPeriodeInMaanden: v.optional(v.number()),
    werkzaamheden: v.array(werkzaamheidInputValidator),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireDirectieOrProjectleider(ctx);
    const now = Date.now();

    for (const w of args.werkzaamheden) {
      valideerWerkzaamheidInput(w);
    }

    // Generate contract number
    const contractNummer = await generateContractNummer(ctx);

    // Jaarlijks tarief: bouwsteen-regels (frequentie × prijs per beurt) winnen;
    // anders het legacy termijnmodel (tarief × termijnen per jaar).
    const jaarprijsBouwstenen = berekenJaarprijsBouwstenen(args.werkzaamheden);
    const termijnenPerJaar = getTermijnenPerJaar(args.betalingsfrequentie);
    const jaarlijksTarief =
      jaarprijsBouwstenen > 0
        ? jaarprijsBouwstenen
        : args.tariefPerTermijn * termijnenPerJaar;

    // Insert contract
    const contractId = await ctx.db.insert("onderhoudscontracten", {
      userId: user._id,
      klantId: args.klantId,
      contractNummer,
      naam: args.naam,
      locatie: args.locatie,
      startDatum: args.startDatum,
      eindDatum: args.eindDatum,
      opzegtermijnDagen: args.opzegtermijnDagen,
      tariefPerTermijn: args.tariefPerTermijn,
      betalingsfrequentie: args.betalingsfrequentie,
      jaarlijksTarief,
      indexatiePercentage: args.indexatiePercentage,
      facturatiemodus: args.facturatiemodus ?? "per_bezoek",
      status: "concept",
      autoVerlenging: args.autoVerlenging,
      verlengingsPeriodeInMaanden: args.verlengingsPeriodeInMaanden,
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });

    // Insert werkzaamheden (bouwsteen-regels)
    for (let i = 0; i < args.werkzaamheden.length; i++) {
      const w = args.werkzaamheden[i];
      const frequentie = w.frequentie ?? w.frequentiePerJaar ?? 1;
      await ctx.db.insert("contractWerkzaamheden", {
        contractId,
        omschrijving: w.omschrijving,
        scope: w.scope,
        bouwsteenId: w.bouwsteenId,
        frequentiePerJaar: w.frequentiePerJaar,
        prijsPerBeurt: w.prijsPerBeurt,
        prijsPerBeurtHandmatig: w.prijsPerBeurtHandmatig,
        vensterVanMaand: w.vensterVanMaand,
        vensterTotMaand: w.vensterTotMaand,
        seizoen: w.seizoen,
        frequentie,
        frequentieEenheid: w.frequentieEenheid,
        geschatteUrenPerBeurt: w.geschatteUrenPerBeurt,
        geschatteUrenTotaal: w.geschatteUrenPerBeurt * frequentie,
        volgorde: i,
        createdAt: now,
      });
    }

    // Termijnschema (contractFacturen) alleen bij modus "vast_maandbedrag":
    // bij per_bezoek/maandelijks_verzameld factureert de latere engine (§2.8)
    // op basis van uitgevoerde beurten — een termijnschema zou daar spookfacturen
    // opleveren (audit-risico 21/27).
    if ((args.facturatiemodus ?? "per_bezoek") === "vast_maandbedrag") {
      const periodes = generateTermijnPeriodes(
        args.startDatum,
        args.eindDatum,
        args.betalingsfrequentie,
        args.tariefPerTermijn
      );

      for (const periode of periodes) {
        await ctx.db.insert("contractFacturen", {
          contractId,
          userId: user._id,
          termijnNummer: periode.termijnNummer,
          periodeStart: periode.periodeStart,
          periodeEinde: periode.periodeEinde,
          bedrag: periode.bedrag,
          status: "gepland",
          createdAt: now,
        });
      }
    }

    // Upgrade klant pipeline
    await upgradeKlantPipeline(ctx, args.klantId, "onderhoud");

    return contractId;
  },
});

/**
 * Update contract details (only concept or actief).
 */
export const update = mutation({
  args: {
    id: v.id("onderhoudscontracten"),
    naam: v.optional(v.string()),
    locatie: v.optional(locatieValidator),
    startDatum: v.optional(v.string()),
    eindDatum: v.optional(v.string()),
    opzegtermijnDagen: v.optional(v.number()),
    tariefPerTermijn: v.optional(v.number()),
    betalingsfrequentie: v.optional(betalingsfrequentieValidator),
    indexatiePercentage: v.optional(v.number()),
    facturatiemodus: v.optional(facturatiemodusValidator),
    autoVerlenging: v.optional(v.boolean()),
    verlengingsPeriodeInMaanden: v.optional(v.number()),
    notities: v.optional(v.string()),
    status: v.optional(statusValidator),
  },
  handler: async (ctx, args) => {
    await requireDirectieOrProjectleider(ctx);

    const contract = await ctx.db.get(args.id);
    if (!contract || contract.deletedAt) {
      throw new ConvexError("Contract niet gevonden");
    }

    if (
      contract.status !== "concept" &&
      contract.status !== "actief" &&
      !args.status // Allow status changes from any state
    ) {
      throw new ConvexError(
        "Alleen concept- en actieve contracten kunnen worden bewerkt"
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (args.naam !== undefined) updates.naam = args.naam;
    if (args.locatie !== undefined) updates.locatie = args.locatie;
    if (args.startDatum !== undefined) updates.startDatum = args.startDatum;
    if (args.eindDatum !== undefined) updates.eindDatum = args.eindDatum;
    if (args.opzegtermijnDagen !== undefined)
      updates.opzegtermijnDagen = args.opzegtermijnDagen;
    if (args.notities !== undefined) updates.notities = args.notities;
    if (args.autoVerlenging !== undefined)
      updates.autoVerlenging = args.autoVerlenging;
    if (args.verlengingsPeriodeInMaanden !== undefined)
      updates.verlengingsPeriodeInMaanden = args.verlengingsPeriodeInMaanden;
    if (args.indexatiePercentage !== undefined)
      updates.indexatiePercentage = args.indexatiePercentage;
    if (args.facturatiemodus !== undefined)
      updates.facturatiemodus = args.facturatiemodus;
    if (args.status !== undefined) updates.status = args.status;

    // Recalculate jaarlijks tarief if pricing changed
    if (
      args.tariefPerTermijn !== undefined ||
      args.betalingsfrequentie !== undefined
    ) {
      const tarief = args.tariefPerTermijn ?? contract.tariefPerTermijn;
      const freq = args.betalingsfrequentie ?? contract.betalingsfrequentie;
      updates.tariefPerTermijn = tarief;
      updates.betalingsfrequentie = freq;
      updates.jaarlijksTarief = tarief * getTermijnenPerJaar(freq);
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Add a werkzaamheid to a contract.
 */
export const addWerkzaamheid = mutation({
  args: {
    contractId: v.id("onderhoudscontracten"),
    omschrijving: v.string(),
    scope: v.optional(v.string()),
    bouwsteenId: v.optional(v.id("bouwstenen")),
    frequentiePerJaar: v.optional(v.number()),
    prijsPerBeurt: v.optional(v.number()),
    prijsPerBeurtHandmatig: v.optional(v.boolean()),
    vensterVanMaand: v.optional(v.number()),
    vensterTotMaand: v.optional(v.number()),
    seizoen: v.optional(seizoenValidator),
    frequentie: v.optional(v.number()),
    frequentieEenheid: v.optional(
      v.union(
        v.literal("per_seizoen"),
        v.literal("per_maand"),
        v.literal("per_week")
      )
    ),
    geschatteUrenPerBeurt: v.number(),
  },
  handler: async (ctx, args) => {
    await requireDirectieOrProjectleider(ctx);

    const contract = await ctx.db.get(args.contractId);
    if (!contract || contract.deletedAt) {
      throw new ConvexError("Contract niet gevonden");
    }

    valideerWerkzaamheidInput(args);

    // Get current max volgorde
    const existing = await ctx.db
      .query("contractWerkzaamheden")
      .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
      .collect();

    const maxVolgorde = existing.reduce(
      (max, w) => Math.max(max, w.volgorde),
      -1
    );

    const frequentie = args.frequentie ?? args.frequentiePerJaar ?? 1;
    const werkzaamheidId = await ctx.db.insert("contractWerkzaamheden", {
      contractId: args.contractId,
      omschrijving: args.omschrijving,
      scope: args.scope,
      bouwsteenId: args.bouwsteenId,
      frequentiePerJaar: args.frequentiePerJaar,
      prijsPerBeurt: args.prijsPerBeurt,
      prijsPerBeurtHandmatig: args.prijsPerBeurtHandmatig,
      vensterVanMaand: args.vensterVanMaand,
      vensterTotMaand: args.vensterTotMaand,
      seizoen: args.seizoen,
      frequentie,
      frequentieEenheid: args.frequentieEenheid,
      geschatteUrenPerBeurt: args.geschatteUrenPerBeurt,
      geschatteUrenTotaal: args.geschatteUrenPerBeurt * frequentie,
      volgorde: maxVolgorde + 1,
      createdAt: Date.now(),
    });

    // Update contract timestamp
    await ctx.db.patch(args.contractId, { updatedAt: Date.now() });

    return werkzaamheidId;
  },
});

/**
 * Update a werkzaamheid.
 */
export const updateWerkzaamheid = mutation({
  args: {
    id: v.id("contractWerkzaamheden"),
    omschrijving: v.optional(v.string()),
    scope: v.optional(v.string()),
    bouwsteenId: v.optional(v.id("bouwstenen")),
    frequentiePerJaar: v.optional(v.number()),
    prijsPerBeurt: v.optional(v.number()),
    prijsPerBeurtHandmatig: v.optional(v.boolean()),
    vensterVanMaand: v.optional(v.number()),
    vensterTotMaand: v.optional(v.number()),
    seizoen: v.optional(seizoenValidator),
    frequentie: v.optional(v.number()),
    frequentieEenheid: v.optional(
      v.union(
        v.literal("per_seizoen"),
        v.literal("per_maand"),
        v.literal("per_week")
      )
    ),
    geschatteUrenPerBeurt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireDirectieOrProjectleider(ctx);

    const werkzaamheid = await ctx.db.get(args.id);
    if (!werkzaamheid) {
      throw new ConvexError("Werkzaamheid niet gevonden");
    }

    valideerWerkzaamheidInput({
      omschrijving: args.omschrijving ?? werkzaamheid.omschrijving,
      frequentiePerJaar:
        args.frequentiePerJaar ?? werkzaamheid.frequentiePerJaar,
      prijsPerBeurt: args.prijsPerBeurt ?? werkzaamheid.prijsPerBeurt,
      vensterVanMaand: args.vensterVanMaand ?? werkzaamheid.vensterVanMaand,
      vensterTotMaand: args.vensterTotMaand ?? werkzaamheid.vensterTotMaand,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (args.omschrijving !== undefined)
      updates.omschrijving = args.omschrijving;
    if (args.scope !== undefined) updates.scope = args.scope;
    if (args.bouwsteenId !== undefined) updates.bouwsteenId = args.bouwsteenId;
    if (args.prijsPerBeurt !== undefined)
      updates.prijsPerBeurt = args.prijsPerBeurt;
    if (args.prijsPerBeurtHandmatig !== undefined)
      updates.prijsPerBeurtHandmatig = args.prijsPerBeurtHandmatig;
    if (args.vensterVanMaand !== undefined)
      updates.vensterVanMaand = args.vensterVanMaand;
    if (args.vensterTotMaand !== undefined)
      updates.vensterTotMaand = args.vensterTotMaand;
    if (args.seizoen !== undefined) updates.seizoen = args.seizoen;
    if (args.frequentieEenheid !== undefined)
      updates.frequentieEenheid = args.frequentieEenheid;

    // Nieuwe canonieke frequentie: houd legacy `frequentie` in sync
    if (args.frequentiePerJaar !== undefined) {
      updates.frequentiePerJaar = args.frequentiePerJaar;
      if (args.frequentie === undefined) {
        updates.frequentie = args.frequentiePerJaar;
      }
    }

    // Recalculate totaal uren if relevant fields changed
    const freq =
      args.frequentie ?? args.frequentiePerJaar ?? werkzaamheid.frequentie;
    const urenPerBeurt =
      args.geschatteUrenPerBeurt ?? werkzaamheid.geschatteUrenPerBeurt;
    if (
      args.frequentie !== undefined ||
      args.frequentiePerJaar !== undefined ||
      args.geschatteUrenPerBeurt !== undefined
    ) {
      updates.frequentie = freq;
      updates.geschatteUrenPerBeurt = urenPerBeurt;
      updates.geschatteUrenTotaal = urenPerBeurt * freq;
    }

    await ctx.db.patch(args.id, updates);

    // Update contract timestamp
    await ctx.db.patch(werkzaamheid.contractId, { updatedAt: Date.now() });

    return args.id;
  },
});

/**
 * Remove a werkzaamheid from a contract.
 */
export const removeWerkzaamheid = mutation({
  args: { id: v.id("contractWerkzaamheden") },
  handler: async (ctx, args) => {
    await requireDirectieOrProjectleider(ctx);

    const werkzaamheid = await ctx.db.get(args.id);
    if (!werkzaamheid) {
      throw new ConvexError("Werkzaamheid niet gevonden");
    }

    await ctx.db.delete(args.id);

    // Update contract timestamp
    await ctx.db.patch(werkzaamheid.contractId, { updatedAt: Date.now() });
  },
});

/**
 * Renew a contract — update dates and optionally adjust tariff.
 */
export const renewContract = mutation({
  args: {
    id: v.id("onderhoudscontracten"),
    nieuwEindDatum: v.string(),
    nieuwTarief: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireDirectieOrProjectleider(ctx);

    const contract = await ctx.db.get(args.id);
    if (!contract || contract.deletedAt) {
      throw new ConvexError("Contract niet gevonden");
    }

    const now = Date.now();
    const nieuwStartDatum = contract.eindDatum; // New period starts where old ends
    const tariefPerTermijn = args.nieuwTarief ?? contract.tariefPerTermijn;
    const jaarlijksTarief =
      tariefPerTermijn * getTermijnenPerJaar(contract.betalingsfrequentie);

    // Update contract
    await ctx.db.patch(args.id, {
      status: "actief",
      startDatum: nieuwStartDatum,
      eindDatum: args.nieuwEindDatum,
      tariefPerTermijn,
      jaarlijksTarief,
      updatedAt: now,
    });

    // Generate new termijnfacturen
    const periodes = generateTermijnPeriodes(
      nieuwStartDatum,
      args.nieuwEindDatum,
      contract.betalingsfrequentie,
      tariefPerTermijn
    );

    // Find max existing termijnnummer
    const existingFacturen = await ctx.db
      .query("contractFacturen")
      .withIndex("by_contract", (q) => q.eq("contractId", args.id))
      .collect();

    const maxTermijn = existingFacturen.reduce(
      (max, f) => Math.max(max, f.termijnNummer),
      0
    );

    for (const periode of periodes) {
      await ctx.db.insert("contractFacturen", {
        contractId: args.id,
        userId: user._id,
        termijnNummer: maxTermijn + periode.termijnNummer,
        periodeStart: periode.periodeStart,
        periodeEinde: periode.periodeEinde,
        bedrag: periode.bedrag,
        status: "gepland",
        createdAt: now,
      });
    }

    // — Klanttijdlijn (PRD §2.3): verlenging zet het contract (weer) op
    // actief — zelfde event-type als activering. Additief, niet-blokkerend.
    await logTijdlijnEvent(ctx, {
      userId: contract.userId,
      klantId: contract.klantId,
      eventType: "contract_geactiveerd",
      auteurId: user._id,
      auteurNaam: user.name,
      tekst: `Onderhoudscontract ${contract.contractNummer} verlengd t/m ${args.nieuwEindDatum}`,
    });

    return args.id;
  },
});

/**
 * Cancel a contract — set status to opgezegd.
 *
 * Ruimt ook de gevolgen op (PRD §2.1):
 * - toekomstige ONGEPLANDE beurten (werkitems zonder geplandeStart, status
 *   "gepland") gaan naar status "vervallen";
 * - geplande termijnfacturen (status "gepland") gaan naar "vervallen", zodat
 *   de latere facturatie-engine (§2.8) geen spookfacturen genereert.
 * Al ingeplande, uitgevoerde of gefactureerde beurten blijven staan.
 */
export const cancelContract = mutation({
  args: {
    id: v.id("onderhoudscontracten"),
    reden: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireDirectieOrProjectleider(ctx);

    const contract = await ctx.db.get(args.id);
    if (!contract || contract.deletedAt) {
      throw new ConvexError("Contract niet gevonden");
    }

    if (contract.status === "opgezegd") {
      throw new ConvexError("Contract is al opgezegd");
    }

    const now = Date.now();

    // Update contract status
    await ctx.db.patch(args.id, {
      status: "opgezegd",
      notities: args.reden
        ? `${contract.notities ? contract.notities + "\n\n" : ""}Opzegreden: ${args.reden}`
        : contract.notities,
      updatedAt: now,
    });

    // — Klanttijdlijn (PRD §2.3): contract opgezegd. Additief, niet-blokkerend.
    await logTijdlijnEvent(ctx, {
      userId: contract.userId,
      klantId: contract.klantId,
      eventType: "contract_opgezegd",
      auteurId: user._id,
      auteurNaam: user.name,
      tekst: `Onderhoudscontract ${contract.contractNummer} opgezegd${
        args.reden ? ` — reden: ${args.reden}` : ""
      }`,
    });

    // Toekomstige ongeplande beurten → vervallen
    const aantalVervallenBeurten = await vervalOngeplandeBeurten(ctx, args.id);

    // Geplande termijnen → vervallen (dicht het oude cancelContract-gat)
    const termijnen = await ctx.db
      .query("contractFacturen")
      .withIndex("by_contract_status", (q) =>
        q.eq("contractId", args.id).eq("status", "gepland")
      )
      .collect();
    // Parallel i.p.v. serieel (audit §5): het zijn losse documenten, dus de
    // patches hoeven niet op elkaar te wachten.
    await Promise.all(
      termijnen.map((termijn) =>
        ctx.db.patch(termijn._id, { status: "vervallen" })
      )
    );

    return { contractId: args.id, aantalVervallenBeurten };
  },
});

/**
 * Get contract data formatted for PDF generation.
 * Returns contract + klant + werkzaamheden grouped by seizoen + facturen.
 */
export const getForPdf = query({
  args: { id: v.id("onderhoudscontracten") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const contract = await ctx.db.get(args.id);
    if (!contract || contract.deletedAt) {
      throw new ConvexError("Contract niet gevonden");
    }

    // Get klant
    const klant = await ctx.db.get(contract.klantId);

    // Get werkzaamheden sorted by volgorde
    const werkzaamheden = await ctx.db
      .query("contractWerkzaamheden")
      .withIndex("by_contract", (q) => q.eq("contractId", args.id))
      .collect();

    const sortedWerkzaamheden = werkzaamheden.sort(
      (a, b) => a.volgorde - b.volgorde
    );

    // Group werkzaamheden by seizoen
    const werkzaamhedenPerSeizoen: Record<
      string,
      typeof sortedWerkzaamheden
    > = {};
    for (const w of sortedWerkzaamheden) {
      // Nieuwe bouwsteen-regels hebben geen seizoen-enum meer → "jaarrond"
      const seizoen = w.seizoen ?? "jaarrond";
      if (!werkzaamhedenPerSeizoen[seizoen]) {
        werkzaamhedenPerSeizoen[seizoen] = [];
      }
      werkzaamhedenPerSeizoen[seizoen].push(w);
    }

    // Get facturen sorted by termijnNummer
    const facturen = await ctx.db
      .query("contractFacturen")
      .withIndex("by_contract", (q) => q.eq("contractId", args.id))
      .collect();

    const sortedFacturen = facturen.sort(
      (a, b) => a.termijnNummer - b.termijnNummer
    );

    return {
      contract: {
        _id: contract._id,
        contractNummer: contract.contractNummer,
        naam: contract.naam,
        status: contract.status,
        locatie: contract.locatie,
        startDatum: contract.startDatum,
        eindDatum: contract.eindDatum,
        opzegtermijnDagen: contract.opzegtermijnDagen,
        tariefPerTermijn: contract.tariefPerTermijn,
        betalingsfrequentie: contract.betalingsfrequentie,
        jaarlijksTarief: contract.jaarlijksTarief,
        indexatiePercentage: contract.indexatiePercentage,
        autoVerlenging: contract.autoVerlenging,
        verlengingsPeriodeInMaanden: contract.verlengingsPeriodeInMaanden,
        notities: contract.notities,
        voorwaarden: contract.voorwaarden,
        createdAt: contract.createdAt,
        // PRD §2.1 / bijlage A regel 6: modus + clausule zichtbaar in de PDF
        facturatiemodus: getFacturatiemodus(contract),
        indexatieVanToepassing: isIndexatieVanToepassing(
          contract.startDatum,
          contract.eindDatum
        ),
        indexatieClausule: isIndexatieVanToepassing(
          contract.startDatum,
          contract.eindDatum
        )
          ? INDEXATIE_CLAUSULE_TEKST
          : null,
      },
      klant: klant
        ? {
            naam: klant.naam,
            adres: klant.adres,
            postcode: klant.postcode,
            plaats: klant.plaats,
            email: klant.email,
            telefoon: klant.telefoon,
          }
        : null,
      werkzaamhedenPerSeizoen,
      facturen: sortedFacturen,
    };
  },
});

/**
 * Soft delete a contract.
 */
export const remove = mutation({
  args: { id: v.id("onderhoudscontracten") },
  handler: async (ctx, args) => {
    await requireDirectieOrProjectleider(ctx);

    const contract = await ctx.db.get(args.id);
    if (!contract) {
      throw new ConvexError("Contract niet gevonden");
    }

    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// ============================================
// BOUWSTEEN-DEFAULTS & OFFERTE-CONVERSIE (PRD §2.1)
// ============================================

/**
 * Actieve bouwstenen voor de contract-bouwsteenkiezer (kantoor-only), met
 * per bouwsteen de default prijs per beurt op een peildatum: normuren ×
 * uurtarief-op-die-datum, of het vaste bedrag (PRD §2.1). Historische
 * contracten behouden zo het tarief van hun eigen contractdatum (§8.7).
 */
export const getBouwsteenDefaults = query({
  args: { datum: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const datum = args.datum ?? vandaagIso();

    const tarieven = await ctx.db.query("uurtarieven").collect();
    const geldendTarief = bepaalTariefOpDatum(tarieven, datum);

    const bouwstenen = await ctx.db
      .query("bouwstenen")
      .withIndex("by_actief", (q) => q.eq("actief", true))
      .collect();

    return bouwstenen
      .map((b) => ({
        _id: b._id,
        naam: b.naam,
        code: b.code,
        categorie: b.categorie,
        soort: b.soort,
        defaultFrequentiePerJaar: b.defaultFrequentiePerJaar,
        vensterVanMaand: b.seizoensvensterVan,
        vensterTotMaand: b.seizoensvensterTot,
        urenPerBeurt: b.urenPerBeurt,
        prijsmodel: b.prijsmodel,
        btwCode: b.btwCode,
        // Receptuurstappen (bv. reinigingsbeurt: borstelen → reinigen →
        // invegen) voor de wizard-weergave van de vaste stapvolgorde (§2.5a)
        receptuurstappen: b.receptuurstappen,
        defaultPrijsPerBeurt: geldendTarief
          ? berekenPrijsPerBeurt(b, geldendTarief.bedrag)
          : null,
        // Keuzeregel-optieprijzen (bijlage A #17, zand): defaults per optie
        optiePrijsVoegzand: b.optiePrijsVoegzand,
        optiePrijsStraatzand: b.optiePrijsStraatzand,
        uurtarief: geldendTarief?.bedrag ?? null,
      }))
      .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  },
});

/**
 * Match een offerte-regel aan een bouwsteen: de bouwsteennaam komt voor in
 * de regelomschrijving (case-insensitief; langste naam wint). Codes worden
 * bewust niet gematcht — te kort ("HS") en dus te veel false positives.
 * Pure functie (unit-testbaar).
 */
export function matchBouwsteenOpOmschrijving<T extends { naam: string }>(
  omschrijving: string,
  bouwstenen: T[]
): T | null {
  const tekst = omschrijving.toLowerCase();
  // Langste naam eerst zodat "haag snoeien groot" niet op "haag" blijft hangen
  const opNaamlengte = [...bouwstenen].sort(
    (a, b) => b.naam.length - a.naam.length
  );
  for (const b of opNaamlengte) {
    if (b.naam && tekst.includes(b.naam.toLowerCase())) return b;
  }
  return null;
}

/** Gestructureerde bouwsteen-regel van een offerte (offertes.bouwsteenRegels). */
export interface OfferteBouwsteenRegelInput {
  bouwsteenId: Id<"bouwstenen">;
  naam: string;
  soort: string;
  frequentiePerJaar: number;
  prijsPerBeurt: number;
  prijsPerBeurtHandmatig?: boolean;
  eenmalig: boolean;
  zandKeuze?: {
    keuze: "voegzand" | "straatzand";
    prijsVoegzand: number;
    prijsStraatzand: number;
  };
}

/**
 * Gestructureerde offerte-bouwsteenregels (wizard §2.5a) → contract-
 * werkzaamheden. Exacte voorvulling zonder naam-matching: bouwsteenId,
 * frequentie en prijs per beurt komen 1-op-1 van de offerte, zodat een
 * historische offerte haar eigen tarief behoudt (§8.7). Eenmalige regels
 * krijgen geen frequentiePerJaar en genereren dus geen beurtenreeks
 * (structuurregel 2). Pure functie (unit-testbaar).
 */
export function offerteBouwsteenRegelsNaarWerkzaamheden<
  TB extends {
    _id: Id<"bouwstenen">;
    seizoensvensterVan?: number;
    seizoensvensterTot?: number;
    urenPerBeurt?: number;
  },
>(regels: OfferteBouwsteenRegelInput[], bouwstenen: TB[]) {
  const perId = new Map(bouwstenen.map((b) => [b._id.toString(), b]));
  return regels.map((regel) => {
    const bouwsteen = perId.get(regel.bouwsteenId.toString());
    const zandLabel = regel.zandKeuze
      ? regel.zandKeuze.keuze === "voegzand"
        ? " — onkruidvrij voegzand"
        : " — straatzand"
      : "";
    return {
      omschrijving: `${regel.naam}${zandLabel}`,
      bouwsteenId: regel.bouwsteenId,
      frequentiePerJaar: regel.eenmalig ? undefined : regel.frequentiePerJaar,
      prijsPerBeurt: regel.prijsPerBeurt,
      prijsPerBeurtHandmatig: regel.prijsPerBeurtHandmatig ?? false,
      vensterVanMaand: bouwsteen?.seizoensvensterVan,
      vensterTotMaand: bouwsteen?.seizoensvensterTot,
      geschatteUrenPerBeurt: bouwsteen?.urenPerBeurt ?? 0,
    };
  });
}

/**
 * Geaccepteerde onderhoud-offerte → voorgevuld CONCEPT-contract (PRD §2.1,
 * "één klik activeren" gebeurt daarna via beurtgenerator.activeerContract).
 *
 * Voorinvulling voor zover herleidbaar:
 * - arbeid-regels worden bouwsteen-regels; bouwsteen gematcht op naam in de
 *   omschrijving, met default frequentie/venster/prijs uit de catalogus
 *   (prijs = normuren × uurtarief-op-startdatum of vast bedrag);
 * - niet te matchen regels worden vrije regels (frequentie 1×/jaar, prijs =
 *   regeltotaal) die kantoor in het concept bijstelt;
 * - looptijd default 12 maanden vanaf vandaag, opzegtermijn 30 dagen,
 *   facturatiemodus "per_bezoek" (default).
 * Verplichte validatie op offerte-acceptatie zelf is §2.5 (latere stap).
 */
/**
 * Kernlogica van createFromOfferte, herbruikbaar vanuit de acceptatie-
 * overgang in offertes.updateStatus (PRD §2.5: route 1 maakt bij acceptatie
 * automatisch een concept-contract). Draait onder de offerte-eigenaar;
 * autorisatie gebeurt bij de aanroeper. Idempotent: bestaat er al een
 * contract uit deze offerte, dan wordt dat teruggegeven.
 */
export async function maakContractVanGeaccepteerdeOfferte(
  ctx: MutationCtx,
  offerte: Doc<"offertes">
): Promise<{ contractId: Id<"onderhoudscontracten">; aantalRegels: number }> {
  const now = Date.now();

  if (offerte.type !== "onderhoud") {
    throw new ConvexError("Alleen onderhoud-offertes kunnen een contract worden");
  }
  if (offerte.status !== "geaccepteerd") {
    throw new ConvexError(
      "Alleen geaccepteerde offertes kunnen een contract worden"
    );
  }
  if (!offerte.klantId) {
    throw new ConvexError(
      "Koppel de offerte eerst aan een klant voordat je een contract maakt"
    );
  }
  const klant = await ctx.db.get(offerte.klantId);
  if (!klant) {
    throw new ConvexError("Klant van de offerte niet gevonden");
  }

  // Idempotentie: één contract per offerte (her-acceptatie maakt geen tweede)
  const bestaand = await ctx.db
    .query("onderhoudscontracten")
    .withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
    .first();
  if (bestaand) {
    const bestaandeRegels = await ctx.db
      .query("contractWerkzaamheden")
      .withIndex("by_contract", (q) => q.eq("contractId", bestaand._id))
      .collect();
    return { contractId: bestaand._id, aantalRegels: bestaandeRegels.length };
  }

    const startDatum = vandaagIso();
    const eindDatum = addMaanden(startDatum, 12);

    // Catalogus + uurtarief op contractdatum voor de prijs-defaults
    const bouwstenen = await ctx.db
      .query("bouwstenen")
      .withIndex("by_actief", (q) => q.eq("actief", true))
      .collect();
    const tarieven = await ctx.db.query("uurtarieven").collect();
    const geldendTarief = bepaalTariefOpDatum(tarieven, startDatum);

    // Arbeid-regels → bouwsteen-regels (voor zover herleidbaar)
    const arbeidRegels = offerte.regels.filter((r) => r.type === "arbeid");
    const bronRegels = arbeidRegels.length > 0 ? arbeidRegels : offerte.regels;

    // Gestructureerde bouwsteen-regels van de wizard (§2.5a) winnen: exacte
    // voorvulling met het tarief van de offertedatum. Alleen oudere offertes
    // zonder bouwsteenRegels vallen terug op naam-matching.
    const werkzaamheden =
      offerte.bouwsteenRegels && offerte.bouwsteenRegels.length > 0
        ? offerteBouwsteenRegelsNaarWerkzaamheden(
            offerte.bouwsteenRegels,
            bouwstenen
          )
        : bronRegels.map((regel) => {
            const bouwsteen = matchBouwsteenOpOmschrijving(
              regel.omschrijving,
              bouwstenen
            );
            if (bouwsteen) {
              const defaultPrijs = geldendTarief
                ? berekenPrijsPerBeurt(bouwsteen, geldendTarief.bedrag)
                : null;
              return {
                omschrijving: bouwsteen.naam,
                bouwsteenId: bouwsteen._id as Id<"bouwstenen"> | undefined,
                frequentiePerJaar: bouwsteen.defaultFrequentiePerJaar ?? 1,
                prijsPerBeurt: defaultPrijs ?? regel.totaal,
                prijsPerBeurtHandmatig: defaultPrijs === null,
                vensterVanMaand: bouwsteen.seizoensvensterVan,
                vensterTotMaand: bouwsteen.seizoensvensterTot,
                geschatteUrenPerBeurt: bouwsteen.urenPerBeurt ?? 0,
              };
            }
            // Niet herleidbaar → vrije regel, kantoor stelt bij in het concept
            return {
              omschrijving: regel.omschrijving,
              bouwsteenId: undefined as Id<"bouwstenen"> | undefined,
              frequentiePerJaar: 1 as number | undefined,
              prijsPerBeurt: regel.totaal,
              prijsPerBeurtHandmatig: true,
              vensterVanMaand: undefined as number | undefined,
              vensterTotMaand: undefined as number | undefined,
              geschatteUrenPerBeurt: 0,
            };
          });

    const jaarprijs = berekenJaarprijsBouwstenen(werkzaamheden);
    const contractNummer = await generateContractNummer(ctx);

    const contractId = await ctx.db.insert("onderhoudscontracten", {
      userId: offerte.userId,
      klantId: offerte.klantId,
      offerteId: offerte._id,
      contractNummer,
      naam: `Onderhoudscontract ${klant.naam}`,
      locatie: {
        adres: offerte.klant.adres,
        postcode: offerte.klant.postcode,
        plaats: offerte.klant.plaats,
      },
      startDatum,
      eindDatum,
      opzegtermijnDagen: 30,
      tariefPerTermijn: Math.round((jaarprijs / 12) * 100) / 100,
      betalingsfrequentie: "maandelijks",
      jaarlijksTarief: jaarprijs,
      facturatiemodus: "per_bezoek",
      status: "concept",
      autoVerlenging: false,
      notities: `Aangemaakt vanuit offerte ${offerte.offerteNummer}`,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < werkzaamheden.length; i++) {
      const w = werkzaamheden[i];
      await ctx.db.insert("contractWerkzaamheden", {
        contractId,
        omschrijving: w.omschrijving,
        bouwsteenId: w.bouwsteenId,
        frequentiePerJaar: w.frequentiePerJaar,
        prijsPerBeurt: w.prijsPerBeurt,
        prijsPerBeurtHandmatig: w.prijsPerBeurtHandmatig,
        vensterVanMaand: w.vensterVanMaand,
        vensterTotMaand: w.vensterTotMaand,
        // Legacy verplicht veld; eenmalige regels (geen frequentiePerJaar) → 1
        frequentie: w.frequentiePerJaar ?? 1,
        geschatteUrenPerBeurt: w.geschatteUrenPerBeurt,
        geschatteUrenTotaal: w.geschatteUrenPerBeurt * (w.frequentiePerJaar ?? 1),
        volgorde: i,
        createdAt: now,
      });
    }

    await upgradeKlantPipeline(ctx, offerte.klantId, "onderhoud");

    return { contractId, aantalRegels: werkzaamheden.length };
}

export const createFromOfferte = mutation({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    const user = await requireKantoor(ctx);

    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte || offerte.userId.toString() !== user._id.toString()) {
      throw new ConvexError("Offerte niet gevonden");
    }

    return maakContractVanGeaccepteerdeOfferte(ctx, offerte);
  },
});
