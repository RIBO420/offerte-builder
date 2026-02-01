/**
 * Medewerker Rapportages - Employee reporting and analytics
 *
 * Provides queries for analyzing employee productivity, comparing performance,
 * and tracking hours worked across different scopes and projects.
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

// Helper to get week key from date string (YYYY-MM-DD)
function getWeekKeyFromDate(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}

// Helper to calculate date range for previous period comparison
function getPreviousPeriodRange(startDate: number, endDate: number): { start: number; end: number } {
  const periodLength = endDate - startDate;
  return {
    start: startDate - periodLength,
    end: startDate,
  };
}

/**
 * Get productivity metrics for a specific employee.
 * Returns hours worked, projects participated, efficiency metrics.
 */
export const getMedewerkerProductiviteit = query({
  args: {
    medewerkerId: v.optional(v.id("medewerkers")),
    medewerkerNaam: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    comparePreviousPeriod: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get medewerker if ID provided
    let medewerkerNaam = args.medewerkerNaam;
    let medewerkerData = null;

    if (args.medewerkerId) {
      medewerkerData = await ctx.db.get(args.medewerkerId);
      if (!medewerkerData || medewerkerData.userId.toString() !== userId.toString()) {
        throw new Error("Medewerker niet gevonden of geen toegang");
      }
      medewerkerNaam = medewerkerData.naam;
    }

    if (!medewerkerNaam) {
      throw new Error("Medewerker ID of naam is verplicht");
    }

    // Get all urenRegistraties for this medewerker
    const allUren = await ctx.db
      .query("urenRegistraties")
      .collect();

    // Filter by medewerker name and user's projects
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const userProjectIds = new Set(projecten.map((p) => p._id.toString()));

    let urenRegistraties = allUren.filter(
      (u) =>
        u.medewerker === medewerkerNaam &&
        userProjectIds.has(u.projectId.toString())
    );

    // Filter by date range if provided
    if (args.startDate || args.endDate) {
      urenRegistraties = urenRegistraties.filter((u) => {
        const datum = new Date(u.datum).getTime();
        if (args.startDate && datum < args.startDate) return false;
        if (args.endDate && datum > args.endDate) return false;
        return true;
      });
    }

    // Get related projects and voorcalculaties for efficiency calculation
    const projectIdSet = new Set(urenRegistraties.map((u) => u.projectId.toString()));
    const relevantProjecten = projecten.filter((p) => projectIdSet.has(p._id.toString()));

    // Get offertes for project names
    const offerteIds = relevantProjecten.map((p) => p.offerteId);
    const offertes = await Promise.all(offerteIds.map((id) => ctx.db.get(id)));
    const offerteById = new Map(offertes.filter(Boolean).map((o) => [o!._id.toString(), o!]));

    // Calculate basic metrics
    const totaalUren = urenRegistraties.reduce((sum, u) => sum + u.uren, 0);
    const uniqueDates = new Set(urenRegistraties.map((u) => u.datum));
    const werkdagen = uniqueDates.size;
    const gemiddeldeUrenPerDag = werkdagen > 0 ? Math.round((totaalUren / werkdagen) * 10) / 10 : 0;

    // Calculate efficiency (actual hours vs expected based on beschikbaarheid)
    let verwachteUren = 0;
    let efficiencyPercentage = 0;

    if (medewerkerData?.beschikbaarheid) {
      const { maxUrenPerDag } = medewerkerData.beschikbaarheid;
      verwachteUren = werkdagen * maxUrenPerDag;
      efficiencyPercentage = verwachteUren > 0
        ? Math.round((totaalUren / verwachteUren) * 100)
        : 0;
    }

    // Hours per scope
    const urenPerScope: Record<string, number> = {};
    for (const uren of urenRegistraties) {
      if (uren.scope) {
        urenPerScope[uren.scope] = (urenPerScope[uren.scope] || 0) + uren.uren;
      }
    }

    const scopeData = Object.entries(urenPerScope)
      .map(([scope, uren]) => ({
        scope,
        uren: Math.round(uren * 10) / 10,
        percentage: totaalUren > 0 ? Math.round((uren / totaalUren) * 100) : 0,
      }))
      .sort((a, b) => b.uren - a.uren);

    // Hours per project
    const urenPerProject: Record<string, { projectId: string; projectNaam: string; klantNaam: string; uren: number }> = {};
    for (const uren of urenRegistraties) {
      const projectId = uren.projectId.toString();
      if (!urenPerProject[projectId]) {
        const project = projecten.find((p) => p._id.toString() === projectId);
        const offerte = project ? offerteById.get(project.offerteId.toString()) : null;
        urenPerProject[projectId] = {
          projectId,
          projectNaam: project?.naam || "Onbekend",
          klantNaam: offerte?.klant.naam || "Onbekend",
          uren: 0,
        };
      }
      urenPerProject[projectId].uren += uren.uren;
    }

    const projectData = Object.values(urenPerProject)
      .map((p) => ({
        ...p,
        uren: Math.round(p.uren * 10) / 10,
      }))
      .sort((a, b) => b.uren - a.uren);

    // Weekly trend
    const weeklyData: Record<string, { week: string; uren: number; dagen: number }> = {};
    for (const uren of urenRegistraties) {
      const weekKey = getWeekKeyFromDate(uren.datum);
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = { week: weekKey, uren: 0, dagen: 0 };
      }
      weeklyData[weekKey].uren += uren.uren;
    }

    // Count unique days per week
    const daysPerWeek: Record<string, Set<string>> = {};
    for (const uren of urenRegistraties) {
      const weekKey = getWeekKeyFromDate(uren.datum);
      if (!daysPerWeek[weekKey]) {
        daysPerWeek[weekKey] = new Set();
      }
      daysPerWeek[weekKey].add(uren.datum);
    }

    Object.keys(weeklyData).forEach((weekKey) => {
      weeklyData[weekKey].dagen = daysPerWeek[weekKey]?.size || 0;
    });

    const weeklyTrend = Object.values(weeklyData)
      .map((w) => ({
        ...w,
        uren: Math.round(w.uren * 10) / 10,
        gemiddeldePerDag: w.dagen > 0 ? Math.round((w.uren / w.dagen) * 10) / 10 : 0,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    // Monthly trend
    const monthlyData: Record<string, { maand: string; uren: number; projecten: Set<string> }> = {};
    for (const uren of urenRegistraties) {
      const date = new Date(uren.datum);
      const monthKey = getMonthKey(date.getTime());
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { maand: getMonthName(monthKey), uren: 0, projecten: new Set() };
      }
      monthlyData[monthKey].uren += uren.uren;
      monthlyData[monthKey].projecten.add(uren.projectId.toString());
    }

    const monthlyTrend = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => ({
        maand: data.maand,
        uren: Math.round(data.uren * 10) / 10,
        aantalProjecten: data.projecten.size,
      }));

    // Previous period comparison
    let previousPeriodComparison = null;
    if (args.comparePreviousPeriod && args.startDate && args.endDate) {
      const prevRange = getPreviousPeriodRange(args.startDate, args.endDate);

      const prevUren = allUren.filter(
        (u) =>
          u.medewerker === medewerkerNaam &&
          userProjectIds.has(u.projectId.toString()) &&
          new Date(u.datum).getTime() >= prevRange.start &&
          new Date(u.datum).getTime() < prevRange.end
      );

      const prevTotaalUren = prevUren.reduce((sum, u) => sum + u.uren, 0);
      const prevWerkdagen = new Set(prevUren.map((u) => u.datum)).size;

      previousPeriodComparison = {
        prevTotaalUren: Math.round(prevTotaalUren * 10) / 10,
        urenChange: Math.round((totaalUren - prevTotaalUren) * 10) / 10,
        urenChangePercentage: prevTotaalUren > 0
          ? Math.round(((totaalUren - prevTotaalUren) / prevTotaalUren) * 100)
          : 0,
        prevWerkdagen,
        werkdagenChange: werkdagen - prevWerkdagen,
      };
    }

    return {
      medewerker: {
        naam: medewerkerNaam,
        functie: medewerkerData?.functie,
        uurtarief: medewerkerData?.uurtarief,
        contractType: medewerkerData?.contractType,
      },
      samenvatting: {
        totaalUren: Math.round(totaalUren * 10) / 10,
        werkdagen,
        gemiddeldeUrenPerDag,
        aantalProjecten: projectIdSet.size,
        verwachteUren,
        efficiencyPercentage,
      },
      scopeData,
      projectData,
      weeklyTrend,
      monthlyTrend,
      previousPeriodComparison,
    };
  },
});

/**
 * Compare productivity across all employees.
 * Returns comparative metrics for all active employees.
 */
export const getMedewerkerVergelijking = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    alleenActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get all medewerkers
    let medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter to active only if requested (default: true)
    if (args.alleenActief !== false) {
      medewerkers = medewerkers.filter((m) => m.isActief);
    }

    // Get all user's projects
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const userProjectIds = new Set(projecten.map((p) => p._id.toString()));

    // Get all urenRegistraties
    let urenRegistraties = (await ctx.db.query("urenRegistraties").collect())
      .filter((u) => userProjectIds.has(u.projectId.toString()));

    // Filter by date range if provided
    if (args.startDate || args.endDate) {
      urenRegistraties = urenRegistraties.filter((u) => {
        const datum = new Date(u.datum).getTime();
        if (args.startDate && datum < args.startDate) return false;
        if (args.endDate && datum > args.endDate) return false;
        return true;
      });
    }

    // Build comparison data for each medewerker
    type MedewerkerVergelijkingData = {
      medewerkerId: string | null;
      naam: string;
      functie: string | null;
      contractType: string | null;
      totaalUren: number;
      werkdagen: number;
      gemiddeldeUrenPerDag: number;
      aantalProjecten: number;
      topScope: string | null;
      topScopeUren: number;
    };

    const vergelijkingData: MedewerkerVergelijkingData[] = [];

    // Create a set of all medewerker names from urenRegistraties
    const allMedewerkerNames = new Set(urenRegistraties.map((u) => u.medewerker));

    // Include both registered medewerkers and names from urenRegistraties
    const medewerkerByName = new Map(medewerkers.map((m) => [m.naam, m]));
    const allNames = new Set([...medewerkers.map((m) => m.naam), ...allMedewerkerNames]);

    for (const naam of allNames) {
      const medewerker = medewerkerByName.get(naam);
      const medewerkerUren = urenRegistraties.filter((u) => u.medewerker === naam);

      if (medewerkerUren.length === 0) continue;

      const totaalUren = medewerkerUren.reduce((sum, u) => sum + u.uren, 0);
      const uniqueDates = new Set(medewerkerUren.map((u) => u.datum));
      const werkdagen = uniqueDates.size;
      const uniqueProjects = new Set(medewerkerUren.map((u) => u.projectId.toString()));

      // Find top scope
      const scopeUren: Record<string, number> = {};
      for (const uren of medewerkerUren) {
        if (uren.scope) {
          scopeUren[uren.scope] = (scopeUren[uren.scope] || 0) + uren.uren;
        }
      }

      let topScope: string | null = null;
      let topScopeUren = 0;
      for (const [scope, uren] of Object.entries(scopeUren)) {
        if (uren > topScopeUren) {
          topScope = scope;
          topScopeUren = uren;
        }
      }

      vergelijkingData.push({
        medewerkerId: medewerker?._id.toString() || null,
        naam,
        functie: medewerker?.functie || null,
        contractType: medewerker?.contractType || null,
        totaalUren: Math.round(totaalUren * 10) / 10,
        werkdagen,
        gemiddeldeUrenPerDag: werkdagen > 0 ? Math.round((totaalUren / werkdagen) * 10) / 10 : 0,
        aantalProjecten: uniqueProjects.size,
        topScope,
        topScopeUren: Math.round(topScopeUren * 10) / 10,
      });
    }

    // Sort by total hours (descending)
    vergelijkingData.sort((a, b) => b.totaalUren - a.totaalUren);

    // Calculate team totals
    const teamTotaalUren = vergelijkingData.reduce((sum, m) => sum + m.totaalUren, 0);
    const teamGemiddeldeUren = vergelijkingData.length > 0
      ? Math.round((teamTotaalUren / vergelijkingData.length) * 10) / 10
      : 0;

    // Prepare chart data for stacked bar (hours per medewerker per scope)
    const scopesSet = new Set<string>();
    for (const uren of urenRegistraties) {
      if (uren.scope) scopesSet.add(uren.scope);
    }
    const scopes = Array.from(scopesSet);

    const stackedBarData = vergelijkingData.map((m) => {
      const medewerkerUren = urenRegistraties.filter((u) => u.medewerker === m.naam);
      const result: Record<string, string | number> = { naam: m.naam };

      for (const scope of scopes) {
        const scopeUren = medewerkerUren
          .filter((u) => u.scope === scope)
          .reduce((sum, u) => sum + u.uren, 0);
        result[scope] = Math.round(scopeUren * 10) / 10;
      }

      return result;
    });

    return {
      samenvatting: {
        aantalMedewerkers: vergelijkingData.length,
        teamTotaalUren: Math.round(teamTotaalUren * 10) / 10,
        teamGemiddeldeUren,
      },
      medewerkers: vergelijkingData,
      stackedBarData,
      scopes,
    };
  },
});

/**
 * Get hours breakdown by scope type across all employees.
 * Returns aggregated scope data for capacity planning.
 */
export const getUrenPerScope = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    groupBy: v.optional(v.union(v.literal("week"), v.literal("maand"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get all user's projects
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const userProjectIds = new Set(projecten.map((p) => p._id.toString()));

    // Get all urenRegistraties
    let urenRegistraties = (await ctx.db.query("urenRegistraties").collect())
      .filter((u) => userProjectIds.has(u.projectId.toString()));

    // Filter by date range if provided
    if (args.startDate || args.endDate) {
      urenRegistraties = urenRegistraties.filter((u) => {
        const datum = new Date(u.datum).getTime();
        if (args.startDate && datum < args.startDate) return false;
        if (args.endDate && datum > args.endDate) return false;
        return true;
      });
    }

    // Aggregate by scope
    const scopeData: Record<string, {
      scope: string;
      totaalUren: number;
      aantalRegistraties: number;
      aantalMedewerkers: Set<string>;
      aantalProjecten: Set<string>;
    }> = {};

    for (const uren of urenRegistraties) {
      const scope = uren.scope || "onbekend";

      if (!scopeData[scope]) {
        scopeData[scope] = {
          scope,
          totaalUren: 0,
          aantalRegistraties: 0,
          aantalMedewerkers: new Set(),
          aantalProjecten: new Set(),
        };
      }

      scopeData[scope].totaalUren += uren.uren;
      scopeData[scope].aantalRegistraties++;
      scopeData[scope].aantalMedewerkers.add(uren.medewerker);
      scopeData[scope].aantalProjecten.add(uren.projectId.toString());
    }

    const scopeSamenvatting = Object.values(scopeData)
      .map((s) => ({
        scope: s.scope,
        totaalUren: Math.round(s.totaalUren * 10) / 10,
        aantalRegistraties: s.aantalRegistraties,
        aantalMedewerkers: s.aantalMedewerkers.size,
        aantalProjecten: s.aantalProjecten.size,
        gemiddeldeUrenPerRegistratie: s.aantalRegistraties > 0
          ? Math.round((s.totaalUren / s.aantalRegistraties) * 10) / 10
          : 0,
      }))
      .sort((a, b) => b.totaalUren - a.totaalUren);

    // Calculate total for percentages
    const totaalUren = scopeSamenvatting.reduce((sum, s) => sum + s.totaalUren, 0);

    // Add percentage to each scope
    const scopeDataWithPercentage = scopeSamenvatting.map((s) => ({
      ...s,
      percentage: totaalUren > 0 ? Math.round((s.totaalUren / totaalUren) * 100) : 0,
    }));

    // Time-based grouping if requested
    let trendData: Array<Record<string, string | number>> = [];
    const groupBy = args.groupBy || "maand";

    if (groupBy === "week") {
      // Group by week
      const weeklyScopes: Record<string, Record<string, number>> = {};

      for (const uren of urenRegistraties) {
        const weekKey = getWeekKeyFromDate(uren.datum);
        const scope = uren.scope || "onbekend";

        if (!weeklyScopes[weekKey]) {
          weeklyScopes[weekKey] = {};
        }
        weeklyScopes[weekKey][scope] = (weeklyScopes[weekKey][scope] || 0) + uren.uren;
      }

      trendData = Object.entries(weeklyScopes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([week, scopes]) => {
          const result: Record<string, string | number> = { periode: week };
          for (const [scope, uren] of Object.entries(scopes)) {
            result[scope] = Math.round(uren * 10) / 10;
          }
          return result;
        });
    } else {
      // Group by month
      const monthlyScopes: Record<string, Record<string, number>> = {};

      for (const uren of urenRegistraties) {
        const date = new Date(uren.datum);
        const monthKey = getMonthKey(date.getTime());
        const scope = uren.scope || "onbekend";

        if (!monthlyScopes[monthKey]) {
          monthlyScopes[monthKey] = {};
        }
        monthlyScopes[monthKey][scope] = (monthlyScopes[monthKey][scope] || 0) + uren.uren;
      }

      trendData = Object.entries(monthlyScopes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([monthKey, scopes]) => {
          const result: Record<string, string | number> = { periode: getMonthName(monthKey) };
          for (const [scope, uren] of Object.entries(scopes)) {
            result[scope] = Math.round(uren * 10) / 10;
          }
          return result;
        });
    }

    // Get all scopes for chart legend
    const allScopes = [...new Set(urenRegistraties.map((u) => u.scope || "onbekend"))];

    return {
      samenvatting: {
        totaalUren: Math.round(totaalUren * 10) / 10,
        aantalScopes: scopeDataWithPercentage.length,
        aantalRegistraties: urenRegistraties.length,
      },
      scopeData: scopeDataWithPercentage,
      trendData,
      scopes: allScopes,
    };
  },
});
