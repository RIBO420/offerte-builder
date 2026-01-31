"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

export function useMachines() {
  const { user } = useCurrentUser();

  const machines = useQuery(api.machines.list, user?._id ? {} : "skip");

  const createMachine = useMutation(api.machines.create);
  const updateMachine = useMutation(api.machines.update);
  const deleteMachine = useMutation(api.machines.remove);
  const createDefaults = useMutation(api.machines.createDefaults);

  const create = async (machineData: {
    naam: string;
    type: "intern" | "extern";
    tarief: number;
    tariefType: "uur" | "dag";
    gekoppeldeScopes: string[];
  }) => {
    if (!user?._id) throw new Error("User not found");
    return createMachine(machineData);
  };

  const initializeDefaults = async () => {
    if (!user?._id) throw new Error("User not found");
    return createDefaults({});
  };

  return {
    machines: machines?.filter((m) => m.isActief) || [],
    allMachines: machines || [],
    isLoading: user && machines === undefined,
    create,
    update: updateMachine,
    delete: deleteMachine,
    initializeDefaults,
  };
}

export function useMachine(id: Id<"machines"> | null) {
  const machine = useQuery(api.machines.get, id ? { id } : "skip");

  return {
    machine,
    isLoading: id && machine === undefined,
  };
}

export function useMachinesByScopes(scopes: string[]) {
  const { user } = useCurrentUser();

  const machines = useQuery(
    api.machines.getByScopes,
    user?._id && scopes.length > 0 ? { scopes } : "skip"
  );

  return {
    machines: machines || [],
    isLoading: user && scopes.length > 0 && machines === undefined,
  };
}
