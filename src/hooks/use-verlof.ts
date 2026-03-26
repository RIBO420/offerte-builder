"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

export type VerlofType = "vakantie" | "bijzonder" | "onbetaald" | "compensatie";
export type VerlofStatus = "aangevraagd" | "goedgekeurd" | "afgekeurd";

export function useVerlof(options?: {
  status?: VerlofStatus;
  medewerkerId?: Id<"medewerkers">;
  jaar?: number;
}) {
  const { user } = useCurrentUser();

  const aanvragen = useQuery(
    api.verlof.list,
    user?._id
      ? {
          status: options?.status,
          medewerkerId: options?.medewerkerId,
          jaar: options?.jaar,
        }
      : "skip"
  );

  const pendingCount = useQuery(
    api.verlof.countPending,
    user?._id ? {} : "skip"
  );

  const createMutation = useMutation(api.verlof.create);
  const updateMutation = useMutation(api.verlof.update);
  const goedkeurenMutation = useMutation(api.verlof.goedkeuren);
  const afkeurenMutation = useMutation(api.verlof.afkeuren);
  const removeMutation = useMutation(api.verlof.remove);

  const isLoading = !!user && aanvragen === undefined;
  const aanvragenList = useMemo(() => aanvragen ?? [], [aanvragen]);

  const create = useCallback(
    async (data: {
      medewerkerId: Id<"medewerkers">;
      startDatum: string;
      eindDatum: string;
      aantalDagen: number;
      type: VerlofType;
      opmerking?: string;
    }) => {
      return await createMutation(data);
    },
    [createMutation]
  );

  const update = useCallback(
    async (
      id: Id<"verlofaanvragen">,
      data: {
        startDatum?: string;
        eindDatum?: string;
        aantalDagen?: number;
        type?: VerlofType;
        opmerking?: string;
      }
    ) => {
      return await updateMutation({ id, ...data });
    },
    [updateMutation]
  );

  const goedkeuren = useCallback(
    async (id: Id<"verlofaanvragen">) => {
      return await goedkeurenMutation({ id });
    },
    [goedkeurenMutation]
  );

  const afkeuren = useCallback(
    async (id: Id<"verlofaanvragen">, afwijzingReden?: string) => {
      return await afkeurenMutation({ id, afwijzingReden });
    },
    [afkeurenMutation]
  );

  const remove = useCallback(
    async (id: Id<"verlofaanvragen">) => {
      return await removeMutation({ id });
    },
    [removeMutation]
  );

  return {
    aanvragen: aanvragenList,
    pendingCount: pendingCount ?? 0,
    isLoading,
    create,
    update,
    goedkeuren,
    afkeuren,
    remove,
  };
}

export function useVerlofsaldo(
  medewerkerId?: Id<"medewerkers">,
  jaar?: number
) {
  const saldo = useQuery(
    api.verlof.getVerlofsaldo,
    medewerkerId ? { medewerkerId, jaar } : "skip"
  );

  return {
    saldo: saldo ?? null,
    isLoading: medewerkerId !== undefined && saldo === undefined,
  };
}
