import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireAuth,
  requireAuthUserId,
  getOwnedOfferte,
  verifyOwnership,
} from "./auth";

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
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    return await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
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
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

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
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return offertes.filter((o) => o.status === args.status);
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
    }

    return args.id;
  },
});

// Delete offerte
export const remove = mutation({
  args: { id: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify ownership before deleting
    await getOwnedOfferte(ctx, args.id);
    await ctx.db.delete(args.id);
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

// Bulk delete offertes
export const bulkRemove = mutation({
  args: {
    ids: v.array(v.id("offertes")),
  },
  handler: async (ctx, args) => {
    for (const id of args.ids) {
      // Verify ownership for each offerte
      await getOwnedOfferte(ctx, id);
      await ctx.db.delete(id);
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
