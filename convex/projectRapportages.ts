/**
 * Project Rapportages - Project reporting and analytics
 *
 * Provides queries for analyzing project performance, tracking completion rates,
 * budget accuracy, profitability, and overall project progress.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// Helper to get month key from timestamp
function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Helper to get month name in Dutch
function getMonthName(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const monthNames = [
    "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
    "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
  ];
  return `${monthNames[parseInt(month) - 1]} ${year}`;
}

// Helper to calculate date range for previous period comparison
function getPreviousPeriodRange(startDate: number, endDate: number): { start: number; end: number } {
  const periodLength = endDate - startDate;
  return {
    start: startDate - periodLength,
    end: startDate,
  };
}

// Helper to calculate days between two timestamps
function daysBetween(start: number, end: number): number {
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

/**
 * Get project performance metrics.
 * Returns completion rate, budget accuracy, profitability analysis.
 */
export const getProjectPrestaties = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    comparePreviousPeriod: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get all projects for user
    let projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter by date range if provided
    if (args.startDate || args.endDate) {
      projecten = projecten.filter((p) => {
        if (args.startDate && p.createdAt < args.startDate) return false;
        if (args.endDate && p.createdAt > args.endDate) return false;
        return true;
      });
    }

    // Get related data for all projects
    const projectIds = projecten.map((p) => p._id);
    const offerteIds = projecten.map((p) => p.offerteId);

    // Fetch voorcalculaties, nacalculaties, and offertes in parallel
    const [voorcalculatiesResults, nacalculatiesResults, offertesResults, factuurResults] = await Promise.all([
      Promise.all([
        ...projectIds.map((id) =>
          ctx.db
            .query("voorcalculaties")
            .withIndex("by_project", (q) => q.eq("projectId", id))
            .unique()
        ),
        ...offerteIds.map((id) =>
          ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", id))
            .unique()
        ),
      ]),
      Promise.all(
        projectIds.map((id) =>
          ctx.db
            .query("nacalculaties")
            .withIndex("by_project", (q) => q.eq("projectId", id))
            .unique()
        )
      ),
      Promise.all(offerteIds.map((id) => ctx.db.get(id))),
      Promise.all(
        projectIds.map((id) =>
          ctx.db
            .query("facturen")
            .withIndex("by_project", (q) => q.eq("projectId", id))
            .unique()
        )
      ),
    ]);

    // Build lookup maps
    const voorcalculatieByProject = new Map<string, NonNullable<typeof voorcalculatiesResults[0]>>();
    const voorcalculatieByOfferte = new Map<string, NonNullable<typeof voorcalculatiesResults[0]>>();

    voorcalculatiesResults.forEach((vc) => {
      if (vc) {
        if (vc.projectId) voorcalculatieByProject.set(vc.projectId.toString(), vc);
        if (vc.offerteId) voorcalculatieByOfferte.set(vc.offerteId.toString(), vc);
      }
    });

    const nacalculatieByProject = new Map<string, NonNullable<typeof nacalculatiesResults[0]>>();
    nacalculatiesResults.forEach((nc, idx) => {
      if (nc) nacalculatieByProject.set(projectIds[idx].toString(), nc);
    });

    const offerteById = new Map<string, NonNullable<typeof offertesResults[0]>>();
    offertesResults.forEach((o) => {
      if (o) offerteById.set(o._id.toString(), o);
    });

    const factuurByProject = new Map<string, NonNullable<typeof factuurResults[0]>>();
    factuurResults.forEach((f, idx) => {
      if (f) factuurByProject.set(projectIds[idx].toString(), f);
    });

    // Calculate project-level performance
    type ProjectPrestatie = {
      projectId: string;
      projectNaam: string;
      klantNaam: string;
      type: string;
      status: string;
      createdAt: number;
      maand: string;
      // Budget metrics
      begroot: number;
      werkelijk: number;
      budgetAfwijking: number;
      budgetAfwijkingPercentage: number;
      isBinnenBudget: boolean;
      // Time metrics
      geplandeUren: number;
      werkelijkeUren: number;
      urenAfwijking: number;
      urenAfwijkingPercentage: number;
      // Profitability
      omzet: number;
      kosten: number;
      winst: number;
      winstmarge: number;
      // Duration
      doorlooptijd: number | null; // days from creation to completion
    };

    const projectPrestaties: ProjectPrestatie[] = [];

    // Status counts
    const statusCounts: Record<string, number> = {
      gepland: 0,
      in_uitvoering: 0,
      afgerond: 0,
      nacalculatie_compleet: 0,
      gefactureerd: 0,
      voorcalculatie: 0, // legacy
    };

    // Monthly aggregation
    const monthlyData: Record<string, {
      maand: string;
      aantalProjecten: number;
      omzet: number;
      kosten: number;
      winst: number;
      binnenBudget: number;
    }> = {};

    // Type aggregation
    const typeData: Record<string, {
      type: string;
      aantalProjecten: number;
      omzet: number;
      winst: number;
      gemiddeldeWinstmarge: number;
    }> = {
      aanleg: { type: "Aanleg", aantalProjecten: 0, omzet: 0, winst: 0, gemiddeldeWinstmarge: 0 },
      onderhoud: { type: "Onderhoud", aantalProjecten: 0, omzet: 0, winst: 0, gemiddeldeWinstmarge: 0 },
    };

    // Get instellingen for uurtarief
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const uurtarief = instellingen?.uurtarief || 45;

    for (const project of projecten) {
      const offerte = offerteById.get(project.offerteId.toString());
      if (!offerte) continue;

      const voorcalculatie =
        voorcalculatieByOfferte.get(project.offerteId.toString()) ||
        voorcalculatieByProject.get(project._id.toString());

      const nacalculatie = nacalculatieByProject.get(project._id.toString());
      const factuur = factuurByProject.get(project._id.toString());

      // Count status
      statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;

      // Calculate budget metrics
      const begroot = offerte.totalen.totaalExBtw;
      const geplandeUren = voorcalculatie?.normUrenTotaal || offerte.totalen.totaalUren;
      const werkelijkeUren = nacalculatie?.werkelijkeUren || 0;

      // Calculate actual costs (if nacalculatie exists)
      const arbeidskosten = werkelijkeUren * uurtarief;
      const machineKosten = nacalculatie?.werkelijkeMachineKosten || 0;

      // Estimate material costs from offerte (assume same as planned)
      const materiaalkosten = offerte.regels
        .filter((r) => r.type === "materiaal")
        .reduce((sum, r) => sum + r.totaal, 0);

      const werkelijk = arbeidskosten + machineKosten + materiaalkosten;
      const budgetAfwijking = werkelijk - begroot;
      const budgetAfwijkingPercentage = begroot > 0
        ? Math.round((budgetAfwijking / begroot) * 100 * 10) / 10
        : 0;

      // Hour metrics
      const urenAfwijking = werkelijkeUren - geplandeUren;
      const urenAfwijkingPercentage = geplandeUren > 0
        ? Math.round((urenAfwijking / geplandeUren) * 100 * 10) / 10
        : 0;

      // Profitability
      const omzet = factuur?.totaalInclBtw || offerte.totalen.totaalInclBtw;
      const kosten = werkelijk || (offerte.totalen.subtotaal);
      const winst = omzet - kosten;
      const winstmarge = omzet > 0 ? Math.round((winst / omzet) * 100 * 10) / 10 : 0;

      // Duration (only for completed projects)
      let doorlooptijd: number | null = null;
      if (["afgerond", "nacalculatie_compleet", "gefactureerd"].includes(project.status)) {
        doorlooptijd = daysBetween(project.createdAt, project.updatedAt);
      }

      // Monthly aggregation
      const monthKey = getMonthKey(project.createdAt);
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          maand: getMonthName(monthKey),
          aantalProjecten: 0,
          omzet: 0,
          kosten: 0,
          winst: 0,
          binnenBudget: 0,
        };
      }
      monthlyData[monthKey].aantalProjecten++;
      monthlyData[monthKey].omzet += omzet;
      monthlyData[monthKey].kosten += kosten;
      monthlyData[monthKey].winst += winst;
      if (Math.abs(budgetAfwijkingPercentage) <= 10) {
        monthlyData[monthKey].binnenBudget++;
      }

      // Type aggregation
      const type = offerte.type;
      typeData[type].aantalProjecten++;
      typeData[type].omzet += omzet;
      typeData[type].winst += winst;

      projectPrestaties.push({
        projectId: project._id.toString(),
        projectNaam: project.naam,
        klantNaam: offerte.klant.naam,
        type: offerte.type,
        status: project.status,
        createdAt: project.createdAt,
        maand: getMonthName(monthKey),
        begroot: Math.round(begroot),
        werkelijk: Math.round(werkelijk),
        budgetAfwijking: Math.round(budgetAfwijking),
        budgetAfwijkingPercentage,
        isBinnenBudget: Math.abs(budgetAfwijkingPercentage) <= 10,
        geplandeUren: Math.round(geplandeUren * 10) / 10,
        werkelijkeUren: Math.round(werkelijkeUren * 10) / 10,
        urenAfwijking: Math.round(urenAfwijking * 10) / 10,
        urenAfwijkingPercentage,
        omzet: Math.round(omzet),
        kosten: Math.round(kosten),
        winst: Math.round(winst),
        winstmarge,
        doorlooptijd,
      });
    }

    // Calculate type averages
    Object.values(typeData).forEach((t) => {
      if (t.aantalProjecten > 0) {
        t.gemiddeldeWinstmarge = t.omzet > 0
          ? Math.round((t.winst / t.omzet) * 100 * 10) / 10
          : 0;
      }
    });

    // Calculate summary metrics
    const totaalProjecten = projectPrestaties.length;
    const afgerondeProjecten = projectPrestaties.filter((p) =>
      ["afgerond", "nacalculatie_compleet", "gefactureerd"].includes(p.status)
    ).length;

    const projectenMetNacalculatie = projectPrestaties.filter((p) => p.werkelijkeUren > 0).length;
    const projectenBinnenBudget = projectPrestaties.filter((p) => p.isBinnenBudget).length;

    const completionRate = totaalProjecten > 0
      ? Math.round((afgerondeProjecten / totaalProjecten) * 100)
      : 0;

    const budgetAccuracy = projectenMetNacalculatie > 0
      ? Math.round((projectenBinnenBudget / projectenMetNacalculatie) * 100)
      : 0;

    const totaleOmzet = projectPrestaties.reduce((sum, p) => sum + p.omzet, 0);
    const totaleWinst = projectPrestaties.reduce((sum, p) => sum + p.winst, 0);
    const gemiddeldeWinstmarge = totaleOmzet > 0
      ? Math.round((totaleWinst / totaleOmzet) * 100 * 10) / 10
      : 0;

    // Sort monthly data
    const sortedMonthlyData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => ({
        ...data,
        omzet: Math.round(data.omzet),
        kosten: Math.round(data.kosten),
        winst: Math.round(data.winst),
        winstmarge: data.omzet > 0
          ? Math.round((data.winst / data.omzet) * 100 * 10) / 10
          : 0,
        budgetAccuracy: data.aantalProjecten > 0
          ? Math.round((data.binnenBudget / data.aantalProjecten) * 100)
          : 0,
      }));

    // Calculate previous period comparison if requested
    let previousPeriodComparison = null;
    if (args.comparePreviousPeriod && args.startDate && args.endDate) {
      const prevRange = getPreviousPeriodRange(args.startDate, args.endDate);

      const prevProjecten = (await ctx.db
        .query("projecten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
      ).filter((p) => p.createdAt >= prevRange.start && p.createdAt < prevRange.end);

      const prevAfgerond = prevProjecten.filter((p) =>
        ["afgerond", "nacalculatie_compleet", "gefactureerd"].includes(p.status)
      ).length;

      const prevCompletionRate = prevProjecten.length > 0
        ? Math.round((prevAfgerond / prevProjecten.length) * 100)
        : 0;

      previousPeriodComparison = {
        prevAantalProjecten: prevProjecten.length,
        projectenChange: totaalProjecten - prevProjecten.length,
        prevCompletionRate,
        completionRateChange: completionRate - prevCompletionRate,
      };
    }

    // Status distribution for charts
    const statusVerdeling = Object.entries(statusCounts)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        status: status.replace(/_/g, " "),
        count,
        percentage: totaalProjecten > 0 ? Math.round((count / totaalProjecten) * 100) : 0,
      }));

    return {
      samenvatting: {
        totaalProjecten,
        afgerondeProjecten,
        completionRate,
        budgetAccuracy,
        totaleOmzet: Math.round(totaleOmzet),
        totaleWinst: Math.round(totaleWinst),
        gemiddeldeWinstmarge,
        gemiddeldeOmzetPerProject: totaalProjecten > 0
          ? Math.round(totaleOmzet / totaalProjecten)
          : 0,
      },
      projectPrestaties: projectPrestaties.sort((a, b) => b.createdAt - a.createdAt),
      maandelijkseData: sortedMonthlyData,
      typeData: Object.values(typeData).map((t) => ({
        ...t,
        omzet: Math.round(t.omzet),
        winst: Math.round(t.winst),
      })),
      statusVerdeling,
      previousPeriodComparison,
    };
  },
});

/**
 * Get active project progress overview.
 * Returns current status of all active projects with progress indicators.
 */
export const getProjectVoortgang = query({
  args: {
    alleenActief: v.optional(v.boolean()), // default: true
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get all projects for user
    let projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter to active only (not archived)
    projecten = projecten.filter((p) => !p.isArchived);

    // Filter to only in-progress projects if requested (default: true)
    if (args.alleenActief !== false) {
      projecten = projecten.filter((p) =>
        ["gepland", "in_uitvoering", "voorcalculatie"].includes(p.status)
      );
    }

    // Get related data for all projects
    const projectIds = projecten.map((p) => p._id);
    const offerteIds = projecten.map((p) => p.offerteId);

    // Fetch related data in parallel
    const [
      voorcalculatiesResults,
      urenRegistratiesResults,
      offertesResults,
      planningTakenResults,
    ] = await Promise.all([
      Promise.all([
        ...projectIds.map((id) =>
          ctx.db
            .query("voorcalculaties")
            .withIndex("by_project", (q) => q.eq("projectId", id))
            .unique()
        ),
        ...offerteIds.map((id) =>
          ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", id))
            .unique()
        ),
      ]),
      Promise.all(
        projectIds.map((id) =>
          ctx.db
            .query("urenRegistraties")
            .withIndex("by_project", (q) => q.eq("projectId", id))
            .collect()
        )
      ),
      Promise.all(offerteIds.map((id) => ctx.db.get(id))),
      Promise.all(
        projectIds.map((id) =>
          ctx.db
            .query("planningTaken")
            .withIndex("by_project", (q) => q.eq("projectId", id))
            .collect()
        )
      ),
    ]);

    // Build lookup maps
    const voorcalculatieByProject = new Map<string, NonNullable<typeof voorcalculatiesResults[0]>>();
    const voorcalculatieByOfferte = new Map<string, NonNullable<typeof voorcalculatiesResults[0]>>();

    voorcalculatiesResults.forEach((vc) => {
      if (vc) {
        if (vc.projectId) voorcalculatieByProject.set(vc.projectId.toString(), vc);
        if (vc.offerteId) voorcalculatieByOfferte.set(vc.offerteId.toString(), vc);
      }
    });

    const urenByProject = new Map<string, typeof urenRegistratiesResults[0]>();
    urenRegistratiesResults.forEach((uren, idx) => {
      urenByProject.set(projectIds[idx].toString(), uren);
    });

    const offerteById = new Map<string, NonNullable<typeof offertesResults[0]>>();
    offertesResults.forEach((o) => {
      if (o) offerteById.set(o._id.toString(), o);
    });

    const takenByProject = new Map<string, typeof planningTakenResults[0]>();
    planningTakenResults.forEach((taken, idx) => {
      takenByProject.set(projectIds[idx].toString(), taken);
    });

    // Build project progress data
    type ProjectVoortgang = {
      projectId: string;
      projectNaam: string;
      klantNaam: string;
      klantAdres: string;
      type: string;
      status: string;
      statusLabel: string;
      createdAt: number;
      // Progress metrics
      geplandeUren: number;
      gewerktUren: number;
      voortgangPercentage: number;
      resterendeUren: number;
      // Task progress
      totaalTaken: number;
      afgerondeTaken: number;
      taakVoortgang: number;
      // Days metrics
      dagenSindsStart: number;
      geschatteDagen: number;
      dagenOver: number | null;
      // Team info
      teamleden: string[];
      laatsteActiviteit: string | null;
    };

    const projectVoortgangList: ProjectVoortgang[] = [];

    const statusLabels: Record<string, string> = {
      gepland: "Gepland",
      in_uitvoering: "In uitvoering",
      afgerond: "Afgerond",
      nacalculatie_compleet: "Nacalculatie compleet",
      gefactureerd: "Gefactureerd",
      voorcalculatie: "Voorcalculatie",
    };

    for (const project of projecten) {
      const offerte = offerteById.get(project.offerteId.toString());
      if (!offerte) continue;

      const voorcalculatie =
        voorcalculatieByOfferte.get(project.offerteId.toString()) ||
        voorcalculatieByProject.get(project._id.toString());

      const urenRegistraties = urenByProject.get(project._id.toString()) || [];
      const planningTaken = takenByProject.get(project._id.toString()) || [];

      // Calculate hours
      const geplandeUren = voorcalculatie?.normUrenTotaal || offerte.totalen.totaalUren;
      const gewerktUren = urenRegistraties.reduce((sum, u) => sum + u.uren, 0);
      const voortgangPercentage = geplandeUren > 0
        ? Math.min(100, Math.round((gewerktUren / geplandeUren) * 100))
        : 0;
      const resterendeUren = Math.max(0, geplandeUren - gewerktUren);

      // Calculate task progress
      const totaalTaken = planningTaken.length;
      const afgerondeTaken = planningTaken.filter((t) => t.status === "afgerond").length;
      const taakVoortgang = totaalTaken > 0
        ? Math.round((afgerondeTaken / totaalTaken) * 100)
        : 0;

      // Calculate days
      const dagenSindsStart = daysBetween(project.createdAt, Date.now());
      const geschatteDagen = voorcalculatie?.geschatteDagen || 0;
      const dagenOver = geschatteDagen > 0 ? geschatteDagen - dagenSindsStart : null;

      // Get team members from voorcalculatie or urenRegistraties
      const teamleden = voorcalculatie?.teamleden || [...new Set(urenRegistraties.map((u) => u.medewerker))];

      // Get latest activity date
      const laatsteActiviteit = urenRegistraties.length > 0
        ? urenRegistraties.sort((a, b) => b.datum.localeCompare(a.datum))[0].datum
        : null;

      projectVoortgangList.push({
        projectId: project._id.toString(),
        projectNaam: project.naam,
        klantNaam: offerte.klant.naam,
        klantAdres: `${offerte.klant.adres}, ${offerte.klant.plaats}`,
        type: offerte.type,
        status: project.status,
        statusLabel: statusLabels[project.status] || project.status,
        createdAt: project.createdAt,
        geplandeUren: Math.round(geplandeUren * 10) / 10,
        gewerktUren: Math.round(gewerktUren * 10) / 10,
        voortgangPercentage,
        resterendeUren: Math.round(resterendeUren * 10) / 10,
        totaalTaken,
        afgerondeTaken,
        taakVoortgang,
        dagenSindsStart,
        geschatteDagen,
        dagenOver,
        teamleden,
        laatsteActiviteit,
      });
    }

    // Sort by status priority and then by creation date
    const statusPriority: Record<string, number> = {
      in_uitvoering: 1,
      gepland: 2,
      voorcalculatie: 3,
      afgerond: 4,
      nacalculatie_compleet: 5,
      gefactureerd: 6,
    };

    projectVoortgangList.sort((a, b) => {
      const priorityA = statusPriority[a.status] || 99;
      const priorityB = statusPriority[b.status] || 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return b.createdAt - a.createdAt;
    });

    // Calculate summary
    const totaalGeplandeUren = projectVoortgangList.reduce((sum, p) => sum + p.geplandeUren, 0);
    const totaalGewerktUren = projectVoortgangList.reduce((sum, p) => sum + p.gewerktUren, 0);
    const totaalResterendeUren = projectVoortgangList.reduce((sum, p) => sum + p.resterendeUren, 0);

    const gemiddeldeVoortgang = projectVoortgangList.length > 0
      ? Math.round(
          projectVoortgangList.reduce((sum, p) => sum + p.voortgangPercentage, 0) /
          projectVoortgangList.length
        )
      : 0;

    // Count by status for chart
    const statusCounts: Record<string, number> = {};
    for (const p of projectVoortgangList) {
      statusCounts[p.statusLabel] = (statusCounts[p.statusLabel] || 0) + 1;
    }

    const statusData = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
    }));

    // Identify projects at risk (over time or over budget)
    const projectenOpRisico = projectVoortgangList.filter(
      (p) => p.dagenOver !== null && p.dagenOver < 0
    );

    return {
      samenvatting: {
        aantalProjecten: projectVoortgangList.length,
        totaalGeplandeUren: Math.round(totaalGeplandeUren * 10) / 10,
        totaalGewerktUren: Math.round(totaalGewerktUren * 10) / 10,
        totaalResterendeUren: Math.round(totaalResterendeUren * 10) / 10,
        gemiddeldeVoortgang,
        projectenOpRisico: projectenOpRisico.length,
      },
      projecten: projectVoortgangList,
      statusData,
      projectenOpRisico: projectenOpRisico.map((p) => ({
        projectId: p.projectId,
        projectNaam: p.projectNaam,
        klantNaam: p.klantNaam,
        dagenOverTijd: Math.abs(p.dagenOver || 0),
        voortgangPercentage: p.voortgangPercentage,
      })),
    };
  },
});

/**
 * Get detailed project timeline data.
 * Returns daily/weekly progress data for a specific project or all projects.
 */
export const getProjectTimeline = query({
  args: {
    projectId: v.optional(v.id("projecten")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get project(s)
    let projecten = [];
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (project && project.userId.toString() === userId.toString()) {
        projecten = [project];
      }
    } else {
      projecten = await ctx.db
        .query("projecten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    }

    // Filter by date range if provided
    if (args.startDate || args.endDate) {
      projecten = projecten.filter((p) => {
        if (args.startDate && p.createdAt < args.startDate) return false;
        if (args.endDate && p.createdAt > args.endDate) return false;
        return true;
      });
    }

    const projectIds = projecten.map((p) => p._id);

    // Get all urenRegistraties for these projects
    const urenResults = await Promise.all(
      projectIds.map((id) =>
        ctx.db
          .query("urenRegistraties")
          .withIndex("by_project", (q) => q.eq("projectId", id))
          .collect()
      )
    );

    // Get offertes for project names
    const offerteIds = projecten.map((p) => p.offerteId);
    const offertesResults = await Promise.all(offerteIds.map((id) => ctx.db.get(id)));
    const offerteById = new Map(offertesResults.filter(Boolean).map((o) => [o!._id.toString(), o!]));

    // Aggregate by date
    type DailyData = {
      datum: string;
      uren: number;
      projecten: Record<string, number>;
      medewerkers: Record<string, number>;
    };

    const dailyData: Record<string, DailyData> = {};

    urenResults.flat().forEach((uren) => {
      const datum = uren.datum;
      if (!dailyData[datum]) {
        dailyData[datum] = {
          datum,
          uren: 0,
          projecten: {},
          medewerkers: {},
        };
      }
      dailyData[datum].uren += uren.uren;

      const project = projecten.find((p) => p._id.toString() === uren.projectId.toString());
      const offerte = project ? offerteById.get(project.offerteId.toString()) : null;
      const projectNaam = project?.naam || "Onbekend";

      dailyData[datum].projecten[projectNaam] = (dailyData[datum].projecten[projectNaam] || 0) + uren.uren;
      dailyData[datum].medewerkers[uren.medewerker] = (dailyData[datum].medewerkers[uren.medewerker] || 0) + uren.uren;
    });

    // Convert to array and sort by date
    const timelineData = Object.values(dailyData)
      .sort((a, b) => a.datum.localeCompare(b.datum))
      .map((d) => ({
        datum: d.datum,
        uren: Math.round(d.uren * 10) / 10,
        projecten: Object.entries(d.projecten).map(([naam, uren]) => ({
          naam,
          uren: Math.round(uren * 10) / 10,
        })),
        medewerkers: Object.entries(d.medewerkers).map(([naam, uren]) => ({
          naam,
          uren: Math.round(uren * 10) / 10,
        })),
      }));

    // Calculate cumulative progress
    let cumulatief = 0;
    const cumulatieveData = timelineData.map((d) => {
      cumulatief += d.uren;
      return {
        datum: d.datum,
        dagUren: d.uren,
        cumulatiefUren: Math.round(cumulatief * 10) / 10,
      };
    });

    // Get all project names for legend
    const projectNamen = [...new Set(projecten.map((p) => p.naam))];
    const medewerkerNamen = [...new Set(urenResults.flat().map((u) => u.medewerker))];

    return {
      samenvatting: {
        aantalDagen: timelineData.length,
        totaalUren: Math.round(cumulatief * 10) / 10,
        gemiddeldeUrenPerDag: timelineData.length > 0
          ? Math.round((cumulatief / timelineData.length) * 10) / 10
          : 0,
      },
      timelineData,
      cumulatieveData,
      projectNamen,
      medewerkerNamen,
    };
  },
});
