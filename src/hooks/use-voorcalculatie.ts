"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";
import { useMemo, useCallback } from "react";

/**
 * Hook for managing voorcalculatie data
 */
export function useVoorcalculatie(projectId: Id<"projecten"> | null) {
  const { user } = useCurrentUser();

  // Get voorcalculatie by project
  const voorcalculatie = useQuery(
    api.voorcalculaties.getByProject,
    projectId && user?._id ? { projectId } : "skip"
  );

  // Mutations
  const createMutation = useMutation(api.voorcalculaties.create);
  const updateMutation = useMutation(api.voorcalculaties.update);
  const removeMutation = useMutation(api.voorcalculaties.remove);

  const create = useCallback(
    async (data: {
      projectId: Id<"projecten">;
      teamGrootte: 2 | 3 | 4;
      teamleden?: string[];
      effectieveUrenPerDag: number;
      normUrenTotaal: number;
      geschatteDagen: number;
      normUrenPerScope: Record<string, number>;
    }) => {
      if (!user?._id) throw new Error("User not found");
      return createMutation(data);
    },
    [user?._id, createMutation]
  );

  const update = useCallback(
    async (
      id: Id<"voorcalculaties">,
      data: {
        teamGrootte?: 2 | 3 | 4;
        teamleden?: string[];
        effectieveUrenPerDag?: number;
        normUrenTotaal?: number;
        geschatteDagen?: number;
        normUrenPerScope?: Record<string, number>;
      }
    ) => {
      if (!user?._id) throw new Error("User not found");
      return updateMutation({ id, ...data });
    },
    [user?._id, updateMutation]
  );

  const remove = useCallback(
    async (id: Id<"voorcalculaties">) => {
      if (!user?._id) throw new Error("User not found");
      return removeMutation({ id });
    },
    [user?._id, removeMutation]
  );

  return {
    voorcalculatie,
    isLoading: user && projectId && voorcalculatie === undefined,
    create,
    update,
    remove,
  };
}

/**
 * Hook for calculating normuren from offerte
 */
export function useVoorcalculatieCalculation(
  offerteId: Id<"offertes"> | null
) {
  const { user } = useCurrentUser();

  const calculation = useQuery(
    api.voorcalculaties.calculate,
    offerteId && user?._id ? { offerteId } : "skip"
  );

  return {
    calculation,
    isLoading: user && offerteId && calculation === undefined,
  };
}

/**
 * Hook for managing project with voorcalculatie
 */
export function useProjectVoorcalculatie(projectId: Id<"projecten"> | null) {
  const { user } = useCurrentUser();

  // Get project with details
  const projectData = useQuery(
    api.projecten.getWithDetails,
    projectId && user?._id ? { id: projectId } : "skip"
  );

  // Get voorcalculatie calculation based on offerte
  const offerteId = projectData?.project?.offerteId;
  const calculation = useQuery(
    api.voorcalculaties.calculate,
    offerteId && user?._id ? { offerteId } : "skip"
  );

  // Mutations
  const createVoorcalculatie = useMutation(api.voorcalculaties.create);
  const updateVoorcalculatie = useMutation(api.voorcalculaties.update);
  const updateProjectStatus = useMutation(api.projecten.updateStatus);

  // Calculate project days based on team configuration
  const calculateDays = useCallback(
    (
      normUrenTotaal: number,
      teamGrootte: 2 | 3 | 4,
      effectieveUrenPerDag: number
    ) => {
      const teamCapaciteitPerDag = teamGrootte * effectieveUrenPerDag;
      return Math.ceil(normUrenTotaal / teamCapaciteitPerDag);
    },
    []
  );

  // Save voorcalculatie
  const saveVoorcalculatie = useCallback(
    async (data: {
      teamGrootte: 2 | 3 | 4;
      teamleden?: string[];
      effectieveUrenPerDag: number;
    }) => {
      if (!projectId || !calculation) {
        throw new Error("Project or calculation not available");
      }

      const geschatteDagen = calculateDays(
        calculation.normUrenTotaal,
        data.teamGrootte,
        data.effectieveUrenPerDag
      );

      const voorcalculatieData = {
        projectId,
        teamGrootte: data.teamGrootte,
        teamleden: data.teamleden,
        effectieveUrenPerDag: data.effectieveUrenPerDag,
        normUrenTotaal: calculation.normUrenTotaal,
        geschatteDagen,
        normUrenPerScope: calculation.normUrenPerScope,
      };

      // Check if voorcalculatie exists
      if (projectData?.voorcalculatie) {
        return updateVoorcalculatie({
          id: projectData.voorcalculatie._id,
          ...voorcalculatieData,
        });
      } else {
        return createVoorcalculatie(voorcalculatieData);
      }
    },
    [
      projectId,
      calculation,
      projectData?.voorcalculatie,
      calculateDays,
      createVoorcalculatie,
      updateVoorcalculatie,
    ]
  );

  // Move project to next phase
  const moveToPlanning = useCallback(async () => {
    if (!projectId) {
      throw new Error("Project not available");
    }
    return updateProjectStatus({ id: projectId, status: "gepland" });
  }, [projectId, updateProjectStatus]);

  // Memoized data
  const hasVoorcalculatie = useMemo(
    () => !!projectData?.voorcalculatie,
    [projectData?.voorcalculatie]
  );

  return {
    project: projectData?.project,
    offerte: projectData?.offerte,
    voorcalculatie: projectData?.voorcalculatie,
    calculation,
    isLoading:
      user &&
      projectId &&
      (projectData === undefined || calculation === undefined),
    hasVoorcalculatie,
    saveVoorcalculatie,
    moveToPlanning,
    calculateDays,
  };
}
