"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

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

  const isLoading = user && medewerkers === undefined;

  // Memoize the medewerkers list
  const medewerkersList = useMemo(() => medewerkers ?? [], [medewerkers]);

  // Memoize filtered active medewerkers to prevent recalculation on every render
  const activeMedewerkers = useMemo(
    () => medewerkersList.filter((m) => m.isActief),
    [medewerkersList]
  );

  // Memoize callbacks to prevent unnecessary re-renders in child components
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

export function useMedewerker(id: Id<"medewerkers"> | null) {
  const medewerker = useQuery(
    api.medewerkers.get,
    id ? { id } : "skip"
  );

  return {
    medewerker,
    isLoading: id !== null && medewerker === undefined,
  };
}

export function useActiveMedewerkers() {
  const { user } = useCurrentUser();

  const medewerkers = useQuery(
    api.medewerkers.getActive,
    user?._id ? {} : "skip"
  );

  return {
    medewerkers: medewerkers ?? [],
    isLoading: user && medewerkers === undefined,
  };
}
