"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Hook for accessing smart analytics data that powers intelligent workflow features
 */
export function useSmartAnalytics() {
  const { user } = useCurrentUser();

  // Get scope price statistics
  const scopePriceStats = useQuery(
    api.smartAnalytics.getScopePriceStats,
    user?._id ? {} : "skip"
  );

  return {
    scopePriceStats: scopePriceStats?.stats ?? {},
    hasHistoricalData: scopePriceStats?.hasData ?? false,
    totalOffertes: scopePriceStats?.totalOffertes ?? 0,
    isLoading: user && scopePriceStats === undefined,
  };
}

/**
 * Hook for getting price estimation for a specific scope
 */
export function useScopePriceEstimate(
  scope: string | null,
  oppervlakte?: number
) {
  const { user } = useCurrentUser();

  const priceRange = useQuery(
    api.smartAnalytics.getScopePriceRange,
    user?._id && scope
      ? {
          scope,
          oppervlakte,
        }
      : "skip"
  );

  if (!priceRange || !priceRange.hasEnoughData) {
    return {
      hasEstimate: false,
      isLoading: user && scope !== null && priceRange === undefined,
    };
  }

  return {
    hasEstimate: true,
    avgPrice: priceRange.avgPrice,
    medianPrice: priceRange.medianPrice,
    minPrice: priceRange.minPrice,
    maxPrice: priceRange.maxPrice,
    typicalRange: {
      low: priceRange.p25,
      high: priceRange.p75,
    },
    avgPricePerM2: priceRange.avgPricePerM2,
    estimatedPrice: priceRange.estimatedPrice,
    dataPoints: priceRange.count,
    isLoading: false,
  };
}

/**
 * Hook for checking price anomalies
 */
export function usePriceAnomalyCheck(
  scope: string | null,
  price: number | null,
  oppervlakte?: number
) {
  const { user } = useCurrentUser();

  const anomalyCheck = useQuery(
    api.smartAnalytics.checkPriceAnomaly,
    user?._id && scope && price !== null && price > 0
      ? {
          scope,
          price,
          oppervlakte,
        }
      : "skip"
  );

  if (!anomalyCheck || !anomalyCheck.hasEnoughData) {
    return {
      hasCheck: false,
      isAnomaly: false,
      isLoading: user && scope !== null && price !== null && anomalyCheck === undefined,
    };
  }

  return {
    hasCheck: true,
    isAnomaly: anomalyCheck.isAnomaly,
    isTooLow: anomalyCheck.isTooLow,
    isTooHigh: anomalyCheck.isTooHigh,
    severity: anomalyCheck.severity,
    message: anomalyCheck.message,
    stats: anomalyCheck.stats,
    isLoading: false,
  };
}

/**
 * Hook for getting klant with history for smart autocomplete
 */
export function useKlantWithHistory(klantId: Id<"klanten"> | null) {
  const { user } = useCurrentUser();

  const klantData = useQuery(
    api.smartAnalytics.getKlantWithHistory,
    user?._id && klantId ? { klantId } : "skip"
  );

  return {
    klant: klantData?.klant ?? null,
    stats: klantData?.stats ?? null,
    lastOfferte: klantData?.lastOfferte ?? null,
    isLoading: user && klantId !== null && klantData === undefined,
  };
}

/**
 * Hook for getting enriched klanten list with stats
 */
export function useKlantenWithStats(limit: number = 10) {
  const { user } = useCurrentUser();

  const klanten = useQuery(
    api.smartAnalytics.getKlantenWithStats,
    user?._id ? { limit } : "skip"
  );

  return {
    klanten: klanten ?? [],
    isLoading: user && klanten === undefined,
  };
}

/**
 * Hook for comparing labor hours with historical data
 */
export function useLabourHoursComparison(
  scope: string | null,
  hours: number | null,
  oppervlakte?: number
) {
  const { user } = useCurrentUser();

  const comparison = useQuery(
    api.smartAnalytics.getLabourHoursComparison,
    user?._id && scope && hours !== null && hours > 0
      ? {
          scope,
          hours,
          oppervlakte,
        }
      : "skip"
  );

  if (!comparison || !comparison.hasEnoughData) {
    return {
      hasComparison: false,
      isLoading: user && scope !== null && hours !== null && comparison === undefined,
    };
  }

  return {
    hasComparison: true,
    medianHours: comparison.medianHours,
    medianHoursPerM2: comparison.medianHoursPerM2,
    yourHours: comparison.yourHours,
    comparison: comparison.comparison as "normal" | "high" | "low",
    percentDiff: comparison.percentDiff,
    isLoading: false,
  };
}
