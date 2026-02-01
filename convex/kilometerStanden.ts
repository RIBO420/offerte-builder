import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Get all kilometer records for a vehicle
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
      .query("kilometerStanden")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId))
      .order("desc")
      .collect();
  },
});

// Get latest kilometer reading for a vehicle
export const getLatest = query({
  args: { voertuigId: v.id("voertuigen") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership of the vehicle
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
      return null;
    }

    const records = await ctx.db
      .query("kilometerStanden")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId))
      .order("desc")
      .first();

    return records;
  },
});

// Create a kilometer reading
export const create = mutation({
  args: {
    voertuigId: v.id("voertuigen"),
    datum: v.string(), // YYYY-MM-DD format
    kilometerstand: v.number(),
    projectId: v.optional(v.id("projecten")),
    notities: v.optional(v.string()),
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

    return await ctx.db.insert("kilometerStanden", {
      voertuigId: args.voertuigId,
      userId,
      datum: args.datum,
      kilometerstand: args.kilometerstand,
      projectId: args.projectId,
      notities: args.notities,
      createdAt: Date.now(),
    });
  },
});

// Delete a kilometer record
export const remove = mutation({
  args: { id: v.id("kilometerStanden") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const record = await ctx.db.get(args.id);
    if (!record || record.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit kilometer record");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Haal alle kilometerstanden op voor de gebruiker
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit ?? 100;

    const records = await ctx.db
      .query("kilometerStanden")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Sorteer op datum (nieuwste eerst)
    const sorted = records.sort((a, b) => b.datum.localeCompare(a.datum));

    return sorted.slice(0, limit);
  },
});

// Haal een enkele kilometerstand op
export const get = query({
  args: { id: v.id("kilometerStanden") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const record = await ctx.db.get(args.id);

    if (!record) return null;
    if (record.userId.toString() !== userId.toString()) {
      return null;
    }

    return record;
  },
});

// Log een nieuwe kilometerstand (alias voor create met extra validatie)
export const log = mutation({
  args: {
    voertuigId: v.id("voertuigen"),
    datum: v.string(), // YYYY-MM-DD format
    kilometerstand: v.number(),
    projectId: v.optional(v.id("projecten")),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership of the vehicle
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit voertuig");
    }

    // Valideer dat de kilometerstand niet lager is dan de huidige
    if (voertuig.kmStand && args.kilometerstand < voertuig.kmStand) {
      throw new Error(
        `Kilometerstand (${args.kilometerstand}) kan niet lager zijn dan huidige stand (${voertuig.kmStand})`
      );
    }

    // Optioneel: verifieer projecteigenaarschap als projectId is meegegeven
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId.toString() !== userId.toString()) {
        throw new Error("Geen toegang tot dit project");
      }
    }

    // Update de kilometerstand op het voertuig
    await ctx.db.patch(args.voertuigId, {
      kmStand: args.kilometerstand,
      updatedAt: Date.now(),
    });

    // Maak het kilometerstand record aan
    return await ctx.db.insert("kilometerStanden", {
      voertuigId: args.voertuigId,
      userId,
      datum: args.datum,
      kilometerstand: args.kilometerstand,
      projectId: args.projectId,
      notities: args.notities,
      createdAt: Date.now(),
    });
  },
});

// Werk een kilometerstand bij
export const update = mutation({
  args: {
    id: v.id("kilometerStanden"),
    datum: v.optional(v.string()),
    kilometerstand: v.optional(v.number()),
    projectId: v.optional(v.id("projecten")),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const record = await ctx.db.get(args.id);
    if (!record || record.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit kilometer record");
    }

    const updateData: {
      datum?: string;
      kilometerstand?: number;
      projectId?: typeof args.projectId;
      notities?: string;
    } = {};

    if (args.datum !== undefined) updateData.datum = args.datum;
    if (args.kilometerstand !== undefined)
      updateData.kilometerstand = args.kilometerstand;
    if (args.projectId !== undefined) updateData.projectId = args.projectId;
    if (args.notities !== undefined) updateData.notities = args.notities;

    await ctx.db.patch(args.id, updateData);
    return args.id;
  },
});

// Haal kilometerstand statistieken op per voertuig
export const getStatistieken = query({
  args: {
    voertuigId: v.id("voertuigen"),
    periode: v.optional(v.number()), // Aantal dagen terug kijken
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap
    const voertuig = await ctx.db.get(args.voertuigId);
    if (!voertuig || voertuig.userId.toString() !== userId.toString()) {
      return null;
    }

    const periode = args.periode ?? 365; // Standaard 1 jaar
    const startDatum = new Date();
    startDatum.setDate(startDatum.getDate() - periode);
    const startDatumStr = startDatum.toISOString().split("T")[0];

    const records = await ctx.db
      .query("kilometerStanden")
      .withIndex("by_voertuig", (q) => q.eq("voertuigId", args.voertuigId))
      .collect();

    // Filter op periode
    const filteredRecords = records.filter(
      (record) => record.datum >= startDatumStr
    );

    if (filteredRecords.length === 0) {
      return {
        totaalKilometers: 0,
        gemiddeldePerDag: 0,
        gemiddeldePerMaand: 0,
        aantalRegistraties: 0,
        periodeInDagen: periode,
      };
    }

    // Sorteer op datum
    const sorted = filteredRecords.sort((a, b) =>
      a.datum.localeCompare(b.datum)
    );

    // Bereken totaal gereden kilometers in periode
    const eersteStand = sorted[0].kilometerstand;
    const laatsteStand = sorted[sorted.length - 1].kilometerstand;
    const totaalKilometers = laatsteStand - eersteStand;

    // Bereken dagen tussen eerste en laatste registratie
    const eersteDatum = new Date(sorted[0].datum);
    const laatsteDatum = new Date(sorted[sorted.length - 1].datum);
    const dagenTussen = Math.max(
      1,
      Math.ceil(
        (laatsteDatum.getTime() - eersteDatum.getTime()) / (24 * 60 * 60 * 1000)
      )
    );

    const gemiddeldePerDag = totaalKilometers / dagenTussen;
    const gemiddeldePerMaand = gemiddeldePerDag * 30;

    return {
      totaalKilometers,
      gemiddeldePerDag: Math.round(gemiddeldePerDag * 10) / 10,
      gemiddeldePerMaand: Math.round(gemiddeldePerMaand),
      aantalRegistraties: sorted.length,
      periodeInDagen: periode,
      eersteStand,
      laatsteStand,
    };
  },
});

// Haal kilometerstanden op voor een project
export const listByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verifieer eigenaarschap van project
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      return [];
    }

    const records = await ctx.db
      .query("kilometerStanden")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter op projectId
    const projectRecords = records.filter(
      (record) => record.projectId === args.projectId
    );

    // Sorteer op datum
    return projectRecords.sort((a, b) => a.datum.localeCompare(b.datum));
  },
});
