"use client";

import { useQuery, useMutation } from "convex/react";
import { useMemo, useCallback } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "./use-current-user";

export type ProjectKostenType = "materiaal" | "arbeid" | "machine" | "overig";

/**
 * Hook for listing project costs
 */
export function useProjectKosten(projectId: Id<"projecten"> | null) {
  const kosten = useQuery(
    api.projectKosten.list,
    projectId ? { projectId } : "skip"
  );

  const isLoading = projectId !== null && kosten === undefined;

  // Memoize the list
  const kostenList = useMemo(() => kosten ?? [], [kosten]);

  // Group by type
  const kostenPerType = useMemo(() => {
    return {
      materiaal: kostenList.filter((k) => k.type === "materiaal"),
      arbeid: kostenList.filter((k) => k.type === "arbeid"),
      machine: kostenList.filter((k) => k.type === "machine"),
      overig: [] as typeof kostenList, // Overig is not a separate type in the new API
    };
  }, [kostenList]);

  // Group by scope
  const kostenPerScope = useMemo(() => {
    const grouped: Record<string, typeof kostenList> = {};
    for (const kost of kostenList) {
      const scope = kost.scope ?? "Geen scope";
      if (!grouped[scope]) {
        grouped[scope] = [];
      }
      grouped[scope].push(kost);
    }
    return grouped;
  }, [kostenList]);

  return {
    kosten: kostenList,
    kostenPerType,
    kostenPerScope,
    isLoading,
  };
}

/**
 * Hook for filtered project costs
 */
export function useProjectKostenFiltered(
  projectId: Id<"projecten"> | null,
  filters?: {
    type?: ProjectKostenType;
    startDate?: string;
    endDate?: string;
  }
) {
  const kosten = useQuery(
    api.projectKosten.list,
    projectId
      ? {
          projectId,
          type: filters?.type,
          startDate: filters?.startDate,
          endDate: filters?.endDate,
        }
      : "skip"
  );

  return {
    kosten: kosten ?? [],
    isLoading: projectId !== null && kosten === undefined,
  };
}

/**
 * Hook for project cost totals per type
 */
export function useKostenTotalen(projectId: Id<"projecten"> | null) {
  const totalen = useQuery(
    api.projectKosten.getTotalen,
    projectId ? { projectId } : "skip"
  );

  const isLoading = projectId !== null && totalen === undefined;

  return {
    arbeid: totalen?.arbeid ?? { totaal: 0, uren: 0, aantalRegistraties: 0 },
    machine: totalen?.machine ?? { totaal: 0, aantalRegistraties: 0 },
    materiaal: totalen?.materiaal ?? { totaal: 0, aantalRegistraties: 0 },
    overig: totalen?.overig ?? { totaal: 0, aantalRegistraties: 0 },
    totaal: totalen?.totaal ?? 0,
    isLoading,
  };
}

/**
 * Hook for budget comparison (actual vs planned)
 */
export function useBudgetVergelijking(projectId: Id<"projecten"> | null) {
  const vergelijking = useQuery(
    api.projectKosten.getBudgetVergelijking,
    projectId ? { projectId } : "skip"
  );

  const isLoading = projectId !== null && vergelijking === undefined;

  // Check if there's an error
  const hasError = vergelijking?.error !== null;
  const data = vergelijking?.data;

  // Calculate budget usage percentages
  const budgetGebruik = useMemo(() => {
    if (!data) return null;

    const { werkelijk, gepland } = data;

    return {
      arbeid: gepland.arbeid > 0 ? (werkelijk.arbeid / gepland.arbeid) * 100 : 0,
      machine: gepland.machine > 0 ? (werkelijk.machine / gepland.machine) * 100 : 0,
      materiaal: gepland.materiaal > 0 ? (werkelijk.materiaal / gepland.materiaal) * 100 : 0,
      totaal: gepland.totaal > 0 ? (werkelijk.totaal / gepland.totaal) * 100 : 0,
    };
  }, [data]);

  // Check if over budget
  const isOverBudget = useMemo(() => {
    return data?.budgetStatus === "over_budget";
  }, [data]);

  // Get warnings for types exceeding budget
  const budgetWaarschuwingen = useMemo(() => {
    if (!data) return [];

    const warnings: { type: ProjectKostenType; afwijking: number; percentage: number }[] = [];
    const { afwijking } = data;

    const types = ["materiaal", "arbeid", "machine"] as const;
    for (const type of types) {
      if (afwijking[type].absoluut > 0) {
        warnings.push({
          type,
          afwijking: afwijking[type].absoluut,
          percentage: afwijking[type].percentage,
        });
      }
    }

    return warnings;
  }, [data]);

  return {
    gepland: data?.gepland ?? null,
    werkelijk: data?.werkelijk ?? null,
    afwijking: data?.afwijking ?? null,
    budgetGebruik,
    isOverBudget,
    budgetStatus: data?.budgetStatus ?? null,
    urenStatus: data?.urenStatus ?? null,
    budgetWaarschuwingen,
    error: vergelijking?.error ?? null,
    hasError,
    isLoading,
  };
}

/**
 * Hook for costs grouped by scope
 */
export function useKostenPerScope(projectId: Id<"projecten"> | null) {
  const perScope = useQuery(
    api.projectKosten.getByScope,
    projectId ? { projectId } : "skip"
  );

  return {
    kostenPerScope: perScope ?? {},
    isLoading: projectId !== null && perScope === undefined,
  };
}

/**
 * Hook for daily cost overview
 */
export function useDagelijksKostenOverzicht(
  projectId: Id<"projecten"> | null,
  options?: { startDate?: string; endDate?: string }
) {
  const dagen = useQuery(
    api.projectKosten.getDagelijksOverzicht,
    projectId
      ? {
          projectId,
          startDate: options?.startDate,
          endDate: options?.endDate,
        }
      : "skip"
  );

  return {
    dagen: dagen ?? [],
    isLoading: projectId !== null && dagen === undefined,
  };
}

/**
 * Hook for complete project cost overview
 */
export function useProjectKostenOverzicht(projectId: Id<"projecten"> | null) {
  const overzicht = useQuery(
    api.projectKosten.getProjectOverzicht,
    projectId ? { projectId } : "skip"
  );

  return {
    overzicht,
    isLoading: projectId !== null && overzicht === undefined,
  };
}

/**
 * Hook for project cost mutations
 */
export function useProjectKostenMutations() {
  const { user } = useCurrentUser();

  const createMutation = useMutation(api.projectKosten.create);
  const updateMutation = useMutation(api.projectKosten.update);
  const removeMutation = useMutation(api.projectKosten.remove);

  const create = useCallback(
    async (data: {
      projectId: Id<"projecten">;
      datum: string;
      type: ProjectKostenType;
      omschrijving: string;
      hoeveelheid: number;
      prijsPerEenheid: number;
      scope?: string;
      medewerker?: string;
      machineId?: Id<"machines">;
      productId?: Id<"producten">;
      notities?: string;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return await createMutation(data);
    },
    [user?._id, createMutation]
  );

  const update = useCallback(
    async (
      id: string,
      type: ProjectKostenType,
      projectId: Id<"projecten">,
      data: {
        datum?: string;
        hoeveelheid?: number;
        scope?: string;
        medewerker?: string;
        notities?: string;
      }
    ) => {
      return await updateMutation({ id, type, projectId, ...data });
    },
    [updateMutation]
  );

  const remove = useCallback(
    async (id: string, type: ProjectKostenType, projectId: Id<"projecten">) => {
      return await removeMutation({ id, type, projectId });
    },
    [removeMutation]
  );

  return {
    create,
    update,
    remove,
  };
}
