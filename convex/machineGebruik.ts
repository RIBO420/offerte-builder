import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// List all machine usage for a project
export const list = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Project niet gevonden of geen toegang");
    }

    const usage = await ctx.db
      .query("machineGebruik")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Enrich with machine details
    const enrichedUsage = await Promise.all(
      usage.map(async (item) => {
        const machine = await ctx.db.get(item.machineId);
        return {
          ...item,
          machine: machine
            ? {
                naam: machine.naam,
                type: machine.type,
                tariefType: machine.tariefType,
              }
            : null,
        };
      })
    );

    return enrichedUsage;
  },
});

// Get total machine costs for project
export const getTotals = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Project niet gevonden of geen toegang");
    }

    const usage = await ctx.db
      .query("machineGebruik")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Calculate totals
    const totaalKosten = usage.reduce((sum, item) => sum + item.kosten, 0);
    const totaalUren = usage.reduce((sum, item) => sum + item.uren, 0);

    // Per machine
    const perMachine: Record<string, { uren: number; kosten: number; naam: string }> = {};

    for (const item of usage) {
      const machine = await ctx.db.get(item.machineId);
      const machineId = item.machineId.toString();

      if (!perMachine[machineId]) {
        perMachine[machineId] = {
          uren: 0,
          kosten: 0,
          naam: machine?.naam || "Onbekende machine",
        };
      }

      perMachine[machineId].uren += item.uren;
      perMachine[machineId].kosten += item.kosten;
    }

    // Per datum
    const perDatum: Record<string, number> = {};
    usage.forEach((item) => {
      perDatum[item.datum] = (perDatum[item.datum] || 0) + item.kosten;
    });

    return {
      totaalKosten,
      totaalUren,
      perMachine,
      perDatum,
      aantalRegistraties: usage.length,
    };
  },
});

// Add machine usage entry
export const add = mutation({
  args: {
    projectId: v.id("projecten"),
    machineId: v.id("machines"),
    datum: v.string(), // YYYY-MM-DD
    uren: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Project niet gevonden of geen toegang");
    }

    // Verify machine ownership and get tarief
    const machine = await ctx.db.get(args.machineId);
    if (!machine || machine.userId.toString() !== userId.toString()) {
      throw new Error("Machine niet gevonden of geen toegang");
    }

    // Calculate costs based on tarief type
    let kosten: number;
    if (machine.tariefType === "dag") {
      // Convert hours to days (assuming 8 hour workday)
      const dagen = args.uren / 8;
      kosten = dagen * machine.tarief;
    } else {
      // Per hour
      kosten = args.uren * machine.tarief;
    }

    return await ctx.db.insert("machineGebruik", {
      projectId: args.projectId,
      machineId: args.machineId,
      datum: args.datum,
      uren: args.uren,
      kosten,
    });
  },
});

// Update machine usage entry
export const update = mutation({
  args: {
    id: v.id("machineGebruik"),
    datum: v.optional(v.string()),
    uren: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get entry and verify ownership through project
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error("Machine gebruik niet gevonden");
    }

    const project = await ctx.db.get(entry.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit machine gebruik");
    }

    const updates: Record<string, unknown> = {};

    if (args.datum !== undefined) {
      updates.datum = args.datum;
    }

    if (args.uren !== undefined) {
      // Recalculate costs if hours changed
      const machine = await ctx.db.get(entry.machineId);
      if (machine) {
        let kosten: number;
        if (machine.tariefType === "dag") {
          const dagen = args.uren / 8;
          kosten = dagen * machine.tarief;
        } else {
          kosten = args.uren * machine.tarief;
        }
        updates.uren = args.uren;
        updates.kosten = kosten;
      }
    }

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

// Delete machine usage entry
export const remove = mutation({
  args: { id: v.id("machineGebruik") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get entry and verify ownership through project
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error("Machine gebruik niet gevonden");
    }

    const project = await ctx.db.get(entry.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot dit machine gebruik");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
