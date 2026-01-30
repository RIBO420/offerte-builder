import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const klantValidator = v.object({
  naam: v.string(),
  adres: v.string(),
  postcode: v.string(),
  plaats: v.string(),
  email: v.optional(v.string()),
  telefoon: v.optional(v.string()),
});

const algemeenParamsValidator = v.object({
  bereikbaarheid: v.union(
    v.literal("goed"),
    v.literal("beperkt"),
    v.literal("slecht")
  ),
  achterstalligheid: v.optional(
    v.union(v.literal("laag"), v.literal("gemiddeld"), v.literal("hoog"))
  ),
});

const regelValidator = v.object({
  id: v.string(),
  scope: v.string(),
  omschrijving: v.string(),
  eenheid: v.string(),
  hoeveelheid: v.number(),
  prijsPerEenheid: v.number(),
  totaal: v.number(),
  type: v.union(v.literal("materiaal"), v.literal("arbeid"), v.literal("machine")),
});

const totalenValidator = v.object({
  materiaalkosten: v.number(),
  arbeidskosten: v.number(),
  totaalUren: v.number(),
  subtotaal: v.number(),
  marge: v.number(),
  margePercentage: v.number(),
  totaalExBtw: v.number(),
  btw: v.number(),
  totaalInclBtw: v.number(),
});

// List all offertes for user
export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// List offertes with pagination
export const listPaginated = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 25;

    const result = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .paginate({ numItems: limit, cursor: args.cursor ?? null });

    return {
      offertes: result.page,
      nextCursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  },
});

// Combined dashboard query - reduces round trips
export const getDashboardData = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Get all offertes in one query
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    // Calculate stats
    const stats = {
      totaal: offertes.length,
      concept: 0,
      definitief: 0,
      verzonden: 0,
      geaccepteerd: 0,
      afgewezen: 0,
      totaalWaarde: 0,
      geaccepteerdWaarde: 0,
    };

    for (const offerte of offertes) {
      stats[offerte.status as keyof typeof stats]++;
      stats.totaalWaarde += offerte.totalen.totaalInclBtw;
      if (offerte.status === "geaccepteerd") {
        stats.geaccepteerdWaarde += offerte.totalen.totaalInclBtw;
      }
    }

    // Get recent 5
    const recent = offertes.slice(0, 5);

    return {
      stats,
      recent,
      // For backwards compatibility, also include a limited list
      offertes: offertes.slice(0, 50),
    };
  },
});

// List offertes by status
export const listByStatus = query({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("concept"),
      v.literal("definitief"),
      v.literal("verzonden"),
      v.literal("geaccepteerd"),
      v.literal("afgewezen")
    ),
  },
  handler: async (ctx, args) => {
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return offertes.filter((o) => o.status === args.status);
  },
});

// Get single offerte
export const get = query({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get offerte by nummer
export const getByNummer = query({
  args: { offerteNummer: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("offertes")
      .withIndex("by_nummer", (q) => q.eq("offerteNummer", args.offerteNummer))
      .unique();
  },
});

// Create new offerte
export const create = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(v.literal("aanleg"), v.literal("onderhoud")),
    offerteNummer: v.string(),
    klant: klantValidator,
    algemeenParams: algemeenParamsValidator,
    scopes: v.optional(v.array(v.string())),
    scopeData: v.optional(v.any()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("offertes", {
      userId: args.userId,
      type: args.type,
      status: "concept",
      offerteNummer: args.offerteNummer,
      klant: args.klant,
      algemeenParams: args.algemeenParams,
      scopes: args.scopes,
      scopeData: args.scopeData,
      totalen: {
        materiaalkosten: 0,
        arbeidskosten: 0,
        totaalUren: 0,
        subtotaal: 0,
        marge: 0,
        margePercentage: 0,
        totaalExBtw: 0,
        btw: 0,
        totaalInclBtw: 0,
      },
      regels: [],
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update offerte basic info
export const update = mutation({
  args: {
    id: v.id("offertes"),
    klant: v.optional(klantValidator),
    algemeenParams: v.optional(algemeenParamsValidator),
    scopes: v.optional(v.array(v.string())),
    scopeData: v.optional(v.any()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

// Update offerte regels and recalculate totals
export const updateRegels = mutation({
  args: {
    id: v.id("offertes"),
    regels: v.array(regelValidator),
    margePercentage: v.number(),
    btwPercentage: v.number(),
    uurtarief: v.number(),
  },
  handler: async (ctx, args) => {
    // Calculate totals
    let materiaalkosten = 0;
    let arbeidskosten = 0;
    let totaalUren = 0;

    for (const regel of args.regels) {
      if (regel.type === "materiaal") {
        materiaalkosten += regel.totaal;
      } else if (regel.type === "arbeid") {
        arbeidskosten += regel.totaal;
        totaalUren += regel.hoeveelheid;
      } else if (regel.type === "machine") {
        // Machine costs go to arbeidskosten
        arbeidskosten += regel.totaal;
      }
    }

    const subtotaal = materiaalkosten + arbeidskosten;
    const marge = subtotaal * (args.margePercentage / 100);
    const totaalExBtw = subtotaal + marge;
    const btw = totaalExBtw * (args.btwPercentage / 100);
    const totaalInclBtw = totaalExBtw + btw;

    await ctx.db.patch(args.id, {
      regels: args.regels,
      totalen: {
        materiaalkosten,
        arbeidskosten,
        totaalUren,
        subtotaal,
        marge,
        margePercentage: args.margePercentage,
        totaalExBtw,
        btw,
        totaalInclBtw,
      },
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Update status
export const updateStatus = mutation({
  args: {
    id: v.id("offertes"),
    status: v.union(
      v.literal("concept"),
      v.literal("definitief"),
      v.literal("verzonden"),
      v.literal("geaccepteerd"),
      v.literal("afgewezen")
    ),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };

    if (args.status === "verzonden") {
      updates.verzondenAt = Date.now();
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

// Delete offerte
export const remove = mutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Duplicate offerte
export const duplicate = mutation({
  args: {
    id: v.id("offertes"),
    newOfferteNummer: v.string(),
  },
  handler: async (ctx, args) => {
    const original = await ctx.db.get(args.id);
    if (!original) {
      throw new Error("Offerte not found");
    }

    const now = Date.now();

    return await ctx.db.insert("offertes", {
      userId: original.userId,
      type: original.type,
      status: "concept",
      offerteNummer: args.newOfferteNummer,
      klant: original.klant,
      algemeenParams: original.algemeenParams,
      scopes: original.scopes,
      scopeData: original.scopeData,
      totalen: original.totalen,
      regels: original.regels,
      notities: original.notities
        ? `Kopie van ${original.offerteNummer}\n\n${original.notities}`
        : `Kopie van ${original.offerteNummer}`,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get stats for dashboard
export const getStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const stats = {
      totaal: offertes.length,
      concept: 0,
      definitief: 0,
      verzonden: 0,
      geaccepteerd: 0,
      afgewezen: 0,
      totaalWaarde: 0,
      geaccepteerdWaarde: 0,
    };

    for (const offerte of offertes) {
      stats[offerte.status]++;
      stats.totaalWaarde += offerte.totalen.totaalInclBtw;
      if (offerte.status === "geaccepteerd") {
        stats.geaccepteerdWaarde += offerte.totalen.totaalInclBtw;
      }
    }

    return stats;
  },
});

// Get recent offertes
export const getRecent = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;

    return await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});
