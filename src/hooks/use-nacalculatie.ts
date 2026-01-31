"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";
import { useMemo } from "react";
import {
  calculateNacalculatie,
  type NacalculatieResult,
} from "@/lib/nacalculatie-calculator";

/**
 * Hook for nacalculatie operations on a specific project
 */
export function useNacalculatie(projectId: Id<"projecten"> | null) {
  const { user } = useCurrentUser();

  // Get existing nacalculatie
  const nacalculatie = useQuery(
    api.nacalculaties.get,
    projectId ? { projectId } : "skip"
  );

  // Get calculated data from server
  const calculatedData = useQuery(
    api.nacalculaties.calculate,
    projectId ? { projectId } : "skip"
  );

  // Get full details
  const details = useQuery(
    api.nacalculaties.getWithDetails,
    projectId ? { projectId } : "skip"
  );

  // Mutations
  const saveNacalculatie = useMutation(api.nacalculaties.save);
  const addConclusionMutation = useMutation(api.nacalculaties.addConclusion);

  // Save calculated results
  const save = async (data: {
    werkelijkeUren: number;
    werkelijkeDagen: number;
    werkelijkeMachineKosten: number;
    afwijkingUren: number;
    afwijkingPercentage: number;
    afwijkingenPerScope: Record<string, number>;
    conclusies?: string;
  }) => {
    if (!projectId) throw new Error("Project ID is required");
    return saveNacalculatie({
      projectId,
      ...data,
    });
  };

  // Add or update conclusions
  const addConclusion = async (conclusies: string) => {
    if (!projectId) throw new Error("Project ID is required");
    return addConclusionMutation({
      projectId,
      conclusies,
    });
  };

  // Client-side calculated result (for display purposes)
  const clientCalculation = useMemo((): NacalculatieResult | null => {
    if (!details?.voorcalculatie || !details?.urenRegistraties) return null;

    return calculateNacalculatie({
      voorcalculatie: {
        normUrenTotaal: details.voorcalculatie.normUrenTotaal,
        geschatteDagen: details.voorcalculatie.geschatteDagen,
        normUrenPerScope: details.voorcalculatie.normUrenPerScope,
        teamGrootte: details.voorcalculatie.teamGrootte,
        effectieveUrenPerDag: details.voorcalculatie.effectieveUrenPerDag,
      },
      urenRegistraties: details.urenRegistraties.map((r) => ({
        datum: r.datum,
        medewerker: r.medewerker,
        uren: r.uren,
        scope: r.scope,
        notities: r.notities,
      })),
      machineGebruik: details.machineGebruik.map((m) => ({
        datum: m.datum,
        uren: m.uren,
        kosten: m.kosten,
      })),
      offerteRegels: details.offerte?.regels,
    });
  }, [details]);

  return {
    // Data
    nacalculatie,
    calculatedData: calculatedData?.data,
    calculationError: calculatedData?.error,
    details,
    clientCalculation,

    // Loading states
    isLoading:
      user &&
      projectId &&
      (nacalculatie === undefined || calculatedData === undefined),
    isLoadingDetails: user && projectId && details === undefined,

    // Actions
    save,
    addConclusion,

    // Helper data
    hasVoorcalculatie: !!details?.voorcalculatie,
    hasUrenRegistraties: (details?.urenRegistraties?.length ?? 0) > 0,
    hasMachineGebruik: (details?.machineGebruik?.length ?? 0) > 0,
  };
}

/**
 * Hook for listing all nacalculaties (for leerfeedback analysis)
 */
export function useNacalculatiesList() {
  const { user } = useCurrentUser();

  const nacalculaties = useQuery(
    api.nacalculaties.listAll,
    user?._id ? {} : "skip"
  );

  return {
    nacalculaties: nacalculaties || [],
    isLoading: user && nacalculaties === undefined,
  };
}

/**
 * Hook for nacalculatie with export functionality
 */
export function useNacalculatieExport(projectId: Id<"projecten"> | null) {
  const { nacalculatie, details, clientCalculation } =
    useNacalculatie(projectId);

  const exportData = useMemo(() => {
    if (!details || !clientCalculation) return null;

    return {
      project: details.project,
      offerte: details.offerte,
      voorcalculatie: details.voorcalculatie,
      nacalculatie,
      berekening: clientCalculation,
      urenRegistraties: details.urenRegistraties,
      machineGebruik: details.machineGebruik,
    };
  }, [details, clientCalculation, nacalculatie]);

  return {
    exportData,
    isReady: !!exportData,
  };
}
