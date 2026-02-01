import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Types for onderhoud
export const onderhoudTypes = [
  "olie",
  "apk",
  "banden",
  "inspectie",
  "reparatie",
  "overig",
] as const;

export const onderhoudStatusTypes = [
  "gepland",
  "in_uitvoering",
  "voltooid",
] as const;

// Get all maintenance records for a vehicle
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
      .query("voertuigOnderhoud")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId))
      .order("desc")
      .collect();
  },
});

// Get upcoming/scheduled maintenance for all vehicles
export const listUpcoming = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const records = await ctx.db
      .query("voertuigOnderhoud")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "gepland"),
          q.eq(q.field("status"), "in_uitvoering")
        )
      )
      .collect();

    return records;
  },
});

// Get a single maintenance record
export const get = query({
  args: { id: v.id("voertuigOnderhoud") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const record = await ctx.db.get(args.id);

    if (!record || record.userId.toString() !== userId.toString()) {
      return null;
    }

    return record;
  },
});

// Create a maintenance record
export const create = mutation({
  args: {
    voertuigId: v.id("voertuigen"),
    type: v.union(
      v.literal("olie"),
      v.literal("apk"),
      v.literal("banden"),
      v.literal("inspectie"),
      v.literal("reparatie"),
      v.literal("overig")
    ),
    omschrijving: v.string(),
    geplanteDatum: v.number(),
    kosten: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("gepland"),
        v.literal("in_uitvoering"),
        v.literal("voltooid")
      )
    ),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership of the vehicle
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    const now = Date.now();

    return await ctx.db.insert("voertuigOnderhoud", {
      voertuigId: args.voertuigId,
      userId,
      type: args.type,
      omschrijving: args.omschrijving,
      geplanteDatum: args.geplanteDatum,
      kosten: args.kosten,
      status: args.status ?? "gepland",
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Update a maintenance record
export const update = mutation({
  args: {
    id: v.id("voertuigOnderhoud"),
    type: v.optional(
      v.union(
        v.literal("olie"),
        v.literal("apk"),
        v.literal("banden"),
        v.literal("inspectie"),
        v.literal("reparatie"),
        v.literal("overig")
      )
    ),
    omschrijving: v.optional(v.string()),
    geplanteDatum: v.optional(v.number()),
    voltooidDatum: v.optional(v.number()),
    kosten: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("gepland"),
        v.literal("in_uitvoering"),
        v.literal("voltooid")
      )
    ),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const record = await ctx.db.get(args.id);
    if (!record || record.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit onderhoud record");
    }

    const updateData: {
      type?: "olie" | "apk" | "banden" | "inspectie" | "reparatie" | "overig";
      omschrijving?: string;
      geplanteDatum?: number;
      voltooidDatum?: number;
      kosten?: number;
      status?: "gepland" | "in_uitvoering" | "voltooid";
      notities?: string;
      updatedAt: number;
    } = { updatedAt: Date.now() };

    if (args.type !== undefined) updateData.type = args.type;
    if (args.omschrijving !== undefined) updateData.omschrijving = args.omschrijving;
    if (args.geplanteDatum !== undefined) updateData.geplanteDatum = args.geplanteDatum;
    if (args.voltooidDatum !== undefined) updateData.voltooidDatum = args.voltooidDatum;
    if (args.kosten !== undefined) updateData.kosten = args.kosten;
    if (args.status !== undefined) updateData.status = args.status;
    if (args.notities !== undefined) updateData.notities = args.notities;

    await ctx.db.patch(args.id, updateData);
    return args.id;
  },
});

// Delete a maintenance record
export const remove = mutation({
  args: { id: v.id("voertuigOnderhoud") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const record = await ctx.db.get(args.id);
    if (!record || record.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit onderhoud record");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Haal alle onderhoud op voor de gebruiker met optionele status filter
export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("gepland"),
        v.literal("in_uitvoering"),
        v.literal("voltooid")
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    let onderhoudItems = await ctx.db
      .query("voertuigOnderhoud")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter op status indien meegegeven
    if (args.status !== undefined) {
      onderhoudItems = onderhoudItems.filter(
        (item) => item.status === args.status
      );
    }

    // Sorteer op geplande datum (nieuwste eerst)
    return onderhoudItems.sort((a, b) => b.geplanteDatum - a.geplanteDatum);
  },
});

// Haal aankomend onderhoud op (gepland in de toekomst)
export const getUpcoming = query({
  args: {
    dagenVooruit: v.optional(v.number()), // Standaard 30 dagen
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const dagenVooruit = args.dagenVooruit ?? 30;
    const now = Date.now();
    const grens = now + dagenVooruit * 24 * 60 * 60 * 1000;

    const onderhoudItems = await ctx.db
      .query("voertuigOnderhoud")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter op gepland en binnen de tijdsgrens
    const upcoming = onderhoudItems.filter(
      (item) =>
        item.status !== "voltooid" &&
        item.geplanteDatum >= now &&
        item.geplanteDatum <= grens
    );

    // Haal voertuig details op voor elk item
    const voertuigIds = Array.from(new Set(upcoming.map((item) => item.voertuigId)));
    const voertuigen = await Promise.all(
      voertuigIds.map((id) => ctx.db.get(id))
    );
    const voertuigMap = new Map(
      voertuigen.filter(Boolean).map((v) => [v!._id, v])
    );

    const result = upcoming.map((item) => {
      const voertuig = voertuigMap.get(item.voertuigId);
      return {
        ...item,
        voertuig: voertuig
          ? {
              kenteken: voertuig.kenteken,
              merk: voertuig.merk,
              model: voertuig.model,
            }
          : null,
      };
    });

    // Sorteer op datum (vroegste eerst)
    return result.sort((a, b) => a.geplanteDatum - b.geplanteDatum);
  },
});

// Haal achterstallig onderhoud op (gepland in het verleden, niet voltooid)
export const getOverdue = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    const onderhoudItems = await ctx.db
      .query("voertuigOnderhoud")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter op niet voltooid en in het verleden
    const overdue = onderhoudItems.filter(
      (item) => item.status !== "voltooid" && item.geplanteDatum < now
    );

    // Haal voertuig details op voor elk item
    const voertuigIds = Array.from(new Set(overdue.map((item) => item.voertuigId)));
    const voertuigen = await Promise.all(
      voertuigIds.map((id) => ctx.db.get(id))
    );
    const voertuigMap = new Map(
      voertuigen.filter(Boolean).map((v) => [v!._id, v])
    );

    const result = overdue.map((item) => {
      const voertuig = voertuigMap.get(item.voertuigId);
      const dagenAchterstallig = Math.floor(
        (now - item.geplanteDatum) / (24 * 60 * 60 * 1000)
      );
      return {
        ...item,
        dagenAchterstallig,
        voertuig: voertuig
          ? {
              kenteken: voertuig.kenteken,
              merk: voertuig.merk,
              model: voertuig.model,
            }
          : null,
      };
    });

    // Sorteer op datum (oudste eerst - meest achterstallig bovenaan)
    return result.sort((a, b) => a.geplanteDatum - b.geplanteDatum);
  },
});

// Markeer onderhoud als voltooid
export const markeerVoltooid = mutation({
  args: {
    id: v.id("voertuigOnderhoud"),
    kosten: v.optional(v.number()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Verifieer eigenaarschap
    const onderhoud = await ctx.db.get(args.id);
    if (!onderhoud) {
      throw new Error("Onderhoud record niet gevonden");
    }
    if (onderhoud.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit onderhoud record");
    }

    const updateData: {
      status: "voltooid";
      voltooidDatum: number;
      kosten?: number;
      notities?: string;
      updatedAt: number;
    } = {
      status: "voltooid",
      voltooidDatum: now,
      updatedAt: now,
    };

    if (args.kosten !== undefined) updateData.kosten = args.kosten;
    if (args.notities !== undefined) updateData.notities = args.notities;

    await ctx.db.patch(args.id, updateData);

    // Als het APK onderhoud is, update ook de APK vervaldatum van het voertuig
    if (onderhoud.type === "apk") {
      // APK is geldig voor 1 jaar (365 dagen)
      const nieuweApkVervaldatum = now + 365 * 24 * 60 * 60 * 1000;
      await ctx.db.patch(onderhoud.voertuigId, {
        apkVervaldatum: nieuweApkVervaldatum,
        updatedAt: now,
      });
    }

    return args.id;
  },
});

// Haal onderhoud statistieken op per voertuig of voor alle voertuigen
export const getStatistieken = query({
  args: {
    voertuigId: v.optional(v.id("voertuigen")),
    periode: v.optional(v.number()), // Aantal dagen terug kijken
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const periode = args.periode ?? 365; // Standaard 1 jaar
    const startDatum = Date.now() - periode * 24 * 60 * 60 * 1000;

    let onderhoudItems;

    if (args.voertuigId) {
      // Verifieer eigenaarschap
      const voertuig = await ctx.db.get(args.voertuigId);
      if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
        return null;
      }

      onderhoudItems = await ctx.db
        .query("voertuigOnderhoud")
        .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId!))
        .collect();
    } else {
      onderhoudItems = await ctx.db
        .query("voertuigOnderhoud")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    }

    // Filter op periode voor voltooide items
    const voltooideItems = onderhoudItems.filter(
      (item) =>
        item.status === "voltooid" &&
        item.voltooidDatum &&
        item.voltooidDatum >= startDatum
    );

    // Bereken totale kosten
    const totaleKosten = voltooideItems.reduce(
      (sum, item) => sum + (item.kosten || 0),
      0
    );

    // Groepeer per type
    const kostenPerType: Record<string, number> = {};
    const aantalPerType: Record<string, number> = {};

    for (const item of voltooideItems) {
      if (!kostenPerType[item.type]) {
        kostenPerType[item.type] = 0;
        aantalPerType[item.type] = 0;
      }
      kostenPerType[item.type] += item.kosten || 0;
      aantalPerType[item.type] += 1;
    }

    // Tel openstaande items
    const openstaand = onderhoudItems.filter(
      (item) => item.status !== "voltooid"
    ).length;

    return {
      totaleKosten,
      aantalVoltooid: voltooideItems.length,
      aantalOpenstaand: openstaand,
      kostenPerType,
      aantalPerType,
      periodeInDagen: periode,
    };
  },
});
