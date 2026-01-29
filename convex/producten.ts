import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all products for user
export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// List products by category
export const listByCategorie = query({
  args: {
    userId: v.id("users"),
    categorie: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("producten")
      .withIndex("by_categorie", (q) =>
        q.eq("userId", args.userId).eq("categorie", args.categorie)
      )
      .collect();
  },
});

// Search products
export const search = query({
  args: {
    userId: v.id("users"),
    zoekterm: v.string(),
    categorie: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let searchQuery = ctx.db
      .query("producten")
      .withSearchIndex("search_producten", (q) => {
        let search = q.search("productnaam", args.zoekterm);
        search = search.eq("userId", args.userId);
        if (args.categorie) {
          search = search.eq("categorie", args.categorie);
        }
        return search;
      });

    return await searchQuery.collect();
  },
});

// Get single product
export const get = query({
  args: { id: v.id("producten") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create product
export const create = mutation({
  args: {
    userId: v.id("users"),
    productnaam: v.string(),
    categorie: v.string(),
    inkoopprijs: v.number(),
    verkoopprijs: v.number(),
    eenheid: v.string(),
    leverancier: v.optional(v.string()),
    verliespercentage: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("producten", {
      userId: args.userId,
      productnaam: args.productnaam,
      categorie: args.categorie,
      inkoopprijs: args.inkoopprijs,
      verkoopprijs: args.verkoopprijs,
      eenheid: args.eenheid,
      leverancier: args.leverancier,
      verliespercentage: args.verliespercentage,
      isActief: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Update product
export const update = mutation({
  args: {
    id: v.id("producten"),
    productnaam: v.optional(v.string()),
    categorie: v.optional(v.string()),
    inkoopprijs: v.optional(v.number()),
    verkoopprijs: v.optional(v.number()),
    eenheid: v.optional(v.string()),
    leverancier: v.optional(v.string()),
    verliespercentage: v.optional(v.number()),
    isActief: v.optional(v.boolean()),
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

// Delete product (soft delete by setting isActief to false)
export const remove = mutation({
  args: { id: v.id("producten") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

// Hard delete product
export const hardDelete = mutation({
  args: { id: v.id("producten") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Bulk import products (for CSV/XLS import)
export const bulkImport = mutation({
  args: {
    userId: v.id("users"),
    producten: v.array(
      v.object({
        productnaam: v.string(),
        categorie: v.string(),
        inkoopprijs: v.number(),
        verkoopprijs: v.number(),
        eenheid: v.string(),
        leverancier: v.optional(v.string()),
        verliespercentage: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const insertedIds: string[] = [];

    for (const product of args.producten) {
      const id = await ctx.db.insert("producten", {
        userId: args.userId,
        ...product,
        isActief: true,
        createdAt: now,
        updatedAt: now,
      });
      insertedIds.push(id);
    }

    return {
      count: insertedIds.length,
      ids: insertedIds,
    };
  },
});

// Get categories for user
export const getCategories = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const categories = [...new Set(products.map((p) => p.categorie))];
    return categories.sort();
  },
});

// Count products per category
export const countByCategorie = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    const counts: Record<string, number> = {};
    for (const product of products) {
      counts[product.categorie] = (counts[product.categorie] || 0) + 1;
    }

    return counts;
  },
});

// Create default products for new user (sample hoveniers prijsboek)
export const createDefaults = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Check if user already has products
    const existing = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      return { message: "User already has products", count: 0 };
    }

    const defaultProducts = [
      // Bestrating
      { productnaam: "Betontegel 30x30 grijs", categorie: "Bestrating", inkoopprijs: 1.50, verkoopprijs: 3.50, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 5 },
      { productnaam: "Betontegel 60x60 grijs", categorie: "Bestrating", inkoopprijs: 8.00, verkoopprijs: 15.00, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 5 },
      { productnaam: "Klinker waalformaat rood", categorie: "Bestrating", inkoopprijs: 0.35, verkoopprijs: 0.75, eenheid: "stuk", leverancier: "Wienerberger", verliespercentage: 8 },
      { productnaam: "Klinker waalformaat antraciet", categorie: "Bestrating", inkoopprijs: 0.40, verkoopprijs: 0.85, eenheid: "stuk", leverancier: "Wienerberger", verliespercentage: 8 },
      { productnaam: "Natuursteen tegels 60x60", categorie: "Bestrating", inkoopprijs: 35.00, verkoopprijs: 65.00, eenheid: "stuk", leverancier: "Beltrami", verliespercentage: 3 },
      { productnaam: "Opsluitband 100x20x6", categorie: "Bestrating", inkoopprijs: 2.50, verkoopprijs: 5.50, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 5 },

      // Zand en fundering
      { productnaam: "Straatzand", categorie: "Zand en fundering", inkoopprijs: 18.00, verkoopprijs: 32.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
      { productnaam: "Metselzand", categorie: "Zand en fundering", inkoopprijs: 20.00, verkoopprijs: 35.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
      { productnaam: "Puingranulaat 0-31,5", categorie: "Zand en fundering", inkoopprijs: 12.00, verkoopprijs: 25.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
      { productnaam: "Betonpuin", categorie: "Zand en fundering", inkoopprijs: 8.00, verkoopprijs: 18.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },

      // Houtwerk
      { productnaam: "Schuttingplank 180x15cm", categorie: "Houtwerk", inkoopprijs: 3.50, verkoopprijs: 7.50, eenheid: "stuk", leverancier: "Jongeneel", verliespercentage: 5 },
      { productnaam: "Schuttingpaal 7x7x270cm", categorie: "Houtwerk", inkoopprijs: 12.00, verkoopprijs: 25.00, eenheid: "stuk", leverancier: "Jongeneel", verliespercentage: 3 },
      { productnaam: "Vlonderdeel hardhout 21x145mm", categorie: "Houtwerk", inkoopprijs: 8.50, verkoopprijs: 16.00, eenheid: "m", leverancier: "Jongeneel", verliespercentage: 8 },
      { productnaam: "Balk 45x70mm geïmpregneerd", categorie: "Houtwerk", inkoopprijs: 4.50, verkoopprijs: 9.00, eenheid: "m", leverancier: "Jongeneel", verliespercentage: 5 },
      { productnaam: "Betonpoer 30x30x30cm", categorie: "Houtwerk", inkoopprijs: 8.00, verkoopprijs: 16.00, eenheid: "stuk", leverancier: "Struyk Verwo", verliespercentage: 3 },

      // Grond en bodemverbetering
      { productnaam: "Tuinaarde", categorie: "Grond", inkoopprijs: 22.00, verkoopprijs: 40.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
      { productnaam: "Compost", categorie: "Grond", inkoopprijs: 18.00, verkoopprijs: 32.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 10 },
      { productnaam: "Boomschors 10-40mm", categorie: "Grond", inkoopprijs: 45.00, verkoopprijs: 75.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 5 },
      { productnaam: "Siersplit wit 8-16mm", categorie: "Grond", inkoopprijs: 65.00, verkoopprijs: 110.00, eenheid: "m³", leverancier: "De Beijer", verliespercentage: 5 },

      // Gras
      { productnaam: "Graszoden", categorie: "Gras", inkoopprijs: 3.50, verkoopprijs: 7.50, eenheid: "m²", leverancier: "Graszodenkwekerij", verliespercentage: 5 },
      { productnaam: "Graszaad siergazon", categorie: "Gras", inkoopprijs: 35.00, verkoopprijs: 60.00, eenheid: "kg", leverancier: "Barenbrug", verliespercentage: 10 },
      { productnaam: "Graszaad speelgazon", categorie: "Gras", inkoopprijs: 30.00, verkoopprijs: 50.00, eenheid: "kg", leverancier: "Barenbrug", verliespercentage: 10 },

      // Planten
      { productnaam: "Bodembedekker (pot 9cm)", categorie: "Planten", inkoopprijs: 1.50, verkoopprijs: 4.50, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 5 },
      { productnaam: "Heester (3 liter)", categorie: "Planten", inkoopprijs: 8.00, verkoopprijs: 18.00, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 5 },
      { productnaam: "Solitaire struik (10 liter)", categorie: "Planten", inkoopprijs: 25.00, verkoopprijs: 55.00, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 3 },
      { productnaam: "Haagplant (60-80cm)", categorie: "Planten", inkoopprijs: 6.00, verkoopprijs: 14.00, eenheid: "stuk", leverancier: "Kwekerij", verliespercentage: 5 },

      // Elektra
      { productnaam: "Grondspot LED", categorie: "Elektra", inkoopprijs: 35.00, verkoopprijs: 75.00, eenheid: "stuk", leverancier: "Buitenverlichting.nl", verliespercentage: 2 },
      { productnaam: "Tuinlamp op paal LED", categorie: "Elektra", inkoopprijs: 85.00, verkoopprijs: 165.00, eenheid: "stuk", leverancier: "Buitenverlichting.nl", verliespercentage: 2 },
      { productnaam: "Kabel 3x1,5 grond", categorie: "Elektra", inkoopprijs: 1.50, verkoopprijs: 3.50, eenheid: "m", leverancier: "Elektrotechnisch", verliespercentage: 5 },
      { productnaam: "Lasdoos waterdicht", categorie: "Elektra", inkoopprijs: 4.50, verkoopprijs: 12.00, eenheid: "stuk", leverancier: "Elektrotechnisch", verliespercentage: 5 },

      // Afvoer
      { productnaam: "Afvoer grond (stort)", categorie: "Afvoer", inkoopprijs: 25.00, verkoopprijs: 35.00, eenheid: "m³", leverancier: "Stortplaats", verliespercentage: 0 },
      { productnaam: "Afvoer groenafval", categorie: "Afvoer", inkoopprijs: 15.00, verkoopprijs: 25.00, eenheid: "m³", leverancier: "Stortplaats", verliespercentage: 0 },
      { productnaam: "Afvoer puin", categorie: "Afvoer", inkoopprijs: 18.00, verkoopprijs: 28.00, eenheid: "m³", leverancier: "Stortplaats", verliespercentage: 0 },
    ];

    const now = Date.now();
    let count = 0;

    for (const product of defaultProducts) {
      await ctx.db.insert("producten", {
        userId: args.userId,
        ...product,
        isActief: true,
        createdAt: now,
        updatedAt: now,
      });
      count++;
    }

    return { message: "Default products created", count };
  },
});
