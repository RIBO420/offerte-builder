"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "./use-current-user";

export type KwaliteitsControleStatus = "open" | "in_uitvoering" | "goedgekeurd" | "afgekeurd";

export interface ChecklistItem {
  id: string;
  omschrijving: string;
  isAfgevinkt: boolean;
  afgevinktAt?: number;
  afgevinktDoor?: string;
  notities?: string;
}

/**
 * Hook for listing QC checks for a project
 */
export function useKwaliteitsControles(projectId: Id<"projecten"> | null) {
  const controles = useQuery(
    api.kwaliteitsControles.getByProject,
    projectId ? { projectId } : "skip"
  );

  const isLoading = projectId !== null && controles === undefined;

  // Memoize the list
  const controlesList = useMemo(() => controles ?? [], [controles]);

  // Group by status
  const controlesByStatus = useMemo(() => {
    return {
      open: controlesList.filter((c) => c.status === "open"),
      in_uitvoering: controlesList.filter((c) => c.status === "in_uitvoering"),
      goedgekeurd: controlesList.filter((c) => c.status === "goedgekeurd"),
      afgekeurd: controlesList.filter((c) => c.status === "afgekeurd"),
    };
  }, [controlesList]);

  // Group by scope
  const controlesByScope = useMemo(() => {
    const grouped: Record<string, typeof controlesList> = {};
    for (const controle of controlesList) {
      if (!grouped[controle.scope]) {
        grouped[controle.scope] = [];
      }
      grouped[controle.scope].push(controle);
    }
    return grouped;
  }, [controlesList]);

  return {
    controles: controlesList,
    controlesByStatus,
    controlesByScope,
    isLoading,
  };
}

/**
 * Hook for single QC check
 */
export function useKwaliteitsControle(id: Id<"kwaliteitsControles"> | null) {
  const controle = useQuery(
    api.kwaliteitsControles.getById,
    id ? { id } : "skip"
  );

  return {
    controle,
    isLoading: id !== null && controle === undefined,
  };
}

/**
 * Hook for QC checks filtered by status
 */
export function useKwaliteitsControlesByStatus(
  projectId: Id<"projecten"> | null,
  status: KwaliteitsControleStatus
) {
  const controles = useQuery(
    api.kwaliteitsControles.getByProjectAndStatus,
    projectId ? { projectId, status } : "skip"
  );

  return {
    controles: controles ?? [],
    isLoading: projectId !== null && controles === undefined,
  };
}

/**
 * Hook for QC project summary (progress overview)
 */
export function useKwaliteitsControleSummary(projectId: Id<"projecten"> | null) {
  const summary = useQuery(
    api.kwaliteitsControles.getProjectSummary,
    projectId ? { projectId } : "skip"
  );

  const isLoading = projectId !== null && summary === undefined;

  return {
    summary,
    totaal: summary?.totaal ?? 0,
    open: summary?.open ?? 0,
    inUitvoering: summary?.inUitvoering ?? 0,
    goedgekeurd: summary?.goedgekeurd ?? 0,
    afgekeurd: summary?.afgekeurd ?? 0,
    voortgangPercentage: summary?.voortgangPercentage ?? 0,
    perScope: summary?.perScope ?? [],
    isLoading,
  };
}

/**
 * Hook for getting default checklist items for a scope
 */
export function useDefaultChecklist(scope: string | null) {
  const items = useQuery(
    api.kwaliteitsControles.getDefaultChecklist,
    scope ? { scope } : "skip"
  );

  return {
    items: items ?? [],
    isLoading: scope !== null && items === undefined,
  };
}

/**
 * Hook for all default checklists
 */
export function useAllDefaultChecklists() {
  const checklists = useQuery(api.kwaliteitsControles.getAllDefaultChecklists, {});

  return {
    checklists: checklists ?? [],
    isLoading: checklists === undefined,
  };
}

/**
 * Hook for QC mutations
 */
export function useKwaliteitsControleMutations() {
  const { user } = useCurrentUser();

  const createMutation = useMutation(api.kwaliteitsControles.create);
  const updateChecklistItemMutation = useMutation(api.kwaliteitsControles.updateChecklistItem);
  const updateStatusMutation = useMutation(api.kwaliteitsControles.updateStatus);
  const approveMutation = useMutation(api.kwaliteitsControles.approve);
  const rejectMutation = useMutation(api.kwaliteitsControles.reject);
  const addFotoMutation = useMutation(api.kwaliteitsControles.addFoto);
  const removeFotoMutation = useMutation(api.kwaliteitsControles.removeFoto);
  const addChecklistItemMutation = useMutation(api.kwaliteitsControles.addChecklistItem);
  const removeChecklistItemMutation = useMutation(api.kwaliteitsControles.removeChecklistItem);
  const removeMutation = useMutation(api.kwaliteitsControles.remove);

  const create = useCallback(
    async (data: {
      projectId: Id<"projecten">;
      scope: string;
      customChecklistItems?: string[];
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createMutation(data);
    },
    [user?._id, createMutation]
  );

  const updateItem = useCallback(
    async (
      id: Id<"kwaliteitsControles">,
      itemId: string,
      isAfgevinkt: boolean,
      options?: {
        notities?: string;
        afgevinktDoor?: string;
      }
    ) => {
      return await updateChecklistItemMutation({
        id,
        itemId,
        isAfgevinkt,
        notities: options?.notities,
        afgevinktDoor: options?.afgevinktDoor,
      });
    },
    [updateChecklistItemMutation]
  );

  const updateStatus = useCallback(
    async (
      id: Id<"kwaliteitsControles">,
      status: KwaliteitsControleStatus,
      opmerkingen?: string
    ) => {
      return await updateStatusMutation({ id, status, opmerkingen });
    },
    [updateStatusMutation]
  );

  const approve = useCallback(
    async (
      id: Id<"kwaliteitsControles">,
      goedgekeurdDoor: string,
      opmerkingen?: string
    ) => {
      return await approveMutation({ id, goedgekeurdDoor, opmerkingen });
    },
    [approveMutation]
  );

  const reject = useCallback(
    async (
      id: Id<"kwaliteitsControles">,
      reden: string,
      afgekeurdDoor?: string
    ) => {
      return await rejectMutation({ id, reden, afgekeurdDoor });
    },
    [rejectMutation]
  );

  const addFoto = useCallback(
    async (
      id: Id<"kwaliteitsControles">,
      url: string,
      type: "voor" | "na",
      beschrijving?: string
    ) => {
      return await addFotoMutation({ id, url, type, beschrijving });
    },
    [addFotoMutation]
  );

  const removeFoto = useCallback(
    async (id: Id<"kwaliteitsControles">, fotoUrl: string) => {
      return await removeFotoMutation({ id, fotoUrl });
    },
    [removeFotoMutation]
  );

  const addChecklistItem = useCallback(
    async (id: Id<"kwaliteitsControles">, omschrijving: string) => {
      return await addChecklistItemMutation({ id, omschrijving });
    },
    [addChecklistItemMutation]
  );

  const removeChecklistItem = useCallback(
    async (id: Id<"kwaliteitsControles">, itemId: string) => {
      return await removeChecklistItemMutation({ id, itemId });
    },
    [removeChecklistItemMutation]
  );

  const remove = useCallback(
    async (id: Id<"kwaliteitsControles">) => {
      return await removeMutation({ id });
    },
    [removeMutation]
  );

  return {
    create,
    updateItem,
    updateStatus,
    approve,
    reject,
    addFoto,
    removeFoto,
    addChecklistItem,
    removeChecklistItem,
    remove,
  };
}
