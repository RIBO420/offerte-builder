"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "./use-current-user";

export type InkooporderStatus = "concept" | "besteld" | "geleverd" | "gefactureerd";

export interface InkooporderFilters {
  status?: InkooporderStatus;
  leverancierId?: Id<"leveranciers">;
  projectId?: Id<"projecten">;
}

export interface InkooporderRegel {
  id: string;
  productId?: Id<"producten">;
  omschrijving: string;
  hoeveelheid: number;
  eenheid: string;
  prijsPerEenheid: number;
  totaal: number;
}

/**
 * Hook for listing inkooporders with optional filters
 */
export function useInkooporders(filters?: InkooporderFilters) {
  const { user } = useCurrentUser();

  const inkooporders = useQuery(
    api.inkooporders.list,
    user?._id
      ? {
          status: filters?.status,
          leverancierId: filters?.leverancierId,
          projectId: filters?.projectId,
        }
      : "skip"
  );

  const isLoading = user && inkooporders === undefined;

  // Memoize the list
  const inkoopordersList = useMemo(() => inkooporders ?? [], [inkooporders]);

  // Memoize computed values
  const ordersByStatus = useMemo(() => {
    return {
      concept: inkoopordersList.filter((o) => o.status === "concept"),
      besteld: inkoopordersList.filter((o) => o.status === "besteld"),
      geleverd: inkoopordersList.filter((o) => o.status === "geleverd"),
      gefactureerd: inkoopordersList.filter((o) => o.status === "gefactureerd"),
    };
  }, [inkoopordersList]);

  return {
    inkooporders: inkoopordersList,
    ordersByStatus,
    isLoading,
  };
}

/**
 * Hook for single inkooporder with leverancier details
 */
export function useInkooporder(id: Id<"inkooporders"> | null) {
  const inkooporder = useQuery(
    api.inkooporders.getById,
    id ? { id } : "skip"
  );

  return {
    inkooporder,
    leverancier: inkooporder?.leverancier ?? null,
    project: inkooporder?.project ?? null,
    isLoading: id !== null && inkooporder === undefined,
  };
}

/**
 * Hook for inkooporders by project
 */
export function useInkoopordersByProject(projectId: Id<"projecten"> | null) {
  const inkooporders = useQuery(
    api.inkooporders.getByProject,
    projectId ? { projectId } : "skip"
  );

  return {
    inkooporders: inkooporders ?? [],
    isLoading: projectId !== null && inkooporders === undefined,
  };
}

/**
 * Hook for inkooporders by leverancier
 */
export function useInkoopordersByLeverancier(leverancierId: Id<"leveranciers"> | null) {
  const inkooporders = useQuery(
    api.inkooporders.getByLeverancier,
    leverancierId ? { leverancierId } : "skip"
  );

  return {
    inkooporders: inkooporders ?? [],
    isLoading: leverancierId !== null && inkooporders === undefined,
  };
}

/**
 * Hook for inkooporder statistics
 */
export function useInkoopordersStats() {
  const { user } = useCurrentUser();

  const stats = useQuery(
    api.inkooporders.getStats,
    user?._id ? {} : "skip"
  );

  return {
    stats,
    isLoading: user && stats === undefined,
  };
}

/**
 * Hook for inkooporder mutations
 */
export function useInkoopordersMutations() {
  const { user } = useCurrentUser();

  const createMutation = useMutation(api.inkooporders.create);
  const updateMutation = useMutation(api.inkooporders.update);
  const updateStatusMutation = useMutation(api.inkooporders.updateStatus);
  const removeMutation = useMutation(api.inkooporders.remove);

  const create = useCallback(
    async (data: {
      leverancierId: Id<"leveranciers">;
      projectId?: Id<"projecten">;
      regels: InkooporderRegel[];
      notities?: string;
      verwachteLevertijd?: number;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createMutation(data);
    },
    [user?._id, createMutation]
  );

  const update = useCallback(
    async (
      id: Id<"inkooporders">,
      data: {
        leverancierId?: Id<"leveranciers">;
        projectId?: Id<"projecten">;
        regels?: InkooporderRegel[];
        notities?: string;
        verwachteLevertijd?: number;
      }
    ) => {
      return await updateMutation({ id, ...data });
    },
    [updateMutation]
  );

  const updateStatus = useCallback(
    async (id: Id<"inkooporders">, status: InkooporderStatus) => {
      return await updateStatusMutation({ id, status });
    },
    [updateStatusMutation]
  );

  const remove = useCallback(
    async (id: Id<"inkooporders">) => {
      return await removeMutation({ id });
    },
    [removeMutation]
  );

  return {
    create,
    update,
    updateStatus,
    remove,
  };
}
