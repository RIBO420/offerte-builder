import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

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
    const userId = await requireAuthUserId(ctx);

    // If filtering by voertuig
    if (args.voertuigId) {
      // First verify ownership of the vehicle
      const voertuig = await ctx.db.get(args.voertuigId);
      if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
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

      // Filter by user ownership
      return schades.filter((s) => s.userId.toString() === userId.toString());
    }

    // Get all schades for this user
    return await ctx.db
      .query("voertuigSchades")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Get a single damage report
export const get = query({
  args: { id: v.id("voertuigSchades") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const schade = await ctx.db.get(args.id);

    if (!schade) return null;
    if (schade.userId.toString() !== userId.toString()) {
      return null;
    }

    return schade;
  },
});

// Get damage report with vehicle info
export const getWithVoertuig = query({
  args: { id: v.id("voertuigSchades") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const schade = await ctx.db.get(args.id);

    if (!schade) return null;
    if (schade.userId.toString() !== userId.toString()) {
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
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Verify ownership of the vehicle
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig) {
      throw new Error("Voertuig niet gevonden");
    }
    if (voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    return await ctx.db.insert("voertuigSchades", {
      voertuigId: args.voertuigId,
      userId,
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
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const schade = await ctx.db.get(args.id);
    if (!schade) {
      throw new Error("Schademelding niet gevonden");
    }
    if (schade.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze schademelding");
    }

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
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const schade = await ctx.db.get(args.id);
    if (!schade) {
      throw new Error("Schademelding niet gevonden");
    }
    if (schade.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze schademelding");
    }

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
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const schade = await ctx.db.get(args.id);
    if (!schade) {
      throw new Error("Schademelding niet gevonden");
    }
    if (schade.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze schademelding");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Get damage statistics for a vehicle
export const getStats = query({
  args: { voertuigId: v.optional(v.id("voertuigen")) },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    let schades;
    if (args.voertuigId) {
      // Verify ownership
      const voertuig = await ctx.db.get(args.voertuigId);
      if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
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
        .withIndex("by_user", (q) => q.eq("userId", userId))
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
