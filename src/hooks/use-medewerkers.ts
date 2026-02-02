"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";
import { createGetResourceHook } from "../lib/hooks/use-resource-factory";

// ============================================================================
// MEDEWERKERS HOOKS - Using Resource Factory Pattern
// ============================================================================
// Before: 116 lines | After: ~80 lines | Reduction: ~31%
// Main hook retains custom logic for filtered lists, get uses factory
// ============================================================================

/**
 * Main hook for medewerkers with filtering and all mutations.
 */
export function useMedewerkers(filterActief?: boolean) {
  const { user } = useCurrentUser();

  const medewerkers = useQuery(
    api.medewerkers.list,
    user?._id ? { isActief: filterActief } : "skip"
  );

  const createMutation = useMutation(api.medewerkers.create);
  const updateMutation = useMutation(api.medewerkers.update);
  const removeMutation = useMutation(api.medewerkers.remove);
  const hardDeleteMutation = useMutation(api.medewerkers.hardDelete);

  const isLoading = !!user && medewerkers === undefined;

  // Memoize the medewerkers list
  const medewerkersList = useMemo(() => medewerkers ?? [], [medewerkers]);

  // Memoize filtered active medewerkers to prevent recalculation on every render
  const activeMedewerkers = useMemo(
    () => medewerkersList.filter((m) => m.isActief),
    [medewerkersList]
  );

  // Memoize callbacks to prevent unnecessary re-renders
  const create = useCallback(
    async (medewerkerData: {
      naam: string;
      email?: string;
      telefoon?: string;
      functie?: string;
      uurtarief?: number;
      notities?: string;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createMutation(medewerkerData);
    },
    [user?._id, createMutation]
  );

  const update = useCallback(
    async (
      id: Id<"medewerkers">,
      medewerkerData: {
        naam?: string;
        email?: string;
        telefoon?: string;
        functie?: string;
        uurtarief?: number;
        isActief?: boolean;
        notities?: string;
      }
    ) => {
      return await updateMutation({ id, ...medewerkerData });
    },
    [updateMutation]
  );

  const remove = useCallback(
    async (id: Id<"medewerkers">) => {
      return await removeMutation({ id });
    },
    [removeMutation]
  );

  const hardDelete = useCallback(
    async (id: Id<"medewerkers">) => {
      return await hardDeleteMutation({ id });
    },
    [hardDeleteMutation]
  );

  return {
    medewerkers: medewerkersList,
    activeMedewerkers,
    isLoading,
    create,
    update,
    remove,
    hardDelete,
  };
}

// ============================================================================
// Factory-based hooks
// ============================================================================

/**
 * Hook to get a single medewerker by ID - uses factory pattern
 */
const useMedewerkerFactory = createGetResourceHook(api.medewerkers.get, "medewerkers");

export function useMedewerker(id: Id<"medewerkers"> | null) {
  const { data, isLoading } = useMedewerkerFactory(id);
  return {
    medewerker: data,
    isLoading,
  };
}

/**
 * Hook for active medewerkers only - uses separate query
 */
export function useActiveMedewerkers() {
  const { user } = useCurrentUser();

  const medewerkers = useQuery(
    api.medewerkers.getActive,
    user?._id ? {} : "skip"
  );

  return {
    medewerkers: medewerkers ?? [],
    isLoading: !!user && medewerkers === undefined,
  };
}
