/**
 * WeekPlanning — Drag-and-drop weekplanning
 *
 * Grid: medewerkers (Y-as) × dagen (X-as) met projectblokken.
 */

import { v, ConvexError } from "convex/values";
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
    if (!item) throw new ConvexError("Toewijzing niet gevonden");

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
    if (!item) throw new ConvexError("Toewijzing niet gevonden");
    await ctx.db.delete(args.id);
  },
});

// ============================================
// Seizoensplanning: Maand / Kwartaal / Jaar views
// ============================================

/**
 * Get all planning assignments for a given month.
 * Returns tasks grouped by date with medewerker and project info.
 */
export const listByMonth = query({
  args: {
    year: v.number(),
    month: v.number(), // 1-12
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Build date range: first and last day of month (YYYY-MM-DD strings)
    const startDatum = `${args.year}-${String(args.month).padStart(2, "0")}-01`;
    const lastDay = new Date(args.year, args.month, 0).getDate();
    const eindDatum = `${args.year}-${String(args.month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const toewijzingen = await ctx.db
      .query("weekPlanning")
      .withIndex("by_datum")
      .filter((q) =>
        q.and(
          q.gte(q.field("datum"), startDatum),
          q.lte(q.field("datum"), eindDatum)
        )
      )
      .collect();

    // Get capacity info
    const alleMedewerkers = await ctx.db
      .query("medewerkers")
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    const urenPerDag = 8;
    const beschikbareUrenPerDag = alleMedewerkers.length * urenPerDag;

    // Enrich with medewerker and project info
    const enriched = await Promise.all(
      toewijzingen.map(async (t) => {
        const medewerker = await ctx.db.get(t.medewerkerId);
        const project = await ctx.db.get(t.projectId);
        return {
          _id: t._id,
          datum: t.datum,
          uren: t.uren,
          medewerkerId: t.medewerkerId,
          projectId: t.projectId,
          medewerkerNaam: medewerker?.naam ?? "Onbekend",
          projectNaam: project?.naam ?? "Onbekend",
          projectStatus: project?.status,
        };
      })
    );

    // Group by date
    const perDag: Record<
      string,
      {
        datum: string;
        taken: typeof enriched;
        aantalTaken: number;
        uren: number;
        beschikbareUren: number;
        medewerkers: string[];
      }
    > = {};

    for (const item of enriched) {
      if (!perDag[item.datum]) {
        perDag[item.datum] = {
          datum: item.datum,
          taken: [],
          aantalTaken: 0,
          uren: 0,
          beschikbareUren: beschikbareUrenPerDag,
          medewerkers: [],
        };
      }
      perDag[item.datum].taken.push(item);
      perDag[item.datum].aantalTaken += 1;
      perDag[item.datum].uren += item.uren ?? urenPerDag;
      const naam = item.medewerkerNaam;
      if (!perDag[item.datum].medewerkers.includes(naam)) {
        perDag[item.datum].medewerkers.push(naam);
      }
    }

    return { perDag, beschikbareUrenPerDag, totaalMedewerkers: alleMedewerkers.length };
  },
});

/**
 * Get planning summary per week for a quarter.
 * Quarter 1 = Jan-Mar, 2 = Apr-Jun, 3 = Jul-Sep, 4 = Oct-Dec
 */
export const listByQuarter = query({
  args: {
    year: v.number(),
    quarter: v.number(), // 1-4
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const startMonth = (args.quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;

    const startDatum = `${args.year}-${String(startMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(args.year, endMonth, 0).getDate();
    const eindDatum = `${args.year}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const toewijzingen = await ctx.db
      .query("weekPlanning")
      .withIndex("by_datum")
      .filter((q) =>
        q.and(
          q.gte(q.field("datum"), startDatum),
          q.lte(q.field("datum"), eindDatum)
        )
      )
      .collect();

    const alleMedewerkers = await ctx.db
      .query("medewerkers")
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    const urenPerDag = 8;

    // Group by ISO week number
    const perWeek: Record<
      string,
      {
        weekNummer: number;
        startDatum: string;
        aantalTaken: number;
        geplandeUren: number;
        beschikbareUren: number;
        bezetting: number;
        medewerkers: Set<string>;
      }
    > = {};

    for (const t of toewijzingen) {
      const d = new Date(t.datum + "T00:00:00");
      // ISO week number calculation
      const tempDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = tempDate.getUTCDay() || 7;
      tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil(((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

      const weekKey = `${args.year}-W${weekNum}`;
      if (!perWeek[weekKey]) {
        // Calculate Monday of this week
        const monday = new Date(d);
        monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
        const beschikbaar = alleMedewerkers.length * urenPerDag * 5; // 5 werkdagen

        perWeek[weekKey] = {
          weekNummer: weekNum,
          startDatum: monday.toISOString().split("T")[0],
          aantalTaken: 0,
          geplandeUren: 0,
          beschikbareUren: beschikbaar,
          bezetting: 0,
          medewerkers: new Set(),
        };
      }

      perWeek[weekKey].aantalTaken += 1;
      perWeek[weekKey].geplandeUren += t.uren ?? urenPerDag;
      perWeek[weekKey].medewerkers.add(t.medewerkerId);
    }

    // Calculate bezetting and convert Set to count
    const result = Object.values(perWeek)
      .map((w) => ({
        weekNummer: w.weekNummer,
        startDatum: w.startDatum,
        aantalTaken: w.aantalTaken,
        geplandeUren: w.geplandeUren,
        beschikbareUren: w.beschikbareUren,
        bezetting:
          w.beschikbareUren > 0
            ? Math.round((w.geplandeUren / w.beschikbareUren) * 100)
            : 0,
        aantalMedewerkers: w.medewerkers.size,
      }))
      .sort((a, b) => a.weekNummer - b.weekNummer);

    return {
      weken: result,
      totaalMedewerkers: alleMedewerkers.length,
    };
  },
});

/**
 * Capacity overview for the year view.
 * Returns per-month: total planned hours, available capacity, utilization %.
 * Also returns per-medewerker hours per month.
 */
export const getCapacityOverview = query({
  args: {
    year: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    // Full year range
    const startDatum = `${args.year}-01-01`;
    const eindDatum = `${args.year}-12-31`;

    const toewijzingen = await ctx.db
      .query("weekPlanning")
      .withIndex("by_datum")
      .filter((q) =>
        q.and(
          q.gte(q.field("datum"), startDatum),
          q.lte(q.field("datum"), eindDatum)
        )
      )
      .collect();

    const alleMedewerkers = await ctx.db
      .query("medewerkers")
      .filter((q) => q.eq(q.field("isActief"), true))
      .collect();

    const urenPerDag = 8;

    // Calculate werkdagen per month (exclude weekends)
    function werkdagenInMaand(year: number, month: number): number {
      const lastDay = new Date(year, month, 0).getDate();
      let count = 0;
      for (let d = 1; d <= lastDay; d++) {
        const day = new Date(year, month - 1, d).getDay();
        if (day !== 0 && day !== 6) count++;
      }
      return count;
    }

    // Per month aggregation
    const perMaand: {
      maand: number;
      geplandeUren: number;
      beschikbareUren: number;
      bezetting: number;
      aantalProjecten: number;
      projectIds: Set<string>;
    }[] = [];

    // Per medewerker per month
    const perMedewerker: Record<
      string,
      { naam: string; urenPerMaand: number[] }
    > = {};

    for (const mw of alleMedewerkers) {
      perMedewerker[mw._id] = {
        naam: mw.naam,
        urenPerMaand: new Array(12).fill(0),
      };
    }

    for (let m = 1; m <= 12; m++) {
      const werkdagen = werkdagenInMaand(args.year, m);
      const beschikbaar = alleMedewerkers.length * urenPerDag * werkdagen;

      perMaand.push({
        maand: m,
        geplandeUren: 0,
        beschikbareUren: beschikbaar,
        bezetting: 0,
        aantalProjecten: 0,
        projectIds: new Set(),
      });
    }

    for (const t of toewijzingen) {
      const maand = parseInt(t.datum.substring(5, 7), 10);
      const idx = maand - 1;
      if (idx >= 0 && idx < 12) {
        perMaand[idx].geplandeUren += t.uren ?? urenPerDag;
        perMaand[idx].projectIds.add(t.projectId);

        // Per medewerker tracking
        if (perMedewerker[t.medewerkerId]) {
          perMedewerker[t.medewerkerId].urenPerMaand[idx] += t.uren ?? urenPerDag;
        }
      }
    }

    // Finalize
    const maanden = perMaand.map((m) => ({
      maand: m.maand,
      geplandeUren: m.geplandeUren,
      beschikbareUren: m.beschikbareUren,
      bezetting:
        m.beschikbareUren > 0
          ? Math.round((m.geplandeUren / m.beschikbareUren) * 100)
          : 0,
      aantalProjecten: m.projectIds.size,
    }));

    const medewerkers = Object.entries(perMedewerker).map(([id, data]) => ({
      medewerkerId: id,
      naam: data.naam,
      urenPerMaand: data.urenPerMaand,
    }));

    return {
      maanden,
      medewerkers,
      totaalMedewerkers: alleMedewerkers.length,
    };
  },
});
