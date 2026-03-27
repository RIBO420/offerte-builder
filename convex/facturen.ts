/**
 * Facturen Functions - Invoice module
 *
 * Provides functions for creating and managing facturen (invoices).
 * Facturen worden gegenereerd vanuit projecten na nacalculatie.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
import { requireNotViewer } from "./roles";
import { Id } from "./_generated/dataModel";

/**
 * Validator voor klantgegevens op factuur
 */
const klantValidator = v.object({
  naam: v.string(),
  adres: v.string(),
  postcode: v.string(),
  plaats: v.string(),
  email: v.optional(v.string()),
  telefoon: v.optional(v.string()),
});

/**
 * Validator voor factuurregel
 */
const regelValidator = v.object({
  id: v.string(),
  omschrijving: v.string(),
  eenheid: v.string(),
  hoeveelheid: v.number(),
  prijsPerEenheid: v.number(),
  totaal: v.number(),
});

/**
 * Validator voor correctie
 */
const correctieValidator = v.object({
  omschrijving: v.string(),
  bedrag: v.number(),
});

/**
 * Get a project and verify ownership.
 */
async function getOwnedProject(
  ctx: Parameters<typeof requireAuth>[0],
  projectId: Id<"projecten">
) {
  const project = await ctx.db.get(projectId);
  return verifyOwnership(ctx, project, "project");
}

/**
 * Get a factuur and verify ownership.
 */
async function getOwnedFactuur(
  ctx: Parameters<typeof requireAuth>[0],
  factuurId: Id<"facturen">
) {
  const factuur = await ctx.db.get(factuurId);
  return verifyOwnership(ctx, factuur, "factuur");
}

/**
 * Genereer een factuur vanuit projectgegevens.
 * Haalt project, offerte, nacalculatie en instellingen op.
 * Genereert automatisch een factuurnummer en kopieert relevante gegevens.
 */
export const generate = mutation({
  args: {
    projectId: v.id("projecten"),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Haal project op en verifieer eigenaarschap
    const project = await getOwnedProject(ctx, args.projectId);

    // Controleer of project al een factuur heeft
    const bestaandeFactuur = await ctx.db
      .query("facturen")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (bestaandeFactuur) {
      throw new ConvexError("Er bestaat al een factuur voor dit project");
    }

    // Haal offerte op
    const offerte = await ctx.db.get(project.offerteId);
    if (!offerte) {
      throw new ConvexError("Offerte niet gevonden voor dit project");
    }

    // Haal nacalculatie op (optioneel, voor correcties)
    const nacalculatie = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    // Haal instellingen op
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!instellingen) {
      throw new ConvexError("Instellingen niet gevonden. Configureer eerst je bedrijfsgegevens.");
    }

    // Genereer factuurnummer
    const laatsteNummer = instellingen.laatsteFactuurNummer ?? 0;
    const volgendNummer = laatsteNummer + 1;
    const jaar = new Date().getFullYear();
    const prefix = instellingen.factuurNummerPrefix ?? "FAC-";
    const factuurnummer = `${prefix}${jaar}-${String(volgendNummer).padStart(3, "0")}`;

    // Kopieer regels van offerte (zonder scope en type, conform schema)
    const regels = offerte.regels.map((regel) => ({
      id: regel.id,
      omschrijving: regel.omschrijving,
      eenheid: regel.eenheid,
      hoeveelheid: regel.hoeveelheid,
      prijsPerEenheid: regel.prijsPerEenheid,
      totaal: regel.totaal,
    }));

    // Voeg correcties toe op basis van nacalculatie afwijkingen (indien significant)
    const correcties: Array<{ omschrijving: string; bedrag: number }> = [];
    if (nacalculatie && Math.abs(nacalculatie.afwijkingPercentage) >= 5) {
      // Alleen correcties toevoegen bij significante afwijking (>= 5%)
      const uurtarief = instellingen.uurtarief || 45;
      const correctieBedrag = nacalculatie.afwijkingUren * uurtarief;

      if (correctieBedrag !== 0) {
        correcties.push({
          omschrijving: nacalculatie.afwijkingUren > 0
            ? `Meerwerk: ${nacalculatie.afwijkingUren} uur extra (${nacalculatie.afwijkingPercentage}% afwijking)`
            : `Minderwerk: ${Math.abs(nacalculatie.afwijkingUren)} uur minder (${nacalculatie.afwijkingPercentage}% afwijking)`,
          bedrag: correctieBedrag,
        });
      }
    }

    // Bereken totalen
    const regelsTotaal = regels.reduce((sum, r) => sum + r.totaal, 0);
    const correctiesTotaal = correcties.reduce((sum, c) => sum + c.bedrag, 0);
    const subtotaal = regelsTotaal + correctiesTotaal;
    const btwPercentage = instellingen.btwPercentage;
    const btwBedrag = subtotaal * (btwPercentage / 100);
    const totaalInclBtw = subtotaal + btwBedrag;

    // Bepaal betalingstermijn en vervaldatum
    const betalingstermijnDagen = instellingen.standaardBetalingstermijn ?? 14;
    const vervaldatum = now + betalingstermijnDagen * 24 * 60 * 60 * 1000;

    // Maak de factuur aan
    const factuurId = await ctx.db.insert("facturen", {
      userId,
      projectId: args.projectId,
      factuurnummer,
      status: "concept",
      klant: {
        naam: offerte.klant.naam,
        adres: offerte.klant.adres,
        postcode: offerte.klant.postcode,
        plaats: offerte.klant.plaats,
        email: offerte.klant.email,
        telefoon: offerte.klant.telefoon,
      },
      bedrijf: {
        naam: instellingen.bedrijfsgegevens.naam,
        adres: instellingen.bedrijfsgegevens.adres,
        postcode: instellingen.bedrijfsgegevens.postcode,
        plaats: instellingen.bedrijfsgegevens.plaats,
        kvk: instellingen.bedrijfsgegevens.kvk,
        btw: instellingen.bedrijfsgegevens.btw,
        iban: instellingen.bedrijfsgegevens.iban,
        email: instellingen.bedrijfsgegevens.email,
        telefoon: instellingen.bedrijfsgegevens.telefoon,
      },
      regels,
      correcties: correcties.length > 0 ? correcties : undefined,
      subtotaal,
      btwPercentage,
      btwBedrag,
      totaalInclBtw,
      factuurdatum: now,
      vervaldatum,
      betalingstermijnDagen,
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });

    // Update laatsteFactuurNummer in instellingen
    await ctx.db.patch(instellingen._id, {
      laatsteFactuurNummer: volgendNummer,
    });

    return factuurId;
  },
});

/**
 * Search facturen by factuurNummer, klant naam, or project naam.
 */
export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const searchTerm = args.searchTerm.toLowerCase().trim();

    // Get all facturen for the user
    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // If no search term, return recent facturen
    if (!searchTerm) {
      return facturen.slice(0, 10);
    }

    // Get all projects to search by project naam
    const projectIds = [...new Set(facturen.map((f) => f.projectId))];
    const projects = await Promise.all(
      projectIds.map((id) => ctx.db.get(id))
    );
    const projectMap = new Map(
      projects.filter((p) => p !== null).map((p) => [p!._id.toString(), p!])
    );

    // Filter facturen by search term
    const matchingFacturen = facturen.filter((factuur) => {
      // Search by factuurNummer
      if (factuur.factuurnummer.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search by klant naam
      if (factuur.klant.naam.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search by project naam
      const project = projectMap.get(factuur.projectId.toString());
      if (project && project.naam.toLowerCase().includes(searchTerm)) {
        return true;
      }

      return false;
    });

    return matchingFacturen.slice(0, 20);
  },
});

/**
 * Haal een factuur op met eigenaarschapsverificatie.
 */
export const get = query({
  args: { id: v.id("facturen") },
  handler: async (ctx, args) => {
    const factuur = await ctx.db.get(args.id);
    if (!factuur) return null;

    // Verifieer eigenaarschap
    const user = await requireAuth(ctx);
    if (factuur.userId.toString() !== user._id.toString()) {
      return null; // Verberg bestaan voor onbevoegde gebruikers
    }

    return factuur;
  },
});

/**
 * Haal factuur op voor een specifiek project.
 */
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verifieer eigenaarschap van project
    await getOwnedProject(ctx, args.projectId);

    const factuur = await ctx.db
      .query("facturen")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    return factuur;
  },
});

/**
 * Lijst alle facturen voor de ingelogde gebruiker.
 * Optionele statusfilter en hideArchived parameter.
 * Note: Paid invoices should always be visible, so hideArchived only affects non-paid invoices.
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("concept"),
        v.literal("definitief"),
        v.literal("verzonden"),
        v.literal("betaald"),
        v.literal("vervallen")
      )
    ),
    hideArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    let result = facturen;

    // Filter op status indien opgegeven
    if (args.status) {
      result = result.filter((f) => f.status === args.status);
    }

    // Filter archived facturen if hideArchived is true (but always show paid invoices)
    if (args.hideArchived) {
      result = result.filter((f) => !f.isArchived || f.status === "betaald");
    }

    return result;
  },
});

/**
 * Update een factuur (alleen mogelijk in concept status).
 */
export const update = mutation({
  args: {
    id: v.id("facturen"),
    klant: v.optional(klantValidator),
    regels: v.optional(v.array(regelValidator)),
    correcties: v.optional(v.array(correctieValidator)),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verifieer eigenaarschap
    const factuur = await getOwnedFactuur(ctx, args.id);
    const now = Date.now();

    // Alleen bewerken in concept status
    if (factuur.status !== "concept") {
      throw new ConvexError("Factuur kan alleen bewerkt worden in concept status");
    }

    const updates: Record<string, unknown> = { updatedAt: now };

    if (args.klant !== undefined) {
      updates.klant = args.klant;
    }

    if (args.notities !== undefined) {
      updates.notities = args.notities;
    }

    // Als regels of correcties worden aangepast, herbereken totalen
    const nieuweRegels = args.regels ?? factuur.regels;
    const nieuweCorrecties = args.correcties ?? factuur.correcties ?? [];

    if (args.regels !== undefined || args.correcties !== undefined) {
      updates.regels = nieuweRegels;
      updates.correcties = nieuweCorrecties.length > 0 ? nieuweCorrecties : undefined;

      // Herbereken totalen
      const regelsTotaal = nieuweRegels.reduce((sum, r) => sum + r.totaal, 0);
      const correctiesTotaal = nieuweCorrecties.reduce((sum, c) => sum + c.bedrag, 0);
      const subtotaal = regelsTotaal + correctiesTotaal;
      const btwBedrag = subtotaal * (factuur.btwPercentage / 100);
      const totaalInclBtw = subtotaal + btwBedrag;

      updates.subtotaal = subtotaal;
      updates.btwBedrag = btwBedrag;
      updates.totaalInclBtw = totaalInclBtw;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Update de status van een factuur met validatie.
 * Toegestane overgangen:
 * - concept → definitief (vergrendelt bewerking)
 * - definitief → verzonden (zet verzondenAt)
 * - verzonden → betaald (zet betaaldAt)
 * - verzonden → vervallen
 */
export const updateStatus = mutation({
  args: {
    id: v.id("facturen"),
    status: v.union(
      v.literal("concept"),
      v.literal("definitief"),
      v.literal("verzonden"),
      v.literal("betaald"),
      v.literal("vervallen")
    ),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verifieer eigenaarschap
    const factuur = await getOwnedFactuur(ctx, args.id);
    const now = Date.now();
    const oudeStatus = factuur.status;

    // Valideer statusovergang
    const geldigeOvergangen: Record<string, string[]> = {
      concept: ["definitief"],
      definitief: ["concept", "verzonden"],
      verzonden: ["betaald", "vervallen"],
      betaald: [], // Eindstatus
      vervallen: ["verzonden"], // Kan opnieuw verzonden worden
    };

    if (!geldigeOvergangen[oudeStatus]?.includes(args.status)) {
      throw new ConvexError(
        `Ongeldige statuswijziging: ${oudeStatus} → ${args.status}`
      );
    }

    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    // Zet specifieke timestamps bij statuswijziging
    if (args.status === "verzonden") {
      updates.verzondenAt = now;
    }

    if (args.status === "betaald") {
      updates.betaaldAt = now;
    }

    await ctx.db.patch(args.id, updates);

    // Update project status naar gefactureerd indien van toepassing
    if (args.status === "definitief" || args.status === "verzonden") {
      const project = await ctx.db.get(factuur.projectId);
      if (project && project.status !== "gefactureerd") {
        await ctx.db.patch(factuur.projectId, {
          status: "gefactureerd",
          updatedAt: now,
        });
      }

      // Notify klant via portal email when factuur is sent
      if (args.status === "verzonden" && project?.klantId) {
        await ctx.scheduler.runAfter(0, internal.portaalEmail.sendFactuurNotification, {
          factuurId: args.id,
        });
      }
    }

    return args.id;
  },
});

/**
 * Markeer factuur als betaald met optionele betaaldatum.
 */
export const markAsPaid = mutation({
  args: {
    id: v.id("facturen"),
    betaaldAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verifieer eigenaarschap
    const factuur = await getOwnedFactuur(ctx, args.id);
    const now = Date.now();

    // Alleen verzonden facturen kunnen als betaald worden gemarkeerd
    if (factuur.status !== "verzonden") {
      throw new ConvexError("Alleen verzonden facturen kunnen als betaald worden gemarkeerd");
    }

    await ctx.db.patch(args.id, {
      status: "betaald",
      betaaldAt: args.betaaldAt ?? now,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Archive a factuur.
 * Sets isArchived to true and archivedAt to the current timestamp.
 */
export const archive = mutation({
  args: {
    id: v.id("facturen"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verifieer eigenaarschap
    await getOwnedFactuur(ctx, args.id);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Markeer factuur als betaald en archiveer het project en de offerte.
 * This is a convenience mutation that performs multiple operations:
 * 1. Updates the factuur status to "betaald"
 * 2. Updates the project status to "gefactureerd" and archives it
 * 3. Archives the linked offerte
 */
export const markAsPaidAndArchiveProject = mutation({
  args: {
    id: v.id("facturen"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verifieer eigenaarschap van factuur
    const factuur = await getOwnedFactuur(ctx, args.id);
    const now = Date.now();

    // Alleen verzonden facturen kunnen als betaald worden gemarkeerd
    if (factuur.status !== "verzonden") {
      throw new ConvexError("Alleen verzonden facturen kunnen als betaald worden gemarkeerd");
    }

    // Update factuur status to "betaald"
    await ctx.db.patch(args.id, {
      status: "betaald",
      betaaldAt: now,
      updatedAt: now,
    });

    // Get the linked project
    const project = await ctx.db.get(factuur.projectId);
    if (!project) {
      throw new ConvexError("Project niet gevonden");
    }

    // Verify ownership of project
    if (project.userId.toString() !== factuur.userId.toString()) {
      throw new ConvexError("Geen toegang tot dit project");
    }

    // Update project status to "gefactureerd" and archive it
    await ctx.db.patch(factuur.projectId, {
      status: "gefactureerd",
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    });

    // Get the linked offerte via project.offerteId
    const offerte = await ctx.db.get(project.offerteId);
    if (!offerte) {
      throw new ConvexError("Offerte niet gevonden");
    }

    // Verify ownership of offerte
    if (offerte.userId.toString() !== factuur.userId.toString()) {
      throw new ConvexError("Geen toegang tot deze offerte");
    }

    // Archive the offerte
    await ctx.db.patch(project.offerteId, {
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      factuurId: args.id,
      projectId: factuur.projectId,
      offerteId: project.offerteId,
    };
  },
});

/**
 * Get facturen statistics for the dashboard.
 * Returns totals, amounts, and counts per status.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Count per status
    let conceptCount = 0;
    let definitiefCount = 0;
    let verzondenCount = 0;
    let betaaldCount = 0;
    let vervallenCount = 0;
    let totaalBedrag = 0;
    let openstaandBedrag = 0;
    let betaaldBedrag = 0;

    for (const factuur of facturen) {
      // Count by status
      switch (factuur.status) {
        case "concept":
          conceptCount++;
          break;
        case "definitief":
          definitiefCount++;
          break;
        case "verzonden":
          verzondenCount++;
          openstaandBedrag += factuur.totaalInclBtw;
          break;
        case "betaald":
          betaaldCount++;
          betaaldBedrag += factuur.totaalInclBtw;
          break;
        case "vervallen":
          vervallenCount++;
          break;
      }
      totaalBedrag += factuur.totaalInclBtw;
    }

    return {
      totaal: facturen.length,
      totaalBedrag,
      openstaandBedrag,
      betaaldBedrag,
      concept: conceptCount,
      definitief: definitiefCount,
      verzonden: verzondenCount,
      betaald: betaaldCount,
      vervallen: vervallenCount,
    };
  },
});

/**
 * List facturen with cursor-based pagination.
 * Uses Convex native .paginate() to avoid loading all records into memory.
 */
export const listPaginated = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("concept"),
        v.literal("definitief"),
        v.literal("verzonden"),
        v.literal("betaald"),
        v.literal("vervallen")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit || 25;

    const result = await ctx.db
      .query("facturen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({ numItems: limit, cursor: args.cursor ?? null });

    // Post-filter by status if provided
    let items = result.page;
    if (args.status) {
      items = items.filter((f) => f.status === args.status);
    }

    return {
      items,
      nextCursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  },
});

/**
 * Get recent facturen for the dashboard.
 * Returns max 5 facturen sorted by most recently created.
 */
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit ?? 5;

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return facturen.map((factuur) => ({
      _id: factuur._id,
      factuurnummer: factuur.factuurnummer,
      klantNaam: factuur.klant.naam,
      totaalInclBtw: factuur.totaalInclBtw,
      status: factuur.status,
      factuurdatum: factuur.factuurdatum,
      vervaldatum: factuur.vervaldatum,
    }));
  },
});

/**
 * Bulk archive multiple facturen.
 * Sets isArchived to true and archivedAt to the current timestamp.
 */
export const bulkArchive = mutation({
  args: {
    ids: v.array(v.id("facturen")),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const now = Date.now();

    for (const id of args.ids) {
      // Verify ownership for each factuur
      await getOwnedFactuur(ctx, id);

      await ctx.db.patch(id, {
        isArchived: true,
        archivedAt: now,
        updatedAt: now,
      });
    }

    return args.ids.length;
  },
});

/**
 * Bulk restore archived facturen.
 * Clears isArchived and archivedAt fields.
 */
export const bulkRestore = mutation({
  args: {
    ids: v.array(v.id("facturen")),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const now = Date.now();

    for (const id of args.ids) {
      // Verify ownership for each factuur
      await getOwnedFactuur(ctx, id);

      await ctx.db.patch(id, {
        isArchived: undefined,
        archivedAt: undefined,
        updatedAt: now,
      });
    }

    return args.ids.length;
  },
});

/**
 * Maak een creditnota aan voor een bestaande factuur (FAC-008).
 * Een creditnota is een negatieve factuur die verwijst naar de originele factuur.
 * De originele factuur wordt NOOIT verwijderd (fiscale eis).
 * Creditnota krijgt automatisch een CN-prefix factuurnummer.
 */
export const createCreditnota = mutation({
  args: {
    factuurId: v.id("facturen"),
    reden: v.string(),
    // Optional: select specific regels to credit (by regel id). If omitted, all regels are credited.
    regelIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Haal originele factuur op en verifieer eigenaarschap
    const factuur = await getOwnedFactuur(ctx, args.factuurId);

    // Alleen verzonden, betaald of vervallen facturen kunnen gecrediteerd worden
    if (!["verzonden", "betaald", "vervallen"].includes(factuur.status)) {
      throw new ConvexError(
        "Alleen verzonden, betaalde of vervallen facturen kunnen gecrediteerd worden"
      );
    }

    // Controleer of er al een creditnota bestaat voor deze factuur
    const bestaandeCreditnota = await ctx.db
      .query("facturen")
      .withIndex("by_referentieFactuur", (q) =>
        q.eq("referentieFactuurId", args.factuurId)
      )
      .first();

    if (bestaandeCreditnota) {
      throw new ConvexError(
        "Er bestaat al een creditnota voor deze factuur"
      );
    }

    // Haal instellingen op voor factuurnummer generatie
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!instellingen) {
      throw new ConvexError(
        "Instellingen niet gevonden. Configureer eerst je bedrijfsgegevens."
      );
    }

    // Genereer creditnota nummer met CN-prefix
    const laatsteNummer = instellingen.laatsteFactuurNummer ?? 0;
    const volgendNummer = laatsteNummer + 1;
    const jaar = new Date().getFullYear();
    const creditnotaNummer = `CN-${jaar}-${String(volgendNummer).padStart(3, "0")}`;

    // Bepaal welke regels gecrediteerd worden
    let creditRegels = factuur.regels;
    if (args.regelIds && args.regelIds.length > 0) {
      creditRegels = factuur.regels.filter((r) =>
        args.regelIds!.includes(r.id)
      );
      if (creditRegels.length === 0) {
        throw new ConvexError("Geen geldige regels geselecteerd voor creditnota");
      }
    }

    // Maak negatieve regels (bedragen worden negatief)
    const negatieveRegels = creditRegels.map((r) => ({
      id: r.id,
      omschrijving: r.omschrijving,
      eenheid: r.eenheid,
      hoeveelheid: r.hoeveelheid,
      prijsPerEenheid: -Math.abs(r.prijsPerEenheid),
      totaal: -Math.abs(r.totaal),
    }));

    // Bereken negatieve totalen
    const regelsTotaal = negatieveRegels.reduce((sum, r) => sum + r.totaal, 0);
    const subtotaal = regelsTotaal;
    const btwBedrag = subtotaal * (factuur.btwPercentage / 100);
    const totaalInclBtw = subtotaal + btwBedrag;

    // Maak de creditnota aan (als factuur met isCreditnota = true)
    const creditnotaId = await ctx.db.insert("facturen", {
      userId,
      projectId: factuur.projectId,
      factuurnummer: creditnotaNummer,
      status: "definitief", // Creditnota's zijn meteen definitief
      isCreditnota: true,
      referentieFactuurId: args.factuurId,
      creditnotaReden: args.reden,
      klant: factuur.klant,
      bedrijf: factuur.bedrijf,
      regels: negatieveRegels,
      correcties: undefined,
      subtotaal,
      btwPercentage: factuur.btwPercentage,
      btwBedrag,
      totaalInclBtw,
      factuurdatum: now,
      vervaldatum: now, // Creditnota's hebben geen betalingstermijn
      betalingstermijnDagen: 0,
      notities: `Creditnota voor ${factuur.factuurnummer}: ${args.reden}`,
      createdAt: now,
      updatedAt: now,
    });

    // Update laatsteFactuurNummer in instellingen
    await ctx.db.patch(instellingen._id, {
      laatsteFactuurNummer: volgendNummer,
    });

    return creditnotaId;
  },
});

/**
 * Haal creditnota op voor een specifieke factuur (FAC-008).
 * Geeft de creditnota terug die gekoppeld is aan de opgegeven factuur.
 */
export const getCreditnota = query({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const creditnota = await ctx.db
      .query("facturen")
      .withIndex("by_referentieFactuur", (q) =>
        q.eq("referentieFactuurId", args.factuurId)
      )
      .first();

    return creditnota ?? null;
  },
});

/**
 * Haal alle creditnota's op voor de ingelogde gebruiker (FAC-008).
 */
export const listCreditnotas = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return facturen.filter((f) => f.isCreditnota === true);
  },
});

/**
 * Haal factuur op met volledige project, offerte en nacalculatie details.
 */
export const getWithDetails = query({
  args: { id: v.id("facturen") },
  handler: async (ctx, args) => {
    // Verifieer eigenaarschap
    const factuur = await ctx.db.get(args.id);
    if (!factuur) return null;

    const user = await requireAuth(ctx);
    if (factuur.userId.toString() !== user._id.toString()) {
      return null;
    }

    // Haal gerelateerde data op
    const project = await ctx.db.get(factuur.projectId);

    // Haal offerte op via project
    let offerte = null;
    if (project) {
      offerte = await ctx.db.get(project.offerteId);
    }

    // Haal nacalculatie op indien beschikbaar
    const nacalculatie = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", factuur.projectId))
      .unique();

    // Haal voorcalculatie op indien beschikbaar
    const voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", factuur.projectId))
      .unique();

    return {
      factuur,
      project,
      offerte,
      nacalculatie,
      voorcalculatie,
    };
  },
});

// ── Internal queries (for use by other Convex functions) ────────────────

/** Get a factuur by ID without auth checks. For internal use only. */
export const getByIdInternal = internalQuery({
  args: { factuurId: v.id("facturen") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.factuurId);
  },
});
