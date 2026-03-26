import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, getOwnedKlant } from "./auth";
import { requireNotViewer } from "./roles";
import {
  sanitizeEmail,
  sanitizePhone,
  validateRequiredPostcode,
  sanitizeOptionalString,
  VALIDATION_MESSAGES,
} from "./validators";
import { shouldUpgradePipeline } from "./pipelineHelpers";

// Get all klanten for authenticated user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Get recent klanten (last 5)
export const getRecent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5);
  },
});

// Get a single klant by ID (with ownership verification)
export const get = query({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    const klant = await ctx.db.get(args.id);
    if (!klant) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (klant.userId.toString() !== user._id.toString()) {
      return null;
    }

    return klant;
  },
});

// Get klant with their offertes (with ownership verification)
export const getWithOffertes = query({
  args: { id: v.id("klanten") },
  handler: async (ctx, args) => {
    const klant = await ctx.db.get(args.id);
    if (!klant) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (klant.userId.toString() !== user._id.toString()) {
      return null;
    }

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
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    if (!args.searchTerm.trim()) {
      // Return recent klanten if no search term
      return await ctx.db
        .query("klanten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10);
    }

    // Use search index
    return await ctx.db
      .query("klanten")
      .withSearchIndex("search_klanten", (q) =>
        q.search("naam", args.searchTerm).eq("userId", userId)
      )
      .take(10);
  },
});

// CRM-003: Klant type validator
const klantTypeValidator = v.optional(v.union(
  v.literal("particulier"),
  v.literal("zakelijk"),
  v.literal("vve"),
  v.literal("gemeente"),
  v.literal("overig"),
));

// Create a new klant
export const create = mutation({
  args: {
    naam: v.string(),
    adres: v.string(),
    postcode: v.string(),
    plaats: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    notities: v.optional(v.string()),
    klantType: klantTypeValidator,
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Validate required fields
    if (!args.naam.trim()) {
      throw new Error("Naam is verplicht");
    }
    if (!args.adres.trim()) {
      throw new Error("Adres is verplicht");
    }
    if (!args.plaats.trim()) {
      throw new Error("Plaats is verplicht");
    }

    // Validate and sanitize fields
    const postcode = validateRequiredPostcode(args.postcode);
    const email = sanitizeEmail(args.email);
    const telefoon = sanitizePhone(args.telefoon);
    const notities = sanitizeOptionalString(args.notities);

    // Sanitize tags: trim, lowercase, remove empties, deduplicate
    const sanitizedTags = args.tags
      ? [...new Set(args.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))]
      : undefined;

    return await ctx.db.insert("klanten", {
      userId,
      naam: args.naam.trim(),
      adres: args.adres.trim(),
      postcode,
      plaats: args.plaats.trim(),
      email,
      telefoon,
      notities,
      pipelineStatus: "lead",
      klantType: args.klantType ?? "particulier",
      tags: sanitizedTags,
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
    klantType: klantTypeValidator,
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify ownership
    await getOwnedKlant(ctx, args.id);

    const filteredUpdates: Record<string, unknown> = {};

    // Validate and sanitize each field if provided
    if (args.naam !== undefined) {
      if (!args.naam.trim()) {
        throw new Error("Naam is verplicht");
      }
      filteredUpdates.naam = args.naam.trim();
    }

    if (args.adres !== undefined) {
      if (!args.adres.trim()) {
        throw new Error("Adres is verplicht");
      }
      filteredUpdates.adres = args.adres.trim();
    }

    if (args.postcode !== undefined) {
      filteredUpdates.postcode = validateRequiredPostcode(args.postcode);
    }

    if (args.plaats !== undefined) {
      if (!args.plaats.trim()) {
        throw new Error("Plaats is verplicht");
      }
      filteredUpdates.plaats = args.plaats.trim();
    }

    if (args.email !== undefined) {
      filteredUpdates.email = sanitizeEmail(args.email);
    }

    if (args.telefoon !== undefined) {
      filteredUpdates.telefoon = sanitizePhone(args.telefoon);
    }

    if (args.notities !== undefined) {
      filteredUpdates.notities = sanitizeOptionalString(args.notities);
    }

    if (args.klantType !== undefined) {
      filteredUpdates.klantType = args.klantType;
    }

    if (args.tags !== undefined) {
      // Sanitize tags: trim, lowercase, remove empties, deduplicate
      filteredUpdates.tags = [...new Set(args.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    }

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
    await requireNotViewer(ctx);
    // Verify ownership
    const klant = await getOwnedKlant(ctx, args.id);

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

// Combined query for klanten list with recent - reduces 2 round-trips to 1
export const listWithRecent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return {
      klanten,
      recentKlanten: klanten.slice(0, 5),
    };
  },
});

// CRM-003: Get all unique tags used across klanten (for autocomplete)
export const getAllTags = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const tagSet = new Set<string>();
    for (const klant of klanten) {
      if (klant.tags) {
        for (const tag of klant.tags) {
          tagSet.add(tag);
        }
      }
    }
    return [...tagSet].sort();
  },
});

// Create klant from offerte data (for auto-creating klanten from wizard)
export const createFromOfferte = mutation({
  args: {
    naam: v.string(),
    adres: v.string(),
    postcode: v.string(),
    plaats: v.string(),
    email: v.optional(v.string()),
    telefoon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Check if a klant with the same name and address already exists
    const existingKlanten = await ctx.db
      .query("klanten")
      .withSearchIndex("search_klanten", (q) =>
        q.search("naam", args.naam).eq("userId", userId)
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

    // Validate and sanitize fields
    const postcode = validateRequiredPostcode(args.postcode);
    const email = sanitizeEmail(args.email);
    const telefoon = sanitizePhone(args.telefoon);

    // Create new klant
    const now = Date.now();
    return await ctx.db.insert("klanten", {
      userId,
      naam: args.naam.trim(),
      adres: args.adres.trim(),
      postcode,
      plaats: args.plaats.trim(),
      email,
      telefoon,
      pipelineStatus: "lead",
      createdAt: now,
      updatedAt: now,
    });
  },
});
