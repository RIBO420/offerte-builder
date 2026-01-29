import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all correction factors for user (falls back to system defaults)
export const list = query({
  args: { userId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    // First get system defaults (userId = undefined)
    const systemDefaults = await ctx.db
      .query("correctiefactoren")
      .filter((q) => q.eq(q.field("userId"), undefined))
      .collect();

    if (!args.userId) {
      return systemDefaults;
    }

    // Get user overrides
    const userOverrides = await ctx.db
      .query("correctiefactoren")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId))
      .collect();

    // Merge: user overrides take precedence
    const overrideMap = new Map(
      userOverrides.map((f) => [`${f.type}-${f.waarde}`, f])
    );

    const merged = systemDefaults.map((f) => {
      const override = overrideMap.get(`${f.type}-${f.waarde}`);
      return override || f;
    });

    return merged;
  },
});

// Get correction factor by type and value
export const getByTypeAndValue = query({
  args: {
    userId: v.optional(v.id("users")),
    type: v.string(),
    waarde: v.string(),
  },
  handler: async (ctx, args) => {
    // Try user override first
    if (args.userId) {
      const userFactor = await ctx.db
        .query("correctiefactoren")
        .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
        .filter((q) => q.eq(q.field("waarde"), args.waarde))
        .unique();

      if (userFactor) return userFactor;
    }

    // Fall back to system default
    const systemFactor = await ctx.db
      .query("correctiefactoren")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), undefined),
          q.eq(q.field("type"), args.type),
          q.eq(q.field("waarde"), args.waarde)
        )
      )
      .unique();

    return systemFactor;
  },
});

// Get all factors for a specific type
export const getByType = query({
  args: {
    userId: v.optional(v.id("users")),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const systemFactors = await ctx.db
      .query("correctiefactoren")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), undefined),
          q.eq(q.field("type"), args.type)
        )
      )
      .collect();

    if (!args.userId) {
      return systemFactors;
    }

    const userFactors = await ctx.db
      .query("correctiefactoren")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .collect();

    // Merge
    const overrideMap = new Map(userFactors.map((f) => [f.waarde, f]));
    return systemFactors.map((f) => overrideMap.get(f.waarde) || f);
  },
});

// Update or create user override for correction factor
export const upsert = mutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    waarde: v.string(),
    factor: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("correctiefactoren")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .filter((q) => q.eq(q.field("waarde"), args.waarde))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { factor: args.factor });
      return existing._id;
    }

    return await ctx.db.insert("correctiefactoren", {
      userId: args.userId,
      type: args.type,
      waarde: args.waarde,
      factor: args.factor,
    });
  },
});

// Reset user override to system default
export const resetToDefault = mutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    waarde: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("correctiefactoren")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .filter((q) => q.eq(q.field("waarde"), args.waarde))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Initialize system defaults (run once)
export const initializeSystemDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if already initialized
    const existing = await ctx.db
      .query("correctiefactoren")
      .filter((q) => q.eq(q.field("userId"), undefined))
      .first();

    if (existing) {
      return { message: "System defaults already exist", count: 0 };
    }

    const defaults = [
      // Bereikbaarheid
      { type: "bereikbaarheid", waarde: "goed", factor: 1.0 },
      { type: "bereikbaarheid", waarde: "beperkt", factor: 1.2 },
      { type: "bereikbaarheid", waarde: "slecht", factor: 1.5 },

      // Complexiteit
      { type: "complexiteit", waarde: "laag", factor: 1.0 },
      { type: "complexiteit", waarde: "gemiddeld", factor: 1.15 },
      { type: "complexiteit", waarde: "hoog", factor: 1.3 },

      // Intensiteit (beplanting)
      { type: "intensiteit", waarde: "weinig", factor: 0.8 },
      { type: "intensiteit", waarde: "gemiddeld", factor: 1.0 },
      { type: "intensiteit", waarde: "veel", factor: 1.3 },

      // Snijwerk (bestrating)
      { type: "snijwerk", waarde: "laag", factor: 1.0 },
      { type: "snijwerk", waarde: "gemiddeld", factor: 1.2 },
      { type: "snijwerk", waarde: "hoog", factor: 1.4 },

      // Achterstalligheid (onderhoud)
      { type: "achterstalligheid", waarde: "laag", factor: 1.0 },
      { type: "achterstalligheid", waarde: "gemiddeld", factor: 1.3 },
      { type: "achterstalligheid", waarde: "hoog", factor: 1.6 },

      // Hoogteverschil
      { type: "hoogteverschil", waarde: "geen", factor: 1.0 },
      { type: "hoogteverschil", waarde: "licht", factor: 1.1 },
      { type: "hoogteverschil", waarde: "matig", factor: 1.25 },
      { type: "hoogteverschil", waarde: "sterk", factor: 1.5 },

      // Diepte grondwerk
      { type: "diepte", waarde: "licht", factor: 1.0 },
      { type: "diepte", waarde: "standaard", factor: 1.5 },
      { type: "diepte", waarde: "zwaar", factor: 2.0 },

      // Hoogte heggen/bomen
      { type: "hoogte", waarde: "laag", factor: 1.0 },
      { type: "hoogte", waarde: "middel", factor: 1.3 },
      { type: "hoogte", waarde: "hoog", factor: 1.6 },

      // Bodem type (onderhoud)
      { type: "bodem", waarde: "open", factor: 1.2 },
      { type: "bodem", waarde: "bedekt", factor: 0.8 },

      // Snoei type
      { type: "snoei", waarde: "zijkanten", factor: 0.6 },
      { type: "snoei", waarde: "bovenkant", factor: 0.5 },
      { type: "snoei", waarde: "beide", factor: 1.0 },
    ];

    for (const factor of defaults) {
      await ctx.db.insert("correctiefactoren", {
        userId: undefined,
        ...factor,
      });
    }

    return { message: "System defaults initialized", count: defaults.length };
  },
});
