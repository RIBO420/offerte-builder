"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

export function useVerzuim(options?: {
  medewerkerId?: Id<"medewerkers">;
  alleenActief?: boolean;
  jaar?: number;
}) {
  const { user } = useCurrentUser();

  const registraties = useQuery(
    api.verzuim.list,
    user?._id
      ? {
          medewerkerId: options?.medewerkerId,
          alleenActief: options?.alleenActief,
          jaar: options?.jaar,
        }
      : "skip"
  );

  const actiefCount = useQuery(api.verzuim.countActief, user?._id ? {} : "skip");
  const frequentVerzuim = useQuery(api.verzuim.checkFrequentVerzuim, user?._id ? {} : "skip");

  const ziekmeldenMutation = useMutation(api.verzuim.ziekmelden);
  const herstelmeldenMutation = useMutation(api.verzuim.herstelmelden);
  const removeMutation = useMutation(api.verzuim.remove);

  const isLoading = !!user && registraties === undefined;
  const registratiesList = useMemo(() => registraties ?? [], [registraties]);

  const ziekmelden = useCallback(
    async (data: {
      medewerkerId: Id<"medewerkers">;
      startDatum: string;
      reden?: string;
      notities?: string;
    }) => await ziekmeldenMutation(data),
    [ziekmeldenMutation]
  );

  const herstelmelden = useCallback(
    async (id: Id<"verzuimregistraties">, herstelDatum: string, notities?: string) =>
      await herstelmeldenMutation({ id, herstelDatum, notities }),
    [herstelmeldenMutation]
  );

  const remove = useCallback(
    async (id: Id<"verzuimregistraties">) => await removeMutation({ id }),
    [removeMutation]
  );

  return {
    registraties: registratiesList,
    actiefCount: actiefCount ?? 0,
    frequentVerzuim: frequentVerzuim ?? [],
    isLoading,
    ziekmelden,
    herstelmelden,
    remove,
  };
}

export function useVerzuimStats(jaar?: number) {
  const { user } = useCurrentUser();
  const stats = useQuery(api.verzuim.getStats, user?._id ? { jaar } : "skip");
  return { stats: stats ?? null, isLoading: !!user && stats === undefined };
}
