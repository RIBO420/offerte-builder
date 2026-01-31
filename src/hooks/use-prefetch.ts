"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { useEffect } from "react";

/**
 * Prefetch hook for proactively loading data that will likely be needed.
 * Use this in layouts or parent components to warm the cache before
 * the user navigates to pages that need this data.
 *
 * Convex automatically caches query results, so prefetching here means
 * the data is already available when the user navigates.
 */
export function usePrefetchDashboardData() {
  const { user } = useCurrentUser();

  // Prefetch dashboard data (stats, recent offertes)
  // This will be cached and available when navigating to dashboard
  useQuery(
    api.offertes.getDashboardData,
    user?._id ? {} : "skip"
  );
}

/**
 * Prefetch calculation data for the offerte wizard.
 * Call this when entering the wizard to have all calculation
 * data ready for instant calculations.
 */
export function usePrefetchCalculationData() {
  const { user } = useCurrentUser();

  // Prefetch all data needed for calculations
  useQuery(
    api.berekeningen.getCalculationData,
    user?._id ? {} : "skip"
  );
}

/**
 * Prefetch klanten data with recent list.
 * Useful when navigating to klanten-related pages.
 */
export function usePrefetchKlantenData() {
  const { user } = useCurrentUser();

  useQuery(
    api.klanten.listWithRecent,
    user?._id ? {} : "skip"
  );
}

/**
 * Prefetch producten data with metadata.
 * Useful when navigating to prijsboek or offerte creation.
 */
export function usePrefetchProductenData() {
  const { user } = useCurrentUser();

  useQuery(
    api.producten.listWithMetadata,
    user?._id ? {} : "skip"
  );
}

/**
 * Comprehensive prefetch hook that preloads all common data.
 * Use this in the main dashboard layout to warm caches
 * for a faster overall experience.
 */
export function usePrefetchAllCommonData() {
  const { user } = useCurrentUser();

  // Dashboard data
  useQuery(
    api.offertes.getDashboardData,
    user?._id ? {} : "skip"
  );

  // Calculation data (normuren, correctiefactoren, producten, instellingen)
  useQuery(
    api.berekeningen.getCalculationData,
    user?._id ? {} : "skip"
  );

  // Klanten data
  useQuery(
    api.klanten.listWithRecent,
    user?._id ? {} : "skip"
  );
}

/**
 * Hook to prefetch data for a specific offerte.
 * Use when you know the user will likely view a specific offerte.
 */
export function usePrefetchOfferte(offerteId: string | null) {
  useQuery(
    api.offertes.get,
    offerteId ? { id: offerteId as any } : "skip"
  );
}

/**
 * Effect hook to prefetch data on hover or focus.
 * Returns handlers that can be attached to link elements.
 */
export function usePrefetchOnInteraction(
  prefetchFn: () => void,
  delay: number = 100
) {
  let timeoutId: NodeJS.Timeout | null = null;

  const handleMouseEnter = () => {
    timeoutId = setTimeout(prefetchFn, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const handleFocus = () => {
    prefetchFn();
  };

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  return {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
  };
}
