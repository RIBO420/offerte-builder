/**
 * WeekPlanning — Drag-and-drop weekplanning
 *
 * Grid: medewerkers (Y-as) × dagen (X-as) met projectblokken.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { requireNotViewer } from "./roles";

// ============================================
// Queries
// ============================================

/**
 * Alle toewijzingen ophalen voor een weekperiode.
 */
export const getWeek = query({
  args: {
    startDatum: v.string(), // YYYY-MM-DD (maandag)
    eindDatum: v.string(), // YYYY-MM-DD (vrijdag)
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Haal alle toewijzingen in het datumbereik
    const toewijzingen = await ctx.db
      .query("weekPlanning")
      .withIndex("by_datum")
      .filter((q) =>
        q.and(
          q.gte(q.field("datum"), args.startDatum),
          q.lte(q.field("datum"), args.eindDatum)
        )
      )
      .collect();

    // Enriche met medewerker en project info
    const enriched = await Promise.all(
      toewijzingen.map(async (t) => {
        const medewerker = await ctx.db.get(t.medewerkerId);
        const project = await ctx.db.get(t.projectId);
        return {
          ...t,
          medewerkerNaam: medewerker?.naam ?? "Onbekend",
          projectNaam: project?.naam ?? "Onbekend",
          projectStatus: project?.status,
        };
      })
    );

    return enriched;
  },
});

/**
 * Actieve medewerkers ophalen voor de Y-as.
 */
export const getMedewerkers = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);

    const medewerkers = await ctx.db
      .query("medewerkers")
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    return medewerkers.map((m) => ({
      _id: m._id,
      naam: m.naam,
      functie: m.functie,
    }));
  },
});

/**
 * Actieve projecten ophalen voor drag-source.
 */
export const getActiveProjects = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);

    const projecten = await ctx.db.query("projecten").collect();

    return projecten
      .filter(
        (p) =>
          !p.deletedAt &&
          !p.isArchived &&
          (p.status === "gepland" || p.status === "in_uitvoering")
      )
      .map((p) => ({
        _id: p._id,
        naam: p.naam,
        status: p.status,
      }));
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Toewijzing toevoegen (drag-drop een project op een medewerker+dag).
 */
export const assign = mutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    projectId: v.id("projecten"),
    datum: v.string(),
    uren: v.optional(v.number()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    // Check of deze combinatie al bestaat
    const existing = await ctx.db
      .query("weekPlanning")
      .withIndex("by_medewerker_datum", (q) =>
        q.eq("medewerkerId", args.medewerkerId).eq("datum", args.datum)
      )
      .filter((q) => q.eq(q.field("projectId"), args.projectId))
      .first();

    if (existing) {
      // Update bestaande toewijzing
      await ctx.db.patch(existing._id, {
        uren: args.uren,
        notities: args.notities,
      });
      return existing._id;
    }

    return await ctx.db.insert("weekPlanning", {
      medewerkerId: args.medewerkerId,
      projectId: args.projectId,
      datum: args.datum,
      uren: args.uren,
      notities: args.notities,
      createdAt: Date.now(),
    });
  },
});

/**
 * Toewijzing verplaatsen (drag van ene cel naar andere).
 */
export const move = mutation({
  args: {
    id: v.id("weekPlanning"),
    medewerkerId: v.id("medewerkers"),
    datum: v.string(),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Toewijzing niet gevonden");

    await ctx.db.patch(args.id, {
      medewerkerId: args.medewerkerId,
      datum: args.datum,
    });
  },
});

/**
 * Toewijzing verwijderen.
 */
export const remove = mutation({
  args: { id: v.id("weekPlanning") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Toewijzing niet gevonden");
    await ctx.db.delete(args.id);
  },
});
