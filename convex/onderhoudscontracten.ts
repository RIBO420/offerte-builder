/**
 * Onderhoudscontracten — CRUD for recurring maintenance contracts
 *
 * Manages contract lifecycle: concept → actief → verlopen/opgezegd
 * Includes werkzaamheden per seizoen and termijnfactuur planning.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireAuth, requireAuthUserId } from "./auth";
import {
  requireDirectieOrProjectleider,
} from "./roles";
import { upgradeKlantPipeline } from "./pipelineHelpers";

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

const werkzaamheidInputValidator = v.object({
  omschrijving: v.string(),
  scope: v.optional(v.string()),
  seizoen: seizoenValidator,
  frequentie: v.number(),
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
 * Generate the next contract number in the format OHC-YYYY-NNN.
 */
async function generateContractNummer(
  ctx: MutationCtx,
  userId: Id<"users">
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `OHC-${year}-`;

  // Get all contracts for this user to find the next number
  const existing = await ctx.db
    .query("onderhoudscontracten")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const currentYearContracts = existing.filter((c) =>
    c.contractNummer.startsWith(prefix)
  );

  const maxNum = currentYearContracts.reduce((max: number, c) => {
    const num = parseInt(c.contractNummer.replace(prefix, ""), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  const nextNum = (maxNum + 1).toString().padStart(3, "0");
  return `${prefix}${nextNum}`;
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

    // Enrich with klant naam
    const enriched = await Promise.all(
      filtered.map(async (contract) => {
        const klant = await ctx.db.get(contract.klantId);
        return {
          ...contract,
          klantNaam: klant?.naam ?? "Onbekende klant",
          klantPlaats: klant?.plaats ?? "",
        };
      })
    );

    return enriched;
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

    // Enrich
    const enriched = await Promise.all(
      filtered.map(async (contract) => {
        const klant = await ctx.db.get(contract.klantId);
        return {
          ...contract,
          klantNaam: klant?.naam ?? "Onbekende klant",
          klantPlaats: klant?.plaats ?? "",
        };
      })
    );

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

    // Enrich with klant naam
    const enriched = await Promise.all(
      expiring.map(async (contract) => {
        const klant = await ctx.db.get(contract.klantId);
        return {
          ...contract,
          klantNaam: klant?.naam ?? "Onbekende klant",
        };
      })
    );

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

    // Get werkzaamheden for current season across all contracts
    const allWork = await Promise.all(
      contracts.map(async (contract) => {
        const werkzaamheden = await ctx.db
          .query("contractWerkzaamheden")
          .withIndex("by_contract_seizoen", (q) =>
            q.eq("contractId", contract._id).eq("seizoen", currentSeason)
          )
          .collect();

        const klant = await ctx.db.get(contract.klantId);

        return werkzaamheden.map((w) => ({
          ...w,
          contractNaam: contract.naam,
          contractNummer: contract.contractNummer,
          klantNaam: klant?.naam ?? "Onbekende klant",
          locatie: contract.locatie,
        }));
      })
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
    autoVerlenging: v.boolean(),
    verlengingsPeriodeInMaanden: v.optional(v.number()),
    werkzaamheden: v.array(werkzaamheidInputValidator),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireDirectieOrProjectleider(ctx);
    const now = Date.now();

    // Generate contract number
    const contractNummer = await generateContractNummer(ctx, user._id);

    // Calculate jaarlijks tarief
    const termijnenPerJaar = getTermijnenPerJaar(args.betalingsfrequentie);
    const jaarlijksTarief = args.tariefPerTermijn * termijnenPerJaar;

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
      status: "concept",
      autoVerlenging: args.autoVerlenging,
      verlengingsPeriodeInMaanden: args.verlengingsPeriodeInMaanden,
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });

    // Insert werkzaamheden
    for (let i = 0; i < args.werkzaamheden.length; i++) {
      const w = args.werkzaamheden[i];
      await ctx.db.insert("contractWerkzaamheden", {
        contractId,
        omschrijving: w.omschrijving,
        scope: w.scope,
        seizoen: w.seizoen,
        frequentie: w.frequentie,
        frequentieEenheid: w.frequentieEenheid,
        geschatteUrenPerBeurt: w.geschatteUrenPerBeurt,
        geschatteUrenTotaal: w.geschatteUrenPerBeurt * w.frequentie,
        volgorde: i,
        createdAt: now,
      });
    }

    // Generate planned termijnfacturen
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
    seizoen: seizoenValidator,
    frequentie: v.number(),
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

    // Get current max volgorde
    const existing = await ctx.db
      .query("contractWerkzaamheden")
      .withIndex("by_contract", (q) => q.eq("contractId", args.contractId))
      .collect();

    const maxVolgorde = existing.reduce(
      (max, w) => Math.max(max, w.volgorde),
      -1
    );

    const werkzaamheidId = await ctx.db.insert("contractWerkzaamheden", {
      contractId: args.contractId,
      omschrijving: args.omschrijving,
      scope: args.scope,
      seizoen: args.seizoen,
      frequentie: args.frequentie,
      frequentieEenheid: args.frequentieEenheid,
      geschatteUrenPerBeurt: args.geschatteUrenPerBeurt,
      geschatteUrenTotaal: args.geschatteUrenPerBeurt * args.frequentie,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = { updatedAt: Date.now() };

    if (args.omschrijving !== undefined)
      updates.omschrijving = args.omschrijving;
    if (args.scope !== undefined) updates.scope = args.scope;
    if (args.seizoen !== undefined) updates.seizoen = args.seizoen;
    if (args.frequentieEenheid !== undefined)
      updates.frequentieEenheid = args.frequentieEenheid;

    // Recalculate totaal uren if relevant fields changed
    const freq = args.frequentie ?? werkzaamheid.frequentie;
    const urenPerBeurt =
      args.geschatteUrenPerBeurt ?? werkzaamheid.geschatteUrenPerBeurt;
    if (
      args.frequentie !== undefined ||
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

    return args.id;
  },
});

/**
 * Cancel a contract — set status to opgezegd.
 */
export const cancelContract = mutation({
  args: {
    id: v.id("onderhoudscontracten"),
    reden: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireDirectieOrProjectleider(ctx);

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

    // Note: planned (unfactured) termijnen remain as "gepland" but
    // the contract status "opgezegd" makes them irrelevant.
    // Phase 2: mark these as cancelled or delete them.

    return args.id;
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
