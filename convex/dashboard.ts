/**
 * Consolidated Admin Dashboard Query
 *
 * Replaces 3 overlapping queries with a single round-trip:
 * - getFullDashboardData (offertes.ts) — offertes, projecten, facturen
 * - getDirectieStats (directieDashboard.ts) — offertes, projecten, facturen, uren
 * - getMateriaalmanStats (materiaalmanDashboard.ts) — voertuigen, machines, voorraad, QC
 *
 * Fetches all data once and computes all stats from the shared dataset.
 */

import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// ── Quarter helpers ──────────────────────────────────────────────────

const QUARTER_MS = 90 * 24 * 60 * 60 * 1000; // ~90 days

function getQuarterBounds(date: Date): { start: number; end: number } {
  const quarter = Math.floor(date.getMonth() / 3);
  const start = new Date(date.getFullYear(), quarter * 3, 1).getTime();
  const end = new Date(
    date.getFullYear(),
    quarter * 3 + 3,
    0,
    23,
    59,
    59,
    999
  ).getTime();
  return { start, end };
}

// ── Main query ───────────────────────────────────────────────────────

export const getAdminDashboardData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const now = new Date();
    const thisQ = getQuarterBounds(now);
    const prevQ = getQuarterBounds(new Date(now.getTime() - QUARTER_MS));
    const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // ── Fetch ALL data in one parallel batch ─────────────────────────

    const [
      allOffertes,
      allProjects,
      allFacturen,
      urenDezeMaandRecords,
      voertuigen,
      machines,
      voorraad,
      qcChecks,
    ] = await Promise.all([
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
      ctx.db
        .query("urenRegistraties")
        .withIndex("by_datum", (q) => q.gte("datum", monthStartStr))
        .collect(),
      ctx.db
        .query("voertuigen")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("machines")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("voorraad")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("kwaliteitsControles")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
    ]);

    // Filter out archived/deleted items
    const offertes = allOffertes.filter((o) => !o.isArchived && !o.deletedAt);
    const projects = allProjects.filter((p) => !p.isArchived && !p.deletedAt);

    // ══════════════════════════════════════════════════════════════════
    // From getFullDashboardData (offertes.ts)
    // ══════════════════════════════════════════════════════════════════

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

    let totalAcceptedValue = 0;
    let totalAcceptedCount = 0;
    let totalSentCount = 0;

    for (const offerte of offertes) {
      offerteStats[offerte.status as keyof typeof offerteStats]++;
      offerteStats.totaalWaarde += offerte.totalen?.totaalInclBtw ?? 0;

      if (offerte.status === "geaccepteerd") {
        offerteStats.geaccepteerdWaarde += offerte.totalen?.totaalInclBtw ?? 0;
        totalAcceptedValue += offerte.totalen?.totaalInclBtw ?? 0;
        totalAcceptedCount++;
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

    // === RECENT OFFERTES (top 5 with klant info) ===
    const recentOffertes = offertes.slice(0, 5).map((o) => ({
      _id: o._id,
      offerteNummer: o.offerteNummer,
      klantNaam: o.klant?.naam ?? "Onbekende klant",
      status: o.status,
      totaal: o.totalen?.totaalInclBtw ?? 0,
      updatedAt: o.updatedAt,
    }));

    // === ACCEPTED WITHOUT PROJECT ===
    const offertesWithProject = new Set(
      projects.filter((p) => p.offerteId).map((p) => p.offerteId!.toString())
    );
    const acceptedWithoutProject = offertes
      .filter(
        (o) =>
          o.status === "geaccepteerd" &&
          !offertesWithProject.has(o._id.toString())
      )
      .slice(0, 5)
      .map((o) => ({
        _id: o._id,
        offerteNummer: o.offerteNummer,
        klantNaam: o.klant?.naam ?? "Onbekende klant",
        totaal: o.totalen?.totaalInclBtw ?? 0,
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
    // Pre-build offerte map for O(1) klant lookups (no N+1)
    const offerteMap = new Map(offertes.map((o) => [o._id.toString(), o]));

    const activeProjectsRaw = projects
      .filter((p) => p.status === "in_uitvoering")
      .slice(0, 5);

    const projectIds = activeProjectsRaw.map((p) => p._id);
    const offerteIdsForProjects = activeProjectsRaw.map((p) => p.offerteId);

    // Batch fetch voorcalculaties and uren for active projects in parallel
    const [voorcalculatiesByProject, voorcalculatiesByOfferte, urenByProject] =
      await Promise.all([
        Promise.all(
          projectIds.map((projectId) =>
            ctx.db
              .query("voorcalculaties")
              .withIndex("by_project", (q) => q.eq("projectId", projectId))
              .unique()
          )
        ),
        Promise.all(
          offerteIdsForProjects.map((offerteId) =>
            ctx.db
              .query("voorcalculaties")
              .withIndex("by_offerte", (q) => q.eq("offerteId", offerteId))
              .unique()
          )
        ),
        Promise.all(
          projectIds.map((projectId) =>
            ctx.db
              .query("urenRegistraties")
              .withIndex("by_project", (q) => q.eq("projectId", projectId))
              .collect()
          )
        ),
      ]);

    const activeProjects = activeProjectsRaw.map((project, index) => {
      const offerte = offerteMap.get(project.offerteId.toString());
      const klantNaam = offerte?.klant?.naam || "Onbekende klant";

      const voorcalculatie =
        voorcalculatiesByProject[index] || voorcalculatiesByOfferte[index];
      const begroteUren = voorcalculatie?.normUrenTotaal || 0;

      const urenRegistraties = urenByProject[index] || [];
      const totaalUren = urenRegistraties.reduce((sum, u) => sum + u.uren, 0);

      let voortgang = 0;
      if (begroteUren > 0) {
        voortgang = Math.min(
          100,
          Math.round((totaalUren / begroteUren) * 100)
        );
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
    let openstaandBedragFacturen = 0;
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
          openstaandBedragFacturen += factuur.totaalInclBtw;
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
      openstaandBedrag: openstaandBedragFacturen,
      betaaldBedrag,
      concept: conceptCount,
      definitief: definitiefCount,
      verzonden: verzondenCount,
      betaald: betaaldCount,
      vervallen: vervallenCount,
    };

    const recentFacturen = allFacturen.slice(0, 5).map((factuur) => ({
      _id: factuur._id,
      factuurnummer: factuur.factuurnummer,
      klantNaam: factuur.klant?.naam ?? "Onbekende klant",
      totaalInclBtw: factuur.totaalInclBtw,
      status: factuur.status,
      factuurdatum: factuur.factuurdatum,
      vervaldatum: factuur.vervaldatum,
    }));

    // ══════════════════════════════════════════════════════════════════
    // From getDirectieStats (directieDashboard.ts) — unique data only
    // ══════════════════════════════════════════════════════════════════

    // Financieel: outstanding and overdue invoices
    const openFacturen = allFacturen.filter(
      (f) => f.status === "definitief" || f.status === "vervallen"
    );
    const financieelOpenstaand = openFacturen.reduce(
      (sum, f) => sum + (f.totaalInclBtw ?? 0),
      0
    );
    const vervaldeFacturen = allFacturen.filter(
      (f) => f.status === "vervallen"
    );
    const vervaldenBedrag = vervaldeFacturen.reduce(
      (sum, f) => sum + (f.totaalInclBtw ?? 0),
      0
    );

    const financieel = {
      openstaandBedrag: financieelOpenstaand,
      vervaldeAantal: vervaldeFacturen.length,
      vervaldenBedrag,
    };

    // Uren this month
    const urenDezeMaand = urenDezeMaandRecords.reduce(
      (sum, u) => sum + (u.uren ?? 0),
      0
    );

    // Quarter comparison
    const offertesThisQ = allOffertes.filter(
      (o) => o.createdAt >= thisQ.start && o.createdAt <= thisQ.end
    );
    const offertesPrevQ = allOffertes.filter(
      (o) => o.createdAt >= prevQ.start && o.createdAt <= prevQ.end
    );

    const acceptedThisQ = offertesThisQ.filter(
      (o) => o.status === "geaccepteerd"
    );
    const acceptedPrevQ = offertesPrevQ.filter(
      (o) => o.status === "geaccepteerd"
    );

    const revenueThisQ = acceptedThisQ.reduce(
      (sum, o) => sum + (o.totalen?.totaalInclBtw ?? 0),
      0
    );
    const revenuePrevQ = acceptedPrevQ.reduce(
      (sum, o) => sum + (o.totalen?.totaalInclBtw ?? 0),
      0
    );

    const facturenThisQ = allFacturen.filter(
      (f) => f.createdAt >= thisQ.start && f.createdAt <= thisQ.end
    );
    const facturenPrevQ = allFacturen.filter(
      (f) => f.createdAt >= prevQ.start && f.createdAt <= prevQ.end
    );

    const gefactureerdThisQ = facturenThisQ.reduce(
      (sum, f) => sum + (f.totaalInclBtw ?? 0),
      0
    );
    const gefactureerdPrevQ = facturenPrevQ.reduce(
      (sum, f) => sum + (f.totaalInclBtw ?? 0),
      0
    );

    const kwartaalVergelijking = {
      offertesThisQ: offertesThisQ.length,
      offertesPrevQ: offertesPrevQ.length,
      acceptedThisQ: acceptedThisQ.length,
      acceptedPrevQ: acceptedPrevQ.length,
      revenueThisQ,
      revenuePrevQ,
      gefactureerdThisQ,
      gefactureerdPrevQ,
    };

    // ══════════════════════════════════════════════════════════════════
    // From getMateriaalmanStats (materiaalmanDashboard.ts) — summary
    // ══════════════════════════════════════════════════════════════════

    // Blokkades: vehicles in onderhoud/inactief + inactive machines
    const voertuigBlokkades =
      voertuigen.filter(
        (v) => v.status === "onderhoud" || v.status === "inactief"
      ).length;
    const machineBlokkades = machines.filter((m) => !m.isActief).length;
    const blokkadeCount = voertuigBlokkades + machineBlokkades;

    // Voorraad alerts: items below minimum stock level
    const voorraadAlerts = voorraad.filter(
      (v) => v.minVoorraad && v.hoeveelheid < v.minVoorraad
    ).length;

    // Open QC checks
    const openQCCount = qcChecks.filter(
      (q) => q.status === "open" || q.status === "in_uitvoering"
    ).length;

    const issueCount = blokkadeCount + voorraadAlerts + openQCCount;
    const hasIssues = issueCount > 0;

    // Build Dutch summary string
    let summary = "Alles operationeel";
    if (hasIssues) {
      const parts: string[] = [];
      if (blokkadeCount > 0) {
        parts.push(
          `${blokkadeCount} blokkade${blokkadeCount !== 1 ? "s" : ""}`
        );
      }
      if (voorraadAlerts > 0) {
        parts.push(
          `${voorraadAlerts} voorraad alert${voorraadAlerts !== 1 ? "s" : ""}`
        );
      }
      if (openQCCount > 0) {
        parts.push(
          `${openQCCount} open QC check${openQCCount !== 1 ? "s" : ""}`
        );
      }
      summary = parts.join(", ");
    }

    const vlootSummary = {
      hasIssues,
      issueCount,
      summary,
    };

    // ══════════════════════════════════════════════════════════════════
    // Combined return
    // ══════════════════════════════════════════════════════════════════

    return {
      // From getFullDashboardData
      offerteStats,
      recentOffertes,
      revenueStats,
      acceptedWithoutProject,
      projectStats,
      activeProjects,
      facturenStats,
      recentFacturen,

      // From getDirectieStats (unique data only)
      financieel,
      urenDezeMaand,
      kwartaalVergelijking,

      // From getMateriaalmanStats (summary only)
      vlootSummary,
    };
  },
});
