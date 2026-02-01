import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Get all fuel records for a vehicle
export const listByVoertuig = query({
  args: { voertuigId: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership of the vehicle
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
      return [];
    }

    return await ctx.db
      .query("brandstofRegistratie")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId))
      .order("desc")
      .collect();
  },
});

// Get fuel statistics for a vehicle
export const getStats = query({
  args: { voertuigId: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership of the vehicle
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
      return null;
    }

    const records = await ctx.db
      .query("brandstofRegistratie")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId))
      .order("desc")
      .collect();

    if (records.length === 0) {
      return {
        totaalLiters: 0,
        totaalKosten: 0,
        gemiddeldVerbruik: 0,
        aantalTankbeurten: 0,
      };
    }

    const totaalLiters = records.reduce((sum, r) => sum + r.liters, 0);
    const totaalKosten = records.reduce((sum, r) => sum + r.kosten, 0);

    // Calculate average consumption if we have at least 2 records
    let gemiddeldVerbruik = 0;
    if (records.length >= 2) {
      const sortedByKm = [...records].sort((a, b) => a.kilometerstand - b.kilometerstand);
      const firstKm = sortedByKm[0].kilometerstand;
      const lastKm = sortedByKm[sortedByKm.length - 1].kilometerstand;
      const kmDiff = lastKm - firstKm;
      if (kmDiff > 0) {
        // Calculate liters per 100km
        gemiddeldVerbruik = (totaalLiters / kmDiff) * 100;
      }
    }

    return {
      totaalLiters,
      totaalKosten,
      gemiddeldVerbruik: Math.round(gemiddeldVerbruik * 10) / 10,
      aantalTankbeurten: records.length,
    };
  },
});

// Create a fuel record
export const create = mutation({
  args: {
    voertuigId: v.id("voertuigen"),
    datum: v.number(), // Timestamp
    liters: v.number(),
    kosten: v.number(),
    kilometerstand: v.number(),
    locatie: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership of the vehicle
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    // Also update the vehicle's current km stand
    await ctx.db.patch(args.voertuigId, {
      kmStand: args.kilometerstand,
      updatedAt: Date.now(),
    });

    return await ctx.db.insert("brandstofRegistratie", {
      voertuigId: args.voertuigId,
      userId,
      datum: args.datum,
      liters: args.liters,
      kosten: args.kosten,
      kilometerstand: args.kilometerstand,
      locatie: args.locatie,
      createdAt: Date.now(),
    });
  },
});

// Delete a fuel record
export const remove = mutation({
  args: { id: v.id("brandstofRegistratie") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const record = await ctx.db.get(args.id);
    if (!record || record.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit brandstof record");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
