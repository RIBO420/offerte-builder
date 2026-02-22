import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Alle actieve plantsoorten ophalen (inclusief systeem defaults waar userId null is)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Haal gebruiker-specifieke plantsoorten op
    const userPlantsoorten = await ctx.db
      .query("plantsoorten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Haal systeem defaults op (userId is undefined)
    const systeemPlantsoorten = await ctx.db
      .query("plantsoorten")
      .withIndex("by_user", (q) => q.eq("userId", undefined))
      .collect();

    // Combineer en filter alleen actieve
    const alle = [...userPlantsoorten, ...systeemPlantsoorten];
    return alle.filter((p) => p.isActief !== false);
  },
});

// Plantsoorten ophalen gefilterd op lichtbehoefte
export const getByLichtbehoefte = query({
  args: {
    lichtbehoefte: v.union(
      v.literal("zon"),
      v.literal("halfschaduw"),
      v.literal("schaduw")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const plantsoorten = await ctx.db
      .query("plantsoorten")
      .withIndex("by_lichtbehoefte", (q) =>
        q.eq("lichtbehoefte", args.lichtbehoefte)
      )
      .collect();

    // Filter op eigenaar (user of systeem default) en actief
    return plantsoorten.filter(
      (p) =>
        (p.userId === undefined ||
          p.userId?.toString() === userId.toString()) &&
        p.isActief !== false
    );
  },
});

// Zoeken op type en/of lichtbehoefte
export const search = query({
  args: {
    type: v.optional(v.string()),
    lichtbehoefte: v.optional(
      v.union(
        v.literal("zon"),
        v.literal("halfschaduw"),
        v.literal("schaduw")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Haal gebruiker-specifieke plantsoorten op
    const userPlantsoorten = await ctx.db
      .query("plantsoorten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Haal systeem defaults op (userId is undefined)
    const systeemPlantsoorten = await ctx.db
      .query("plantsoorten")
      .withIndex("by_user", (q) => q.eq("userId", undefined))
      .collect();

    // Combineer alle plantsoorten
    let resultaat = [...userPlantsoorten, ...systeemPlantsoorten];

    // Filter alleen actieve
    resultaat = resultaat.filter((p) => p.isActief !== false);

    // Filter op type indien opgegeven
    if (args.type) {
      const zoekType = args.type.toLowerCase();
      resultaat = resultaat.filter(
        (p) => p.type.toLowerCase() === zoekType
      );
    }

    // Filter op lichtbehoefte indien opgegeven
    if (args.lichtbehoefte) {
      resultaat = resultaat.filter(
        (p) => p.lichtbehoefte === args.lichtbehoefte
      );
    }

    return resultaat;
  },
});

// Eén plantsoort ophalen op ID (met eigendomsverificatie voor user-plantsoorten)
export const getById = query({
  args: { id: v.id("plantsoorten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const plantsoort = await ctx.db.get(args.id);

    if (!plantsoort) return null;

    // Systeem defaults zijn voor iedereen beschikbaar
    if (plantsoort.userId === undefined) {
      return plantsoort;
    }

    // User-specifieke plantsoorten: eigendomsverificatie
    if (plantsoort.userId.toString() !== userId.toString()) {
      return null;
    }

    return plantsoort;
  },
});

// Nieuwe plantsoort aanmaken
export const create = mutation({
  args: {
    naam: v.string(),
    type: v.string(),
    lichtbehoefte: v.union(
      v.literal("zon"),
      v.literal("halfschaduw"),
      v.literal("schaduw")
    ),
    bodemvoorkeur: v.string(),
    prijsIndicatie: v.number(),
    omschrijving: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    if (!args.naam.trim()) {
      throw new Error("Naam is verplicht");
    }
    if (!args.type.trim()) {
      throw new Error("Type is verplicht");
    }
    if (!args.bodemvoorkeur.trim()) {
      throw new Error("Bodemvoorkeur is verplicht");
    }

    const now = Date.now();
    return await ctx.db.insert("plantsoorten", {
      userId,
      naam: args.naam.trim(),
      type: args.type.trim(),
      lichtbehoefte: args.lichtbehoefte,
      bodemvoorkeur: args.bodemvoorkeur.trim(),
      prijsIndicatie: args.prijsIndicatie,
      omschrijving: args.omschrijving,
      isActief: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Plantsoort bijwerken (met eigendomsverificatie, alleen user-plantsoorten)
export const update = mutation({
  args: {
    id: v.id("plantsoorten"),
    naam: v.optional(v.string()),
    type: v.optional(v.string()),
    lichtbehoefte: v.optional(
      v.union(
        v.literal("zon"),
        v.literal("halfschaduw"),
        v.literal("schaduw")
      )
    ),
    bodemvoorkeur: v.optional(v.string()),
    prijsIndicatie: v.optional(v.number()),
    omschrijving: v.optional(v.string()),
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const plantsoort = await ctx.db.get(args.id);
    if (!plantsoort) {
      throw new Error("Plantsoort niet gevonden");
    }

    // Systeem defaults mogen niet bewerkt worden door gebruikers
    if (plantsoort.userId === undefined) {
      throw new Error("Systeem plantsoorten kunnen niet worden bewerkt");
    }

    if (plantsoort.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze plantsoort");
    }

    const { id, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = { updatedAt: Date.now() };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, filteredUpdates);
    return id;
  },
});

// Soft delete plantsoort (isActief = false, alleen user-plantsoorten)
export const remove = mutation({
  args: { id: v.id("plantsoorten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const plantsoort = await ctx.db.get(args.id);
    if (!plantsoort) {
      throw new Error("Plantsoort niet gevonden");
    }

    // Systeem defaults mogen niet verwijderd worden door gebruikers
    if (plantsoort.userId === undefined) {
      throw new Error("Systeem plantsoorten kunnen niet worden verwijderd");
    }

    if (plantsoort.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze plantsoort");
    }

    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});
