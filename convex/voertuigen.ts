import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Haal alle voertuigen op voor de ingelogde gebruiker
// Optionele filter op status
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("actief"),
        v.literal("inactief"),
        v.literal("onderhoud")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Als status filter meegegeven, gebruik de samengestelde index
    if (args.status !== undefined) {
      return await ctx.db
        .query("voertuigen")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", args.status!)
        )
        .collect();
    }

    // Anders haal alle voertuigen op
    return await ctx.db
      .query("voertuigen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Haal een enkel voertuig op (met eigenaarschap verificatie)
export const get = query({
  args: { id: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const voertuig = await ctx.db.get(args.id);

    if (!voertuig) return null;
    if (voertuig.userId.toString() !== userId.toString()) {
      return null;
    }

    return voertuig;
  },
});

// Haal alleen actieve voertuigen op (voor dropdowns/selecties)
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("voertuigen")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "actief")
      )
      .collect();
  },
});

// Zoek voertuig op kenteken
export const getByKenteken = query({
  args: { kenteken: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const voertuig = await ctx.db
      .query("voertuigen")
      .withIndex("by_kenteken", (q) => q.eq("kenteken", args.kenteken))
      .first();

    if (!voertuig) return null;
    // Verifieer eigenaarschap
    if (voertuig.userId.toString() !== userId.toString()) {
      return null;
    }

    return voertuig;
  },
});

// Maak een nieuw voertuig aan
export const create = mutation({
  args: {
    kenteken: v.string(),
    merk: v.string(),
    model: v.string(),
    type: v.string(),
    bouwjaar: v.optional(v.number()),
    kleur: v.optional(v.string()),
    fleetgoId: v.optional(v.string()),
    fleetgoData: v.optional(v.any()),
    kmStand: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("actief"),
        v.literal("inactief"),
        v.literal("onderhoud")
      )
    ),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    return await ctx.db.insert("voertuigen", {
      userId,
      kenteken: args.kenteken,
      merk: args.merk,
      model: args.model,
      type: args.type,
      bouwjaar: args.bouwjaar,
      kleur: args.kleur,
      fleetgoId: args.fleetgoId,
      fleetgoData: args.fleetgoData,
      kmStand: args.kmStand,
      status: args.status ?? "actief",
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Werk een voertuig bij (met eigenaarschap verificatie)
export const update = mutation({
  args: {
    id: v.id("voertuigen"),
    kenteken: v.optional(v.string()),
    merk: v.optional(v.string()),
    model: v.optional(v.string()),
    type: v.optional(v.string()),
    bouwjaar: v.optional(v.number()),
    kleur: v.optional(v.string()),
    fleetgoId: v.optional(v.string()),
    fleetgoData: v.optional(v.any()),
    kmStand: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("actief"),
        v.literal("inactief"),
        v.literal("onderhoud")
      )
    ),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.id);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    // Bouw update object expliciet (geen dynamic object access)
    const updateData: {
      kenteken?: string;
      merk?: string;
      model?: string;
      type?: string;
      bouwjaar?: number;
      kleur?: string;
      fleetgoId?: string;
      fleetgoData?: unknown;
      kmStand?: number;
      status?: "actief" | "inactief" | "onderhoud";
      notities?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.kenteken !== undefined) updateData.kenteken = args.kenteken;
    if (args.merk !== undefined) updateData.merk = args.merk;
    if (args.model !== undefined) updateData.model = args.model;
    if (args.type !== undefined) updateData.type = args.type;
    if (args.bouwjaar !== undefined) updateData.bouwjaar = args.bouwjaar;
    if (args.kleur !== undefined) updateData.kleur = args.kleur;
    if (args.fleetgoId !== undefined) updateData.fleetgoId = args.fleetgoId;
    if (args.fleetgoData !== undefined) updateData.fleetgoData = args.fleetgoData;
    if (args.kmStand !== undefined) updateData.kmStand = args.kmStand;
    if (args.status !== undefined) updateData.status = args.status;
    if (args.notities !== undefined) updateData.notities = args.notities;

    await ctx.db.patch(args.id, updateData);

    return args.id;
  },
});

// Soft delete: zet status op inactief (met eigenaarschap verificatie)
export const remove = mutation({
  args: { id: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.id);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    await ctx.db.patch(args.id, {
      status: "inactief",
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Permanent verwijderen (met eigenaarschap verificatie)
export const hardDelete = mutation({
  args: { id: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.id);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Sync voertuig data van FleetGo
export const syncFromFleetGo = mutation({
  args: {
    id: v.id("voertuigen"),
    fleetgoData: v.any(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.id);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      fleetgoData: args.fleetgoData,
      laatsteSyncAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

// Snelle update voor kilometerstand
export const updateKmStand = mutation({
  args: {
    id: v.id("voertuigen"),
    kmStand: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.id);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    await ctx.db.patch(args.id, {
      kmStand: args.kmStand,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});
