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

// Ernst levels for damage
export const ernstValidator = v.union(
  v.literal("klein"),
  v.literal("gemiddeld"),
  v.literal("groot")
);

// Damage types
export const schadeTypeValidator = v.union(
  v.literal("deuk"),
  v.literal("kras"),
  v.literal("breuk"),
  v.literal("mechanisch"),
  v.literal("overig")
);

// Status for damage reports
export const schadeStatusValidator = v.union(
  v.literal("nieuw"),
  v.literal("in_reparatie"),
  v.literal("afgehandeld")
);

// List all damage reports for the user
export const list = query({
  args: {
    voertuigId: v.optional(v.id("voertuigen")),
    status: v.optional(schadeStatusValidator),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    // If filtering by voertuig
    if (args.voertuigId) {
      // Eigendom van het voertuig = zelfde organisatie
      if (!(await voertuigVanOrg(ctx, orgId, args.voertuigId))) {
        return [];
      }

      let schades = await ctx.db
        .query("voertuigSchades")
        .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId!))
        .collect();

      // Filter by status if provided
      if (args.status) {
        schades = schades.filter((s) => s.status === args.status);
      }

      return schades;
    }

    // If filtering by status only
    if (args.status) {
      const schades = await ctx.db
        .query("voertuigSchades")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();

      // Belt & braces: by_status is bedrijfsoverstijgend
      return schades.filter((s) => s.orgId?.toString() === orgId.toString());
    }

    // Alle schades van de eigen organisatie
    return await ctx.db
      .query("voertuigSchades")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

// Get a single damage report
export const get = query({
  args: { id: v.id("voertuigSchades") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const schade = await ctx.db.get(args.id);

    if (!schade) return null;
    if (schade.orgId?.toString() !== orgId.toString()) {
      return null;
    }

    return schade;
  },
});

// Get damage report with vehicle info
export const getWithVoertuig = query({
  args: { id: v.id("voertuigSchades") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const schade = await ctx.db.get(args.id);

    if (!schade) return null;
    if (schade.orgId?.toString() !== orgId.toString()) {
      return null;
    }

    const voertuig = await ctx.db.get(schade.voertuigId);

    return {
      ...schade,
      voertuig,
    };
  },
});

// Create a new damage report
export const create = mutation({
  args: {
    voertuigId: v.id("voertuigen"),
    datum: v.number(),
    beschrijving: v.string(),
    ernst: ernstValidator,
    schadeType: schadeTypeValidator,
    fotoUrls: v.optional(v.array(v.string())),
    gerapporteerdDoor: v.string(),
    status: v.optional(schadeStatusValidator),
    reparatieKosten: v.optional(v.number()),
    verzekeringsClaim: v.optional(v.boolean()),
    claimNummer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const { org, user } = await requireOrgContext(ctx);
    const now = Date.now();

    // Eigendom van het voertuig = zelfde organisatie
    if (!(await voertuigVanOrg(ctx, org._id, args.voertuigId))) {
      throw new ConvexError("Geen toegang tot dit voertuig");
    }

    return await ctx.db.insert("voertuigSchades", {
      voertuigId: args.voertuigId,
      orgId: org._id,
      // `userId` blijft tot fase 6 verplicht in het schema.
      userId: user._id,
      datum: args.datum,
      beschrijving: args.beschrijving,
      ernst: args.ernst,
      schadeType: args.schadeType,
      fotoUrls: args.fotoUrls,
      gerapporteerdDoor: args.gerapporteerdDoor,
      status: args.status ?? "nieuw",
      reparatieKosten: args.reparatieKosten,
      verzekeringsClaim: args.verzekeringsClaim,
      claimNummer: args.claimNummer,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update a damage report
export const update = mutation({
  args: {
    id: v.id("voertuigSchades"),
    datum: v.optional(v.number()),
    beschrijving: v.optional(v.string()),
    ernst: v.optional(ernstValidator),
    schadeType: v.optional(schadeTypeValidator),
    fotoUrls: v.optional(v.array(v.string())),
    gerapporteerdDoor: v.optional(v.string()),
    status: v.optional(schadeStatusValidator),
    reparatieKosten: v.optional(v.number()),
    verzekeringsClaim: v.optional(v.boolean()),
    claimNummer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Eigendom = zelfde organisatie
    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "schademelding");

    // Build update object explicitly
    const updateData: {
      datum?: number;
      beschrijving?: string;
      ernst?: "klein" | "gemiddeld" | "groot";
      schadeType?: "deuk" | "kras" | "breuk" | "mechanisch" | "overig";
      fotoUrls?: string[];
      gerapporteerdDoor?: string;
      status?: "nieuw" | "in_reparatie" | "afgehandeld";
      reparatieKosten?: number;
      verzekeringsClaim?: boolean;
      claimNummer?: string;
      updatedAt: number;
    } = {
      updatedAt: Date.now(),
    };

    if (args.datum !== undefined) updateData.datum = args.datum;
    if (args.beschrijving !== undefined) updateData.beschrijving = args.beschrijving;
    if (args.ernst !== undefined) updateData.ernst = args.ernst;
    if (args.schadeType !== undefined) updateData.schadeType = args.schadeType;
    if (args.fotoUrls !== undefined) updateData.fotoUrls = args.fotoUrls;
    if (args.gerapporteerdDoor !== undefined) updateData.gerapporteerdDoor = args.gerapporteerdDoor;
    if (args.status !== undefined) updateData.status = args.status;
    if (args.reparatieKosten !== undefined) updateData.reparatieKosten = args.reparatieKosten;
    if (args.verzekeringsClaim !== undefined) updateData.verzekeringsClaim = args.verzekeringsClaim;
    if (args.claimNummer !== undefined) updateData.claimNummer = args.claimNummer;

    await ctx.db.patch(args.id, updateData);

    return args.id;
  },
});

// Update status only (quick action)
export const updateStatus = mutation({
  args: {
    id: v.id("voertuigSchades"),
    status: schadeStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Eigendom = zelfde organisatie
    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "schademelding");

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Delete a damage report
export const remove = mutation({
  args: { id: v.id("voertuigSchades") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Eigendom = zelfde organisatie
    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "schademelding");

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Get damage statistics for a vehicle
export const getStats = query({
  args: { voertuigId: v.optional(v.id("voertuigen")) },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    let schades;
    if (args.voertuigId) {
      // Eigendom van het voertuig = zelfde organisatie
      if (!(await voertuigVanOrg(ctx, orgId, args.voertuigId))) {
        return {
          totaal: 0,
          nieuw: 0,
          inReparatie: 0,
          afgehandeld: 0,
          totaleKosten: 0,
        };
      }

      schades = await ctx.db
        .query("voertuigSchades")
        .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId!))
        .collect();
    } else {
      schades = await ctx.db
        .query("voertuigSchades")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
    }

    return {
      totaal: schades.length,
      nieuw: schades.filter((s) => s.status === "nieuw").length,
      inReparatie: schades.filter((s) => s.status === "in_reparatie").length,
      afgehandeld: schades.filter((s) => s.status === "afgehandeld").length,
      totaleKosten: schades.reduce((sum, s) => sum + (s.reparatieKosten || 0), 0),
    };
  },
});
