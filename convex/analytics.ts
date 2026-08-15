/**
 * DEPRECATED — `getAnalyticsData` is de datalaag van de óude /rapportages met
 * 8 tabs. Het herontwerp (docs/design/plannen/rapportage-masterplan.md) draait
 * op `convex/rapportage.ts::getRapportage`. Zodra de nieuwe pagina staat, kan
 * dit bestand samen met `src/hooks/use-analytics.ts` weg.
 *
 * Twee queries die hier stonden zijn vervallen omdat ze nooit zijn aangeroepen
 * en elk hun eigen omzetdefinitie meebrachten (R2):
 *   - `getVoorcalculatieNacalculatieVergelijking` → `rapportage.getRapportage`
 *     (`geldLigt.voorNacalculatie`) en `rapportage.getVoorNacalculatieDetail`;
 *   - `getFinancieelOverzicht` → `rapportage.getRapportage`
 *     (`hoeLoopt`, `geldLigt.openstaand`, `besteWerk.scopeMarges`).
 *
 * `totaleOmzet` hieronder komt sinds R2 uit `lib/omzetDefinities.ts`, zodat de
 * oude pagina tijdens de overgang niet alsnog een afwijkend cijfer toont.
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import {
  berekenConversionRates,
  berekenPipelineFunnel,
} from "./lib/pipelineKpis";
import { berekenGetekendeOmzet, isTelbaar } from "./lib/omzetDefinities";
import { klantNaam, klantVeld } from "./lib/offerteKlant";

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


// Main analytics query (for authenticated user)
export const getAnalyticsData = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get all offertes for authenticated user
    const alleOffertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Archief en prullenbak tellen niet mee (R2, gedeelde regel).
    let offertes = alleOffertes.filter(isTelbaar);

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
    const voorcalculatie = offertes.filter((o) => o.status === "voorcalculatie");
    const verzonden = offertes.filter((o) => o.status === "verzonden");
    const geaccepteerd = offertes.filter((o) => o.status === "geaccepteerd");
    const afgewezen = offertes.filter((o) => o.status === "afgewezen");
    const afgehandeld = geaccepteerd.length + afgewezen.length;

    const winRate = afgehandeld > 0
      ? Math.round((geaccepteerd.length / afgehandeld) * 100)
      : 0;

    // R2: één definitie. Peildatum is het tekenmoment, niet de aanmaakdatum,
    // dus dit cijfer wordt over de volledige set berekend met een expliciet
    // venster — precies zoals dashboard.ts en rapportage.ts het doen.
    const totaleOmzet = berekenGetekendeOmzet(
      alleOffertes,
      args.startDate !== undefined || args.endDate !== undefined
        ? {
            start: args.startDate ?? 0,
            eind: args.endDate !== undefined ? args.endDate + 1 : 8.64e15,
          }
        : null
    ).getekendeOmzetInclBtw;

    const gemiddeldeWaarde = totaalOffertes > 0
      ? offertes.reduce((sum, o) => sum + o.totalen.totaalInclBtw, 0) / totaalOffertes
      : 0;

    // ===== Sales Pipeline Funnel =====
    // §5.3b (PRD §2.5e): concepten (wizard auto-save) tellen niet mee in de
    // pipeline-KPI's — de funnel begint bij voorcalculatie.
    const pipelineFunnel = berekenPipelineFunnel({
      voorcalculatie: voorcalculatie.length,
      verzonden: verzonden.length,
      geaccepteerd: geaccepteerd.length,
      afgewezen: afgewezen.length,
    });

    // Conversion rates between stages (excl. concepten)
    const conversionRates = berekenConversionRates(pipelineFunnel);

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
      const customerKey = klantNaam(offerte.klant);
      if (!customerData[customerKey]) {
        customerData[customerKey] = {
          klantId: offerte.klantId ?? null,
          klantNaam: klantNaam(offerte.klant),
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
      klantNaam: klantVeld(o.klant, "naam"),
      klantAdres: klantVeld(o.klant, "adres"),
      klantPostcode: klantVeld(o.klant, "postcode"),
      klantPlaats: klantVeld(o.klant, "plaats"),
      klantEmail: klantVeld(o.klant, "email"),
      klantTelefoon: klantVeld(o.klant, "telefoon"),
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
// Vervallen queries (R2, 15 aug 2026)
// ============================================
//
// `getVoorcalculatieNacalculatieVergelijking` en `getFinancieelOverzicht`
// stonden hier ~600 regels lang zonder ooit te zijn aangeroepen; het
// Calculatie- en Projecten-tab bootsten ze na met hardcoded sample-data. Elk
// bracht bovendien een eigen omzetdefinitie mee (ex btw vs. incl. btw), wat
// precies de tegenstrijdigheid was die R2 opruimt.
//
// Hun functie leeft nu in `convex/rapportage.ts`:
//   - voor/nacalculatie  → `getRapportage().geldLigt.voorNacalculatie`
//                          en `getVoorNacalculatieDetail` (uitklap);
//   - financieel overzicht → `getRapportage().hoeLoopt`,
//                            `.geldLigt.openstaand` en `.besteWerk.scopeMarges`.
