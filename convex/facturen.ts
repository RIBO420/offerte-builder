/**
 * Facturen Functions - Invoice module
 *
 * Provides functions for creating and managing facturen (invoices).
 * Facturen worden gegenereerd vanuit projecten na nacalculatie.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
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
      throw new Error("Er bestaat al een factuur voor dit project");
    }

    // Haal offerte op
    const offerte = await ctx.db.get(project.offerteId);
    if (!offerte) {
      throw new Error("Offerte niet gevonden voor dit project");
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
      throw new Error("Instellingen niet gevonden. Configureer eerst je bedrijfsgegevens.");
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
 * Optionele statusfilter.
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
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const facturen = await ctx.db
      .query("facturen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter op status indien opgegeven
    if (args.status) {
      return facturen.filter((f) => f.status === args.status);
    }

    return facturen;
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
    // Verifieer eigenaarschap
    const factuur = await getOwnedFactuur(ctx, args.id);
    const now = Date.now();

    // Alleen bewerken in concept status
    if (factuur.status !== "concept") {
      throw new Error("Factuur kan alleen bewerkt worden in concept status");
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
      throw new Error(
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
    // Verifieer eigenaarschap
    const factuur = await getOwnedFactuur(ctx, args.id);
    const now = Date.now();

    // Alleen verzonden facturen kunnen als betaald worden gemarkeerd
    if (factuur.status !== "verzonden") {
      throw new Error("Alleen verzonden facturen kunnen als betaald worden gemarkeerd");
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

    // Initialize stats
    const stats = {
      totaal: facturen.length,
      totaalBedrag: 0,
      openstaandBedrag: 0,
      betaaldBedrag: 0,
      concept: 0,
      definitief: 0,
      verzonden: 0,
      betaald: 0,
      vervallen: 0,
    };

    for (const factuur of facturen) {
      // Count by status
      if (factuur.status in stats) {
        stats[factuur.status as keyof typeof stats]++;
      }

      // Sum totals
      stats.totaalBedrag += factuur.totaalInclBtw;

      // Openstaand = verzonden (nog niet betaald of vervallen)
      if (factuur.status === "verzonden") {
        stats.openstaandBedrag += factuur.totaalInclBtw;
      }

      // Betaald bedrag
      if (factuur.status === "betaald") {
        stats.betaaldBedrag += factuur.totaalInclBtw;
      }
    }

    return stats;
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
