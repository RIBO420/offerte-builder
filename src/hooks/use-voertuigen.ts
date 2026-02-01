"use client";

import { useQuery, useMutation } from "convex/react";
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

  const create = async (voertuigData: {
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
  };

  const update = async (
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
  };

  const remove = async (id: Id<"voertuigen">) => {
    return await removeMutation({ id });
  };

  const hardDelete = async (id: Id<"voertuigen">) => {
    return await hardDeleteMutation({ id });
  };

  const updateKmStand = async (id: Id<"voertuigen">, kmStand: number) => {
    return await updateKmStandMutation({ id, kmStand });
  };

  // Computed values
  const activeVoertuigen = (voertuigen ?? []).filter((v) => v.status === "actief");
  const inactiveVoertuigen = (voertuigen ?? []).filter((v) => v.status === "inactief");
  const maintenanceVoertuigen = (voertuigen ?? []).filter((v) => v.status === "onderhoud");

  return {
    voertuigen: voertuigen ?? [],
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
