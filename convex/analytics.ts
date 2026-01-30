import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

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

    // Customer revenue data
    const customerData: Record<string, {
      klantId: string | null;
      klantNaam: string;
      totaalOmzet: number;
      aantalOffertes: number;
      gemiddeldeWaarde: number;
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

      // Customer aggregation (only accepted offertes count for revenue)
      const customerKey = offerte.klant.naam;
      if (!customerData[customerKey]) {
        customerData[customerKey] = {
          klantId: offerte.klantId ?? null,
          klantNaam: offerte.klant.naam,
          totaalOmzet: 0,
          aantalOffertes: 0,
          gemiddeldeWaarde: 0,
        };
      }
      customerData[customerKey].aantalOffertes++;
      if (offerte.status === "geaccepteerd") {
        customerData[customerKey].totaalOmzet += offerte.totalen.totaalInclBtw;
      }
    }

    // Calculate customer averages
    for (const customer of Object.values(customerData)) {
      if (customer.aantalOffertes > 0) {
        customer.gemiddeldeWaarde = customer.totaalOmzet / customer.aantalOffertes;
      }
    }

    // Sort and format data
    const sortedMonthlyData = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => data);

    const sortedQuarterlyRevenue = Object.entries(quarterlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => data);

    const sortedScopeMargins = Object.values(scopeMargins)
      .map((scope) => ({
        ...scope,
        margePercentage: scope.totaal > 0
          ? Math.round((scope.marge / scope.totaal) * 100)
          : 0,
      }))
      .sort((a, b) => b.totaal - a.totaal);

    const topKlanten = Object.values(customerData)
      .sort((a, b) => b.totaalOmzet - a.totaalOmzet)
      .slice(0, 10);

    // Status distribution for charts
    const statusVerdeling = {
      concept: offertes.filter((o) => o.status === "concept").length,
      definitief: offertes.filter((o) => o.status === "definitief").length,
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
      },
      maandelijkseTrend: sortedMonthlyData,
      kwartaalOmzet: sortedQuarterlyRevenue,
      scopeMarges: sortedScopeMargins,
      topKlanten,
      statusVerdeling,
      typeVerdeling,
      exportData,
    };
  },
});
