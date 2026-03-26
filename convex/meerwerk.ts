/**
 * Meerwerk Functions - Extra work module (FAC-003)
 *
 * Provides functions for creating and managing meerwerk (additional work).
 * Meerwerk is extra work on top of the original offerte, must be approved
 * before it can be invoiced.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
import { requireNotViewer } from "./roles";

const regelValidator = v.object({
  id: v.string(),
  omschrijving: v.string(),
  hoeveelheid: v.number(),
  eenheid: v.string(),
  prijsPerEenheid: v.number(),
  totaal: v.number(),
});

/**
 * Maak een nieuw meerwerkitem aan voor een project.
 */
export const create = mutation({
  args: {
    projectId: v.id("projecten"),
    omschrijving: v.string(),
    reden: v.optional(v.string()),
    regels: v.array(regelValidator),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Verifieer eigenaarschap van project
    const project = await ctx.db.get(args.projectId);
    verifyOwnership(ctx, project, "project");

    const totaalExclBtw = args.regels.reduce((sum, r) => sum + r.totaal, 0);

    return await ctx.db.insert("meerwerk", {
      projectId: args.projectId,
      userId,
      omschrijving: args.omschrijving,
      reden: args.reden,
      regels: args.regels,
      totaalExclBtw,
      status: "aangevraagd",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Haal meerwerk items op voor een project.
 */
export const listByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return [];

    const user = await requireAuth(ctx);
    if (project.userId.toString() !== user._id.toString()) return [];

    return await ctx.db
      .query("meerwerk")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

/**
 * Haal een meerwerkitem op.
 */
export const get = query({
  args: { id: v.id("meerwerk") },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) return null;

    const user = await requireAuth(ctx);
    if (item.userId.toString() !== user._id.toString()) return null;

    return item;
  },
});

/**
 * Keur meerwerk goed.
 */
export const approve = mutation({
  args: {
    id: v.id("meerwerk"),
    goedgekeurdDoor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const item = await ctx.db.get(args.id);
    verifyOwnership(ctx, item, "meerwerkitem");

    if (item!.status !== "aangevraagd") {
      throw new Error("Alleen aangevraagd meerwerk kan goedgekeurd worden");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: "goedgekeurd",
      goedgekeurdDoor: args.goedgekeurdDoor,
      goedgekeurdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Wijs meerwerk af.
 */
export const reject = mutation({
  args: { id: v.id("meerwerk") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const item = await ctx.db.get(args.id);
    verifyOwnership(ctx, item, "meerwerkitem");

    if (item!.status !== "aangevraagd") {
      throw new Error("Alleen aangevraagd meerwerk kan afgewezen worden");
    }

    await ctx.db.patch(args.id, {
      status: "afgewezen",
      updatedAt: Date.now(),
    });
  },
});
