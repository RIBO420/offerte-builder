/**
 * Inkooporders Functions - Purchase Order module
 *
 * Provides functions for creating and managing inkooporders (purchase orders).
 * Inkooporders worden aangemaakt voor leveranciers, optioneel gekoppeld aan projecten.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
import { Id } from "./_generated/dataModel";
import { validatePositive, sanitizeOptionalString } from "./validators";

/**
 * Validator voor inkooporderregel
 */
const regelValidator = v.object({
  id: v.string(),
  productId: v.optional(v.id("producten")),
  omschrijving: v.string(),
  hoeveelheid: v.number(),
  eenheid: v.string(),
  prijsPerEenheid: v.number(),
  totaal: v.number(),
});

/**
 * Get an inkooporder and verify ownership.
 */
async function getOwnedInkooporder(
  ctx: Parameters<typeof requireAuth>[0],
  inkooporderId: Id<"inkooporders">
) {
  const inkooporder = await ctx.db.get(inkooporderId);
  return verifyOwnership(ctx, inkooporder, "inkooporder");
}

/**
 * Get a leverancier and verify ownership.
 */
async function getOwnedLeverancier(
  ctx: Parameters<typeof requireAuth>[0],
  leverancierId: Id<"leveranciers">
) {
  const leverancier = await ctx.db.get(leverancierId);
  return verifyOwnership(ctx, leverancier, "leverancier");
}

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
 * Generate the next order number in format "IO-YYYY-XXXX".
 */
async function generateOrderNummer(
  ctx: Parameters<typeof requireAuth>[0],
  userId: Id<"users">
): Promise<string> {
  const jaar = new Date().getFullYear();

  // Get the highest order number for this year
  const existingOrders = await ctx.db
    .query("inkooporders")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  // Filter orders from current year and find the highest number
  const prefix = `IO-${jaar}-`;
  let highestNumber = 0;

  for (const order of existingOrders) {
    if (order.orderNummer.startsWith(prefix)) {
      const numPart = order.orderNummer.substring(prefix.length);
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > highestNumber) {
        highestNumber = num;
      }
    }
  }

  const nextNumber = highestNumber + 1;
  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

// ============================================
// QUERIES
// ============================================

/**
 * Lijst alle inkooporders voor de ingelogde gebruiker.
 * Ondersteunt filters op status, leverancier en project.
 */
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("concept"),
        v.literal("besteld"),
        v.literal("geleverd"),
        v.literal("gefactureerd")
      )
    ),
    leverancierId: v.optional(v.id("leveranciers")),
    projectId: v.optional(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    let inkooporders = await ctx.db
      .query("inkooporders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter op status indien opgegeven
    if (args.status) {
      inkooporders = inkooporders.filter((io) => io.status === args.status);
    }

    // Filter op leverancier indien opgegeven
    if (args.leverancierId) {
      inkooporders = inkooporders.filter(
        (io) => io.leverancierId.toString() === args.leverancierId!.toString()
      );
    }

    // Filter op project indien opgegeven
    if (args.projectId) {
      inkooporders = inkooporders.filter(
        (io) => io.projectId?.toString() === args.projectId!.toString()
      );
    }

    return inkooporders;
  },
});

/**
 * Haal een specifieke inkooporder op met leverancier details.
 */
export const getById = query({
  args: { id: v.id("inkooporders") },
  handler: async (ctx, args) => {
    const inkooporder = await ctx.db.get(args.id);
    if (!inkooporder) return null;

    // Verifieer eigenaarschap
    const user = await requireAuth(ctx);
    if (inkooporder.userId.toString() !== user._id.toString()) {
      return null; // Verberg bestaan voor onbevoegde gebruikers
    }

    // Haal leverancier op
    const leverancier = await ctx.db.get(inkooporder.leverancierId);

    // Haal project op indien gekoppeld
    let project = null;
    if (inkooporder.projectId) {
      project = await ctx.db.get(inkooporder.projectId);
    }

    return {
      ...inkooporder,
      leverancier,
      project,
    };
  },
});

/**
 * Haal alle inkooporders voor een specifiek project.
 */
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verifieer eigenaarschap van project
    await getOwnedProject(ctx, args.projectId);

    const inkooporders = await ctx.db
      .query("inkooporders")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    return inkooporders;
  },
});

/**
 * Haal alle inkooporders voor een specifieke leverancier.
 */
export const getByLeverancier = query({
  args: { leverancierId: v.id("leveranciers") },
  handler: async (ctx, args) => {
    // Verifieer eigenaarschap van leverancier
    await getOwnedLeverancier(ctx, args.leverancierId);

    const inkooporders = await ctx.db
      .query("inkooporders")
      .withIndex("by_leverancier", (q) => q.eq("leverancierId", args.leverancierId))
      .order("desc")
      .collect();

    return inkooporders;
  },
});

/**
 * Statistieken voor inkooporders.
 * Geeft totalen per status en totaal per maand.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const inkooporders = await ctx.db
      .query("inkooporders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Totalen per status
    const perStatus = {
      concept: 0,
      besteld: 0,
      geleverd: 0,
      gefactureerd: 0,
    };

    // Bedragen per status
    const bedragPerStatus = {
      concept: 0,
      besteld: 0,
      geleverd: 0,
      gefactureerd: 0,
    };

    // Totaal per maand (laatste 12 maanden)
    const now = new Date();
    const perMaand: Record<string, number> = {};

    // Initialiseer laatste 12 maanden
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      perMaand[key] = 0;
    }

    let totaalBedrag = 0;
    let totaalAantal = inkooporders.length;

    for (const io of inkooporders) {
      // Tel per status
      perStatus[io.status as keyof typeof perStatus]++;
      bedragPerStatus[io.status as keyof typeof bedragPerStatus] += io.totaal;
      totaalBedrag += io.totaal;

      // Tel per maand (gebaseerd op createdAt)
      const date = new Date(io.createdAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (key in perMaand) {
        perMaand[key] += io.totaal;
      }
    }

    return {
      totaalAantal,
      totaalBedrag,
      perStatus,
      bedragPerStatus,
      perMaand,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Maak een nieuwe inkooporder aan.
 * Genereert automatisch een orderNummer in format "IO-YYYY-XXXX".
 */
export const create = mutation({
  args: {
    leverancierId: v.id("leveranciers"),
    projectId: v.optional(v.id("projecten")),
    regels: v.array(regelValidator),
    notities: v.optional(v.string()),
    verwachteLevertijd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Verifieer eigenaarschap van leverancier
    await getOwnedLeverancier(ctx, args.leverancierId);

    // Verifieer eigenaarschap van project indien opgegeven
    if (args.projectId) {
      await getOwnedProject(ctx, args.projectId);
    }

    // Valideer regels
    if (args.regels.length === 0) {
      throw new Error("Voeg minimaal 1 regel toe");
    }

    for (const regel of args.regels) {
      if (!regel.omschrijving.trim()) {
        throw new Error("Omschrijving is verplicht voor alle regels");
      }
      validatePositive(regel.hoeveelheid, "Hoeveelheid");
      validatePositive(regel.prijsPerEenheid, "Prijs per eenheid");
    }

    // Genereer orderNummer
    const orderNummer = await generateOrderNummer(ctx, userId);

    // Bereken totaal
    const totaal = args.regels.reduce((sum, regel) => sum + regel.totaal, 0);

    // Sanitize notities
    const notities = sanitizeOptionalString(args.notities);

    const inkooporderId = await ctx.db.insert("inkooporders", {
      userId,
      leverancierId: args.leverancierId,
      projectId: args.projectId,
      orderNummer,
      status: "concept",
      regels: args.regels,
      totaal,
      notities,
      verwachteLevertijd: args.verwachteLevertijd,
      createdAt: now,
      updatedAt: now,
    });

    return inkooporderId;
  },
});

/**
 * Update een inkooporder.
 * Alleen mogelijk als status = concept.
 */
export const update = mutation({
  args: {
    id: v.id("inkooporders"),
    leverancierId: v.optional(v.id("leveranciers")),
    projectId: v.optional(v.id("projecten")),
    regels: v.optional(v.array(regelValidator)),
    notities: v.optional(v.string()),
    verwachteLevertijd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Verifieer eigenaarschap
    const inkooporder = await getOwnedInkooporder(ctx, args.id);
    const now = Date.now();

    // Alleen bewerken in concept status
    if (inkooporder.status !== "concept") {
      throw new Error("Inkooporder kan alleen bewerkt worden in concept status");
    }

    const updates: Record<string, unknown> = { updatedAt: now };

    // Verifieer nieuwe leverancier indien opgegeven
    if (args.leverancierId !== undefined) {
      await getOwnedLeverancier(ctx, args.leverancierId);
      updates.leverancierId = args.leverancierId;
    }

    // Verifieer nieuw project indien opgegeven
    if (args.projectId !== undefined) {
      if (args.projectId !== null) {
        await getOwnedProject(ctx, args.projectId);
      }
      updates.projectId = args.projectId;
    }

    if (args.regels !== undefined) {
      updates.regels = args.regels;
      updates.totaal = args.regels.reduce((sum, regel) => sum + regel.totaal, 0);
    }

    if (args.notities !== undefined) {
      updates.notities = args.notities;
    }

    if (args.verwachteLevertijd !== undefined) {
      updates.verwachteLevertijd = args.verwachteLevertijd;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Update de status van een inkooporder.
 * Workflow: concept -> besteld -> geleverd -> gefactureerd
 */
export const updateStatus = mutation({
  args: {
    id: v.id("inkooporders"),
    status: v.union(
      v.literal("concept"),
      v.literal("besteld"),
      v.literal("geleverd"),
      v.literal("gefactureerd")
    ),
  },
  handler: async (ctx, args) => {
    // Verifieer eigenaarschap
    const inkooporder = await getOwnedInkooporder(ctx, args.id);
    const now = Date.now();
    const oudeStatus = inkooporder.status;

    // Valideer statusovergang
    const geldigeOvergangen: Record<string, string[]> = {
      concept: ["besteld"],
      besteld: ["concept", "geleverd"], // Terug naar concept toegestaan
      geleverd: ["besteld", "gefactureerd"], // Terug naar besteld toegestaan
      gefactureerd: ["geleverd"], // Terug naar geleverd toegestaan
    };

    if (!geldigeOvergangen[oudeStatus]?.includes(args.status)) {
      throw new Error(
        `Ongeldige statuswijziging: ${oudeStatus} -> ${args.status}`
      );
    }

    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    // Zet specifieke timestamps bij statuswijziging
    if (args.status === "besteld" && oudeStatus === "concept") {
      updates.besteldAt = now;
    }

    if (args.status === "geleverd" && oudeStatus === "besteld") {
      updates.geleverdAt = now;
    }

    // Reset timestamps bij terugdraaien
    if (args.status === "concept" && oudeStatus === "besteld") {
      updates.besteldAt = undefined;
    }

    if (args.status === "besteld" && oudeStatus === "geleverd") {
      updates.geleverdAt = undefined;
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Verwijder een inkooporder.
 * Alleen mogelijk als status = concept.
 */
export const remove = mutation({
  args: { id: v.id("inkooporders") },
  handler: async (ctx, args) => {
    // Verifieer eigenaarschap
    const inkooporder = await getOwnedInkooporder(ctx, args.id);

    // Alleen verwijderen in concept status
    if (inkooporder.status !== "concept") {
      throw new Error(
        "Inkooporder kan alleen verwijderd worden in concept status"
      );
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
