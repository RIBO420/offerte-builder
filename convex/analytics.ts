import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { Id } from "./_generated/dataModel";

// Date filter validator for reuse across queries
const dateFilterValidator = {
  startDate: v.optional(v.number()),
  endDate: v.optional(v.number()),
  // Period comparison: compare with previous period of same length
  comparePreviousPeriod: v.optional(v.boolean()),
};

// Helper to get month key from timestamp
function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Helper to get quarter key from timestamp
function getQuarterKey(timestamp: number): string {
  const date = new Date(timestamp);
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
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

// Helper to calculate days between two timestamps
function daysBetween(start: number, end: number): number {
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

// Helper to calculate simple linear regression for forecasting
function linearRegression(data: { x: number; y: number }[]): { slope: number; intercept: number } {
  if (data.length === 0) return { slope: 0, intercept: 0 };

  const n = data.length;
  const sumX = data.reduce((acc, p) => acc + p.x, 0);
  const sumY = data.reduce((acc, p) => acc + p.y, 0);
  const sumXY = data.reduce((acc, p) => acc + p.x * p.y, 0);
  const sumX2 = data.reduce((acc, p) => acc + p.x * p.x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

// Helper to get week key from timestamp
function getWeekKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  // Get ISO week number
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

// Main analytics query (for authenticated user)
export const getAnalyticsData = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get all offertes for authenticated user
    let offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter by date range if provided
    if (args.startDate || args.endDate) {
      offertes = offertes.filter((o) => {
        if (args.startDate && o.createdAt < args.startDate) return false;
        if (args.endDate && o.createdAt > args.endDate) return false;
        return true;
      });
    }

    // Calculate KPIs
    const totaalOffertes = offertes.length;
    const concept = offertes.filter((o) => o.status === "concept");
    const voorcalculatie = offertes.filter((o) => o.status === "voorcalculatie");
    const verzonden = offertes.filter((o) => o.status === "verzonden");
    const geaccepteerd = offertes.filter((o) => o.status === "geaccepteerd");
    const afgewezen = offertes.filter((o) => o.status === "afgewezen");
    const afgehandeld = geaccepteerd.length + afgewezen.length;

    const winRate = afgehandeld > 0
      ? Math.round((geaccepteerd.length / afgehandeld) * 100)
      : 0;

    const totaleOmzet = geaccepteerd.reduce(
      (sum, o) => sum + o.totalen.totaalInclBtw,
      0
    );

    const gemiddeldeWaarde = totaalOffertes > 0
      ? offertes.reduce((sum, o) => sum + o.totalen.totaalInclBtw, 0) / totaalOffertes
      : 0;

    // ===== NEW: Sales Pipeline Funnel =====
    // Calculate conversion rates between stages
    const pipelineFunnel = {
      concept: concept.length + voorcalculatie.length + verzonden.length + geaccepteerd.length + afgewezen.length,
      voorcalculatie: voorcalculatie.length + verzonden.length + geaccepteerd.length + afgewezen.length,
      verzonden: verzonden.length + geaccepteerd.length + afgewezen.length,
      afgehandeld: geaccepteerd.length + afgewezen.length,
      geaccepteerd: geaccepteerd.length,
    };

    // Conversion rates between stages
    const conversionRates = {
      conceptToVoorcalculatie: pipelineFunnel.concept > 0
        ? Math.round((pipelineFunnel.voorcalculatie / pipelineFunnel.concept) * 100)
        : 0,
      voorcalculatieToVerzonden: pipelineFunnel.voorcalculatie > 0
        ? Math.round((pipelineFunnel.verzonden / pipelineFunnel.voorcalculatie) * 100)
        : 0,
      verzondenToAfgehandeld: pipelineFunnel.verzonden > 0
        ? Math.round((pipelineFunnel.afgehandeld / pipelineFunnel.verzonden) * 100)
        : 0,
      afgehandeldToWon: pipelineFunnel.afgehandeld > 0
        ? Math.round((pipelineFunnel.geaccepteerd / pipelineFunnel.afgehandeld) * 100)
        : 0,
      overallConversion: pipelineFunnel.concept > 0
        ? Math.round((pipelineFunnel.geaccepteerd / pipelineFunnel.concept) * 100)
        : 0,
    };

    // ===== NEW: Deal Cycle Time =====
    // Calculate average days from creation to acceptance
    const acceptedWithTimes = geaccepteerd.filter(o => o.createdAt && o.updatedAt);
    const cycleTimes = acceptedWithTimes.map(o => daysBetween(o.createdAt, o.updatedAt));
    const avgCycleTime = cycleTimes.length > 0
      ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length)
      : 0;

    // Calculate cycle time for sent to response
    const verzondenWithResponse = [...geaccepteerd, ...afgewezen].filter(o => o.verzondenAt);
    const responseTimes = verzondenWithResponse.map(o =>
      daysBetween(o.verzondenAt!, o.updatedAt)
    );
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    // Monthly trend data
    const monthlyData: Record<string, {
      maand: string;
      aanleg: number;
      onderhoud: number;
      totaal: number;
      omzet: number;
    }> = {};

    // Quarterly revenue data
    const quarterlyRevenue: Record<string, {
      kwartaal: string;
      omzet: number;
      count: number;
    }> = {};

    // Scope margin data
    const scopeMargins: Record<string, {
      scope: string;
      totaal: number;
      marge: number;
      count: number;
    }> = {};

    // Customer revenue data - enhanced with repeat customer tracking
    const customerData: Record<string, {
      klantId: string | null;
      klantNaam: string;
      totaalOmzet: number;
      aantalOffertes: number;
      aantalGeaccepteerd: number;
      gemiddeldeWaarde: number;
      isRepeatCustomer: boolean;
      firstOfferteDate: number;
      lastOfferteDate: number;
    }> = {};

    // Process all offertes
    for (const offerte of offertes) {
      const monthKey = getMonthKey(offerte.createdAt);
      const quarterKey = getQuarterKey(offerte.createdAt);

      // Monthly aggregation
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          maand: getMonthName(monthKey),
          aanleg: 0,
          onderhoud: 0,
          totaal: 0,
          omzet: 0,
        };
      }

      monthlyData[monthKey].totaal++;
      if (offerte.type === "aanleg") {
        monthlyData[monthKey].aanleg++;
      } else {
        monthlyData[monthKey].onderhoud++;
      }

      if (offerte.status === "geaccepteerd") {
        monthlyData[monthKey].omzet += offerte.totalen.totaalInclBtw;
      }

      // Quarterly revenue (only accepted)
      if (offerte.status === "geaccepteerd") {
        if (!quarterlyRevenue[quarterKey]) {
          quarterlyRevenue[quarterKey] = {
            kwartaal: quarterKey,
            omzet: 0,
            count: 0,
          };
        }
        quarterlyRevenue[quarterKey].omzet += offerte.totalen.totaalInclBtw;
        quarterlyRevenue[quarterKey].count++;
      }

      // Scope margins (from accepted offertes)
      if (offerte.status === "geaccepteerd" && offerte.scopes) {
        for (const scope of offerte.scopes) {
          if (!scopeMargins[scope]) {
            scopeMargins[scope] = {
              scope,
              totaal: 0,
              marge: 0,
              count: 0,
            };
          }
          // Approximate scope contribution based on number of scopes
          const scopeContribution = offerte.totalen.totaalExBtw / offerte.scopes.length;
          const scopeMarge = offerte.totalen.marge / offerte.scopes.length;
          scopeMargins[scope].totaal += scopeContribution;
          scopeMargins[scope].marge += scopeMarge;
          scopeMargins[scope].count++;
        }
      }

      // Customer aggregation - enhanced with repeat customer tracking
      const customerKey = offerte.klant.naam;
      if (!customerData[customerKey]) {
        customerData[customerKey] = {
          klantId: offerte.klantId ?? null,
          klantNaam: offerte.klant.naam,
          totaalOmzet: 0,
          aantalOffertes: 0,
          aantalGeaccepteerd: 0,
          gemiddeldeWaarde: 0,
          isRepeatCustomer: false,
          firstOfferteDate: offerte.createdAt,
          lastOfferteDate: offerte.createdAt,
        };
      }
      customerData[customerKey].aantalOffertes++;
      if (offerte.createdAt < customerData[customerKey].firstOfferteDate) {
        customerData[customerKey].firstOfferteDate = offerte.createdAt;
      }
      if (offerte.createdAt > customerData[customerKey].lastOfferteDate) {
        customerData[customerKey].lastOfferteDate = offerte.createdAt;
      }
      if (offerte.status === "geaccepteerd") {
        customerData[customerKey].totaalOmzet += offerte.totalen.totaalInclBtw;
        customerData[customerKey].aantalGeaccepteerd++;
      }
    }

    // Calculate customer averages and identify repeat customers
    let repeatCustomerCount = 0;
    let totalCustomers = 0;
    for (const customer of Object.values(customerData)) {
      totalCustomers++;
      if (customer.aantalGeaccepteerd > 0) {
        customer.gemiddeldeWaarde = customer.totaalOmzet / customer.aantalGeaccepteerd;
      }
      // A repeat customer has 2+ accepted projects
      if (customer.aantalGeaccepteerd >= 2) {
        customer.isRepeatCustomer = true;
        repeatCustomerCount++;
      }
    }
    const repeatCustomerPercentage = totalCustomers > 0
      ? Math.round((repeatCustomerCount / totalCustomers) * 100)
      : 0;

    // Sort and format data
    const sortedMonthlyData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => data);

    const sortedQuarterlyRevenue = Object.entries(quarterlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => data);

    // Enhanced scope data with profitability ranking
    const sortedScopeMargins = Object.values(scopeMargins)
      .map((scope) => ({
        ...scope,
        margePercentage: scope.totaal > 0
          ? Math.round((scope.marge / scope.totaal) * 100)
          : 0,
        omzet: scope.totaal + scope.marge, // Revenue including margin
        gemiddeldPerOfferte: scope.count > 0 ? (scope.totaal + scope.marge) / scope.count : 0,
      }))
      .sort((a, b) => b.omzet - a.omzet); // Sort by total revenue

    // Calculate total scope revenue for percentage calculations
    const totalScopeRevenue = sortedScopeMargins.reduce((sum, s) => sum + s.omzet, 0);

    const topKlanten = Object.values(customerData)
      .sort((a, b) => b.totaalOmzet - a.totaalOmzet)
      .slice(0, 10);

    // ===== NEW: Trend with Moving Averages and Forecasting =====
    // Calculate 3-month moving average for the trend data
    const trendWithMovingAvg = sortedMonthlyData.map((month, index) => {
      // Calculate 3-month moving average (centered)
      let movingAvgTotal = 0;
      let movingAvgOmzet = 0;
      let count = 0;

      for (let i = Math.max(0, index - 1); i <= Math.min(sortedMonthlyData.length - 1, index + 1); i++) {
        movingAvgTotal += sortedMonthlyData[i].totaal;
        movingAvgOmzet += sortedMonthlyData[i].omzet;
        count++;
      }

      return {
        ...month,
        movingAvgTotal: count > 0 ? Math.round(movingAvgTotal / count * 10) / 10 : 0,
        movingAvgOmzet: count > 0 ? Math.round(movingAvgOmzet / count) : 0,
      };
    });

    // Generate 3-month forecast using linear regression
    const forecast: { maand: string; forecastTotal: number; forecastOmzet: number }[] = [];
    if (sortedMonthlyData.length >= 3) {
      // Use last 6 months (or all data if less) for regression
      const recentData = sortedMonthlyData.slice(-6);
      const totalPoints = recentData.map((d, i) => ({ x: i, y: d.totaal }));
      const omzetPoints = recentData.map((d, i) => ({ x: i, y: d.omzet }));

      const totalRegression = linearRegression(totalPoints);
      const omzetRegression = linearRegression(omzetPoints);

      // Get the last month to project from
      const lastMonthKey = Object.keys(monthlyData).sort().pop();
      if (lastMonthKey) {
        const [lastYear, lastMonth] = lastMonthKey.split("-").map(Number);

        for (let i = 1; i <= 3; i++) {
          const nextMonth = ((lastMonth - 1 + i) % 12) + 1;
          const nextYear = lastYear + Math.floor((lastMonth - 1 + i) / 12);
          const monthKey = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;

          const xValue = recentData.length + i - 1;
          const forecastTotal = Math.max(0, Math.round(totalRegression.intercept + totalRegression.slope * xValue));
          const forecastOmzet = Math.max(0, Math.round(omzetRegression.intercept + omzetRegression.slope * xValue));

          forecast.push({
            maand: getMonthName(monthKey),
            forecastTotal,
            forecastOmzet,
          });
        }
      }
    }

    // Status distribution for charts
    const statusVerdeling = {
      concept: offertes.filter((o) => o.status === "concept").length,
      voorcalculatie: offertes.filter((o) => o.status === "voorcalculatie").length,
      verzonden: offertes.filter((o) => o.status === "verzonden").length,
      geaccepteerd: geaccepteerd.length,
      afgewezen: afgewezen.length,
    };

    const typeVerdeling = {
      aanleg: offertes.filter((o) => o.type === "aanleg").length,
      onderhoud: offertes.filter((o) => o.type === "onderhoud").length,
    };

    // Export data (all offertes with relevant fields)
    const exportData = offertes.map((o) => ({
      offerteNummer: o.offerteNummer,
      type: o.type,
      status: o.status,
      klantNaam: o.klant.naam,
      klantAdres: o.klant.adres,
      klantPostcode: o.klant.postcode,
      klantPlaats: o.klant.plaats,
      klantEmail: o.klant.email ?? "",
      klantTelefoon: o.klant.telefoon ?? "",
      materiaalkosten: o.totalen.materiaalkosten,
      arbeidskosten: o.totalen.arbeidskosten,
      totaalUren: o.totalen.totaalUren,
      subtotaal: o.totalen.subtotaal,
      marge: o.totalen.marge,
      margePercentage: o.totalen.margePercentage,
      totaalExBtw: o.totalen.totaalExBtw,
      btw: o.totalen.btw,
      totaalInclBtw: o.totalen.totaalInclBtw,
      aangemaakt: o.createdAt,
      bijgewerkt: o.updatedAt,
      verzonden: o.verzondenAt ?? null,
    }));

    return {
      kpis: {
        winRate,
        gemiddeldeWaarde,
        totaleOmzet,
        totaalOffertes,
        geaccepteerdCount: geaccepteerd.length,
        afgewezenCount: afgewezen.length,
        // NEW: Additional KPIs
        avgCycleTime,
        avgResponseTime,
        repeatCustomerPercentage,
        repeatCustomerCount,
        totalCustomers,
        overallConversion: conversionRates.overallConversion,
      },
      // NEW: Pipeline funnel data
      pipelineFunnel,
      conversionRates,
      // Enhanced monthly trend with moving averages
      maandelijkseTrend: trendWithMovingAvg,
      // NEW: Forecast data
      forecast,
      kwartaalOmzet: sortedQuarterlyRevenue,
      // Enhanced scope margins with revenue ranking
      scopeMarges: sortedScopeMargins,
      totalScopeRevenue,
      topKlanten,
      statusVerdeling,
      typeVerdeling,
      exportData,
    };
  },
});

// ============================================
// Voorcalculatie vs Nacalculatie Analysis
// ============================================

/**
 * Get comprehensive comparison between voorcalculatie (planned) and nacalculatie (actual).
 * Returns variance per project, per scope, accuracy score, and trends over time.
 */
export const getVoorcalculatieNacalculatieVergelijking = query({
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

    // Get all voorcalculaties and nacalculaties
    const projectIds = projecten.map((p) => p._id);
    const offerteIds = projecten.map((p) => p.offerteId);

    // Fetch all related data in parallel
    const [voorcalculatiesResults, nacalculatiesResults, offertesResults] = await Promise.all([
      // Get voorcalculaties by project and offerte
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
      // Get nacalculaties
      Promise.all(
        projectIds.map((id) =>
          ctx.db
            .query("nacalculaties")
            .withIndex("by_project", (q) => q.eq("projectId", id))
            .unique()
        )
      ),
      // Get offertes for names
      Promise.all(offerteIds.map((id) => ctx.db.get(id))),
    ]);

    // Build lookup maps
    const voorcalculatieByProject = new Map<string, typeof voorcalculatiesResults[0]>();
    const voorcalculatieByOfferte = new Map<string, typeof voorcalculatiesResults[0]>();

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

    // Calculate project-level comparisons
    type ProjectVergelijking = {
      projectId: string;
      projectNaam: string;
      klantNaam: string;
      createdAt: number;
      maand: string;
      geplandeUren: number;
      werkelijkeUren: number;
      afwijkingUren: number;
      afwijkingPercentage: number;
      isAccuraat: boolean; // within 10% variance
      scopeVergelijkingen: Array<{
        scope: string;
        geplandeUren: number;
        werkelijkeUren: number;
        afwijkingUren: number;
        afwijkingPercentage: number;
      }>;
    };

    const projectVergelijkingen: ProjectVergelijking[] = [];
    const scopeAggregatie: Record<string, {
      scope: string;
      totaalGepland: number;
      totaalWerkelijk: number;
      aantalProjecten: number;
    }> = {};

    for (const project of projecten) {
      // Get voorcalculatie (try offerte first, then project)
      const voorcalculatie =
        voorcalculatieByOfferte.get(project.offerteId.toString()) ||
        voorcalculatieByProject.get(project._id.toString());

      const nacalculatie = nacalculatieByProject.get(project._id.toString());
      const offerte = offerteById.get(project.offerteId.toString());

      if (!voorcalculatie || !nacalculatie) continue;

      const geplandeUren = voorcalculatie.normUrenTotaal;
      const werkelijkeUren = nacalculatie.werkelijkeUren;
      const afwijkingUren = werkelijkeUren - geplandeUren;
      const afwijkingPercentage = geplandeUren > 0
        ? Math.round((afwijkingUren / geplandeUren) * 100 * 10) / 10
        : 0;

      // Calculate scope-level vergelijking
      const scopeVergelijkingen: ProjectVergelijking["scopeVergelijkingen"] = [];
      const normUrenPerScope = voorcalculatie.normUrenPerScope || {};
      const afwijkingenPerScope = nacalculatie.afwijkingenPerScope || {};

      const allScopes = new Set([
        ...Object.keys(normUrenPerScope),
        ...Object.keys(afwijkingenPerScope),
      ]);

      for (const scope of allScopes) {
        const scopeGepland = normUrenPerScope[scope] || 0;
        const scopeAfwijking = afwijkingenPerScope[scope] || 0;
        const scopeWerkelijk = scopeGepland + scopeAfwijking;

        // Aggregate scope data
        if (!scopeAggregatie[scope]) {
          scopeAggregatie[scope] = {
            scope,
            totaalGepland: 0,
            totaalWerkelijk: 0,
            aantalProjecten: 0,
          };
        }
        scopeAggregatie[scope].totaalGepland += scopeGepland;
        scopeAggregatie[scope].totaalWerkelijk += scopeWerkelijk;
        scopeAggregatie[scope].aantalProjecten++;

        scopeVergelijkingen.push({
          scope,
          geplandeUren: scopeGepland,
          werkelijkeUren: scopeWerkelijk,
          afwijkingUren: scopeAfwijking,
          afwijkingPercentage: scopeGepland > 0
            ? Math.round((scopeAfwijking / scopeGepland) * 100 * 10) / 10
            : 0,
        });
      }

      projectVergelijkingen.push({
        projectId: project._id.toString(),
        projectNaam: project.naam,
        klantNaam: offerte?.klant.naam || "Onbekend",
        createdAt: project.createdAt,
        maand: getMonthName(getMonthKey(project.createdAt)),
        geplandeUren,
        werkelijkeUren,
        afwijkingUren,
        afwijkingPercentage,
        isAccuraat: Math.abs(afwijkingPercentage) <= 10,
        scopeVergelijkingen,
      });
    }

    // Calculate accuracy metrics
    const totaalProjecten = projectVergelijkingen.length;
    const accurateProjecten = projectVergelijkingen.filter((p) => p.isAccuraat).length;
    const accuracyScore = totaalProjecten > 0
      ? Math.round((accurateProjecten / totaalProjecten) * 100)
      : 0;

    // Calculate average variance
    const gemiddeldeAfwijking = totaalProjecten > 0
      ? Math.round(
          projectVergelijkingen.reduce((sum, p) => sum + p.afwijkingPercentage, 0) / totaalProjecten * 10
        ) / 10
      : 0;

    // Calculate total hours comparison
    const totaalGeplandeUren = projectVergelijkingen.reduce((sum, p) => sum + p.geplandeUren, 0);
    const totaalWerkelijkeUren = projectVergelijkingen.reduce((sum, p) => sum + p.werkelijkeUren, 0);

    // Prepare scope summary data for charts
    const scopeSamenvatting = Object.values(scopeAggregatie).map((s) => ({
      scope: s.scope,
      geplandeUren: Math.round(s.totaalGepland * 10) / 10,
      werkelijkeUren: Math.round(s.totaalWerkelijk * 10) / 10,
      afwijkingUren: Math.round((s.totaalWerkelijk - s.totaalGepland) * 10) / 10,
      afwijkingPercentage: s.totaalGepland > 0
        ? Math.round(((s.totaalWerkelijk - s.totaalGepland) / s.totaalGepland) * 100 * 10) / 10
        : 0,
      aantalProjecten: s.aantalProjecten,
    })).sort((a, b) => Math.abs(b.afwijkingPercentage) - Math.abs(a.afwijkingPercentage));

    // Calculate trend over time (monthly accuracy trend)
    const monthlyTrend: Record<string, {
      maand: string;
      aantalProjecten: number;
      accurateProjecten: number;
      gemiddeldeAfwijking: number;
      totaalAfwijking: number;
    }> = {};

    for (const pv of projectVergelijkingen) {
      const monthKey = getMonthKey(pv.createdAt);
      if (!monthlyTrend[monthKey]) {
        monthlyTrend[monthKey] = {
          maand: getMonthName(monthKey),
          aantalProjecten: 0,
          accurateProjecten: 0,
          gemiddeldeAfwijking: 0,
          totaalAfwijking: 0,
        };
      }
      monthlyTrend[monthKey].aantalProjecten++;
      if (pv.isAccuraat) monthlyTrend[monthKey].accurateProjecten++;
      monthlyTrend[monthKey].totaalAfwijking += pv.afwijkingPercentage;
    }

    // Calculate monthly averages
    const trendData = Object.entries(monthlyTrend)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => ({
        ...data,
        gemiddeldeAfwijking: data.aantalProjecten > 0
          ? Math.round((data.totaalAfwijking / data.aantalProjecten) * 10) / 10
          : 0,
        accuracyPercentage: data.aantalProjecten > 0
          ? Math.round((data.accurateProjecten / data.aantalProjecten) * 100)
          : 0,
      }));

    // Calculate previous period comparison if requested
    let previousPeriodComparison = null;
    if (args.comparePreviousPeriod && args.startDate && args.endDate) {
      const prevRange = getPreviousPeriodRange(args.startDate, args.endDate);

      // Get projects from previous period
      const prevProjecten = (await ctx.db
        .query("projecten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
      ).filter((p) => p.createdAt >= prevRange.start && p.createdAt < prevRange.end);

      let prevAccurateCount = 0;
      let prevTotalCount = 0;

      for (const project of prevProjecten) {
        const voorcalculatie =
          (await ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
            .unique()) ||
          (await ctx.db
            .query("voorcalculaties")
            .withIndex("by_project", (q) => q.eq("projectId", project._id))
            .unique());

        const nacalculatie = await ctx.db
          .query("nacalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .unique();

        if (voorcalculatie && nacalculatie) {
          prevTotalCount++;
          const variance = voorcalculatie.normUrenTotaal > 0
            ? Math.abs((nacalculatie.werkelijkeUren - voorcalculatie.normUrenTotaal) / voorcalculatie.normUrenTotaal) * 100
            : 0;
          if (variance <= 10) prevAccurateCount++;
        }
      }

      const prevAccuracyScore = prevTotalCount > 0
        ? Math.round((prevAccurateCount / prevTotalCount) * 100)
        : 0;

      previousPeriodComparison = {
        prevAccuracyScore,
        accuracyChange: accuracyScore - prevAccuracyScore,
        prevTotalProjecten: prevTotalCount,
        projectenChange: totaalProjecten - prevTotalCount,
      };
    }

    return {
      samenvatting: {
        totaalProjecten,
        accurateProjecten,
        accuracyScore,
        gemiddeldeAfwijking,
        totaalGeplandeUren: Math.round(totaalGeplandeUren * 10) / 10,
        totaalWerkelijkeUren: Math.round(totaalWerkelijkeUren * 10) / 10,
        totaalAfwijkingUren: Math.round((totaalWerkelijkeUren - totaalGeplandeUren) * 10) / 10,
      },
      projectVergelijkingen: projectVergelijkingen.sort((a, b) =>
        Math.abs(b.afwijkingPercentage) - Math.abs(a.afwijkingPercentage)
      ),
      scopeSamenvatting,
      trendData,
      previousPeriodComparison,
    };
  },
});

// ============================================
// Enhanced Financial Reports
// ============================================

/**
 * Get comprehensive financial overview with cost breakdowns.
 * Returns revenue, costs, profit margins with monthly aggregation.
 */
export const getFinancieelOverzicht = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    comparePreviousPeriod: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get all accepted offertes for user
    let offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter to accepted only
    offertes = offertes.filter((o) => o.status === "geaccepteerd");

    // Filter by date range if provided
    if (args.startDate || args.endDate) {
      offertes = offertes.filter((o) => {
        if (args.startDate && o.createdAt < args.startDate) return false;
        if (args.endDate && o.createdAt > args.endDate) return false;
        return true;
      });
    }

    // Get all projects and their nacalculaties for actual cost comparison
    const projecten = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const offerteToProject = new Map<string, typeof projecten[0]>();
    for (const project of projecten) {
      offerteToProject.set(project.offerteId.toString(), project);
    }

    // Get instellingen for uurtarief
    const instellingen = await ctx.db
      .query("instellingen")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const uurtarief = instellingen?.uurtarief || 45;

    // Calculate totals
    let totaleOmzet = 0;
    let totaleMateriaalkosten = 0;
    let totaleArbeidskosten = 0;
    let totaleMachineKosten = 0;
    let totaleUren = 0;

    // Monthly aggregation
    const monthlyData: Record<string, {
      maand: string;
      omzet: number;
      materiaalkosten: number;
      arbeidskosten: number;
      machineKosten: number;
      brutomarge: number;
      margePercentage: number;
      aantalProjecten: number;
    }> = {};

    // Scope-based financial data
    const scopeFinancien: Record<string, {
      scope: string;
      omzet: number;
      kosten: number;
      marge: number;
      aantalProjecten: number;
    }> = {};

    // Type-based financial data (aanleg vs onderhoud)
    const typeFinancien = {
      aanleg: { omzet: 0, kosten: 0, marge: 0, aantalProjecten: 0 },
      onderhoud: { omzet: 0, kosten: 0, marge: 0, aantalProjecten: 0 },
    };

    for (const offerte of offertes) {
      const monthKey = getMonthKey(offerte.createdAt);
      const maand = getMonthName(monthKey);

      // Initialize monthly data
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          maand,
          omzet: 0,
          materiaalkosten: 0,
          arbeidskosten: 0,
          machineKosten: 0,
          brutomarge: 0,
          margePercentage: 0,
          aantalProjecten: 0,
        };
      }

      // Calculate costs from regels
      let materiaalkosten = 0;
      let arbeidskosten = 0;
      let machineKosten = 0;

      for (const regel of offerte.regels) {
        switch (regel.type) {
          case "materiaal":
            materiaalkosten += regel.totaal;
            break;
          case "arbeid":
            arbeidskosten += regel.totaal;
            break;
          case "machine":
            machineKosten += regel.totaal;
            break;
        }
      }

      const offerteOmzet = offerte.totalen.totaalExBtw;
      const offerteMarge = offerte.totalen.marge;

      // Update totals
      totaleOmzet += offerteOmzet;
      totaleMateriaalkosten += materiaalkosten;
      totaleArbeidskosten += arbeidskosten;
      totaleMachineKosten += machineKosten;
      totaleUren += offerte.totalen.totaalUren;

      // Update monthly data
      monthlyData[monthKey].omzet += offerteOmzet;
      monthlyData[monthKey].materiaalkosten += materiaalkosten;
      monthlyData[monthKey].arbeidskosten += arbeidskosten;
      monthlyData[monthKey].machineKosten += machineKosten;
      monthlyData[monthKey].brutomarge += offerteMarge;
      monthlyData[monthKey].aantalProjecten++;

      // Update type financien
      const type = offerte.type;
      typeFinancien[type].omzet += offerteOmzet;
      typeFinancien[type].kosten += materiaalkosten + arbeidskosten + machineKosten;
      typeFinancien[type].marge += offerteMarge;
      typeFinancien[type].aantalProjecten++;

      // Update scope financien
      if (offerte.scopes) {
        const scopeCount = offerte.scopes.length;
        for (const scope of offerte.scopes) {
          if (!scopeFinancien[scope]) {
            scopeFinancien[scope] = {
              scope,
              omzet: 0,
              kosten: 0,
              marge: 0,
              aantalProjecten: 0,
            };
          }
          // Distribute evenly across scopes (approximation)
          scopeFinancien[scope].omzet += offerteOmzet / scopeCount;
          scopeFinancien[scope].kosten += (materiaalkosten + arbeidskosten + machineKosten) / scopeCount;
          scopeFinancien[scope].marge += offerteMarge / scopeCount;
          scopeFinancien[scope].aantalProjecten++;
        }
      }
    }

    // Calculate monthly percentages
    const sortedMonthlyData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => ({
        ...data,
        margePercentage: data.omzet > 0
          ? Math.round((data.brutomarge / data.omzet) * 100 * 10) / 10
          : 0,
      }));

    // Calculate overall bruto profit and margin
    const totaleKosten = totaleMateriaalkosten + totaleArbeidskosten + totaleMachineKosten;
    const brutomarge = totaleOmzet - totaleKosten;
    const brutomargePercentage = totaleOmzet > 0
      ? Math.round((brutomarge / totaleOmzet) * 100 * 10) / 10
      : 0;

    // Prepare scope data for charts
    const scopeData = Object.values(scopeFinancien)
      .map((s) => ({
        ...s,
        omzet: Math.round(s.omzet),
        kosten: Math.round(s.kosten),
        marge: Math.round(s.marge),
        margePercentage: s.omzet > 0
          ? Math.round((s.marge / s.omzet) * 100 * 10) / 10
          : 0,
      }))
      .sort((a, b) => b.omzet - a.omzet);

    // Prepare type data for charts
    const typeData = [
      {
        type: "Aanleg",
        ...typeFinancien.aanleg,
        margePercentage: typeFinancien.aanleg.omzet > 0
          ? Math.round((typeFinancien.aanleg.marge / typeFinancien.aanleg.omzet) * 100 * 10) / 10
          : 0,
      },
      {
        type: "Onderhoud",
        ...typeFinancien.onderhoud,
        margePercentage: typeFinancien.onderhoud.omzet > 0
          ? Math.round((typeFinancien.onderhoud.marge / typeFinancien.onderhoud.omzet) * 100 * 10) / 10
          : 0,
      },
    ];

    // Cost breakdown for pie chart
    const kostenVerdeling = [
      { naam: "Materiaal", waarde: Math.round(totaleMateriaalkosten), kleur: "#8884d8" },
      { naam: "Arbeid", waarde: Math.round(totaleArbeidskosten), kleur: "#82ca9d" },
      { naam: "Machines", waarde: Math.round(totaleMachineKosten), kleur: "#ffc658" },
    ];

    // Calculate previous period comparison if requested
    let previousPeriodComparison = null;
    if (args.comparePreviousPeriod && args.startDate && args.endDate) {
      const prevRange = getPreviousPeriodRange(args.startDate, args.endDate);

      const prevOffertes = (await ctx.db
        .query("offertes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
      ).filter((o) =>
        o.status === "geaccepteerd" &&
        o.createdAt >= prevRange.start &&
        o.createdAt < prevRange.end
      );

      const prevOmzet = prevOffertes.reduce((sum, o) => sum + o.totalen.totaalExBtw, 0);
      const prevMarge = prevOffertes.reduce((sum, o) => sum + o.totalen.marge, 0);
      const prevMargePercentage = prevOmzet > 0
        ? Math.round((prevMarge / prevOmzet) * 100 * 10) / 10
        : 0;

      previousPeriodComparison = {
        prevOmzet: Math.round(prevOmzet),
        omzetChange: Math.round(totaleOmzet - prevOmzet),
        omzetChangePercentage: prevOmzet > 0
          ? Math.round(((totaleOmzet - prevOmzet) / prevOmzet) * 100)
          : 0,
        prevMargePercentage,
        margeChangePercentage: brutomargePercentage - prevMargePercentage,
        prevAantalProjecten: prevOffertes.length,
        projectenChange: offertes.length - prevOffertes.length,
      };
    }

    return {
      samenvatting: {
        totaleOmzet: Math.round(totaleOmzet),
        totaleKosten: Math.round(totaleKosten),
        brutomarge: Math.round(brutomarge),
        brutomargePercentage,
        totaleMateriaalkosten: Math.round(totaleMateriaalkosten),
        totaleArbeidskosten: Math.round(totaleArbeidskosten),
        totaleMachineKosten: Math.round(totaleMachineKosten),
        totaleUren: Math.round(totaleUren * 10) / 10,
        uurtarief,
        gemiddeldeOmzetPerProject: offertes.length > 0
          ? Math.round(totaleOmzet / offertes.length)
          : 0,
        aantalProjecten: offertes.length,
      },
      maandelijkseData: sortedMonthlyData,
      scopeData,
      typeData,
      kostenVerdeling,
      previousPeriodComparison,
    };
  },
});
