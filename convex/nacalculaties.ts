/**
 * Nacalculaties Functions - Post-calculation module
 *
 * Provides functions for calculating and managing post-calculation (nacalculatie)
 * data. Compares voorcalculatie (planned) with actual hours worked.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
import { Id } from "./_generated/dataModel";

/**
 * Get a project and verify ownership.
 */
async function getOwnedProject(
  ctx: Parameters<typeof requireAuth>[0],
  projectId: Id<"projecten">
) {
  const project = await ctx.db.get(projectId);
  return verifyOwnership(ctx, project, "project");
}

/**
 * Get nacalculatie for a project.
 */
export const get = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verify ownership of project
    await getOwnedProject(ctx, args.projectId);

    const nacalculatie = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    return nacalculatie;
  },
});

/**
 * Calculate nacalculatie from project data.
 * This computes the comparison between voorcalculatie (planned) and actual registered hours.
 * Returns the calculated data without saving it.
 */
export const calculate = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verify ownership of project
    const project = await getOwnedProject(ctx, args.projectId);

    // Get voorcalculatie - first try by offerte (new workflow), then by project (legacy)
    let voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
      .unique();

    // Fallback to project-based lookup for legacy data
    if (!voorcalculatie) {
      voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .unique();
    }

    if (!voorcalculatie) {
      return {
        error: "Geen voorcalculatie gevonden voor dit project",
        data: null,
      };
    }

    // Get all urenRegistraties
    const urenRegistraties = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get all machineGebruik
    const machineGebruik = await ctx.db
      .query("machineGebruik")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Calculate werkelijke uren totaal
    const werkelijkeUren = urenRegistraties.reduce(
      (sum, r) => sum + r.uren,
      0
    );

    // Calculate werkelijke dagen (unique dates)
    const uniqueDates = new Set(urenRegistraties.map((r) => r.datum));
    const werkelijkeDagen = uniqueDates.size;

    // Calculate werkelijke machine kosten
    const werkelijkeMachineKosten = machineGebruik.reduce(
      (sum, m) => sum + m.kosten,
      0
    );

    // Calculate afwijking uren
    const afwijkingUren = werkelijkeUren - voorcalculatie.normUrenTotaal;

    // Calculate afwijking percentage
    const afwijkingPercentage =
      voorcalculatie.normUrenTotaal > 0
        ? Math.round(
            ((werkelijkeUren - voorcalculatie.normUrenTotaal) /
              voorcalculatie.normUrenTotaal) *
              100 *
              10
          ) / 10
        : 0;

    // Calculate afwijkingen per scope
    const werkelijkeUrenPerScope: Record<string, number> = {};
    for (const registratie of urenRegistraties) {
      if (registratie.scope) {
        werkelijkeUrenPerScope[registratie.scope] =
          (werkelijkeUrenPerScope[registratie.scope] || 0) + registratie.uren;
      }
    }

    const afwijkingenPerScope: Record<string, number> = {};
    const normUrenPerScope = voorcalculatie.normUrenPerScope || {};

    // Calculate deviation for each scope
    const allScopes = new Set([
      ...Object.keys(normUrenPerScope),
      ...Object.keys(werkelijkeUrenPerScope),
    ]);

    for (const scope of allScopes) {
      const normUren = normUrenPerScope[scope] || 0;
      const werkelijkUren = werkelijkeUrenPerScope[scope] || 0;
      afwijkingenPerScope[scope] = Math.round((werkelijkUren - normUren) * 100) / 100;
    }

    // Get offerte for geplande machine kosten (from regels of type "machine")
    const offerte = await ctx.db.get(project.offerteId);
    const geplandeMachineKosten = offerte?.regels
      ?.filter((r) => r.type === "machine")
      .reduce((sum, r) => sum + r.totaal, 0) || 0;

    return {
      error: null,
      data: {
        projectId: args.projectId,
        // Planned values
        geplandeUren: voorcalculatie.normUrenTotaal,
        geplandeDagen: voorcalculatie.geschatteDagen,
        geplandeUrenPerScope: normUrenPerScope,
        geplandeMachineKosten,
        // Actual values
        werkelijkeUren,
        werkelijkeDagen,
        werkelijkeUrenPerScope,
        werkelijkeMachineKosten,
        // Deviations
        afwijkingUren,
        afwijkingPercentage,
        afwijkingenPerScope,
        // Metadata
        teamGrootte: voorcalculatie.teamGrootte,
        effectieveUrenPerDag: voorcalculatie.effectieveUrenPerDag,
        aantalRegistraties: urenRegistraties.length,
      },
    };
  },
});

/**
 * Save nacalculatie results.
 * Creates or updates the nacalculatie record for a project.
 */
export const save = mutation({
  args: {
    projectId: v.id("projecten"),
    werkelijkeUren: v.number(),
    werkelijkeDagen: v.number(),
    werkelijkeMachineKosten: v.number(),
    afwijkingUren: v.number(),
    afwijkingPercentage: v.number(),
    afwijkingenPerScope: v.record(v.string(), v.number()),
    conclusies: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify ownership of project
    await getOwnedProject(ctx, args.projectId);
    const now = Date.now();

    // Check if nacalculatie already exists
    const existing = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        werkelijkeUren: args.werkelijkeUren,
        werkelijkeDagen: args.werkelijkeDagen,
        werkelijkeMachineKosten: args.werkelijkeMachineKosten,
        afwijkingUren: args.afwijkingUren,
        afwijkingPercentage: args.afwijkingPercentage,
        afwijkingenPerScope: args.afwijkingenPerScope,
        conclusies: args.conclusies,
        updatedAt: now,
      });
      return existing._id;
    }

    // Create new
    const nacalculatieId = await ctx.db.insert("nacalculaties", {
      projectId: args.projectId,
      werkelijkeUren: args.werkelijkeUren,
      werkelijkeDagen: args.werkelijkeDagen,
      werkelijkeMachineKosten: args.werkelijkeMachineKosten,
      afwijkingUren: args.afwijkingUren,
      afwijkingPercentage: args.afwijkingPercentage,
      afwijkingenPerScope: args.afwijkingenPerScope,
      conclusies: args.conclusies,
      createdAt: now,
      updatedAt: now,
    });

    return nacalculatieId;
  },
});

/**
 * Add or update conclusions for a nacalculatie.
 */
export const addConclusion = mutation({
  args: {
    projectId: v.id("projecten"),
    conclusies: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify ownership of project
    await getOwnedProject(ctx, args.projectId);
    const now = Date.now();

    // Get existing nacalculatie
    const existing = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    if (!existing) {
      throw new Error(
        "Nacalculatie niet gevonden. Bereken eerst de nacalculatie."
      );
    }

    await ctx.db.patch(existing._id, {
      conclusies: args.conclusies,
      updatedAt: now,
    });

    return existing._id;
  },
});

/**
 * Get all nacalculaties for the authenticated user.
 * Useful for leerfeedback analysis across multiple projects.
 */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Get all projects for user
    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projectIds = projects.map((p) => p._id);

    // Get nacalculaties for all projects
    const nacalculaties = await Promise.all(
      projectIds.map(async (projectId) => {
        const nacalculatie = await ctx.db
          .query("nacalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .unique();

        if (!nacalculatie) return null;

        // Get project details
        const project = projects.find((p) => p._id === projectId);

        // Get voorcalculatie for planned hours
        const voorcalculatie = await ctx.db
          .query("voorcalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .unique();

        return {
          ...nacalculatie,
          projectNaam: project?.naam,
          geplandeUrenPerScope: voorcalculatie?.normUrenPerScope || {},
        };
      })
    );

    return nacalculaties.filter(Boolean);
  },
});

/**
 * Get nacalculatie data with full project and offerte details.
 */
export const getWithDetails = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verify ownership of project
    const project = await getOwnedProject(ctx, args.projectId);

    // Get nacalculatie
    const nacalculatie = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    // Get offerte
    const offerte = await ctx.db.get(project.offerteId);

    // Get voorcalculatie - first try by offerte (new workflow), then by project (legacy)
    let voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
      .unique();

    // Fallback to project-based lookup for legacy data
    if (!voorcalculatie) {
      voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .unique();
    }

    // Get uren registraties
    const urenRegistraties = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get machine gebruik
    const machineGebruik = await ctx.db
      .query("machineGebruik")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return {
      project,
      offerte,
      voorcalculatie,
      nacalculatie,
      urenRegistraties,
      machineGebruik,
    };
  },
});
