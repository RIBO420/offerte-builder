/**
 * Garanties Functions — Garantiebeheer (MOD-010)
 *
 * Provides CRUD operations for warranty tracking per completed project.
 * Garanties are created manually (Phase 1) or automatically when a project
 * reaches "afgerond" / "nacalculatie_compleet" status (Phase 2).
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
import { requireNotViewer, getUserRole, hasRole } from "./roles";
import { Id } from "./_generated/dataModel";

// ============================================
// QUERIES
// ============================================

/**
 * List all garanties for the current user with optional status filter.
 * Enriched with klant and project names.
 */
export const list = query({
  args: {
    status: v.optional(v.union(v.literal("actief"), v.literal("verlopen"))),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    let garanties;
    if (args.status) {
      garanties = await ctx.db
        .query("garanties")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .collect();
    } else {
      garanties = await ctx.db
        .query("garanties")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
    }

    // Filter out soft-deleted
    const activeGaranties = garanties.filter((g) => !g.deletedAt);

    // Enrich with klant and project data
    const enriched = await Promise.all(
      activeGaranties.map(async (g) => {
        const klant = await ctx.db.get(g.klantId);
        const project = await ctx.db.get(g.projectId);
        return {
          ...g,
          klantNaam: klant?.naam ?? "Onbekend",
          projectNaam: project?.naam ?? "Onbekend",
        };
      })
    );

    return enriched;
  },
});

/**
 * Get a single garantie by ID with related data.
 */
export const getById = query({
  args: { id: v.id("garanties") },
  handler: async (ctx, args) => {
    const garantie = await ctx.db.get(args.id);
    if (!garantie) return null;

    await verifyOwnership(ctx, garantie, "garantie");

    const klant = await ctx.db.get(garantie.klantId);
    const project = await ctx.db.get(garantie.projectId);

    // Get linked servicemeldingen
    const meldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_garantie", (q) => q.eq("garantieId", args.id))
      .collect();

    const activeMeldingen = meldingen.filter((m) => !m.deletedAt);

    return {
      ...garantie,
      klantNaam: klant?.naam ?? "Onbekend",
      klantAdres: klant ? `${klant.adres}, ${klant.postcode} ${klant.plaats}` : "",
      klantEmail: klant?.email ?? "",
      klantTelefoon: klant?.telefoon ?? "",
      projectNaam: project?.naam ?? "Onbekend",
      projectStatus: project?.status ?? "onbekend",
      meldingen: activeMeldingen,
    };
  },
});

/**
 * Get garantie for a specific project.
 */
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const garantie = await ctx.db
      .query("garanties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    if (!garantie || garantie.deletedAt) return null;
    return garantie;
  },
});

/**
 * Get all garanties for a klant.
 */
export const getByKlant = query({
  args: { klantId: v.id("klanten") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const garanties = await ctx.db
      .query("garanties")
      .withIndex("by_klant", (q) => q.eq("klantId", args.klantId))
      .collect();

    return garanties.filter((g) => !g.deletedAt);
  },
});

/**
 * Get garanties expiring within N days.
 */
export const getExpiring = query({
  args: {
    dagenVooruit: v.optional(v.number()), // Default 90
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const dagen = args.dagenVooruit ?? 90;

    const now = new Date();
    const cutoff = new Date(now.getTime() + dagen * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    const aktieveGaranties = await ctx.db
      .query("garanties")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "actief")
      )
      .collect();

    return aktieveGaranties
      .filter((g) => !g.deletedAt && g.eindDatum <= cutoffStr && g.eindDatum >= todayStr)
      .sort((a, b) => a.eindDatum.localeCompare(b.eindDatum));
  },
});

/**
 * Get only active garanties.
 */
export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const garanties = await ctx.db
      .query("garanties")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", user._id).eq("status", "actief")
      )
      .collect();

    return garanties.filter((g) => !g.deletedAt);
  },
});

/**
 * Get dashboard stats for garanties.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const alleGaranties = await ctx.db
      .query("garanties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const active = alleGaranties.filter((g) => !g.deletedAt);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const in30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const actief = active.filter((g) => g.status === "actief").length;
    const verlopen = active.filter((g) => g.status === "verlopen").length;
    const verlopendBinnen30d = active.filter(
      (g) =>
        g.status === "actief" &&
        g.eindDatum <= in30d &&
        g.eindDatum >= todayStr
    ).length;

    // Count open servicemeldingen
    const meldingen = await ctx.db
      .query("servicemeldingen")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const openMeldingen = meldingen.filter(
      (m) => !m.deletedAt && m.status !== "afgehandeld"
    ).length;

    return {
      actief,
      verlopen,
      verlopendBinnen30d,
      openMeldingen,
      totaal: active.length,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new garantie (manual creation — Phase 1).
 */
export const create = mutation({
  args: {
    projectId: v.id("projecten"),
    klantId: v.id("klanten"),
    startDatum: v.string(),
    garantiePeriodeInMaanden: v.optional(v.number()),
    voorwaarden: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Verify project exists and belongs to user
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new ConvexError("Project niet gevonden of geen toegang");
    }

    // Check if garantie already exists for this project
    const existing = await ctx.db
      .query("garanties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .first();

    if (existing && !existing.deletedAt) {
      throw new ConvexError("Er bestaat al een garantie voor dit project");
    }

    // Calculate end date
    const periodeInMaanden = args.garantiePeriodeInMaanden ?? 12;
    const start = new Date(args.startDatum);
    const eind = new Date(start);
    eind.setMonth(eind.getMonth() + periodeInMaanden);
    const eindDatum = eind.toISOString().split("T")[0];

    const id = await ctx.db.insert("garanties", {
      userId,
      projectId: args.projectId,
      klantId: args.klantId,
      startDatum: args.startDatum,
      eindDatum,
      garantiePeriodeInMaanden: periodeInMaanden,
      status: "actief",
      voorwaarden: args.voorwaarden,
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Update garantie details.
 */
export const update = mutation({
  args: {
    id: v.id("garanties"),
    voorwaarden: v.optional(v.string()),
    notities: v.optional(v.string()),
    eindDatum: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const garantie = await ctx.db.get(args.id);
    await verifyOwnership(ctx, garantie, "garantie");

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.voorwaarden !== undefined) updates.voorwaarden = args.voorwaarden;
    if (args.notities !== undefined) updates.notities = args.notities;
    if (args.eindDatum !== undefined) updates.eindDatum = args.eindDatum;

    await ctx.db.patch(args.id, updates);
    return args.id;
  },
});

/**
 * Check and expire garanties that have passed their end date.
 * Called manually or by a scheduled job.
 */
export const checkAndExpire = mutation({
  args: {},
  handler: async (ctx) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const todayStr = new Date().toISOString().split("T")[0];

    const activeGaranties = await ctx.db
      .query("garanties")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "actief")
      )
      .collect();

    let expiredCount = 0;
    for (const g of activeGaranties) {
      if (g.eindDatum < todayStr) {
        await ctx.db.patch(g._id, {
          status: "verlopen",
          updatedAt: Date.now(),
        });
        expiredCount++;
      }
    }

    return { expiredCount };
  },
});
