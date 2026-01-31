import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// List all time entries for a project
export const list = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Project niet gevonden of geen toegang");
    }

    return await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// List entries by date range
export const listByDateRange = query({
  args: {
    projectId: v.id("projecten"),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Project niet gevonden of geen toegang");
    }

    const entries = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Filter by date range
    return entries.filter(
      (entry) => entry.datum >= args.startDate && entry.datum <= args.endDate
    );
  },
});

// Get totals per project/scope/medewerker
export const getTotals = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Project niet gevonden of geen toegang");
    }

    const entries = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Calculate totals
    const totaalUren = entries.reduce((sum, entry) => sum + entry.uren, 0);

    // Per medewerker
    const perMedewerker: Record<string, number> = {};
    entries.forEach((entry) => {
      perMedewerker[entry.medewerker] =
        (perMedewerker[entry.medewerker] || 0) + entry.uren;
    });

    // Per scope
    const perScope: Record<string, number> = {};
    entries.forEach((entry) => {
      if (entry.scope) {
        perScope[entry.scope] = (perScope[entry.scope] || 0) + entry.uren;
      }
    });

    // Per datum
    const perDatum: Record<string, number> = {};
    entries.forEach((entry) => {
      perDatum[entry.datum] = (perDatum[entry.datum] || 0) + entry.uren;
    });

    return {
      totaalUren,
      perMedewerker,
      perScope,
      perDatum,
      aantalRegistraties: entries.length,
    };
  },
});

// Add single entry manually
export const add = mutation({
  args: {
    projectId: v.id("projecten"),
    datum: v.string(), // YYYY-MM-DD
    medewerker: v.string(),
    uren: v.number(),
    taakId: v.optional(v.id("planningTaken")),
    scope: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Project niet gevonden of geen toegang");
    }

    return await ctx.db.insert("urenRegistraties", {
      projectId: args.projectId,
      datum: args.datum,
      medewerker: args.medewerker,
      uren: args.uren,
      taakId: args.taakId,
      scope: args.scope,
      notities: args.notities,
      bron: "handmatig",
    });
  },
});

// Import multiple time entries (batch)
export const importBatch = mutation({
  args: {
    projectId: v.id("projecten"),
    entries: v.array(
      v.object({
        datum: v.string(), // YYYY-MM-DD
        medewerker: v.string(),
        uren: v.number(),
        scope: v.optional(v.string()),
        notities: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Project niet gevonden of geen toegang");
    }

    const insertedIds: string[] = [];

    for (const entry of args.entries) {
      const id = await ctx.db.insert("urenRegistraties", {
        projectId: args.projectId,
        datum: entry.datum,
        medewerker: entry.medewerker,
        uren: entry.uren,
        scope: entry.scope,
        notities: entry.notities,
        bron: "import",
      });
      insertedIds.push(id);
    }

    return {
      count: insertedIds.length,
      ids: insertedIds,
    };
  },
});

// Update entry
export const update = mutation({
  args: {
    id: v.id("urenRegistraties"),
    datum: v.optional(v.string()),
    medewerker: v.optional(v.string()),
    uren: v.optional(v.number()),
    taakId: v.optional(v.id("planningTaken")),
    scope: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get entry and verify ownership through project
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error("Registratie niet gevonden");
    }

    const project = await ctx.db.get(entry.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze registratie");
    }

    const { id, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, filteredUpdates);
    return id;
  },
});

// Delete entry
export const remove = mutation({
  args: { id: v.id("urenRegistraties") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get entry and verify ownership through project
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error("Registratie niet gevonden");
    }

    const project = await ctx.db.get(entry.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze registratie");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
