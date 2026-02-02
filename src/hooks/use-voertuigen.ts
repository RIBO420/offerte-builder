"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

export type VoertuigStatus = "actief" | "inactief" | "onderhoud";

export function useVoertuigen(filterStatus?: VoertuigStatus) {
  const { user } = useCurrentUser();

  const voertuigen = useQuery(
    api.voertuigen.list,
    user?._id ? { status: filterStatus } : "skip"
  );

  const createMutation = useMutation(api.voertuigen.create);
  const updateMutation = useMutation(api.voertuigen.update);
  const removeMutation = useMutation(api.voertuigen.remove);
  const hardDeleteMutation = useMutation(api.voertuigen.hardDelete);
  const updateKmStandMutation = useMutation(api.voertuigen.updateKmStand);

  const isLoading = user && voertuigen === undefined;

  // Memoize the voertuigen list
  const voertuigenList = useMemo(() => voertuigen ?? [], [voertuigen]);

  // Memoize callbacks to prevent unnecessary re-renders
  const create = useCallback(
    async (voertuigData: {
      kenteken: string;
      merk: string;
      model: string;
      type: string;
      bouwjaar?: number;
      kleur?: string;
      kmStand?: number;
      notities?: string;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createMutation(voertuigData);
    },
    [user?._id, createMutation]
  );

  const update = useCallback(
    async (
      id: Id<"voertuigen">,
      voertuigData: {
        kenteken?: string;
        merk?: string;
        model?: string;
        type?: string;
        bouwjaar?: number;
        kleur?: string;
        kmStand?: number;
        status?: VoertuigStatus;
        notities?: string;
      }
    ) => {
      return await updateMutation({ id, ...voertuigData });
    },
    [updateMutation]
  );

  const remove = useCallback(
    async (id: Id<"voertuigen">) => {
      return await removeMutation({ id });
    },
    [removeMutation]
  );

  const hardDelete = useCallback(
    async (id: Id<"voertuigen">) => {
      return await hardDeleteMutation({ id });
    },
    [hardDeleteMutation]
  );

  const updateKmStand = useCallback(
    async (id: Id<"voertuigen">, kmStand: number) => {
      return await updateKmStandMutation({ id, kmStand });
    },
    [updateKmStandMutation]
  );

  // Memoize computed values to prevent recalculation on every render
  const activeVoertuigen = useMemo(
    () => voertuigenList.filter((v) => v.status === "actief"),
    [voertuigenList]
  );

  const inactiveVoertuigen = useMemo(
    () => voertuigenList.filter((v) => v.status === "inactief"),
    [voertuigenList]
  );

  const maintenanceVoertuigen = useMemo(
    () => voertuigenList.filter((v) => v.status === "onderhoud"),
    [voertuigenList]
  );

  return {
    voertuigen: voertuigenList,
    activeVoertuigen,
    inactiveVoertuigen,
    maintenanceVoertuigen,
    isLoading,
    create,
    update,
    remove,
    hardDelete,
    updateKmStand,
  };
}

export function useVoertuig(id: Id<"voertuigen"> | null) {
  const voertuig = useQuery(
    api.voertuigen.get,
    id ? { id } : "skip"
  );

  return {
    voertuig,
    isLoading: id !== null && voertuig === undefined,
  };
}

export function useActiveVoertuigen() {
  const { user } = useCurrentUser();

  const voertuigen = useQuery(
    api.voertuigen.getActive,
    user?._id ? {} : "skip"
  );

  return {
    voertuigen: voertuigen ?? [],
    isLoading: user && voertuigen === undefined,
  };
}
