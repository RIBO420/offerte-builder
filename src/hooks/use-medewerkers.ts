"use client";

import { useQuery, useMutation } from "convex/react";
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

  const create = async (medewerkerData: {
    naam: string;
    email?: string;
    telefoon?: string;
    functie?: string;
    uurtarief?: number;
    notities?: string;
  }) => {
    if (!user?._id) throw new Error("User not found");
    return await createMutation(medewerkerData);
  };

  const update = async (
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
  };

  const remove = async (id: Id<"medewerkers">) => {
    return await removeMutation({ id });
  };

  const hardDelete = async (id: Id<"medewerkers">) => {
    return await hardDeleteMutation({ id });
  };

  return {
    medewerkers: medewerkers ?? [],
    activeMedewerkers: (medewerkers ?? []).filter((m) => m.isActief),
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
