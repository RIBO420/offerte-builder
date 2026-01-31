"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";
import { useCallback, useMemo } from "react";

export type TaakStatus = "gepland" | "gestart" | "afgerond";

export interface PlanningTaak {
  _id: Id<"planningTaken">;
  projectId: Id<"projecten">;
  scope: string;
  taakNaam: string;
  normUren: number;
  geschatteDagen: number;
  volgorde: number;
  status: TaakStatus;
}

export interface PlanningSummary {
  totaalUren: number;
  totaalDagen: number;
  totaalTaken: number;
  afgerondTaken: number;
  gestartTaken: number;
  voortgang: number;
  perScope: Record<
    string,
    { uren: number; dagen: number; taken: number; afgerond: number }
  >;
}

/**
 * Hook for managing planning tasks for a project
 */
export function usePlanning(projectId: Id<"projecten"> | null) {
  const { user } = useCurrentUser();

  // Queries
  const taken = useQuery(
    api.planningTaken.list,
    projectId ? { projectId } : "skip"
  ) as PlanningTaak[] | undefined;

  const summary = useQuery(
    api.planningTaken.getSummary,
    projectId ? { projectId } : "skip"
  ) as PlanningSummary | null | undefined;

  // Mutations
  const generateFromVoorcalculatieMutation = useMutation(
    api.planningTaken.generateFromVoorcalculatie
  );
  const updateMutation = useMutation(api.planningTaken.update);
  const updateVolgordeMutation = useMutation(api.planningTaken.updateVolgorde);
  const removeMutation = useMutation(api.planningTaken.remove);
  const addMutation = useMutation(api.planningTaken.add);
  const moveUpMutation = useMutation(api.planningTaken.moveUp);
  const moveDownMutation = useMutation(api.planningTaken.moveDown);

  // Grouped tasks by scope
  const takenPerScope = useMemo(() => {
    if (!taken) return {};
    const grouped: Record<string, PlanningTaak[]> = {};
    for (const taak of taken) {
      if (!grouped[taak.scope]) {
        grouped[taak.scope] = [];
      }
      grouped[taak.scope].push(taak);
    }
    // Sort each group by volgorde
    for (const scope of Object.keys(grouped)) {
      grouped[scope].sort((a, b) => a.volgorde - b.volgorde);
    }
    return grouped;
  }, [taken]);

  // Generate tasks from voorcalculatie
  const generateFromVoorcalculatie = useCallback(async () => {
    if (!projectId) throw new Error("Project ID is required");
    return generateFromVoorcalculatieMutation({ projectId });
  }, [projectId, generateFromVoorcalculatieMutation]);

  // Update task status
  const updateStatus = useCallback(
    async (taskId: Id<"planningTaken">, status: TaakStatus) => {
      return updateMutation({ taskId, status });
    },
    [updateMutation]
  );

  // Update task details
  const updateTask = useCallback(
    async (
      taskId: Id<"planningTaken">,
      data: {
        taakNaam?: string;
        normUren?: number;
        geschatteDagen?: number;
        status?: TaakStatus;
      }
    ) => {
      return updateMutation({ taskId, ...data });
    },
    [updateMutation]
  );

  // Reorder tasks
  const updateVolgorde = useCallback(
    async (
      taskOrders: Array<{ taskId: Id<"planningTaken">; volgorde: number }>
    ) => {
      if (!projectId) throw new Error("Project ID is required");
      return updateVolgordeMutation({ projectId, taskOrders });
    },
    [projectId, updateVolgordeMutation]
  );

  // Delete task
  const removeTask = useCallback(
    async (taskId: Id<"planningTaken">) => {
      return removeMutation({ taskId });
    },
    [removeMutation]
  );

  // Add custom task
  const addTask = useCallback(
    async (data: {
      scope: string;
      taakNaam: string;
      normUren: number;
      geschatteDagen: number;
    }) => {
      if (!projectId) throw new Error("Project ID is required");
      return addMutation({ projectId, ...data });
    },
    [projectId, addMutation]
  );

  // Move task up
  const moveUp = useCallback(
    async (taskId: Id<"planningTaken">) => {
      return moveUpMutation({ taskId });
    },
    [moveUpMutation]
  );

  // Move task down
  const moveDown = useCallback(
    async (taskId: Id<"planningTaken">) => {
      return moveDownMutation({ taskId });
    },
    [moveDownMutation]
  );

  // Calculate progress percentage
  const voortgang = useMemo(() => {
    if (!taken || taken.length === 0) return 0;
    const afgerond = taken.filter((t) => t.status === "afgerond").length;
    return Math.round((afgerond / taken.length) * 100);
  }, [taken]);

  return {
    // Data
    taken: taken || [],
    takenPerScope,
    summary,
    voortgang,
    isLoading: !!(user && projectId && taken === undefined),

    // Actions
    generateFromVoorcalculatie,
    updateStatus,
    updateTask,
    updateVolgorde,
    removeTask,
    addTask,
    moveUp,
    moveDown,
  };
}

/**
 * Hook to calculate days for a task based on voorcalculatie settings
 */
export function useTaskDaysCalculator(
  teamSize: number = 2,
  effectiveHoursPerDay: number = 6
) {
  const calculateDays = useCallback(
    (taskHours: number): number => {
      const effectiveTeamHours = teamSize * effectiveHoursPerDay;
      if (effectiveTeamHours <= 0) return 0;
      return Math.round((taskHours / effectiveTeamHours) * 100) / 100;
    },
    [teamSize, effectiveHoursPerDay]
  );

  return { calculateDays };
}
