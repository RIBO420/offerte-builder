"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "./use-current-user";

/**
 * Hook for listing leveranciers with stats
 */
export function useLeveranciers() {
  const { user } = useCurrentUser();

  // Use combined query for efficiency
  const data = useQuery(
    api.leveranciers.listAllWithStats,
    user?._id ? {} : "skip"
  );

  const isLoading = user && data === undefined;

  // Memoize lists to prevent reference changes
  const leveranciers = useMemo(() => data?.leveranciers ?? [], [data?.leveranciers]);
  const stats = useMemo(() => data?.stats ?? { totaal: 0, actief: 0, inactief: 0 }, [data?.stats]);

  return {
    leveranciers,
    stats,
    totaal: stats.totaal,
    actief: stats.actief,
    inactief: stats.inactief,
    isLoading,
  };
}

/**
 * Hook for getting all leveranciers (including inactive)
 */
export function useLeveranciersAll() {
  const { user } = useCurrentUser();

  const leveranciers = useQuery(
    api.leveranciers.listAll,
    user?._id ? {} : "skip"
  );

  return {
    leveranciers: leveranciers ?? [],
    isLoading: user && leveranciers === undefined,
  };
}

/**
 * Hook for single leverancier
 */
export function useLeverancier(id: Id<"leveranciers"> | null) {
  const leverancier = useQuery(
    api.leveranciers.getById,
    id ? { id } : "skip"
  );

  return {
    leverancier,
    isLoading: id !== null && leverancier === undefined,
  };
}

/**
 * Hook for leverancier with their orders
 */
export function useLeverancierWithOrders(id: Id<"leveranciers"> | null) {
  const data = useQuery(
    api.leveranciers.getWithOrders,
    id ? { id } : "skip"
  );

  return {
    leverancier: data,
    isLoading: id !== null && data === undefined,
  };
}

/**
 * Hook for leverancier statistics
 */
export function useLeverancierStats(id: Id<"leveranciers"> | null) {
  const stats = useQuery(
    api.leveranciers.getStats,
    id ? { id } : "skip"
  );

  return {
    stats,
    isLoading: id !== null && stats === undefined,
  };
}

/**
 * Hook for searching leveranciers
 */
export function useLeveranciersSearch(searchTerm: string, includeInactive?: boolean) {
  const { user } = useCurrentUser();

  const results = useQuery(
    api.leveranciers.search,
    user?._id ? { searchTerm, includeInactive } : "skip"
  );

  return {
    results: results ?? [],
    isLoading: user && results === undefined,
  };
}

/**
 * Hook for leverancier mutations (create, update, remove)
 */
export function useLeveranciersMutations() {
  const { user } = useCurrentUser();

  const createMutation = useMutation(api.leveranciers.create);
  const updateMutation = useMutation(api.leveranciers.update);
  const removeMutation = useMutation(api.leveranciers.remove);
  const hardDeleteMutation = useMutation(api.leveranciers.hardDelete);
  const reactivateMutation = useMutation(api.leveranciers.reactivate);

  const create = useCallback(
    async (leverancierData: {
      naam: string;
      contactpersoon?: string;
      email?: string;
      telefoon?: string;
      adres?: string;
      postcode?: string;
      plaats?: string;
      kvkNummer?: string;
      btwNummer?: string;
      iban?: string;
      betalingstermijn?: number;
      notities?: string;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createMutation(leverancierData);
    },
    [user?._id, createMutation]
  );

  const update = useCallback(
    async (
      id: Id<"leveranciers">,
      leverancierData: {
        naam?: string;
        contactpersoon?: string;
        email?: string;
        telefoon?: string;
        adres?: string;
        postcode?: string;
        plaats?: string;
        kvkNummer?: string;
        btwNummer?: string;
        iban?: string;
        betalingstermijn?: number;
        notities?: string;
        isActief?: boolean;
      }
    ) => {
      return await updateMutation({ id, ...leverancierData });
    },
    [updateMutation]
  );

  const remove = useCallback(
    async (id: Id<"leveranciers">) => {
      return await removeMutation({ id });
    },
    [removeMutation]
  );

  const hardDelete = useCallback(
    async (id: Id<"leveranciers">) => {
      return await hardDeleteMutation({ id });
    },
    [hardDeleteMutation]
  );

  const reactivate = useCallback(
    async (id: Id<"leveranciers">) => {
      return await reactivateMutation({ id });
    },
    [reactivateMutation]
  );

  return {
    create,
    update,
    remove,
    hardDelete,
    reactivate,
  };
}
