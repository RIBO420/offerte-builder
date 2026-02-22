import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Alle actieve garantiepakketten ophalen voor ingelogde gebruiker
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const pakketten = await ctx.db
      .query("garantiePakketten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter alleen actieve pakketten
    return pakketten.filter((p) => p.isActief !== false);
  },
});

// Garantiepakketten ophalen gefilterd op tier
export const getByTier = query({
  args: {
    tier: v.union(
      v.literal("basis"),
      v.literal("premium"),
      v.literal("premium_plus")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const pakketten = await ctx.db
      .query("garantiePakketten")
      .withIndex("by_tier", (q) => q.eq("tier", args.tier))
      .collect();

    // Filter op userId en actief
    return pakketten.filter(
      (p) => p.userId.toString() === userId.toString() && p.isActief !== false
    );
  },
});

// Eén garantiepakket ophalen op ID (met eigendomsverificatie)
export const getById = query({
  args: { id: v.id("garantiePakketten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const pakket = await ctx.db.get(args.id);

    if (!pakket) return null;
    if (pakket.userId.toString() !== userId.toString()) {
      return null;
    }

    return pakket;
  },
});

// Nieuw garantiepakket aanmaken
export const create = mutation({
  args: {
    naam: v.string(),
    tier: v.union(
      v.literal("basis"),
      v.literal("premium"),
      v.literal("premium_plus")
    ),
    duurJaren: v.number(),
    maxCallbacks: v.number(),
    prijs: v.number(),
    beschrijving: v.string(),
    features: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    if (!args.naam.trim()) {
      throw new Error("Naam is verplicht");
    }
    if (!args.beschrijving.trim()) {
      throw new Error("Beschrijving is verplicht");
    }

    const now = Date.now();
    return await ctx.db.insert("garantiePakketten", {
      userId,
      naam: args.naam.trim(),
      tier: args.tier,
      duurJaren: args.duurJaren,
      maxCallbacks: args.maxCallbacks,
      prijs: args.prijs,
      beschrijving: args.beschrijving.trim(),
      features: args.features,
      isActief: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Garantiepakket bijwerken (met eigendomsverificatie)
export const update = mutation({
  args: {
    id: v.id("garantiePakketten"),
    naam: v.optional(v.string()),
    tier: v.optional(
      v.union(
        v.literal("basis"),
        v.literal("premium"),
        v.literal("premium_plus")
      )
    ),
    duurJaren: v.optional(v.number()),
    maxCallbacks: v.optional(v.number()),
    prijs: v.optional(v.number()),
    beschrijving: v.optional(v.string()),
    features: v.optional(v.array(v.string())),
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const pakket = await ctx.db.get(args.id);
    if (!pakket) {
      throw new Error("Garantiepakket niet gevonden");
    }
    if (pakket.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit garantiepakket");
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

// Soft delete garantiepakket (isActief = false)
export const remove = mutation({
  args: { id: v.id("garantiePakketten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const pakket = await ctx.db.get(args.id);
    if (!pakket) {
      throw new Error("Garantiepakket niet gevonden");
    }
    if (pakket.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit garantiepakket");
    }

    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});
