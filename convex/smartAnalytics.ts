import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

/**
 * Smart Analytics API
 * Provides historical data insights for intelligent workflow features:
 * - Price range estimates per scope
 * - Anomaly detection thresholds
 * - Customer history lookups
 */

// Get historical price statistics per scope
export const getScopePriceStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Get all accepted/definitief offertes for this user
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Only use completed offertes for statistics
    const validOffertes = offertes.filter(
      (o) => o.status === "geaccepteerd" || o.status === "definitief"
    );

    if (validOffertes.length === 0) {
      return { hasData: false, stats: {} };
    }

    // Calculate stats per scope
    const scopeStats: Record<
      string,
      {
        scope: string;
        count: number;
        totalPrices: number[];
        avgPrice: number;
        medianPrice: number;
        minPrice: number;
        maxPrice: number;
        p25: number; // 25th percentile (low warning threshold)
        p75: number; // 75th percentile (high warning threshold)
      }
    > = {};

    for (const offerte of validOffertes) {
      if (!offerte.scopes) continue;

      for (const scope of offerte.scopes) {
        if (!scopeStats[scope]) {
          scopeStats[scope] = {
            scope,
            count: 0,
            totalPrices: [],
            avgPrice: 0,
            medianPrice: 0,
            minPrice: 0,
            maxPrice: 0,
            p25: 0,
            p75: 0,
          };
        }

        // Calculate scope contribution from this offerte
        // Estimate: total / number of scopes (rough approximation)
        const scopeContribution =
          offerte.totalen.totaalExBtw / offerte.scopes.length;

        scopeStats[scope].count++;
        scopeStats[scope].totalPrices.push(scopeContribution);
      }
    }

    // Calculate statistical measures
    for (const scope of Object.keys(scopeStats)) {
      const prices = scopeStats[scope].totalPrices.sort((a, b) => a - b);
      const count = prices.length;

      if (count > 0) {
        scopeStats[scope].avgPrice =
          prices.reduce((sum, p) => sum + p, 0) / count;
        scopeStats[scope].medianPrice = prices[Math.floor(count / 2)];
        scopeStats[scope].minPrice = prices[0];
        scopeStats[scope].maxPrice = prices[count - 1];
        scopeStats[scope].p25 = prices[Math.floor(count * 0.25)] || prices[0];
        scopeStats[scope].p75 =
          prices[Math.floor(count * 0.75)] || prices[count - 1];
      }

      // Clean up the prices array to reduce payload size
      delete (scopeStats[scope] as { totalPrices?: number[] }).totalPrices;
    }

    return {
      hasData: true,
      totalOffertes: validOffertes.length,
      stats: scopeStats,
    };
  },
});

// Get price range for a specific scope with optional size parameter
export const getScopePriceRange = query({
  args: {
    scope: v.string(),
    oppervlakte: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const validOffertes = offertes.filter(
      (o) =>
        (o.status === "geaccepteerd" || o.status === "definitief") &&
        o.scopes?.includes(args.scope)
    );

    if (validOffertes.length < 3) {
      return { hasEnoughData: false };
    }

    // Extract prices for this scope
    const scopePrices: { price: number; oppervlakte?: number }[] = [];

    for (const offerte of validOffertes) {
      // Get scope data if available
      const scopeData = offerte.scopeData as Record<string, unknown> | undefined;
      const data = scopeData?.[args.scope] as { oppervlakte?: number } | undefined;

      const scopeContribution =
        offerte.totalen.totaalExBtw / (offerte.scopes?.length || 1);

      scopePrices.push({
        price: scopeContribution,
        oppervlakte: data?.oppervlakte,
      });
    }

    const prices = scopePrices.map((s) => s.price).sort((a, b) => a - b);
    const count = prices.length;

    // Calculate price per m2 if applicable
    const pricesPerM2 = scopePrices
      .filter((s) => s.oppervlakte && s.oppervlakte > 0)
      .map((s) => s.price / s.oppervlakte!);

    const avgPricePerM2 =
      pricesPerM2.length > 0
        ? pricesPerM2.reduce((sum, p) => sum + p, 0) / pricesPerM2.length
        : null;

    // If oppervlakte provided, estimate price based on historical price/m2
    let estimatedPrice: number | null = null;
    if (args.oppervlakte && avgPricePerM2) {
      estimatedPrice = args.oppervlakte * avgPricePerM2;
    }

    return {
      hasEnoughData: true,
      count,
      avgPrice: prices.reduce((sum, p) => sum + p, 0) / count,
      medianPrice: prices[Math.floor(count / 2)],
      minPrice: prices[0],
      maxPrice: prices[count - 1],
      p25: prices[Math.floor(count * 0.25)] || prices[0],
      p75: prices[Math.floor(count * 0.75)] || prices[count - 1],
      avgPricePerM2,
      estimatedPrice,
    };
  },
});

// Get customer with their offerte history for smart autocomplete
export const getKlantWithHistory = query({
  args: {
    klantId: v.id("klanten"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const klant = await ctx.db.get(args.klantId);
    if (!klant || klant.userId !== userId) {
      return null;
    }

    // Get all offertes for this klant
    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("klantId"), args.klantId))
      .order("desc")
      .collect();

    const lastOfferte = offertes[0];

    // Calculate stats
    const acceptedOffertes = offertes.filter(
      (o) => o.status === "geaccepteerd"
    );
    const totalRevenue = acceptedOffertes.reduce(
      (sum, o) => sum + o.totalen.totaalInclBtw,
      0
    );

    // Get common scopes from this customer's offertes
    const scopeCounts: Record<string, number> = {};
    for (const offerte of offertes) {
      if (offerte.scopes) {
        for (const scope of offerte.scopes) {
          scopeCounts[scope] = (scopeCounts[scope] || 0) + 1;
        }
      }
    }
    const commonScopes = Object.entries(scopeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([scope]) => scope);

    return {
      klant,
      stats: {
        totalOffertes: offertes.length,
        acceptedOffertes: acceptedOffertes.length,
        totalRevenue,
        avgOfferteValue:
          offertes.length > 0
            ? offertes.reduce((sum, o) => sum + o.totalen.totaalInclBtw, 0) /
              offertes.length
            : 0,
        commonScopes,
      },
      lastOfferte: lastOfferte
        ? {
            offerteNummer: lastOfferte.offerteNummer,
            type: lastOfferte.type,
            status: lastOfferte.status,
            scopes: lastOfferte.scopes,
            totaalInclBtw: lastOfferte.totalen.totaalInclBtw,
            createdAt: lastOfferte.createdAt,
          }
        : null,
    };
  },
});

// Get klanten with enhanced info for smart selector
export const getKlantenWithStats = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit || 10;

    // Get recent klanten
    const klanten = await ctx.db
      .query("klanten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    // Get all offertes for enrichment
    const allOffertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Enrich each klant with quick stats
    const enrichedKlanten = klanten.map((klant) => {
      const klantOffertes = allOffertes.filter(
        (o) => o.klantId === klant._id
      );
      const lastOfferte = klantOffertes.sort(
        (a, b) => b.createdAt - a.createdAt
      )[0];

      return {
        ...klant,
        offerteCount: klantOffertes.length,
        lastOfferteDate: lastOfferte?.createdAt || null,
        lastOfferteNummer: lastOfferte?.offerteNummer || null,
        lastOfferteStatus: lastOfferte?.status || null,
        totalSpent: klantOffertes
          .filter((o) => o.status === "geaccepteerd")
          .reduce((sum, o) => sum + o.totalen.totaalInclBtw, 0),
      };
    });

    // Sort by lastOfferteDate (most recent first) for better UX
    return enrichedKlanten.sort((a, b) => {
      if (!a.lastOfferteDate && !b.lastOfferteDate) return 0;
      if (!a.lastOfferteDate) return 1;
      if (!b.lastOfferteDate) return -1;
      return b.lastOfferteDate - a.lastOfferteDate;
    });
  },
});

// Detect price anomalies for a given scope price
export const checkPriceAnomaly = query({
  args: {
    scope: v.string(),
    price: v.number(),
    oppervlakte: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const validOffertes = offertes.filter(
      (o) =>
        (o.status === "geaccepteerd" || o.status === "definitief") &&
        o.scopes?.includes(args.scope)
    );

    if (validOffertes.length < 5) {
      // Not enough data for reliable anomaly detection
      return { hasEnoughData: false, isAnomaly: false };
    }

    // Calculate prices per m2 if oppervlakte is known, otherwise use raw prices
    let comparePrices: number[];

    if (args.oppervlakte && args.oppervlakte > 0) {
      // Compare on price per m2 basis
      const pricesPerM2: number[] = [];
      for (const offerte of validOffertes) {
        const scopeData = offerte.scopeData as Record<string, unknown> | undefined;
        const data = scopeData?.[args.scope] as { oppervlakte?: number } | undefined;
        if (data?.oppervlakte && data.oppervlakte > 0) {
          const scopeContribution =
            offerte.totalen.totaalExBtw / (offerte.scopes?.length || 1);
          pricesPerM2.push(scopeContribution / data.oppervlakte);
        }
      }
      comparePrices = pricesPerM2;
    } else {
      // Compare on absolute price basis
      comparePrices = validOffertes.map(
        (o) => o.totalen.totaalExBtw / (o.scopes?.length || 1)
      );
    }

    if (comparePrices.length < 3) {
      return { hasEnoughData: false, isAnomaly: false };
    }

    comparePrices.sort((a, b) => a - b);
    const count = comparePrices.length;

    const median = comparePrices[Math.floor(count / 2)];
    const p10 = comparePrices[Math.floor(count * 0.1)] || comparePrices[0];
    const p90 =
      comparePrices[Math.floor(count * 0.9)] || comparePrices[count - 1];

    // Calculate the value to compare
    const compareValue =
      args.oppervlakte && args.oppervlakte > 0
        ? args.price / args.oppervlakte
        : args.price;

    // Check for anomaly
    const isTooLow = compareValue < p10 * 0.7; // More than 30% below 10th percentile
    const isTooHigh = compareValue > p90 * 1.3; // More than 30% above 90th percentile

    let severity: "none" | "warning" | "critical" = "none";
    let message = "";

    if (isTooLow) {
      const percentBelow = Math.round(((median - compareValue) / median) * 100);
      severity = percentBelow > 50 ? "critical" : "warning";
      message = `Prijs ligt ${percentBelow}% onder de mediaan voor ${args.scope}`;
    } else if (isTooHigh) {
      const percentAbove = Math.round(((compareValue - median) / median) * 100);
      severity = percentAbove > 100 ? "critical" : "warning";
      message = `Prijs ligt ${percentAbove}% boven de mediaan voor ${args.scope}`;
    }

    return {
      hasEnoughData: true,
      isAnomaly: isTooLow || isTooHigh,
      isTooLow,
      isTooHigh,
      severity,
      message,
      stats: {
        median: Math.round(median * 100) / 100,
        p10: Math.round(p10 * 100) / 100,
        p90: Math.round(p90 * 100) / 100,
        yourValue: Math.round(compareValue * 100) / 100,
      },
    };
  },
});

// Get labor hours comparison with historical median
export const getLabourHoursComparison = query({
  args: {
    scope: v.string(),
    hours: v.number(),
    oppervlakte: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const offertes = await ctx.db
      .query("offertes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const validOffertes = offertes.filter(
      (o) =>
        (o.status === "geaccepteerd" || o.status === "definitief") &&
        o.scopes?.includes(args.scope)
    );

    if (validOffertes.length < 3) {
      return { hasEnoughData: false };
    }

    // Calculate hours per scope from regels
    const hoursData: { hours: number; oppervlakte?: number }[] = [];

    for (const offerte of validOffertes) {
      const scopeRegels = offerte.regels.filter(
        (r) => r.scope === args.scope && r.type === "arbeid"
      );
      const totalHours = scopeRegels.reduce((sum, r) => sum + r.hoeveelheid, 0);

      if (totalHours > 0) {
        const scopeData = offerte.scopeData as Record<string, unknown> | undefined;
        const data = scopeData?.[args.scope] as { oppervlakte?: number } | undefined;

        hoursData.push({
          hours: totalHours,
          oppervlakte: data?.oppervlakte,
        });
      }
    }

    if (hoursData.length < 3) {
      return { hasEnoughData: false };
    }

    // Calculate median hours
    const hours = hoursData.map((d) => d.hours).sort((a, b) => a - b);
    const medianHours = hours[Math.floor(hours.length / 2)];

    // Calculate hours per m2 if possible
    const hoursPerM2 = hoursData
      .filter((d) => d.oppervlakte && d.oppervlakte > 0)
      .map((d) => d.hours / d.oppervlakte!);

    const medianHoursPerM2 =
      hoursPerM2.length > 0
        ? hoursPerM2.sort((a, b) => a - b)[Math.floor(hoursPerM2.length / 2)]
        : null;

    // Compare with provided hours
    let comparison = "normal";
    let percentDiff = 0;

    if (args.oppervlakte && medianHoursPerM2) {
      const expectedHours = args.oppervlakte * medianHoursPerM2;
      percentDiff = Math.round(((args.hours - expectedHours) / expectedHours) * 100);

      if (percentDiff > 30) comparison = "high";
      else if (percentDiff < -30) comparison = "low";
    } else {
      percentDiff = Math.round(((args.hours - medianHours) / medianHours) * 100);

      if (percentDiff > 50) comparison = "high";
      else if (percentDiff < -50) comparison = "low";
    }

    return {
      hasEnoughData: true,
      medianHours,
      medianHoursPerM2,
      yourHours: args.hours,
      comparison,
      percentDiff,
    };
  },
});
