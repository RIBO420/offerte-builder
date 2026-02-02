"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

// Optimized hook using combined dashboard query - reduces 3 round-trips to 1
// Use this when you need offertes list AND stats together
export function useOffertes() {
  const { user } = useCurrentUser();

  // Use combined query for better performance
  const dashboardData = useQuery(
    api.offertes.getDashboardData,
    user?._id ? {} : "skip"
  );

  const createOfferte = useMutation(api.offertes.create);
  const updateOfferte = useMutation(api.offertes.update);
  const updateRegels = useMutation(api.offertes.updateRegels);
  const updateStatus = useMutation(api.offertes.updateStatus);
  const deleteOfferte = useMutation(api.offertes.remove);
  const restoreOfferte = useMutation(api.offertes.restore);
  const duplicateOfferte = useMutation(api.offertes.duplicate);
  const bulkUpdateStatusMutation = useMutation(api.offertes.bulkUpdateStatus);
  const bulkRemoveMutation = useMutation(api.offertes.bulkRemove);
  const bulkRestoreMutation = useMutation(api.offertes.bulkRestore);

  // Memoize data to prevent reference changes
  const offertes = useMemo(() => dashboardData?.offertes, [dashboardData?.offertes]);
  const stats = useMemo(() => dashboardData?.stats, [dashboardData?.stats]);
  const recentOffertes = useMemo(() => dashboardData?.recent, [dashboardData?.recent]);

  // Memoize create callback
  const create = useCallback(
    async (data: {
      type: "aanleg" | "onderhoud";
      offerteNummer: string;
      klant: {
        naam: string;
        adres: string;
        postcode: string;
        plaats: string;
        email?: string;
        telefoon?: string;
      };
      algemeenParams: {
        bereikbaarheid: "goed" | "beperkt" | "slecht";
        achterstalligheid?: "laag" | "gemiddeld" | "hoog";
      };
      scopes?: string[];
      scopeData?: Record<string, unknown>;
      notities?: string;
      klantId?: Id<"klanten">;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return createOfferte(data);
    },
    [user?._id, createOfferte]
  );

  return {
    offertes,
    stats,
    recentOffertes,
    isLoading: user && dashboardData === undefined,
    create,
    update: updateOfferte,
    updateRegels,
    updateStatus,
    delete: deleteOfferte,
    restore: restoreOfferte,
    duplicate: duplicateOfferte,
    bulkUpdateStatus: bulkUpdateStatusMutation,
    bulkRemove: bulkRemoveMutation,
    bulkRestore: bulkRestoreMutation,
  };
}

// Use this when you only need the full list of offertes (no stats)
export function useOffertesListOnly() {
  const { user } = useCurrentUser();

  const offertesData = useQuery(
    api.offertes.list,
    user?._id ? {} : "skip"
  );

  const createOfferte = useMutation(api.offertes.create);
  const updateOfferte = useMutation(api.offertes.update);
  const updateRegels = useMutation(api.offertes.updateRegels);
  const updateStatus = useMutation(api.offertes.updateStatus);
  const deleteOfferte = useMutation(api.offertes.remove);
  const restoreOfferte = useMutation(api.offertes.restore);
  const duplicateOfferte = useMutation(api.offertes.duplicate);
  const bulkUpdateStatusMutation = useMutation(api.offertes.bulkUpdateStatus);
  const bulkRemoveMutation = useMutation(api.offertes.bulkRemove);
  const bulkRestoreMutation = useMutation(api.offertes.bulkRestore);

  // Memoize the list to prevent reference changes
  const offertes = useMemo(() => offertesData, [offertesData]);

  // Memoize create callback
  const create = useCallback(
    async (data: {
      type: "aanleg" | "onderhoud";
      offerteNummer: string;
      klant: {
        naam: string;
        adres: string;
        postcode: string;
        plaats: string;
        email?: string;
        telefoon?: string;
      };
      algemeenParams: {
        bereikbaarheid: "goed" | "beperkt" | "slecht";
        achterstalligheid?: "laag" | "gemiddeld" | "hoog";
      };
      scopes?: string[];
      scopeData?: Record<string, unknown>;
      notities?: string;
      klantId?: Id<"klanten">;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return createOfferte(data);
    },
    [user?._id, createOfferte]
  );

  return {
    offertes,
    isLoading: user && offertesData === undefined,
    create,
    update: updateOfferte,
    updateRegels,
    updateStatus,
    delete: deleteOfferte,
    restore: restoreOfferte,
    duplicate: duplicateOfferte,
    bulkUpdateStatus: bulkUpdateStatusMutation,
    bulkRemove: bulkRemoveMutation,
    bulkRestore: bulkRestoreMutation,
  };
}

export function useOfferte(id: Id<"offertes"> | null) {
  const offerte = useQuery(
    api.offertes.get,
    id ? { id } : "skip"
  );

  return {
    offerte,
    isLoading: id && offerte === undefined,
  };
}

// Optimized dashboard hook - single query for stats, recent, and limited list
export function useDashboardData() {
  const { user } = useCurrentUser();

  const dashboardData = useQuery(
    api.offertes.getDashboardData,
    user?._id ? {} : "skip"
  );

  // Memoize to prevent reference changes on each render
  const stats = useMemo(() => dashboardData?.stats, [dashboardData?.stats]);
  const recentOffertes = useMemo(() => dashboardData?.recent ?? [], [dashboardData?.recent]);
  const offertes = useMemo(() => dashboardData?.offertes ?? [], [dashboardData?.offertes]);

  return {
    stats,
    recentOffertes,
    offertes,
    isLoading: user && dashboardData === undefined,
  };
}

// Comprehensive dashboard hook - batches ALL dashboard data in a single round-trip
// Use this for the main dashboard page to minimize query round-trips
export function useFullDashboardData() {
  const { user } = useCurrentUser();

  const data = useQuery(
    api.offertes.getFullDashboardData,
    user?._id ? {} : "skip"
  );

  // Memoize all values to prevent unnecessary re-renders
  const offerteStats = useMemo(() => data?.offerteStats ?? null, [data?.offerteStats]);
  const recentOffertes = useMemo(() => data?.recentOffertes ?? [], [data?.recentOffertes]);
  const revenueStats = useMemo(() => data?.revenueStats ?? null, [data?.revenueStats]);
  const acceptedWithoutProject = useMemo(() => data?.acceptedWithoutProject ?? [], [data?.acceptedWithoutProject]);
  const projectStats = useMemo(() => data?.projectStats ?? null, [data?.projectStats]);
  const activeProjects = useMemo(() => data?.activeProjects ?? [], [data?.activeProjects]);
  const facturenStats = useMemo(() => data?.facturenStats ?? null, [data?.facturenStats]);
  const recentFacturen = useMemo(() => data?.recentFacturen ?? [], [data?.recentFacturen]);

  return {
    // Offerte data
    offerteStats,
    recentOffertes,
    // Revenue stats
    revenueStats,
    // Action required
    acceptedWithoutProject,
    // Project data
    projectStats,
    activeProjects,
    // Facturen data
    facturenStats,
    recentFacturen,
    // Loading state
    isLoading: user && data === undefined,
  };
}

// Paginated offertes hook
export function useOffertesPaginated(limit: number = 25) {
  const { user } = useCurrentUser();

  const data = useQuery(
    api.offertes.listPaginated,
    user?._id ? { limit } : "skip"
  );

  // Memoize list and pagination info
  const offertes = useMemo(() => data?.offertes ?? [], [data?.offertes]);
  const nextCursor = useMemo(() => data?.nextCursor, [data?.nextCursor]);
  const hasMore = useMemo(() => data?.hasMore ?? false, [data?.hasMore]);

  return {
    offertes,
    nextCursor,
    hasMore,
    isLoading: user && data === undefined,
  };
}
