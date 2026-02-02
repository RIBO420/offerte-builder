import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireAuth,
  requireAuthUserId,
  getOwnedOfferte,
  verifyOwnership,
} from "./auth";
import { internal } from "./_generated/api";

const klantValidator = v.object({
  naam: v.string(),
  adres: v.string(),
  postcode: v.string(),
  plaats: v.string(),
  email: v.optional(v.string()),
  telefoon: v.optional(v.string()),
});

const algemeenParamsValidator = v.object({
  bereikbaarheid: v.union(
    v.literal("goed"),
    v.literal("beperkt"),
    v.literal("slecht")
  ),
  achterstalligheid: v.optional(
    v.union(v.literal("laag"), v.literal("gemiddeld"), v.literal("hoog"))
  ),
});

const regelValidator = v.object({
  id: v.string(),
  scope: v.string(),
  omschrijving: v.string(),
  eenheid: v.string(),
  hoeveelheid: v.number(),
  prijsPerEenheid: v.number(),
  totaal: v.number(),
  type: v.union(v.literal("materiaal"), v.literal("arbeid"), v.literal("machine")),
  margePercentage: v.optional(v.number()), // Override marge per regel
});

const scopeMargesValidator = v.object({
  grondwerk: v.optional(v.number()),
  bestrating: v.optional(v.number()),
  borders: v.optional(v.number()),
  gras: v.optional(v.number()),
  houtwerk: v.optional(v.number()),
  water_elektra: v.optional(v.number()),
  specials: v.optional(v.number()),
  gras_onderhoud: v.optional(v.number()),
  borders_onderhoud: v.optional(v.number()),
  heggen: v.optional(v.number()),
  bomen: v.optional(v.number()),
  overig: v.optional(v.number()),
});

const totalenValidator = v.object({
  materiaalkosten: v.number(),
  arbeidskosten: v.number(),
  totaalUren: v.number(),
  subtotaal: v.number(),
  marge: v.number(),
  margePercentage: v.number(),
  totaalExBtw: v.number(),
  btw: v.number(),
  totaalInclBtw: v.number(),
});

// List all offertes for authenticated user
export const list = query({
  args: {
    includeArchived: v.optional(v.boolean()),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter out deleted offertes unless includeDeleted is true
    let filtered = offertes;
    if (!args.includeDeleted) {
      filtered = filtered.filter((o) => !o.deletedAt);
    }

    // Filter out archived offertes unless includeArchived is true
    if (!args.includeArchived) {
      filtered = filtered.filter((o) => !o.isArchived);
    }

    return filtered;
  },
});

// List offertes with pagination
export const listPaginated = query({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit || 25;

    const result = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate({ numItems: limit, cursor: args.cursor ?? null });

    return {
      offertes: result.page,
      nextCursor: result.continueCursor,
      hasMore: !result.isDone,
    };
  },
});

// Combined dashboard query - reduces round trips
export const getDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    // Get all offertes in one query
    const allOffertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter out archived and deleted offertes
    const offertes = allOffertes.filter((o) => !o.isArchived && !o.deletedAt);

    // Calculate stats
    const stats = {
      totaal: offertes.length,
      concept: 0,
      voorcalculatie: 0,
      verzonden: 0,
      geaccepteerd: 0,
      afgewezen: 0,
      totaalWaarde: 0,
      geaccepteerdWaarde: 0,
    };

    for (const offerte of offertes) {
      stats[offerte.status as keyof typeof stats]++;
      stats.totaalWaarde += offerte.totalen.totaalInclBtw;
      if (offerte.status === "geaccepteerd") {
        stats.geaccepteerdWaarde += offerte.totalen.totaalInclBtw;
      }
    }

    // Get recent 5
    const recent = offertes.slice(0, 5);

    return {
      stats,
      recent,
      // For backwards compatibility, also include a limited list
      offertes: offertes.slice(0, 50),
    };
  },
});

// Comprehensive dashboard query - batches ALL dashboard data in a single round-trip
// Combines: offerte stats, revenue stats, accepted without project, project stats,
// active projects, facturen stats, and recent facturen
export const getFullDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Batch fetch all data in parallel using Promise.all
    const [allOffertes, allProjects, allFacturen] = await Promise.all([
      ctx.db
        .query("offertes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("projecten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("facturen")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
    ]);

    // Filter out archived and deleted items
    const offertes = allOffertes.filter((o) => !o.isArchived && !o.deletedAt);
    const projects = allProjects.filter((p) => !p.isArchived && !p.deletedAt);

    // === OFFERTE STATS ===
    const offerteStats = {
      totaal: offertes.length,
      concept: 0,
      voorcalculatie: 0,
      verzonden: 0,
      geaccepteerd: 0,
      afgewezen: 0,
      totaalWaarde: 0,
      geaccepteerdWaarde: 0,
    };

    // === REVENUE STATS (calculated from offertes) ===
    let totalAcceptedValue = 0;
    let totalAcceptedCount = 0;
    let totalSentCount = 0;
    const geaccepteerdeOfferteIds: string[] = [];

    for (const offerte of offertes) {
      offerteStats[offerte.status as keyof typeof offerteStats]++;
      offerteStats.totaalWaarde += offerte.totalen.totaalInclBtw;

      if (offerte.status === "geaccepteerd") {
        offerteStats.geaccepteerdWaarde += offerte.totalen.totaalInclBtw;
        totalAcceptedValue += offerte.totalen.totaalInclBtw;
        totalAcceptedCount++;
        geaccepteerdeOfferteIds.push(offerte._id.toString());
      }

      if (
        offerte.status === "verzonden" ||
        offerte.status === "geaccepteerd" ||
        offerte.status === "afgewezen"
      ) {
        totalSentCount++;
      }
    }

    const conversionRate =
      totalSentCount > 0
        ? Math.round((totalAcceptedCount / totalSentCount) * 100)
        : 0;
    const averageOfferteValue =
      totalAcceptedCount > 0
        ? Math.round(totalAcceptedValue / totalAcceptedCount)
        : 0;

    const revenueStats = {
      totalAcceptedValue,
      totalAcceptedCount,
      conversionRate,
      averageOfferteValue,
    };

    // === ACCEPTED OFFERTES WITHOUT PROJECT ===
    const offertesWithProject = new Set(
      projects.map((p) => p.offerteId.toString())
    );
    const geaccepteerdeOffertes = offertes.filter(
      (o) => o.status === "geaccepteerd"
    );
    const acceptedWithoutProject = geaccepteerdeOffertes
      .filter((o) => !offertesWithProject.has(o._id.toString()))
      .slice(0, 5)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        klantNaam: o.klant.naam,
        totaal: o.totalen.totaalInclBtw,
        datum: o.createdAt,
      }));

    // === PROJECT STATS ===
    const projectStats = {
      totaal: projects.length,
      gepland: 0,
      in_uitvoering: 0,
      afgerond: 0,
      nacalculatie_compleet: 0,
      gefactureerd: 0,
    };

    for (const project of projects) {
      if (project.status in projectStats) {
        projectStats[project.status as keyof typeof projectStats]++;
      }
    }

    // === ACTIVE PROJECTS WITH PROGRESS ===
    const activeProjectsRaw = projects
      .filter((p) => p.status === "in_uitvoering")
      .slice(0, 5);

    // OPTIMIZED: Batch fetch all related data using Promise.all instead of N+1 queries
    // 1. Build lookup map from offertes we already have
    const offerteMap = new Map(offertes.map((o) => [o._id.toString(), o]));

    // 2. Batch fetch voorcalculaties and urenRegistraties for each project in parallel
    // Since these tables don't have a by_user index, we fetch per-project but in parallel
    const projectIds = activeProjectsRaw.map((p) => p._id);
    const offerteIdsForProjects = activeProjectsRaw.map((p) => p.offerteId);

    // Fetch all voorcalculaties and urenRegistraties in parallel batches
    const [voorcalculatiesByProject, voorcalculatiesByOfferte, urenByProject] = await Promise.all([
      // Batch 1: Fetch voorcalculaties by project IDs
      Promise.all(
        projectIds.map((projectId) =>
          ctx.db
            .query("voorcalculaties")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .unique()
        )
      ),
      // Batch 2: Fetch voorcalculaties by offerte IDs (fallback)
      Promise.all(
        offerteIdsForProjects.map((offerteId) =>
          ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", offerteId))
            .unique()
        )
      ),
      // Batch 3: Fetch urenRegistraties by project IDs
      Promise.all(
        projectIds.map((projectId) =>
          ctx.db
            .query("urenRegistraties")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .collect()
        )
      ),
    ]);

    // Now process active projects with in-memory lookups (no additional queries)
    const activeProjects = activeProjectsRaw.map((project, index) => {
      // Get offerte for klant naam from our existing map
      const offerte = offerteMap.get(project.offerteId.toString());
      const klantNaam = offerte?.klant?.naam || "Onbekende klant";

      // Get voorcalculatie (check project-level first, then offerte-level)
      const voorcalculatie = voorcalculatiesByProject[index] || voorcalculatiesByOfferte[index];
      const begroteUren = voorcalculatie?.normUrenTotaal || 0;

      // Get uren registraties for totaal uren
      const urenRegistraties = urenByProject[index] || [];
      const totaalUren = urenRegistraties.reduce((sum, u) => sum + u.uren, 0);

      // Calculate voortgang percentage (0-100)
      let voortgang = 0;
      if (begroteUren > 0) {
        voortgang = Math.min(100, Math.round((totaalUren / begroteUren) * 100));
      }

      return {
        _id: project._id,
        naam: project.naam,
        status: project.status,
        voortgang,
        totaalUren: Math.round(totaalUren * 10) / 10,
        begroteUren: Math.round(begroteUren * 10) / 10,
        klantNaam,
      };
    });

    // === FACTUREN STATS ===
    let conceptCount = 0;
    let definitiefCount = 0;
    let verzondenCount = 0;
    let betaaldCount = 0;
    let vervallenCount = 0;
    let totaalBedrag = 0;
    let openstaandBedrag = 0;
    let betaaldBedrag = 0;

    for (const factuur of allFacturen) {
      switch (factuur.status) {
        case "concept":
          conceptCount++;
          break;
        case "definitief":
          definitiefCount++;
          break;
        case "verzonden":
          verzondenCount++;
          openstaandBedrag += factuur.totaalInclBtw;
          break;
        case "betaald":
          betaaldCount++;
          betaaldBedrag += factuur.totaalInclBtw;
          break;
        case "vervallen":
          vervallenCount++;
          break;
      }
      totaalBedrag += factuur.totaalInclBtw;
    }

    const facturenStats = {
      totaal: allFacturen.length,
      totaalBedrag,
      openstaandBedrag,
      betaaldBedrag,
      concept: conceptCount,
      definitief: definitiefCount,
      verzonden: verzondenCount,
      betaald: betaaldCount,
      vervallen: vervallenCount,
    };

    // === RECENT FACTUREN ===
    const recentFacturen = allFacturen.slice(0, 5).map((factuur) => ({
      _id: factuur._id,
      factuurnummer: factuur.factuurnummer,
      klantNaam: factuur.klant.naam,
      totaalInclBtw: factuur.totaalInclBtw,
      status: factuur.status,
      factuurdatum: factuur.factuurdatum,
      vervaldatum: factuur.vervaldatum,
    }));

    return {
      // Offerte data
      offerteStats,
      recentOffertes: offertes.slice(0, 5),
      // Revenue stats (derived from offertes)
      revenueStats,
      // Action required items
      acceptedWithoutProject,
      // Project data
      projectStats,
      activeProjects,
      // Facturen data
      facturenStats,
      recentFacturen,
    };
  },
});

// List offertes by status
export const listByStatus = query({
  args: {
    status: v.union(
      v.literal("concept"),
      v.literal("voorcalculatie"),
      v.literal("verzonden"),
      v.literal("geaccepteerd"),
      v.literal("afgewezen")
    ),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter by status, exclude archived unless specified, and exclude deleted
    return offertes.filter((o) =>
      o.status === args.status &&
      (args.includeArchived || !o.isArchived) &&
      !o.deletedAt
    );
  },
});

// Get single offerte (with ownership verification)
export const get = query({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    const offerte = await ctx.db.get(args.id);
    if (!offerte) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (offerte.userId.toString() !== user._id.toString()) {
      return null; // Don't reveal existence to unauthorized users
    }

    return offerte;
  },
});

// Get single offerte with voorcalculatie data joined
export const getWithVoorcalculatie = query({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    const offerte = await ctx.db.get(args.id);
    if (!offerte) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (offerte.userId.toString() !== user._id.toString()) {
      return null; // Don't reveal existence to unauthorized users
    }

    // Get the voorcalculatie for this offerte
    const voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
      .first();

    return {
      ...offerte,
      voorcalculatie: voorcalculatie || null,
    };
  },
});

// Get offerte by nummer
export const getByNummer = query({
  args: { offerteNummer: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("offertes")
      .withIndex("by_nummer", (q) => q.eq("offerteNummer", args.offerteNummer))
      .unique();
  },
});

// Create new offerte
export const create = mutation({
  args: {
    type: v.union(v.literal("aanleg"), v.literal("onderhoud")),
    offerteNummer: v.string(),
    klant: klantValidator,
    algemeenParams: algemeenParamsValidator,
    scopes: v.optional(v.array(v.string())),
    scopeData: v.optional(v.any()),
    notities: v.optional(v.string()),
    klantId: v.optional(v.id("klanten")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    const offerteId = await ctx.db.insert("offertes", {
      userId,
      type: args.type,
      status: "concept",
      offerteNummer: args.offerteNummer,
      klant: args.klant,
      klantId: args.klantId,
      algemeenParams: args.algemeenParams,
      scopes: args.scopes,
      scopeData: args.scopeData,
      totalen: {
        materiaalkosten: 0,
        arbeidskosten: 0,
        totaalUren: 0,
        subtotaal: 0,
        marge: 0,
        margePercentage: 0,
        totaalExBtw: 0,
        btw: 0,
        totaalInclBtw: 0,
      },
      regels: [],
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });

    // Create initial version
    const offerte = await ctx.db.get(offerteId);
    if (offerte) {
      await ctx.db.insert("offerte_versions", {
        offerteId,
        userId,
        versieNummer: 1,
        snapshot: {
          status: offerte.status,
          klant: offerte.klant,
          algemeenParams: {
            bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
            achterstalligheid: offerte.algemeenParams.achterstalligheid,
          },
          scopes: offerte.scopes,
          scopeData: offerte.scopeData,
          totalen: offerte.totalen,
          regels: [],
          notities: offerte.notities,
        },
        actie: "aangemaakt",
        omschrijving: `Offerte ${args.offerteNummer} aangemaakt`,
        createdAt: now,
      });

      // Trigger notification for new offerte creation (optional - only if enabled in preferences)
      await ctx.scheduler.runAfter(0, internal.notifications.notifyOfferteCreated, {
        offerteId,
        createdByUserId: userId,
      });
    }

    return offerteId;
  },
});

// Update offerte basic info
export const update = mutation({
  args: {
    id: v.id("offertes"),
    klant: v.optional(klantValidator),
    algemeenParams: v.optional(algemeenParamsValidator),
    scopes: v.optional(v.array(v.string())),
    scopeData: v.optional(v.any()),
    notities: v.optional(v.string()),
    createVersion: v.optional(v.boolean()), // Optional: skip version for auto-save
  },
  handler: async (ctx, args) => {
    // Verify ownership before updating
    await getOwnedOfferte(ctx, args.id);

    const { id, createVersion: shouldCreateVersion = true, ...updates } = args;
    const now = Date.now();
    const filteredUpdates: Record<string, unknown> = { updatedAt: now };

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, filteredUpdates);

    // Create version snapshot if enabled (default: true)
    if (shouldCreateVersion) {
      const offerte = await ctx.db.get(id);
      if (offerte) {
        // Get next version number
        const versions = await ctx.db
          .query("offerte_versions")
          .withIndex("by_offerte", (q) => q.eq("offerteId", id))
          .order("desc")
          .take(1);

        const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

        await ctx.db.insert("offerte_versions", {
          offerteId: id,
          userId: offerte.userId,
          versieNummer,
          snapshot: {
            status: offerte.status,
            klant: offerte.klant,
            algemeenParams: {
              bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
              achterstalligheid: offerte.algemeenParams.achterstalligheid,
            },
            scopes: offerte.scopes,
            scopeData: offerte.scopeData,
            totalen: offerte.totalen,
            regels: offerte.regels.map((r) => ({
              id: r.id,
              scope: r.scope,
              omschrijving: r.omschrijving,
              eenheid: r.eenheid,
              hoeveelheid: r.hoeveelheid,
              prijsPerEenheid: r.prijsPerEenheid,
              totaal: r.totaal,
              type: r.type,
            })),
            notities: offerte.notities,
          },
          actie: "gewijzigd",
          omschrijving: "Offerte gegevens gewijzigd",
          createdAt: now,
        });
      }
    }

    return id;
  },
});

// Update offerte regels and recalculate totals
export const updateRegels = mutation({
  args: {
    id: v.id("offertes"),
    regels: v.array(regelValidator),
    margePercentage: v.number(), // Standaard marge
    scopeMarges: v.optional(scopeMargesValidator), // Per-scope marges
    btwPercentage: v.number(),
    uurtarief: v.number(),
    createVersion: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify ownership before updating
    await getOwnedOfferte(ctx, args.id);

    const now = Date.now();
    const shouldCreateVersion = args.createVersion ?? true;

    // Helper functie om effectieve marge te bepalen per regel
    const getEffectiveMargePercentage = (regel: typeof args.regels[0]): number => {
      // Prioriteit: 1) regel.margePercentage, 2) scopeMarges[scope], 3) standaardMarge
      if (regel.margePercentage !== undefined && regel.margePercentage !== null) {
        return regel.margePercentage;
      }
      if (args.scopeMarges) {
        const scopeMarge = args.scopeMarges[regel.scope as keyof typeof args.scopeMarges];
        if (scopeMarge !== undefined && scopeMarge !== null) {
          return scopeMarge;
        }
      }
      return args.margePercentage;
    };

    // Calculate totals with per-regel margins
    let materiaalkosten = 0;
    let arbeidskosten = 0;
    let totaalUren = 0;
    let totaleMarge = 0;

    for (const regel of args.regels) {
      const effectieveMarge = getEffectiveMargePercentage(regel);
      const regelMarge = regel.totaal * (effectieveMarge / 100);
      totaleMarge += regelMarge;

      if (regel.type === "materiaal") {
        materiaalkosten += regel.totaal;
      } else if (regel.type === "arbeid") {
        arbeidskosten += regel.totaal;
        totaalUren += regel.hoeveelheid;
      } else if (regel.type === "machine") {
        // Machine costs go to arbeidskosten
        arbeidskosten += regel.totaal;
      }
    }

    const subtotaal = materiaalkosten + arbeidskosten;
    // Gebruik de berekende totale marge i.p.v. simpele percentage berekening
    const marge = totaleMarge;
    // Bereken effectief gemiddeld marge percentage voor weergave
    const effectiefMargePercentage = subtotaal > 0 ? (marge / subtotaal) * 100 : args.margePercentage;
    const totaalExBtw = subtotaal + marge;
    const btw = totaalExBtw * (args.btwPercentage / 100);
    const totaalInclBtw = totaalExBtw + btw;

    const newTotalen = {
      materiaalkosten,
      arbeidskosten,
      totaalUren,
      subtotaal,
      marge,
      margePercentage: Math.round(effectiefMargePercentage * 100) / 100, // Afgerond op 2 decimalen
      totaalExBtw,
      btw,
      totaalInclBtw,
    };

    await ctx.db.patch(args.id, {
      regels: args.regels,
      totalen: newTotalen,
      updatedAt: now,
    });

    // Create version snapshot if enabled
    if (shouldCreateVersion) {
      const offerte = await ctx.db.get(args.id);
      if (offerte) {
        const versions = await ctx.db
          .query("offerte_versions")
          .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
          .order("desc")
          .take(1);

        const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

        await ctx.db.insert("offerte_versions", {
          offerteId: args.id,
          userId: offerte.userId,
          versieNummer,
          snapshot: {
            status: offerte.status,
            klant: offerte.klant,
            algemeenParams: {
              bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
              achterstalligheid: offerte.algemeenParams.achterstalligheid,
            },
            scopes: offerte.scopes,
            scopeData: offerte.scopeData,
            totalen: newTotalen,
            regels: args.regels.map((r) => ({
              id: r.id,
              scope: r.scope,
              omschrijving: r.omschrijving,
              eenheid: r.eenheid,
              hoeveelheid: r.hoeveelheid,
              prijsPerEenheid: r.prijsPerEenheid,
              totaal: r.totaal,
              type: r.type,
              margePercentage: r.margePercentage,
            })),
            notities: offerte.notities,
          },
          actie: "regels_gewijzigd",
          omschrijving: `Regels gewijzigd (${args.regels.length} regels)`,
          createdAt: now,
        });
      }
    }

    return args.id;
  },
});

// Update status
// Workflow: concept → voorcalculatie → verzonden → geaccepteerd/afgewezen
export const updateStatus = mutation({
  args: {
    id: v.id("offertes"),
    status: v.union(
      v.literal("concept"),
      v.literal("voorcalculatie"),
      v.literal("verzonden"),
      v.literal("geaccepteerd"),
      v.literal("afgewezen")
    ),
  },
  handler: async (ctx, args) => {
    // Verify ownership before updating (also retrieves the offerte)
    const oldOfferte = await getOwnedOfferte(ctx, args.id);
    const now = Date.now();
    const oldStatus = oldOfferte.status;

    // Validate status workflow
    // concept → voorcalculatie → verzonden → geaccepteerd/afgewezen
    const validTransitions: Record<string, string[]> = {
      concept: ["voorcalculatie"],
      voorcalculatie: ["concept", "verzonden"],
      verzonden: ["voorcalculatie", "geaccepteerd", "afgewezen"],
      geaccepteerd: ["verzonden"],
      afgewezen: ["verzonden"],
    };

    if (!validTransitions[oldStatus]?.includes(args.status)) {
      throw new Error(
        `Ongeldige statuswijziging: ${oldStatus} → ${args.status}`
      );
    }

    // When changing to "verzonden", check that a voorcalculatie exists
    if (args.status === "verzonden") {
      const voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
        .first();

      if (!voorcalculatie) {
        throw new Error(
          "Voorcalculatie moet eerst worden ingevuld voordat de offerte kan worden verzonden"
        );
      }
    }

    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.status === "verzonden") {
      updates.verzondenAt = now;
    }

    // Reset customerResponse when status changes away from geaccepteerd/afgewezen
    // This ensures the customer portal shows the correct status
    if (
      (oldOfferte.customerResponse?.status === "geaccepteerd" ||
        oldOfferte.customerResponse?.status === "afgewezen") &&
      args.status !== "geaccepteerd" &&
      args.status !== "afgewezen"
    ) {
      // Keep the view history but reset the response status to "bekeken"
      updates.customerResponse = oldOfferte.customerResponse
        ? {
            status: "bekeken",
            viewedAt: oldOfferte.customerResponse.viewedAt,
            respondedAt: now,
            // Clear signature when resetting
          }
        : undefined;
    }

    await ctx.db.patch(args.id, updates);

    // Create version snapshot for status change
    const offerte = await ctx.db.get(args.id);
    if (offerte) {
      const versions = await ctx.db
        .query("offerte_versions")
        .withIndex("by_offerte", (q) => q.eq("offerteId", args.id))
        .order("desc")
        .take(1);

      const versieNummer = (versions[0]?.versieNummer ?? 0) + 1;

      const statusLabels: Record<string, string> = {
        concept: "Concept",
        voorcalculatie: "Voorcalculatie",
        verzonden: "Verzonden",
        geaccepteerd: "Geaccepteerd",
        afgewezen: "Afgewezen",
      };

      await ctx.db.insert("offerte_versions", {
        offerteId: args.id,
        userId: offerte.userId,
        versieNummer,
        snapshot: {
          status: offerte.status,
          klant: offerte.klant,
          algemeenParams: {
            bereikbaarheid: offerte.algemeenParams.bereikbaarheid,
            achterstalligheid: offerte.algemeenParams.achterstalligheid,
          },
          scopes: offerte.scopes,
          scopeData: offerte.scopeData,
          totalen: offerte.totalen,
          regels: offerte.regels.map((r) => ({
            id: r.id,
            scope: r.scope,
            omschrijving: r.omschrijving,
            eenheid: r.eenheid,
            hoeveelheid: r.hoeveelheid,
            prijsPerEenheid: r.prijsPerEenheid,
            totaal: r.totaal,
            type: r.type,
          })),
          notities: offerte.notities,
        },
        actie: "status_gewijzigd",
        omschrijving: `Status gewijzigd: ${statusLabels[oldStatus]} → ${statusLabels[args.status]}`,
        createdAt: now,
      });

      // Trigger notification for status change (verzonden, geaccepteerd, afgewezen)
      if (args.status === "verzonden" || args.status === "geaccepteerd" || args.status === "afgewezen") {
        await ctx.scheduler.runAfter(0, internal.notifications.notifyOfferteStatusChange, {
          offerteId: args.id,
          newStatus: args.status,
          triggeredBy: offerte.userId.toString(),
        });
      }
    }

    return args.id;
  },
});

// Soft delete offerte (sets deletedAt timestamp)
// Items can be restored within 30 days, after which they are permanently deleted
export const remove = mutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify ownership before deleting
    await getOwnedOfferte(ctx, args.id);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

// Restore a soft-deleted offerte
export const restore = mutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify ownership before restoring
    const offerte = await getOwnedOfferte(ctx, args.id);

    // Check if actually deleted
    if (!offerte.deletedAt) {
      throw new Error("Deze offerte is niet verwijderd");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      deletedAt: undefined,
      updatedAt: now,
    });

    return args.id;
  },
});

// Permanently delete offerte (hard delete)
// Used by cleanup function or manual permanent deletion
export const permanentlyDelete = mutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify ownership before deleting
    await getOwnedOfferte(ctx, args.id);
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Archive offerte
export const archive = mutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify ownership before archiving
    await getOwnedOfferte(ctx, args.id);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

// Duplicate offerte
export const duplicate = mutation({
  args: {
    id: v.id("offertes"),
    newOfferteNummer: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ownership before duplicating
    const original = await getOwnedOfferte(ctx, args.id);
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    return await ctx.db.insert("offertes", {
      userId,
      type: original.type,
      status: "concept",
      offerteNummer: args.newOfferteNummer,
      klant: original.klant,
      algemeenParams: original.algemeenParams,
      scopes: original.scopes,
      scopeData: original.scopeData,
      totalen: original.totalen,
      regels: original.regels,
      notities: original.notities
        ? `Kopie van ${original.offerteNummer}\n\n${original.notities}`
        : `Kopie van ${original.offerteNummer}`,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Get stats for dashboard
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const stats = {
      totaal: offertes.length,
      concept: 0,
      voorcalculatie: 0,
      verzonden: 0,
      geaccepteerd: 0,
      afgewezen: 0,
      totaalWaarde: 0,
      geaccepteerdWaarde: 0,
    };

    for (const offerte of offertes) {
      stats[offerte.status as keyof typeof stats]++;
      stats.totaalWaarde += offerte.totalen.totaalInclBtw;
      if (offerte.status === "geaccepteerd") {
        stats.geaccepteerdWaarde += offerte.totalen.totaalInclBtw;
      }
    }

    return stats;
  },
});

// Get revenue statistics for dashboard
export const getRevenueStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let totalAcceptedValue = 0;
    let totalAcceptedCount = 0;
    let totalSentCount = 0; // verzonden + geaccepteerd + afgewezen

    for (const offerte of offertes) {
      if (offerte.status === "geaccepteerd") {
        totalAcceptedValue += offerte.totalen.totaalInclBtw;
        totalAcceptedCount++;
      }
      // Count all offertes that have been sent (includes accepted and rejected)
      if (
        offerte.status === "verzonden" ||
        offerte.status === "geaccepteerd" ||
        offerte.status === "afgewezen"
      ) {
        totalSentCount++;
      }
    }

    // Calculate conversion rate (accepted / total sent)
    const conversionRate =
      totalSentCount > 0
        ? Math.round((totalAcceptedCount / totalSentCount) * 100)
        : 0;

    // Calculate average offerte value (of accepted offertes)
    const averageOfferteValue =
      totalAcceptedCount > 0
        ? Math.round(totalAcceptedValue / totalAcceptedCount)
        : 0;

    return {
      totalAcceptedValue,
      totalAcceptedCount,
      conversionRate,
      averageOfferteValue,
    };
  },
});

// Get recent offertes
export const getRecent = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit || 5;

    return await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

// Bulk update status
// Note: Bulk update skips workflow validation for admin convenience
// but still requires voorcalculatie for verzonden status
export const bulkUpdateStatus = mutation({
  args: {
    ids: v.array(v.id("offertes")),
    status: v.union(
      v.literal("concept"),
      v.literal("voorcalculatie"),
      v.literal("verzonden"),
      v.literal("geaccepteerd"),
      v.literal("afgewezen")
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const id of args.ids) {
      // Verify ownership for each offerte
      await getOwnedOfferte(ctx, id);

      // When changing to "verzonden", check that a voorcalculatie exists
      if (args.status === "verzonden") {
        const voorcalculatie = await ctx.db
          .query("voorcalculaties")
          .withIndex("by_offerte", (q) => q.eq("offerteId", id))
          .first();

        if (!voorcalculatie) {
          throw new Error(
            "Voorcalculatie moet eerst worden ingevuld voordat de offerte kan worden verzonden"
          );
        }
      }

      const updates: Record<string, unknown> = {
        status: args.status,
        updatedAt: now,
      };

      if (args.status === "verzonden") {
        updates.verzondenAt = now;
      }

      await ctx.db.patch(id, updates);
    }

    return args.ids.length;
  },
});

// Bulk soft delete offertes
export const bulkRemove = mutation({
  args: {
    ids: v.array(v.id("offertes")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      // Verify ownership for each offerte
      await getOwnedOfferte(ctx, id);
      await ctx.db.patch(id, {
        deletedAt: now,
        updatedAt: now,
      });
    }
    return args.ids.length;
  },
});

// Bulk restore soft-deleted offertes
export const bulkRestore = mutation({
  args: {
    ids: v.array(v.id("offertes")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const id of args.ids) {
      // Verify ownership for each offerte
      await getOwnedOfferte(ctx, id);
      await ctx.db.patch(id, {
        deletedAt: undefined,
        updatedAt: now,
      });
    }
    return args.ids.length;
  },
});

// Get accepted offertes without a project (action required)
export const getAcceptedOffertesWithoutProject = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Get all accepted offertes for this user
    const acceptedOffertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter to only accepted offertes
    const geaccepteerdeOffertes = acceptedOffertes.filter(
      (o) => o.status === "geaccepteerd"
    );

    if (geaccepteerdeOffertes.length === 0) {
      return [];
    }

    // Get all projects for this user to check which offertes already have a project
    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Create a Set of offerteIds that have a project
    const offertesWithProject = new Set(
      projects.map((p) => p.offerteId.toString())
    );

    // Filter offertes that don't have a project yet
    const offertesWithoutProject = geaccepteerdeOffertes.filter(
      (o) => !offertesWithProject.has(o._id.toString())
    );

    // Return max 5 items with required fields, sorted by createdAt desc
    return offertesWithoutProject
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        klantNaam: o.klant.naam,
        totaal: o.totalen.totaalInclBtw,
        datum: o.createdAt,
      }));
  },
});
