import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Haal alle medewerkers op voor de ingelogde gebruiker
// Optionele filter op isActief status
export const list = query({
  args: {
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Als isActief filter meegegeven, gebruik de samengestelde index
    if (args.isActief !== undefined) {
      return await ctx.db
        .query("medewerkers")
        .withIndex("by_user_actief", (q) =>
          q.eq("userId", userId).eq("isActief", args.isActief!)
        )
        .collect();
    }

    // Anders haal alle medewerkers op
    return await ctx.db
      .query("medewerkers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Haal een enkele medewerker op (met eigenaarschap verificatie)
export const get = query({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const medewerker = await ctx.db.get(args.id);

    if (!medewerker) return null;
    if (medewerker.userId.toString() !== userId.toString()) {
      return null;
    }

    return medewerker;
  },
});

// Haal alleen actieve medewerkers op (voor dropdowns/selecties)
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("medewerkers")
      .withIndex("by_user_actief", (q) =>
        q.eq("userId", userId).eq("isActief", true)
      )
      .collect();
  },
});

// Maak een nieuwe medewerker aan
export const create = mutation({
  args: {
    naam: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    functie: v.optional(v.string()),
    uurtarief: v.optional(v.number()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    return await ctx.db.insert("medewerkers", {
      userId,
      naam: args.naam,
      email: args.email,
      telefoon: args.telefoon,
      functie: args.functie,
      uurtarief: args.uurtarief,
      notities: args.notities,
      isActief: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Werk een medewerker bij (met eigenaarschap verificatie)
export const update = mutation({
  args: {
    id: v.id("medewerkers"),
    naam: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    functie: v.optional(v.string()),
    uurtarief: v.optional(v.number()),
    notities: v.optional(v.string()),
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    const { id, ...updates } = args;

    // Filter undefined waarden uit
    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

// Soft delete: zet isActief op false (met eigenaarschap verificatie)
export const remove = mutation({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Permanent verwijderen (met eigenaarschap verificatie)
export const hardDelete = mutation({
  args: { id: v.id("medewerkers") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const medewerker = await ctx.db.get(args.id);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }
    if (medewerker.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze medewerker");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
