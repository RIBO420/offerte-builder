import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { Id } from "./_generated/dataModel";
import { validateNonNegative, sanitizeOptionalString } from "./validators";

// ============================================
// QUERIES
// ============================================

// List all voorraad items for authenticated user (with product details)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const voorraadItems = await ctx.db
      .query("voorraad")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Enrich with product details
    const enrichedItems = await Promise.all(
      voorraadItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return {
          ...item,
          product: product
            ? {
                _id: product._id,
                productnaam: product.productnaam,
                categorie: product.categorie,
                eenheid: product.eenheid,
                inkoopprijs: product.inkoopprijs,
                verkoopprijs: product.verkoopprijs,
                isActief: product.isActief,
              }
            : null,
        };
      })
    );

    return enrichedItems;
  },
});

// Get single voorraad item by ID (with product details)
export const getById = query({
  args: { id: v.id("voorraad") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const voorraad = await ctx.db.get(args.id);

    if (!voorraad) return null;
    if (voorraad.userId.toString() !== userId.toString()) {
      return null;
    }

    // Enrich with product details
    const product = await ctx.db.get(voorraad.productId);
    return {
      ...voorraad,
      product: product
        ? {
            _id: product._id,
            productnaam: product.productnaam,
            categorie: product.categorie,
            eenheid: product.eenheid,
            inkoopprijs: product.inkoopprijs,
            verkoopprijs: product.verkoopprijs,
            isActief: product.isActief,
          }
        : null,
    };
  },
});

// Get voorraad for a specific product
export const getByProduct = query({
  args: { productId: v.id("producten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify product ownership first
    const product = await ctx.db.get(args.productId);
    if (!product || product.userId.toString() !== userId.toString()) {
      return null;
    }

    const voorraad = await ctx.db
      .query("voorraad")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .unique();

    if (!voorraad) return null;

    return {
      ...voorraad,
      product: {
        _id: product._id,
        productnaam: product.productnaam,
        categorie: product.categorie,
        eenheid: product.eenheid,
        inkoopprijs: product.inkoopprijs,
        verkoopprijs: product.verkoopprijs,
        isActief: product.isActief,
      },
    };
  },
});

// Get all mutaties for a voorraad item
export const getMutaties = query({
  args: { voorraadId: v.id("voorraad") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify voorraad ownership
    const voorraad = await ctx.db.get(args.voorraadId);
    if (!voorraad || voorraad.userId.toString() !== userId.toString()) {
      return [];
    }

    const mutaties = await ctx.db
      .query("voorraadMutaties")
      .withIndex("by_voorraad", (q) => q.eq("voorraadId", args.voorraadId))
      .collect();

    // Enrich with project and inkooporder details
    const enrichedMutaties = await Promise.all(
      mutaties.map(async (mutatie) => {
        let projectNaam: string | null = null;
        let inkooporderNummer: string | null = null;

        if (mutatie.projectId) {
          const project = await ctx.db.get(mutatie.projectId);
          projectNaam = project?.naam || null;
        }

        if (mutatie.inkooporderId) {
          const inkooporder = await ctx.db.get(mutatie.inkooporderId);
          inkooporderNummer = inkooporder?.orderNummer || null;
        }

        return {
          ...mutatie,
          projectNaam,
          inkooporderNummer,
        };
      })
    );

    // Sort by createdAt descending (most recent first)
    return enrichedMutaties.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Get items where hoeveelheid < minVoorraad (low stock alert)
export const getLowStock = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const voorraadItems = await ctx.db
      .query("voorraad")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter items below minimum stock
    const lowStockItems = voorraadItems.filter(
      (item) =>
        item.minVoorraad !== undefined &&
        item.minVoorraad !== null &&
        item.hoeveelheid < item.minVoorraad
    );

    // Enrich with product details
    const enrichedItems = await Promise.all(
      lowStockItems.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return {
          ...item,
          product: product
            ? {
                _id: product._id,
                productnaam: product.productnaam,
                categorie: product.categorie,
                eenheid: product.eenheid,
                inkoopprijs: product.inkoopprijs,
                verkoopprijs: product.verkoopprijs,
                isActief: product.isActief,
              }
            : null,
          tekort: item.minVoorraad! - item.hoeveelheid,
        };
      })
    );

    return enrichedItems;
  },
});

// Get voorraad statistics
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const voorraadItems = await ctx.db
      .query("voorraad")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Calculate totale voorraadwaarde and count items under minimum
    let totaleWaarde = 0;
    let aantalOnderMinimum = 0;
    let totaalAantalItems = voorraadItems.length;

    for (const item of voorraadItems) {
      const product = await ctx.db.get(item.productId);
      if (product) {
        // Voorraadwaarde = hoeveelheid * inkoopprijs
        totaleWaarde += item.hoeveelheid * product.inkoopprijs;
      }

      // Check if under minimum
      if (
        item.minVoorraad !== undefined &&
        item.minVoorraad !== null &&
        item.hoeveelheid < item.minVoorraad
      ) {
        aantalOnderMinimum++;
      }
    }

    return {
      totaleVoorraadwaarde: Math.round(totaleWaarde * 100) / 100,
      aantalItems: totaalAantalItems,
      aantalOnderMinimum,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

// Create a new voorraad item
export const create = mutation({
  args: {
    productId: v.id("producten"),
    hoeveelheid: v.number(),
    minVoorraad: v.optional(v.number()),
    maxVoorraad: v.optional(v.number()),
    locatie: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify product ownership
    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product niet gevonden");
    }
    if (product.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit product");
    }

    // Validate numeric fields
    const hoeveelheid = validateNonNegative(args.hoeveelheid, "Hoeveelheid");
    let minVoorraad = args.minVoorraad;
    let maxVoorraad = args.maxVoorraad;

    if (minVoorraad !== undefined) {
      minVoorraad = validateNonNegative(minVoorraad, "Minimum voorraad");
    }
    if (maxVoorraad !== undefined) {
      maxVoorraad = validateNonNegative(maxVoorraad, "Maximum voorraad");
    }

    // Sanitize optional strings
    const locatie = sanitizeOptionalString(args.locatie);
    const notities = sanitizeOptionalString(args.notities);

    // Check if voorraad already exists for this product
    const existingVoorraad = await ctx.db
      .query("voorraad")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .unique();

    if (existingVoorraad) {
      throw new Error("Er bestaat al een voorraad item voor dit product");
    }

    const voorraadId = await ctx.db.insert("voorraad", {
      userId,
      productId: args.productId,
      hoeveelheid,
      minVoorraad,
      maxVoorraad,
      locatie,
      notities,
      laatsteBijwerking: Date.now(),
    });

    // Create initial mutatie if hoeveelheid > 0
    if (hoeveelheid > 0) {
      await ctx.db.insert("voorraadMutaties", {
        userId,
        voorraadId,
        productId: args.productId,
        type: "inkoop",
        hoeveelheid,
        notities: "Beginvoorraad",
        createdAt: Date.now(),
      });
    }

    return voorraadId;
  },
});

// Update voorraad settings (locatie, min/max)
export const update = mutation({
  args: {
    id: v.id("voorraad"),
    minVoorraad: v.optional(v.number()),
    maxVoorraad: v.optional(v.number()),
    locatie: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const voorraad = await ctx.db.get(args.id);
    if (!voorraad) {
      throw new Error("Voorraad item niet gevonden");
    }
    if (voorraad.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voorraad item");
    }

    const filteredUpdates: Record<string, unknown> = {
      laatsteBijwerking: Date.now(),
    };

    // Validate and sanitize each field if provided
    if (args.minVoorraad !== undefined) {
      filteredUpdates.minVoorraad = validateNonNegative(
        args.minVoorraad,
        "Minimum voorraad"
      );
    }

    if (args.maxVoorraad !== undefined) {
      filteredUpdates.maxVoorraad = validateNonNegative(
        args.maxVoorraad,
        "Maximum voorraad"
      );
    }

    if (args.locatie !== undefined) {
      filteredUpdates.locatie = sanitizeOptionalString(args.locatie);
    }

    if (args.notities !== undefined) {
      filteredUpdates.notities = sanitizeOptionalString(args.notities);
    }

    await ctx.db.patch(args.id, filteredUpdates);
    return args.id;
  },
});

// Adjust stock (creates a voorraadMutatie automatically)
export const adjustStock = mutation({
  args: {
    voorraadId: v.id("voorraad"),
    type: v.union(
      v.literal("inkoop"),
      v.literal("verbruik"),
      v.literal("correctie"),
      v.literal("retour")
    ),
    hoeveelheid: v.number(),
    projectId: v.optional(v.id("projecten")),
    inkooporderId: v.optional(v.id("inkooporders")),
    notities: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify voorraad ownership
    const voorraad = await ctx.db.get(args.voorraadId);
    if (!voorraad) {
      throw new Error("Voorraad item niet gevonden");
    }
    if (voorraad.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voorraad item");
    }

    // Verify project ownership if provided
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId.toString() !== userId.toString()) {
        throw new Error("Project niet gevonden of geen toegang");
      }
    }

    // Verify inkooporder ownership if provided
    if (args.inkooporderId) {
      const inkooporder = await ctx.db.get(args.inkooporderId);
      if (!inkooporder || inkooporder.userId.toString() !== userId.toString()) {
        throw new Error("Inkooporder niet gevonden of geen toegang");
      }
    }

    // Calculate the actual change amount based on type
    let changeAmount: number;
    switch (args.type) {
      case "inkoop":
      case "retour":
        // Positive: adds to stock
        changeAmount = Math.abs(args.hoeveelheid);
        break;
      case "verbruik":
        // Negative: subtracts from stock
        changeAmount = -Math.abs(args.hoeveelheid);
        break;
      case "correctie":
        // Can be positive or negative (use as provided)
        changeAmount = args.hoeveelheid;
        break;
      default:
        changeAmount = args.hoeveelheid;
    }

    // Calculate new stock level
    const newHoeveelheid = voorraad.hoeveelheid + changeAmount;

    // Prevent negative stock (optional business rule)
    if (newHoeveelheid < 0) {
      throw new Error(
        `Onvoldoende voorraad. Huidige voorraad: ${voorraad.hoeveelheid}, gevraagde afname: ${Math.abs(changeAmount)}`
      );
    }

    // Update voorraad
    await ctx.db.patch(args.voorraadId, {
      hoeveelheid: newHoeveelheid,
      laatsteBijwerking: Date.now(),
    });

    // Create voorraadMutatie record
    const mutatieId = await ctx.db.insert("voorraadMutaties", {
      userId,
      voorraadId: args.voorraadId,
      productId: voorraad.productId,
      type: args.type,
      hoeveelheid: changeAmount,
      projectId: args.projectId,
      inkooporderId: args.inkooporderId,
      notities: args.notities,
      createdAt: Date.now(),
      createdBy: args.createdBy,
    });

    return {
      voorraadId: args.voorraadId,
      mutatieId,
      oudeHoeveelheid: voorraad.hoeveelheid,
      nieuweHoeveelheid: newHoeveelheid,
      wijziging: changeAmount,
    };
  },
});

// Delete voorraad item (hard delete)
export const remove = mutation({
  args: { id: v.id("voorraad") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const voorraad = await ctx.db.get(args.id);
    if (!voorraad) {
      throw new Error("Voorraad item niet gevonden");
    }
    if (voorraad.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voorraad item");
    }

    // Also delete all related mutaties
    const mutaties = await ctx.db
      .query("voorraadMutaties")
      .withIndex("by_voorraad", (q) => q.eq("voorraadId", args.id))
      .collect();

    for (const mutatie of mutaties) {
      await ctx.db.delete(mutatie._id);
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Bulk create voorraad items for all products (useful for initial setup)
export const initializeFromProducts = mutation({
  args: {
    defaultMinVoorraad: v.optional(v.number()),
    defaultMaxVoorraad: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get all active products for this user
    const products = await ctx.db
      .query("producten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    // Get existing voorraad items
    const existingVoorraad = await ctx.db
      .query("voorraad")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const existingProductIds = new Set(
      existingVoorraad.map((v) => v.productId.toString())
    );

    let created = 0;
    let skipped = 0;

    for (const product of products) {
      // Skip if voorraad already exists
      if (existingProductIds.has(product._id.toString())) {
        skipped++;
        continue;
      }

      await ctx.db.insert("voorraad", {
        userId,
        productId: product._id,
        hoeveelheid: 0,
        minVoorraad: args.defaultMinVoorraad,
        maxVoorraad: args.defaultMaxVoorraad,
        laatsteBijwerking: Date.now(),
      });

      created++;
    }

    return {
      created,
      skipped,
      message: `${created} voorraad items aangemaakt, ${skipped} overgeslagen (bestonden al)`,
    };
  },
});
