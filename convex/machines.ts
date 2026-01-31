import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// List all machines for authenticated user
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("machines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Get single machine (with ownership verification)
export const get = query({
  args: { id: v.id("machines") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const machine = await ctx.db.get(args.id);

    if (!machine) return null;
    if (machine.userId.toString() !== userId.toString()) {
      return null;
    }

    return machine;
  },
});

// Get machines linked to specific scopes
export const getByScopes = query({
  args: { scopes: v.array(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const allMachines = await ctx.db
      .query("machines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    // Filter machines that have at least one matching scope
    return allMachines.filter((machine) =>
      machine.gekoppeldeScopes.some((scope) => args.scopes.includes(scope))
    );
  },
});

// Create machine for authenticated user
export const create = mutation({
  args: {
    naam: v.string(),
    type: v.union(v.literal("intern"), v.literal("extern")),
    tarief: v.number(),
    tariefType: v.union(v.literal("uur"), v.literal("dag")),
    gekoppeldeScopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db.insert("machines", {
      userId,
      naam: args.naam,
      type: args.type,
      tarief: args.tarief,
      tariefType: args.tariefType,
      gekoppeldeScopes: args.gekoppeldeScopes,
      isActief: true,
    });
  },
});

// Update machine (with ownership verification)
export const update = mutation({
  args: {
    id: v.id("machines"),
    naam: v.optional(v.string()),
    type: v.optional(v.union(v.literal("intern"), v.literal("extern"))),
    tarief: v.optional(v.number()),
    tariefType: v.optional(v.union(v.literal("uur"), v.literal("dag"))),
    gekoppeldeScopes: v.optional(v.array(v.string())),
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const machine = await ctx.db.get(args.id);
    if (!machine) {
      throw new Error("Machine niet gevonden");
    }
    if (machine.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze machine");
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

// Delete machine (soft delete, with ownership verification)
export const remove = mutation({
  args: { id: v.id("machines") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const machine = await ctx.db.get(args.id);
    if (!machine) {
      throw new Error("Machine niet gevonden");
    }
    if (machine.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze machine");
    }

    await ctx.db.patch(args.id, {
      isActief: false,
    });
    return args.id;
  },
});

// Hard delete machine (with ownership verification)
export const hardDelete = mutation({
  args: { id: v.id("machines") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership
    const machine = await ctx.db.get(args.id);
    if (!machine) {
      throw new Error("Machine niet gevonden");
    }
    if (machine.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze machine");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create default machine templates for authenticated user (idempotent)
export const createDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Idempotent: check if user already has machines
    const existing = await ctx.db
      .query("machines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      return { message: "User already has machines", count: 0 };
    }

    const defaultMachines = [
      {
        naam: "Minikraan",
        type: "intern" as const,
        tarief: 150,
        tariefType: "dag" as const,
        gekoppeldeScopes: ["grondwerk"],
      },
      {
        naam: "Trilplaat",
        type: "intern" as const,
        tarief: 35,
        tariefType: "dag" as const,
        gekoppeldeScopes: ["bestrating", "grondwerk"],
      },
      {
        naam: "Hoogwerker",
        type: "extern" as const,
        tarief: 250,
        tariefType: "dag" as const,
        gekoppeldeScopes: ["bomen", "houtwerk"],
      },
      {
        naam: "Tuinfrees",
        type: "intern" as const,
        tarief: 25,
        tariefType: "dag" as const,
        gekoppeldeScopes: ["grondwerk", "gras"],
      },
      {
        naam: "Grasmaaier (groot)",
        type: "intern" as const,
        tarief: 15,
        tariefType: "uur" as const,
        gekoppeldeScopes: ["gras_onderhoud", "gras"],
      },
      {
        naam: "Heggenschaar (benzine)",
        type: "intern" as const,
        tarief: 20,
        tariefType: "dag" as const,
        gekoppeldeScopes: ["heggen"],
      },
    ];

    let count = 0;

    for (const machine of defaultMachines) {
      await ctx.db.insert("machines", {
        userId,
        ...machine,
        isActief: true,
      });
      count++;
    }

    return { message: "Default machines created", count };
  },
});
