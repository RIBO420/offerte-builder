"use client";

import { useQuery, useMutation } from "convex/react";
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
  const duplicateOfferte = useMutation(api.offertes.duplicate);
  const bulkUpdateStatusMutation = useMutation(api.offertes.bulkUpdateStatus);
  const bulkRemoveMutation = useMutation(api.offertes.bulkRemove);

  const create = async (data: {
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
  };

  return {
    offertes: dashboardData?.offertes,
    stats: dashboardData?.stats,
    recentOffertes: dashboardData?.recent,
    isLoading: user && dashboardData === undefined,
    create,
    update: updateOfferte,
    updateRegels,
    updateStatus,
    delete: deleteOfferte,
    duplicate: duplicateOfferte,
    bulkUpdateStatus: bulkUpdateStatusMutation,
    bulkRemove: bulkRemoveMutation,
  };
}

// Use this when you only need the full list of offertes (no stats)
export function useOffertesListOnly() {
  const { user } = useCurrentUser();

  const offertes = useQuery(
    api.offertes.list,
    user?._id ? {} : "skip"
  );

  const createOfferte = useMutation(api.offertes.create);
  const updateOfferte = useMutation(api.offertes.update);
  const updateRegels = useMutation(api.offertes.updateRegels);
  const updateStatus = useMutation(api.offertes.updateStatus);
  const deleteOfferte = useMutation(api.offertes.remove);
  const duplicateOfferte = useMutation(api.offertes.duplicate);
  const bulkUpdateStatusMutation = useMutation(api.offertes.bulkUpdateStatus);
  const bulkRemoveMutation = useMutation(api.offertes.bulkRemove);

  const create = async (data: {
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
  };

  return {
    offertes,
    isLoading: user && offertes === undefined,
    create,
    update: updateOfferte,
    updateRegels,
    updateStatus,
    delete: deleteOfferte,
    duplicate: duplicateOfferte,
    bulkUpdateStatus: bulkUpdateStatusMutation,
    bulkRemove: bulkRemoveMutation,
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

  return {
    stats: dashboardData?.stats,
    recentOffertes: dashboardData?.recent ?? [],
    offertes: dashboardData?.offertes ?? [],
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

  return {
    // Offerte data
    offerteStats: data?.offerteStats ?? null,
    recentOffertes: data?.recentOffertes ?? [],
    // Revenue stats
    revenueStats: data?.revenueStats ?? null,
    // Action required
    acceptedWithoutProject: data?.acceptedWithoutProject ?? [],
    // Project data
    projectStats: data?.projectStats ?? null,
    activeProjects: data?.activeProjects ?? [],
    // Facturen data
    facturenStats: data?.facturenStats ?? null,
    recentFacturen: data?.recentFacturen ?? [],
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

  return {
    offertes: data?.offertes ?? [],
    nextCursor: data?.nextCursor,
    hasMore: data?.hasMore ?? false,
    isLoading: user && data === undefined,
  };
}
