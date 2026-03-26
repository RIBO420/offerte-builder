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

// ============================================
// PLN-002: Beschikbaarheidspaneel
// ============================================

/**
 * Medewerkers die NIET ingepland zijn op een specifieke dag.
 * Filtert ook op verlof/ziekte via urenRegistraties met uurtype.
 */
export const getBeschikbaar = query({
  args: { datum: v.string() },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const alleMedewerkers = await ctx.db
      .query("medewerkers")
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    // Wie is al ingepland?
    const ingepland = await ctx.db
      .query("weekPlanning")
      .withIndex("by_datum", (q) => q.eq("datum", args.datum))
      .collect();

    const ingeplandIds = new Set(ingepland.map((t) => t.medewerkerId));

    // Check verlof/ziekte in urenRegistraties
    const urenVandaag = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_datum", (q) => q.eq("datum", args.datum))
      .collect();

    const afwezigNamen = new Set(
      urenVandaag
        .filter((u) => {
          const uurtype = (u as Record<string, unknown>).uurtype as string | undefined;
          return uurtype === "ziekte" || uurtype === "verlof";
        })
        .map((u) => u.medewerker)
    );

    return alleMedewerkers
      .filter((m) => !ingeplandIds.has(m._id) && !afwezigNamen.has(m.naam))
      .map((m) => ({ _id: m._id, naam: m.naam, functie: m.functie }));
  },
});

// ============================================
// PLN-005: Capaciteitsoverzicht
// ============================================

/**
 * Capaciteitsoverzicht: beschikbare vs ingeplande uren per dag in een week.
 */
export const getCapaciteit = query({
  args: {
    startDatum: v.string(),
    eindDatum: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const alleMedewerkers = await ctx.db
      .query("medewerkers")
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

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

    const urenPerDag = 8;
    const totaalBeschikbaar = alleMedewerkers.length * urenPerDag;

    // Groepeer per dag
    const perDag: Record<string, { ingepland: number; beschikbaar: number; bezetting: number }> = {};

    // Maak 5 werkdagen aan
    const start = new Date(args.startDatum);
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      const dagToewijzingen = toewijzingen.filter((t) => t.datum === dateStr);
      const ingeplandUren = dagToewijzingen.reduce((sum, t) => sum + (t.uren ?? urenPerDag), 0);
      const bezetting = totaalBeschikbaar > 0
        ? Math.round((ingeplandUren / totaalBeschikbaar) * 100)
        : 0;

      perDag[dateStr] = {
        ingepland: ingeplandUren,
        beschikbaar: totaalBeschikbaar,
        bezetting,
      };
    }

    const totaalIngepland = Object.values(perDag).reduce((s, d) => s + d.ingepland, 0);
    const totaalBeschikbaarWeek = totaalBeschikbaar * 5;
    const weekBezetting = totaalBeschikbaarWeek > 0
      ? Math.round((totaalIngepland / totaalBeschikbaarWeek) * 100)
      : 0;

    return {
      perDag,
      weekBezetting,
      totaalMedewerkers: alleMedewerkers.length,
    };
  },
});

// ============================================
// PLN-006: Conflictdetectie
// ============================================

/**
 * Detecteer conflicten in de weekplanning.
 * Conflict = medewerker ingepland op meerdere projecten op dezelfde dag.
 */
export const getConflicten = query({
  args: {
    startDatum: v.string(),
    eindDatum: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

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

    // Groepeer per medewerker + datum
    const grouped = new Map<string, typeof toewijzingen>();
    for (const t of toewijzingen) {
      const key = `${t.medewerkerId}:${t.datum}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(t);
    }

    // Conflicten = medewerker met >1 project op dezelfde dag
    const conflicten: {
      medewerkerId: string;
      datum: string;
      toewijzingen: string[]; // weekPlanning IDs
      projectIds: string[];
    }[] = [];

    for (const [, items] of grouped) {
      if (items.length > 1) {
        // Meerdere projecten op dezelfde dag = potentieel conflict
        const uniqueProjects = new Set(items.map((i) => i.projectId));
        if (uniqueProjects.size > 1) {
          conflicten.push({
            medewerkerId: items[0].medewerkerId,
            datum: items[0].datum,
            toewijzingen: items.map((i) => i._id),
            projectIds: [...uniqueProjects],
          });
        }
      }
    }

    return conflicten;
  },
});
