import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireOrg, requireOrgId, verifyOrgOwnership } from "./auth";
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

// Equipment categories
export const categorieValidator = v.union(
  v.literal("motorgereedschap"),
  v.literal("handgereedschap"),
  v.literal("veiligheid"),
  v.literal("overig")
);

// Equipment status
export const uitrustingStatusValidator = v.union(
  v.literal("aanwezig"),
  v.literal("vermist"),
  v.literal("defect")
);

// List all equipment for the user
export const list = query({
  args: {
    voertuigId: v.optional(v.id("voertuigen")),
    categorie: v.optional(categorieValidator),
    status: v.optional(uitrustingStatusValidator),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    // If filtering by voertuig
    if (args.voertuigId) {
      // Eigendom van het voertuig = zelfde organisatie
      if (!(await voertuigVanOrg(ctx, orgId, args.voertuigId))) {
        return [];
      }

      let uitrusting = await ctx.db
        .query("voertuigUitrusting")
        .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId!))
        .collect();

      // Filter by categorie if provided
      if (args.categorie) {
        uitrusting = uitrusting.filter((u) => u.categorie === args.categorie);
      }

      // Filter by status if provided
      if (args.status) {
        uitrusting = uitrusting.filter((u) => u.status === args.status);
      }

      return uitrusting;
    }

    // Alle uitrusting van de eigen organisatie
    let uitrusting = await ctx.db
      .query("voertuigUitrusting")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // Filter by categorie if provided
    if (args.categorie) {
      uitrusting = uitrusting.filter((u) => u.categorie === args.categorie);
    }

    // Filter by status if provided
    if (args.status) {
      uitrusting = uitrusting.filter((u) => u.status === args.status);
    }

    return uitrusting;
  },
});

// Get a single equipment item
export const get = query({
  args: { id: v.id("voertuigUitrusting") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const uitrusting = await ctx.db.get(args.id);

    if (!uitrusting) return null;
    if (uitrusting.orgId?.toString() !== orgId.toString()) {
      return null;
    }

    return uitrusting;
  },
});

// Get equipment with vehicle info
export const getWithVoertuig = query({
  args: { id: v.id("voertuigUitrusting") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const uitrusting = await ctx.db.get(args.id);

    if (!uitrusting) return null;
    if (uitrusting.orgId?.toString() !== orgId.toString()) {
      return null;
    }

    const voertuig = await ctx.db.get(uitrusting.voertuigId);

    return {
      ...uitrusting,
      voertuig,
    };
  },
});

// Search equipment by name
export const search = query({
  args: {
    searchTerm: v.string(),
    voertuigId: v.optional(v.id("voertuigen")),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const searchLower = args.searchTerm.toLowerCase();

    let uitrusting;
    if (args.voertuigId) {
      // Eigendom van het voertuig = zelfde organisatie
      if (!(await voertuigVanOrg(ctx, orgId, args.voertuigId))) {
        return [];
      }

      uitrusting = await ctx.db
        .query("voertuigUitrusting")
        .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId!))
        .collect();
    } else {
      uitrusting = await ctx.db
        .query("voertuigUitrusting")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
    }

    // Filter by search term
    return uitrusting.filter(
      (u) =>
        u.naam.toLowerCase().includes(searchLower) ||
        (u.serienummer && u.serienummer.toLowerCase().includes(searchLower)) ||
        (u.notities && u.notities.toLowerCase().includes(searchLower))
    );
  },
});

// Create new equipment
export const create = mutation({
  args: {
    voertuigId: v.id("voertuigen"),
    naam: v.string(),
    categorie: categorieValidator,
    hoeveelheid: v.number(),
    serienummer: v.optional(v.string()),
    aanschafDatum: v.optional(v.number()),
    aanschafPrijs: v.optional(v.number()),
    status: v.optional(uitrustingStatusValidator),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);
    const now = Date.now();

    // Eigendom van het voertuig = zelfde organisatie
    if (!(await voertuigVanOrg(ctx, org._id, args.voertuigId))) {
      throw new ConvexError("Geen toegang tot dit voertuig");
    }

    return await ctx.db.insert("voertuigUitrusting", {
      voertuigId: args.voertuigId,
      orgId: org._id,
      naam: args.naam,
      categorie: args.categorie,
      hoeveelheid: args.hoeveelheid,
      serienummer: args.serienummer,
      aanschafDatum: args.aanschafDatum,
      aanschafPrijs: args.aanschafPrijs,
      status: args.status ?? "aanwezig",
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update equipment
export const update = mutation({
  args: {
    id: v.id("voertuigUitrusting"),
    voertuigId: v.optional(v.id("voertuigen")),
    naam: v.optional(v.string()),
    categorie: v.optional(categorieValidator),
    hoeveelheid: v.optional(v.number()),
    serienummer: v.optional(v.string()),
    aanschafDatum: v.optional(v.number()),
    aanschafPrijs: v.optional(v.number()),
    status: v.optional(uitrustingStatusValidator),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);

    // Eigendom = zelfde organisatie
    const uitrusting = await verifyOrgOwnership(
      ctx,
      await ctx.db.get(args.id),
      "uitrusting"
    );

    // If moving to a different vehicle, verify ownership of new vehicle
    if (args.voertuigId && args.voertuigId !== uitrusting.voertuigId) {
      if (!(await voertuigVanOrg(ctx, orgId, args.voertuigId))) {
        throw new ConvexError("Geen toegang tot dit voertuig");
      }
    }

    // Build update object explicitly
    const updateData: {
      voertuigId?: typeof args.voertuigId;
      naam?: string;
      categorie?: "motorgereedschap" | "handgereedschap" | "veiligheid" | "overig";
      hoeveelheid?: number;
      serienummer?: string;
      aanschafDatum?: number;
      aanschafPrijs?: number;
      status?: "aanwezig" | "vermist" | "defect";
      notities?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.voertuigId !== undefined) updateData.voertuigId = args.voertuigId;
    if (args.naam !== undefined) updateData.naam = args.naam;
    if (args.categorie !== undefined) updateData.categorie = args.categorie;
    if (args.hoeveelheid !== undefined) updateData.hoeveelheid = args.hoeveelheid;
    if (args.serienummer !== undefined) updateData.serienummer = args.serienummer;
    if (args.aanschafDatum !== undefined) updateData.aanschafDatum = args.aanschafDatum;
    if (args.aanschafPrijs !== undefined) updateData.aanschafPrijs = args.aanschafPrijs;
    if (args.status !== undefined) updateData.status = args.status;
    if (args.notities !== undefined) updateData.notities = args.notities;

    await ctx.db.patch(args.id, updateData);

    return args.id;
  },
});

// Update status only (quick action)
export const updateStatus = mutation({
  args: {
    id: v.id("voertuigUitrusting"),
    status: uitrustingStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "uitrusting");

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Delete equipment
export const remove = mutation({
  args: { id: v.id("voertuigUitrusting") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "uitrusting");

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Get equipment statistics for a vehicle or all
export const getStats = query({
  args: { voertuigId: v.optional(v.id("voertuigen")) },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    let uitrusting;
    if (args.voertuigId) {
      // Eigendom van het voertuig = zelfde organisatie
      if (!(await voertuigVanOrg(ctx, orgId, args.voertuigId))) {
        return {
          totaalItems: 0,
          totaalWaarde: 0,
          perCategorie: {},
          perStatus: {},
        };
      }

      uitrusting = await ctx.db
        .query("voertuigUitrusting")
        .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId!))
        .collect();
    } else {
      uitrusting = await ctx.db
        .query("voertuigUitrusting")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
    }

    // Calculate statistics
    const perCategorie: Record<string, number> = {};
    const perStatus: Record<string, number> = {};
    let totaalWaarde = 0;

    for (const item of uitrusting) {
      // Count per category
      perCategorie[item.categorie] = (perCategorie[item.categorie] || 0) + item.hoeveelheid;

      // Count per status
      perStatus[item.status] = (perStatus[item.status] || 0) + item.hoeveelheid;

      // Sum value
      if (item.aanschafPrijs) {
        totaalWaarde += item.aanschafPrijs * item.hoeveelheid;
      }
    }

    return {
      totaalItems: uitrusting.reduce((sum, u) => sum + u.hoeveelheid, 0),
      totaalWaarde,
      perCategorie,
      perStatus,
    };
  },
});

// Move equipment to another vehicle
export const moveToVoertuig = mutation({
  args: {
    id: v.id("voertuigUitrusting"),
    newVoertuigId: v.id("voertuigen"),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);

    // Eigendom van uitrusting én doelvoertuig = zelfde organisatie
    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "uitrusting");
    if (!(await voertuigVanOrg(ctx, orgId, args.newVoertuigId))) {
      throw new ConvexError("Geen toegang tot dit voertuig");
    }

    await ctx.db.patch(args.id, {
      voertuigId: args.newVoertuigId,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});
