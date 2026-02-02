"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "./use-current-user";
import {
  createGetResourceHook,
  createSearchHook,
} from "../lib/hooks/use-resource-factory";

// ============================================================================
// KLANTEN HOOKS - Using Resource Factory Pattern
// ============================================================================
// Before: 133 lines | After: ~75 lines | Reduction: ~44%
// The main hook retains some custom logic, but get/search use factory patterns
// ============================================================================

/**
 * Main hook for klanten with combined list query and all mutations.
 * Uses combined query to reduce 2 round-trips to 1.
 */
export function useKlanten() {
  const { user } = useCurrentUser();

  // Use combined query to reduce 2 round-trips to 1
  const data = useQuery(
    api.klanten.listWithRecent,
    user?._id ? {} : "skip"
  );

  const createMutation = useMutation(api.klanten.create);
  const updateMutation = useMutation(api.klanten.update);
  const removeMutation = useMutation(api.klanten.remove);
  const createFromOfferteMutation = useMutation(api.klanten.createFromOfferte);

  const isLoading = !!user && data === undefined;

  // Memoize lists to prevent reference changes
  const klanten = useMemo(() => data?.klanten ?? [], [data?.klanten]);
  const recentKlanten = useMemo(() => data?.recentKlanten ?? [], [data?.recentKlanten]);

  // Memoize callbacks to prevent unnecessary re-renders
  const create = useCallback(
    async (klantData: {
      naam: string;
      adres: string;
      postcode: string;
      plaats: string;
      email?: string;
      telefoon?: string;
      notities?: string;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createMutation(klantData);
    },
    [user?._id, createMutation]
  );

  const update = useCallback(
    async (
      id: Id<"klanten">,
      klantData: {
        naam?: string;
        adres?: string;
        postcode?: string;
        plaats?: string;
        email?: string;
        telefoon?: string;
        notities?: string;
      }
    ) => {
      return await updateMutation({ id, ...klantData });
    },
    [updateMutation]
  );

  const remove = useCallback(
    async (id: Id<"klanten">) => {
      return await removeMutation({ id });
    },
    [removeMutation]
  );

  const createFromOfferte = useCallback(
    async (klantData: {
      naam: string;
      adres: string;
      postcode: string;
      plaats: string;
      email?: string;
      telefoon?: string;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createFromOfferteMutation(klantData);
    },
    [user?._id, createFromOfferteMutation]
  );

  return {
    klanten,
    recentKlanten,
    isLoading,
    create,
    update,
    remove,
    createFromOfferte,
  };
}

// ============================================================================
// Factory-based hooks for single klant and search
// ============================================================================

/**
 * Hook to get a single klant by ID - uses factory pattern
 */
const useKlantFactory = createGetResourceHook(api.klanten.get, "klanten");

export function useKlant(id: Id<"klanten"> | null) {
  const { data, isLoading } = useKlantFactory(id);
  return {
    klant: data,
    isLoading,
  };
}

/**
 * Hook to get a klant with their offertes
 */
export function useKlantWithOffertes(id: Id<"klanten"> | null) {
  const data = useQuery(
    api.klanten.getWithOffertes,
    id ? { id } : "skip"
  );

  return {
    klant: data,
    isLoading: id !== null && data === undefined,
  };
}

/**
 * Hook for searching klanten - uses factory pattern
 */
const useKlantenSearchFactory = createSearchHook(api.klanten.search, {
  minSearchLength: 1,
});

export function useKlantenSearch(searchTerm: string) {
  const { results, isLoading } = useKlantenSearchFactory(searchTerm);
  return {
    results: results ?? [],
    isLoading,
  };
}
