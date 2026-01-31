/**
 * Leerfeedback Functions - Learning Feedback module
 *
 * Provides functions for analyzing nacalculatie patterns and suggesting
 * normuur adjustments. IMPORTANT: No automatic optimization - all adjustments
 * require explicit user action for transparency and auditability.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId } from "./auth";
import { Id } from "./_generated/dataModel";

// Minimum number of projects required for a reliable suggestion
const MIN_PROJECTS_FOR_SUGGESTION = 3;

// Threshold for deviation to trigger a suggestion (percentage)
const DEVIATION_THRESHOLD = 10;

// Confidence levels based on sample size
const getConfidenceLevel = (sampleSize: number): "laag" | "gemiddeld" | "hoog" => {
  if (sampleSize >= 10) return "hoog";
  if (sampleSize >= 5) return "gemiddeld";
  return "laag";
};

/**
 * Get suggestions for normuur adjustments based on nacalculatie data.
 * Analyzes multiple projects to find patterns of consistent under/over-estimation.
 */
export const getSuggesties = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Get all normuren for user
    const normuren = await ctx.db
      .query("normuren")
      .withIndex("by_user_scope", (q) => q.eq("userId", userId))
      .collect();

    // Get all projects for user
    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get nacalculaties for all projects
    const nacalculatieData: Array<{
      projectId: Id<"projecten">;
      projectNaam: string;
      afwijkingenPerScope: Record<string, number>;
      geplandeUrenPerScope: Record<string, number>;
    }> = [];

    for (const project of projects) {
      const nacalculatie = await ctx.db
        .query("nacalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .unique();

      const voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .unique();

      if (nacalculatie && voorcalculatie) {
        nacalculatieData.push({
          projectId: project._id,
          projectNaam: project.naam,
          afwijkingenPerScope: nacalculatie.afwijkingenPerScope,
          geplandeUrenPerScope: voorcalculatie.normUrenPerScope,
        });
      }
    }

    // Analyze deviations per scope
    const scopeAnalysis: Record<
      string,
      {
        totalAfwijking: number;
        totalGepland: number;
        count: number;
        projectIds: Id<"projecten">[];
      }
    > = {};

    for (const data of nacalculatieData) {
      for (const [scope, afwijking] of Object.entries(data.afwijkingenPerScope)) {
        if (!scopeAnalysis[scope]) {
          scopeAnalysis[scope] = {
            totalAfwijking: 0,
            totalGepland: 0,
            count: 0,
            projectIds: [],
          };
        }

        const gepland = data.geplandeUrenPerScope[scope] || 0;
        scopeAnalysis[scope].totalAfwijking += afwijking;
        scopeAnalysis[scope].totalGepland += gepland;
        scopeAnalysis[scope].count++;
        scopeAnalysis[scope].projectIds.push(data.projectId);
      }
    }

    // Generate suggestions
    const suggesties: Array<{
      id: string;
      scope: string;
      activiteiten: Array<{
        normuurId: Id<"normuren">;
        activiteit: string;
        huidigeWaarde: number;
        gesuggereerdeWaarde: number;
        wijzigingPercentage: number;
        eenheid: string;
      }>;
      gemiddeldeAfwijking: number;
      gemiddeldeAfwijkingPercentage: number;
      aantalProjecten: number;
      betrouwbaarheid: "laag" | "gemiddeld" | "hoog";
      bronProjecten: Id<"projecten">[];
      reden: string;
      type: "onderschatting" | "overschatting";
    }> = [];

    for (const [scope, analysis] of Object.entries(scopeAnalysis)) {
      // Only suggest if we have enough data points
      if (analysis.count < MIN_PROJECTS_FOR_SUGGESTION) continue;

      const gemiddeldeAfwijking = analysis.totalAfwijking / analysis.count;
      const gemiddeldeAfwijkingPercentage =
        analysis.totalGepland > 0
          ? (analysis.totalAfwijking / analysis.totalGepland) * 100
          : 0;

      // Only suggest if deviation exceeds threshold
      if (Math.abs(gemiddeldeAfwijkingPercentage) < DEVIATION_THRESHOLD) continue;

      // Find normuren for this scope
      const scopeNormuren = normuren.filter((n) => n.scope === scope);
      if (scopeNormuren.length === 0) continue;

      // Calculate suggested adjustment factor
      // If actual > planned (positive deviation), we need to increase normuren
      // If actual < planned (negative deviation), we need to decrease normuren
      const adjustmentFactor = 1 + gemiddeldeAfwijkingPercentage / 100;

      const activiteiten = scopeNormuren.map((normuur) => {
        const gesuggereerdeWaarde =
          Math.round(normuur.normuurPerEenheid * adjustmentFactor * 1000) / 1000;
        const wijzigingPercentage =
          Math.round(
            ((gesuggereerdeWaarde - normuur.normuurPerEenheid) /
              normuur.normuurPerEenheid) *
              100 *
              10
          ) / 10;

        return {
          normuurId: normuur._id,
          activiteit: normuur.activiteit,
          huidigeWaarde: normuur.normuurPerEenheid,
          gesuggereerdeWaarde,
          wijzigingPercentage,
          eenheid: normuur.eenheid,
        };
      });

      const direction = gemiddeldeAfwijkingPercentage > 0 ? "onderschatting" : "overschatting";
      const reden = `Gemiddelde ${direction} van ${Math.abs(Math.round(gemiddeldeAfwijkingPercentage))}% over ${analysis.count} projecten`;

      suggesties.push({
        id: `suggestie_${scope}_${Date.now()}`,
        scope,
        activiteiten,
        gemiddeldeAfwijking: Math.round(gemiddeldeAfwijking * 100) / 100,
        gemiddeldeAfwijkingPercentage:
          Math.round(gemiddeldeAfwijkingPercentage * 10) / 10,
        aantalProjecten: analysis.count,
        betrouwbaarheid: getConfidenceLevel(analysis.count),
        bronProjecten: analysis.projectIds,
        reden,
        type: direction as "onderschatting" | "overschatting",
      });
    }

    // Sort by absolute deviation (most significant first)
    suggesties.sort(
      (a, b) =>
        Math.abs(b.gemiddeldeAfwijkingPercentage) -
        Math.abs(a.gemiddeldeAfwijkingPercentage)
    );

    return {
      suggesties,
      totaalAnalyseerdeProjecten: nacalculatieData.length,
      minimumVoorSuggestie: MIN_PROJECTS_FOR_SUGGESTION,
      drempelPercentage: DEVIATION_THRESHOLD,
    };
  },
});

/**
 * Apply a suggested normuur adjustment.
 * Updates the normuur and logs the change in leerfeedback_historie.
 * REQUIRES explicit user action - no automatic application.
 */
export const applyAanpassing = mutation({
  args: {
    normuurId: v.id("normuren"),
    nieuweWaarde: v.number(),
    reden: v.string(),
    bronProjecten: v.array(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    // Get the normuur and verify ownership
    const normuur = await ctx.db.get(args.normuurId);
    if (!normuur) {
      throw new Error("Normuur niet gevonden");
    }
    if (normuur.userId.toString() !== user._id.toString()) {
      throw new Error("Geen toegang tot deze normuur");
    }

    const oudeWaarde = normuur.normuurPerEenheid;
    const wijzigingPercentage =
      Math.round(((args.nieuweWaarde - oudeWaarde) / oudeWaarde) * 100 * 10) / 10;

    // Log the change in historie
    await ctx.db.insert("leerfeedback_historie", {
      userId: user._id,
      normuurId: args.normuurId,
      scope: normuur.scope,
      activiteit: normuur.activiteit,
      oudeWaarde,
      nieuweWaarde: args.nieuweWaarde,
      wijzigingPercentage,
      reden: args.reden,
      bronProjecten: args.bronProjecten,
      toegepastDoor: user.name || user.email,
      createdAt: now,
    });

    // Update the normuur
    await ctx.db.patch(args.normuurId, {
      normuurPerEenheid: args.nieuweWaarde,
    });

    return {
      success: true,
      normuurId: args.normuurId,
      oudeWaarde,
      nieuweWaarde: args.nieuweWaarde,
      wijzigingPercentage,
    };
  },
});

/**
 * Get history of normuur adjustments.
 */
export const getHistorie = query({
  args: {
    scope: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    let history;
    if (args.scope) {
      history = await ctx.db
        .query("leerfeedback_historie")
        .withIndex("by_scope", (q) => q.eq("scope", args.scope!))
        .order("desc")
        .collect();

      // Filter by user
      history = history.filter((h) => h.userId.toString() === userId.toString());
    } else {
      history = await ctx.db
        .query("leerfeedback_historie")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    // Apply limit if specified
    if (args.limit && args.limit > 0) {
      history = history.slice(0, args.limit);
    }

    return history;
  },
});

/**
 * Get history for a specific normuur.
 */
export const getHistorieByNormuur = query({
  args: { normuurId: v.id("normuren") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const history = await ctx.db
      .query("leerfeedback_historie")
      .withIndex("by_normuur", (q) => q.eq("normuurId", args.normuurId))
      .order("desc")
      .collect();

    // Filter by user
    return history.filter((h) => h.userId.toString() === userId.toString());
  },
});

/**
 * Get summary statistics for leerfeedback.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const history = await ctx.db
      .query("leerfeedback_historie")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Calculate stats
    const totaalAanpassingen = history.length;
    const aanpassingenPerScope: Record<string, number> = {};
    const gemiddeldeWijziging: Record<string, number[]> = {};

    for (const entry of history) {
      aanpassingenPerScope[entry.scope] =
        (aanpassingenPerScope[entry.scope] || 0) + 1;

      if (!gemiddeldeWijziging[entry.scope]) {
        gemiddeldeWijziging[entry.scope] = [];
      }
      gemiddeldeWijziging[entry.scope].push(entry.wijzigingPercentage);
    }

    // Calculate average per scope
    const gemiddeldeWijzigingPerScope: Record<string, number> = {};
    for (const [scope, wijzigingen] of Object.entries(gemiddeldeWijziging)) {
      const avg =
        wijzigingen.reduce((sum, w) => sum + w, 0) / wijzigingen.length;
      gemiddeldeWijzigingPerScope[scope] = Math.round(avg * 10) / 10;
    }

    // Get most recent adjustments
    const recenteAanpassingen = history
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    return {
      totaalAanpassingen,
      aanpassingenPerScope,
      gemiddeldeWijzigingPerScope,
      recenteAanpassingen,
    };
  },
});

/**
 * Revert a previous adjustment.
 * Creates a new history entry that undoes a previous change.
 */
export const revertAanpassing = mutation({
  args: { historieId: v.id("leerfeedback_historie") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const now = Date.now();

    // Get the history entry
    const historieEntry = await ctx.db.get(args.historieId);
    if (!historieEntry) {
      throw new Error("Historie entry niet gevonden");
    }
    if (historieEntry.userId.toString() !== user._id.toString()) {
      throw new Error("Geen toegang tot deze historie entry");
    }

    // Get the normuur
    const normuur = await ctx.db.get(historieEntry.normuurId);
    if (!normuur) {
      throw new Error("Normuur niet meer gevonden");
    }

    const oudeWaarde = normuur.normuurPerEenheid;
    const nieuweWaarde = historieEntry.oudeWaarde;
    const wijzigingPercentage =
      Math.round(((nieuweWaarde - oudeWaarde) / oudeWaarde) * 100 * 10) / 10;

    // Log the revert in historie
    await ctx.db.insert("leerfeedback_historie", {
      userId: user._id,
      normuurId: historieEntry.normuurId,
      scope: historieEntry.scope,
      activiteit: historieEntry.activiteit,
      oudeWaarde,
      nieuweWaarde,
      wijzigingPercentage,
      reden: `Teruggedraaid: ${historieEntry.reden}`,
      bronProjecten: historieEntry.bronProjecten,
      toegepastDoor: user.name || user.email,
      createdAt: now,
    });

    // Revert the normuur
    await ctx.db.patch(historieEntry.normuurId, {
      normuurPerEenheid: nieuweWaarde,
    });

    return {
      success: true,
      normuurId: historieEntry.normuurId,
      oudeWaarde,
      nieuweWaarde,
      wijzigingPercentage,
    };
  },
});
