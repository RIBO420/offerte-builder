/**
 * Archief Functions - Archive module
 *
 * Provides queries for fetching archived projects and their related data.
 * Projects and offertes are archived when a factuur is marked as "betaald".
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { Id } from "./_generated/dataModel";

/**
 * List all archived projects for the authenticated user.
 * Returns archived projects with related offerte, factuur, voorcalculatie, and nacalculatie data.
 * Sorted by archivedAt descending (most recent first).
 */
export const listArchivedProjects = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Get all archived projects for this user
    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter to only archived projects
    const archivedProjects = projects.filter((p) => p.isArchived === true);

    // Sort by archivedAt descending (most recent first)
    archivedProjects.sort((a, b) => {
      const aTime = a.archivedAt ?? 0;
      const bTime = b.archivedAt ?? 0;
      return bTime - aTime;
    });

    // Fetch related data for each archived project
    const results = await Promise.all(
      archivedProjects.map(async (project) => {
        // Get related offerte
        const offerte = await ctx.db.get(project.offerteId);

        // Get related factuur
        const factuur = await ctx.db
          .query("facturen")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .unique();

        // Get voorcalculatie - first check offerte-level (new workflow), then project-level (legacy)
        let voorcalculatie = await ctx.db
          .query("voorcalculaties")
          .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
          .unique();

        if (!voorcalculatie) {
          voorcalculatie = await ctx.db
            .query("voorcalculaties")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .unique();
        }

        // Get nacalculatie
        const nacalculatie = await ctx.db
          .query("nacalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .unique();

        return {
          // Project details
          _id: project._id,
          naam: project.naam,
          status: project.status,
          archivedAt: project.archivedAt,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,

          // Related offerte (summary)
          offerte: offerte
            ? {
                _id: offerte._id,
                offerteNummer: offerte.offerteNummer,
                klantNaam: offerte.klant.naam,
                type: offerte.type,
                totalen: {
                  totaalExBtw: offerte.totalen.totaalExBtw,
                  totaalInclBtw: offerte.totalen.totaalInclBtw,
                  totaalUren: offerte.totalen.totaalUren,
                },
              }
            : null,

          // Related factuur (summary)
          factuur: factuur
            ? {
                _id: factuur._id,
                factuurnummer: factuur.factuurnummer,
                status: factuur.status,
                totaalInclBtw: factuur.totaalInclBtw,
                betaaldAt: factuur.betaaldAt,
              }
            : null,

          // Related voorcalculatie (summary)
          voorcalculatie: voorcalculatie
            ? {
                _id: voorcalculatie._id,
                normUrenTotaal: voorcalculatie.normUrenTotaal,
                geschatteDagen: voorcalculatie.geschatteDagen,
                teamGrootte: voorcalculatie.teamGrootte,
              }
            : null,

          // Related nacalculatie (summary)
          nacalculatie: nacalculatie
            ? {
                _id: nacalculatie._id,
                werkelijkeUren: nacalculatie.werkelijkeUren,
                werkelijkeDagen: nacalculatie.werkelijkeDagen,
                afwijkingUren: nacalculatie.afwijkingUren,
                afwijkingPercentage: nacalculatie.afwijkingPercentage,
              }
            : null,
        };
      })
    );

    return results;
  },
});

/**
 * Get full details of a single archived project with all related data.
 * Returns comprehensive data for viewing an archived project.
 */
export const getArchivedProjectDetails = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get the project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Verify ownership
    if (project.userId.toString() !== userId.toString()) {
      return null; // Don't reveal existence to unauthorized users
    }

    // Verify it's archived
    if (!project.isArchived) {
      return null; // This query is specifically for archived projects
    }

    // Get related offerte with full details
    const offerte = await ctx.db.get(project.offerteId);

    // Get related factuur with full details
    const factuur = await ctx.db
      .query("facturen")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

    // Get voorcalculatie - first check offerte-level (new workflow), then project-level (legacy)
    let voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
      .unique();

    if (!voorcalculatie) {
      voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .unique();
    }

    // Get nacalculatie with full details
    const nacalculatie = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();

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

    // Get planning taken
    const planningTaken = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Calculate totals from uren registraties
    const totaalGeregistreerdeUren = urenRegistraties.reduce(
      (sum, u) => sum + u.uren,
      0
    );
    const totaalMachineKosten = machineGebruik.reduce(
      (sum, m) => sum + m.kosten,
      0
    );

    return {
      // Full project details
      project: {
        _id: project._id,
        naam: project.naam,
        status: project.status,
        isArchived: project.isArchived,
        archivedAt: project.archivedAt,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        toegewezenVoertuigen: project.toegewezenVoertuigen,
      },

      // Full offerte details
      offerte: offerte
        ? {
            _id: offerte._id,
            offerteNummer: offerte.offerteNummer,
            type: offerte.type,
            status: offerte.status,
            klant: offerte.klant,
            algemeenParams: offerte.algemeenParams,
            scopes: offerte.scopes,
            totalen: offerte.totalen,
            regels: offerte.regels,
            notities: offerte.notities,
            createdAt: offerte.createdAt,
            verzondenAt: offerte.verzondenAt,
            customerResponse: offerte.customerResponse,
            isArchived: offerte.isArchived,
            archivedAt: offerte.archivedAt,
          }
        : null,

      // Full factuur details
      factuur: factuur
        ? {
            _id: factuur._id,
            factuurnummer: factuur.factuurnummer,
            status: factuur.status,
            klant: factuur.klant,
            bedrijf: factuur.bedrijf,
            regels: factuur.regels,
            correcties: factuur.correcties,
            subtotaal: factuur.subtotaal,
            btwPercentage: factuur.btwPercentage,
            btwBedrag: factuur.btwBedrag,
            totaalInclBtw: factuur.totaalInclBtw,
            factuurdatum: factuur.factuurdatum,
            vervaldatum: factuur.vervaldatum,
            betalingstermijnDagen: factuur.betalingstermijnDagen,
            verzondenAt: factuur.verzondenAt,
            betaaldAt: factuur.betaaldAt,
            notities: factuur.notities,
            isArchived: factuur.isArchived,
            archivedAt: factuur.archivedAt,
            createdAt: factuur.createdAt,
          }
        : null,

      // Full voorcalculatie details
      voorcalculatie: voorcalculatie
        ? {
            _id: voorcalculatie._id,
            teamGrootte: voorcalculatie.teamGrootte,
            teamleden: voorcalculatie.teamleden,
            effectieveUrenPerDag: voorcalculatie.effectieveUrenPerDag,
            normUrenTotaal: voorcalculatie.normUrenTotaal,
            geschatteDagen: voorcalculatie.geschatteDagen,
            normUrenPerScope: voorcalculatie.normUrenPerScope,
            createdAt: voorcalculatie.createdAt,
          }
        : null,

      // Full nacalculatie details
      nacalculatie: nacalculatie
        ? {
            _id: nacalculatie._id,
            werkelijkeUren: nacalculatie.werkelijkeUren,
            werkelijkeDagen: nacalculatie.werkelijkeDagen,
            werkelijkeMachineKosten: nacalculatie.werkelijkeMachineKosten,
            afwijkingUren: nacalculatie.afwijkingUren,
            afwijkingPercentage: nacalculatie.afwijkingPercentage,
            afwijkingenPerScope: nacalculatie.afwijkingenPerScope,
            conclusies: nacalculatie.conclusies,
            createdAt: nacalculatie.createdAt,
            updatedAt: nacalculatie.updatedAt,
          }
        : null,

      // Summary statistics
      statistics: {
        totaalGeregistreerdeUren,
        totaalMachineKosten,
        urenRegistratiesCount: urenRegistraties.length,
        machineGebruikCount: machineGebruik.length,
        planningTakenCount: planningTaken.length,
      },

      // Planning taken (sorted by volgorde)
      planningTaken: planningTaken.sort((a, b) => a.volgorde - b.volgorde),

      // Uren registraties (sorted by datum descending)
      urenRegistraties: urenRegistraties.sort((a, b) =>
        b.datum.localeCompare(a.datum)
      ),

      // Machine gebruik (sorted by datum descending)
      machineGebruik: machineGebruik.sort((a, b) =>
        b.datum.localeCompare(a.datum)
      ),
    };
  },
});
