import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireOrgContext, requireOrgId, verifyOrgOwnership } from "./auth";
import { requireNotViewer } from "./roles";

/** Voertuig van de eigen organisatie, of null (leespaden geven "niets" terug). */
async function voertuigVanOrg(
  ctx: { db: { get: (id: Id<"voertuigen">) => Promise<Doc<"voertuigen"> | null> } },
  orgId: Id<"organisaties">,
  voertuigId: Id<"voertuigen">
): Promise<Doc<"voertuigen"> | null> {
  const voertuig = await ctx.db.get(voertuigId);
  if (!voertuig || voertuig.orgId?.toString() !== orgId.toString()) return null;
  return voertuig;
}

// Get all fuel records for a vehicle
export const listByVoertuig = query({
  args: { voertuigId: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    // Eigendom van het voertuig = zelfde organisatie
    if (!(await voertuigVanOrg(ctx, orgId, args.voertuigId))) {
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
    const orgId = await requireOrgId(ctx);

    // Eigendom van het voertuig = zelfde organisatie
    if (!(await voertuigVanOrg(ctx, orgId, args.voertuigId))) {
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
    datum: v.string(), // YYYY-MM-DD format
    liters: v.number(),
    kosten: v.number(),
    kilometerstand: v.number(),
    locatie: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const { org, user } = await requireOrgContext(ctx);

    // Eigendom van het voertuig = zelfde organisatie
    if (!(await voertuigVanOrg(ctx, org._id, args.voertuigId))) {
      throw new ConvexError("Geen toegang tot dit voertuig");
    }

    // Also update the vehicle's current km stand
    await ctx.db.patch(args.voertuigId, {
      kmStand: args.kilometerstand,
      updatedAt: Date.now(),
    });

    return await ctx.db.insert("brandstofRegistratie", {
      voertuigId: args.voertuigId,
      orgId: org._id,
      // `userId` blijft tot fase 6 verplicht in het schema.
      userId: user._id,
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
    await requireNotViewer(ctx);
    await verifyOrgOwnership(
      ctx,
      await ctx.db.get(args.id),
      "brandstof record"
    );

    await ctx.db.delete(args.id);
    return args.id;
  },
});
