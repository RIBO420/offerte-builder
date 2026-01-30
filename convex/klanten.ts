import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all klanten for user
export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get recent klanten (last 5)
export const getRecent = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(5);
  },
});

// Get a single klant by ID
export const get = query({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get klant with their offertes
export const getWithOffertes = query({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    const klant = await ctx.db.get(args.id);
    if (!klant) return null;

    // Get all offertes for this klant
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", klant.userId))
      .filter((q) => q.eq(q.field("klantId"), args.id))
      .order("desc")
      .collect();

    return {
      ...klant,
      offertes,
    };
  },
});

// Search klanten by name
export const search = query({
  args: { userId: v.id("users"), searchTerm: v.string() },
  handler: async (ctx, args) => {
    if (!args.searchTerm.trim()) {
      // Return recent klanten if no search term
      return await ctx.db
        .query("klanten")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .order("desc")
        .take(10);
    }

    // Use search index
    return await ctx.db
      .query("klanten")
      .withSearchIndex("search_klanten", (q) =>
        q.search("naam", args.searchTerm).eq("userId", args.userId)
      )
      .take(10);
  },
});

// Create a new klant
export const create = mutation({
  args: {
    userId: v.id("users"),
    naam: v.string(),
    adres: v.string(),
    postcode: v.string(),
    plaats: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("klanten", {
      userId: args.userId,
      naam: args.naam,
      adres: args.adres,
      postcode: args.postcode,
      plaats: args.plaats,
      email: args.email,
      telefoon: args.telefoon,
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update a klant
export const update = mutation({
  args: {
    id: v.id("klanten"),
    naam: v.optional(v.string()),
    adres: v.optional(v.string()),
    postcode: v.optional(v.string()),
    plaats: v.optional(v.string()),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const klant = await ctx.db.get(args.id);
    if (!klant) throw new Error("Klant niet gevonden");

    const { id, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates: Record<string, unknown> = {};
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    });

    await ctx.db.patch(args.id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

// Delete a klant
export const remove = mutation({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    const klant = await ctx.db.get(args.id);
    if (!klant) throw new Error("Klant niet gevonden");

    // Check if there are offertes linked to this klant
    const linkedOffertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", klant.userId))
      .filter((q) => q.eq(q.field("klantId"), args.id))
      .take(1);

    if (linkedOffertes.length > 0) {
      throw new Error(
        "Deze klant heeft gekoppelde offertes en kan niet worden verwijderd. Verwijder eerst de offertes."
      );
    }

    await ctx.db.delete(args.id);
  },
});

// Create klant from offerte data (for auto-creating klanten from wizard)
export const createFromOfferte = mutation({
  args: {
    userId: v.id("users"),
    naam: v.string(),
    adres: v.string(),
    postcode: v.string(),
    plaats: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if a klant with the same name and address already exists
    const existingKlanten = await ctx.db
      .query("klanten")
      .withSearchIndex("search_klanten", (q) =>
        q.search("naam", args.naam).eq("userId", args.userId)
      )
      .collect();

    // Find exact match
    const exactMatch = existingKlanten.find(
      (k) =>
        k.naam.toLowerCase() === args.naam.toLowerCase() &&
        k.adres.toLowerCase() === args.adres.toLowerCase()
    );

    if (exactMatch) {
      return exactMatch._id;
    }

    // Create new klant
    const now = Date.now();
    return await ctx.db.insert("klanten", {
      userId: args.userId,
      naam: args.naam,
      adres: args.adres,
      postcode: args.postcode,
      plaats: args.plaats,
      email: args.email,
      telefoon: args.telefoon,
      createdAt: now,
      updatedAt: now,
    });
  },
});
