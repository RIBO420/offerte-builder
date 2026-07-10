import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { requireNotViewer } from "./roles";

// ─── Productbestand-domeinlogica (PRD §2.5c) ─────────────────────────────────

/** Geldige btw-codes voor producten (NL: laag 9%, hoog 21%). */
export const GELDIGE_BTW_CODES = [9, 21] as const;

/**
 * Normaliseer een productnaam voor ontdubbeling en idempotente import:
 * lowercase, trim, dubbele spaties samengevoegd, diakritieken verwijderd.
 * "  Voorrijkosten " en "voorrijkosten" zijn zo hetzelfde artikel.
 */
export function normaliseerProductnaam(naam: string): string {
  return naam
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Artikel zonder bruikbare inkoopprijs (leeg of €0) → prijs hoort op de
 * offerte-regel te worden ingevuld (PRD §2.5c, HERO-les bijlage B).
 */
export function bepaalPrijsOpRegel(
  inkoopprijs: number | null | undefined
): boolean {
  return inkoopprijs === null || inkoopprijs === undefined || inkoopprijs <= 0;
}

/**
 * Verkoopprijs uit inkoopprijs + marge-percentage. Weigert hard op
 * prijs-op-regel-artikelen en op inkoopprijs ≤ €0: daar is geen zinnige
 * marge-berekening mogelijk (voorkomt HERO's "Infinity%", bijlage B).
 */
export function berekenVerkoopprijsUitMarge(
  inkoopprijs: number,
  margePercentage: number,
  prijsOpRegel: boolean
): number {
  if (prijsOpRegel) {
    throw new ConvexError(
      "Geen marge-berekening mogelijk: prijs wordt op de offerte-regel ingevuld"
    );
  }
  if (inkoopprijs <= 0) {
    throw new ConvexError(
      "Geen marge-berekening mogelijk op een inkoopprijs van €0 of lager"
    );
  }
  if (!Number.isFinite(margePercentage)) {
    throw new ConvexError("Ongeldig marge-percentage");
  }
  return inkoopprijs * (1 + margePercentage / 100);
}

/** Valideer een btw-code (9 of 21); undefined is toegestaan (nog niet gezet). */
export function valideerBtwCode(btwCode: number | undefined): void {
  if (btwCode === undefined) return;
  if (!(GELDIGE_BTW_CODES as readonly number[]).includes(btwCode)) {
    throw new ConvexError("Btw-code moet 9 of 21 zijn");
  }
}

/**
 * Volgende stand van de gebruiksteller: ontbrekende teller (bestaande
 * records van vóór de uitbreiding) telt als 0.
 */
export function verhoogTeller(huidig: number | undefined): number {
  return (huidig ?? 0) + 1;
}

/**
 * Picker-sortering (PRD §2.5b): meest gebruikt bovenaan; bij gelijke teller
 * alfabetisch op naam zodat de volgorde stabiel is.
 */
export function sorteerVoorPicker<
  T extends { gebruiksteller?: number; productnaam: string },
>(producten: T[]): T[] {
  return [...producten].sort((a, b) => {
    const verschil = (b.gebruiksteller ?? 0) - (a.gebruiksteller ?? 0);
    if (verschil !== 0) return verschil;
    return a.productnaam.localeCompare(b.productnaam, "nl");
  });
}

// List all products for authenticated user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// List products by category for authenticated user
export const listByCategorie = query({
  args: {
    categorie: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("producten")
      .withIndex("by_categorie", (q) =>
        q.eq("userId", userId).eq("categorie", args.categorie)
      )
      .collect();
  },
});

// Search products for authenticated user
export const search = query({
  args: {
    zoekterm: v.string(),
    categorie: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const searchQuery = ctx.db
      .query("producten")
      .withSearchIndex("search_producten", (q) => {
        let search = q.search("productnaam", args.zoekterm);
        search = search.eq("userId", userId);
        if (args.categorie) {
          search = search.eq("categorie", args.categorie);
        }
        return search;
      });

    return await searchQuery.collect();
  },
});

// Get single product (with ownership verification)
export const get = query({
  args: { id: v.id("producten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const product = await ctx.db.get(args.id);

    if (!product) return null;
    if (product.userId.toString() !== userId.toString()) {
      return null;
    }

    return product;
  },
});

// Create product for authenticated user
export const create = mutation({
  args: {
    productnaam: v.string(),
    categorie: v.string(),
    inkoopprijs: v.number(),
    verkoopprijs: v.number(),
    eenheid: v.string(),
    leverancier: v.optional(v.string()),
    verliespercentage: v.number(),
    // Productbestand-velden (PRD §2.5c)
    leverancierId: v.optional(v.id("leveranciers")),
    btwCode: v.optional(v.number()),
    omschrijving: v.optional(v.string()),
    prijsOpRegel: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    valideerBtwCode(args.btwCode);
    return await ctx.db.insert("producten", {
      userId,
      productnaam: args.productnaam,
      categorie: args.categorie,
      inkoopprijs: args.inkoopprijs,
      verkoopprijs: args.verkoopprijs,
      eenheid: args.eenheid,
      leverancier: args.leverancier,
      verliespercentage: args.verliespercentage,
      leverancierId: args.leverancierId,
      btwCode: args.btwCode,
      omschrijving: args.omschrijving,
      // €0-inkoopprijs → automatisch prijs-op-regel (HERO-les, bijlage B)
      prijsOpRegel: args.prijsOpRegel ?? bepaalPrijsOpRegel(args.inkoopprijs),
      naamGenormaliseerd: normaliseerProductnaam(args.productnaam),
      gebruiksteller: 0,
      isActief: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Update product (with ownership verification)
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
    // Productbestand-velden (PRD §2.5c)
    leverancierId: v.optional(v.id("leveranciers")),
    btwCode: v.optional(v.number()),
    omschrijving: v.optional(v.string()),
    prijsOpRegel: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    valideerBtwCode(args.btwCode);

    // Verify ownership
    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new ConvexError("Product niet gevonden");
    }
    if (product.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot dit product");
    }

    const { id, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = { updatedAt: Date.now() };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    // Naam gewijzigd → genormaliseerde naam mee-updaten (ontdubbeling/import)
    if (args.productnaam !== undefined) {
      filteredUpdates.naamGenormaliseerd = normaliseerProductnaam(
        args.productnaam
      );
    }
    // Inkoopprijs gewijzigd zonder expliciete vlag → vlag herberekenen:
    // €0 wordt prijs-op-regel, een echte prijs heft de vlag weer op
    if (args.inkoopprijs !== undefined && args.prijsOpRegel === undefined) {
      filteredUpdates.prijsOpRegel = bepaalPrijsOpRegel(args.inkoopprijs);
    }

    await ctx.db.patch(id, filteredUpdates);
    return id;
  },
});

// Delete product (soft delete, with ownership verification)
export const remove = mutation({
  args: { id: v.id("producten") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new ConvexError("Product niet gevonden");
    }
    if (product.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot dit product");
    }

    await ctx.db.patch(args.id, {
      isActief: false,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

// Hard delete product (with ownership verification)
export const hardDelete = mutation({
  args: { id: v.id("producten") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new ConvexError("Product niet gevonden");
    }
    if (product.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot dit product");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Bulk import products for authenticated user
export const bulkImport = mutation({
  args: {
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
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();
    const insertedIds: string[] = [];

    for (const product of args.producten) {
      const id = await ctx.db.insert("producten", {
        userId,
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

// Get categories for authenticated user
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const products = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const categories = [...new Set(products.map((p) => p.categorie))];
    return categories.sort();
  },
});

// Count products per category for authenticated user
export const countByCategorie = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const products = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    const counts: Record<string, number> = {};
    for (const product of products) {
      counts[product.categorie] = (counts[product.categorie] || 0) + 1;
    }

    return counts;
  },
});

// Combined query for products with categories and counts - reduces 3 round-trips to 1
export const listWithMetadata = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const products = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Calculate categories
    const categories = [...new Set(products.map((p) => p.categorie))].sort();

    // Calculate counts for active products only
    const countByCategorie: Record<string, number> = {};
    for (const product of products) {
      if (product.isActief) {
        countByCategorie[product.categorie] = (countByCategorie[product.categorie] || 0) + 1;
      }
    }

    return {
      producten: products,
      categories,
      countByCategorie,
    };
  },
});

// Create default products for authenticated user (idempotent)
export const createDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Idempotent: check if user already has products
    const existing = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
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
        userId,
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

// ─── Artikel-picker en gebruiksteller (PRD §2.5b/c) ──────────────────────────

/**
 * Query voor de artikel-picker in de offerte-builder: actieve producten,
 * gesorteerd op gebruiksteller aflopend ("116× gebruikt" bovenaan),
 * doorzoekbaar op naam. Retourneert alleen de velden die de picker toont.
 */
export const picker = query({
  args: {
    zoekterm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const zoekterm = args.zoekterm?.trim();
    const producten = zoekterm
      ? await ctx.db
          .query("producten")
          .withSearchIndex("search_producten", (q) =>
            q.search("productnaam", zoekterm).eq("userId", userId)
          )
          .collect()
      : await ctx.db
          .query("producten")
          .withIndex("by_user_actief", (q) =>
            q.eq("userId", userId).eq("isActief", true)
          )
          .collect();

    return sorteerVoorPicker(
      producten.filter((p) => p.isActief)
    ).map((p) => ({
      _id: p._id,
      productnaam: p.productnaam,
      verkoopprijs: p.verkoopprijs,
      inkoopprijs: p.inkoopprijs,
      eenheid: p.eenheid,
      omschrijving: p.omschrijving,
      gebruiksteller: p.gebruiksteller ?? 0,
      prijsOpRegel: p.prijsOpRegel ?? false,
      btwCode: p.btwCode,
      categorie: p.categorie,
    }));
  },
});

/**
 * Verhoog de gebruiksteller van een artikel met 1. Wordt door de
 * offerte-builder (stap 4b) aangeroepen zodra een artikel op een
 * offerte of factuur wordt gebruikt.
 */
export const verhoogGebruik = mutation({
  args: { id: v.id("producten") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const product = await ctx.db.get(args.id);
    if (!product) {
      throw new ConvexError("Product niet gevonden");
    }
    if (product.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot dit product");
    }

    const nieuweTeller = verhoogTeller(product.gebruiksteller);
    await ctx.db.patch(args.id, {
      gebruiksteller: nieuweTeller,
      updatedAt: Date.now(),
    });
    return nieuweTeller;
  },
});
