"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";
import { useMemo, useCallback } from "react";
import {
  analyzeNacalculaties,
  type LeerfeedbackAnalyse,
  type ScopeSuggestie,
  validateSuggestion,
} from "@/lib/leerfeedback-analyzer";
import { useNormuren } from "./use-normuren";

/**
 * Hook for leerfeedback operations
 */
export function useLeerfeedback() {
  const { user } = useCurrentUser();
  const { normuren } = useNormuren();

  // Get suggestions from server
  const serverSuggesties = useQuery(
    api.leerfeedback.getSuggesties,
    user?._id ? {} : "skip"
  );

  // Get history
  const historie = useQuery(
    api.leerfeedback.getHistorie,
    user?._id ? {} : "skip"
  );

  // Get stats
  const stats = useQuery(
    api.leerfeedback.getStats,
    user?._id ? {} : "skip"
  );

  // Mutations
  const applyAanpassingMutation = useMutation(api.leerfeedback.applyAanpassing);
  const revertAanpassingMutation = useMutation(api.leerfeedback.revertAanpassing);

  // Apply a suggestion
  const applyAanpassing = useCallback(
    async (data: {
      normuurId: Id<"normuren">;
      nieuweWaarde: number;
      reden: string;
      bronProjecten: Id<"projecten">[];
    }) => {
      return applyAanpassingMutation(data);
    },
    [applyAanpassingMutation]
  );

  // Revert a previous adjustment
  const revertAanpassing = useCallback(
    async (historieId: Id<"leerfeedback_historie">) => {
      return revertAanpassingMutation({ historieId });
    },
    [revertAanpassingMutation]
  );

  // Validate a suggestion before applying
  const validateSuggestie = useCallback(
    (suggestie: ScopeSuggestie) => {
      return validateSuggestion(suggestie);
    },
    []
  );

  return {
    // Data
    suggesties: serverSuggesties?.suggesties || [],
    totaalAnalyseerdeProjecten: serverSuggesties?.totaalAnalyseerdeProjecten || 0,
    minimumVoorSuggestie: serverSuggesties?.minimumVoorSuggestie || 3,
    drempelPercentage: serverSuggesties?.drempelPercentage || 10,
    historie: historie || [],
    stats,

    // Loading states
    isLoading: user && serverSuggesties === undefined,
    isLoadingHistorie: user && historie === undefined,
    isLoadingStats: user && stats === undefined,

    // Actions
    applyAanpassing,
    revertAanpassing,
    validateSuggestie,

    // Helper data
    heeftSuggesties: (serverSuggesties?.suggesties?.length ?? 0) > 0,
    aantalSuggesties: serverSuggesties?.suggesties?.length ?? 0,
  };
}

/**
 * Hook for leerfeedback history with filtering
 */
export function useLeerfeedbackHistorie(options?: {
  scope?: string;
  limit?: number;
}) {
  const { user } = useCurrentUser();

  const historie = useQuery(
    api.leerfeedback.getHistorie,
    user?._id ? { scope: options?.scope, limit: options?.limit } : "skip"
  );

  return {
    historie: historie || [],
    isLoading: user && historie === undefined,
  };
}

/**
 * Hook for leerfeedback history for a specific normuur
 */
export function useLeerfeedbackHistorieByNormuur(
  normuurId: Id<"normuren"> | null
) {
  const { user } = useCurrentUser();

  const historie = useQuery(
    api.leerfeedback.getHistorieByNormuur,
    user?._id && normuurId ? { normuurId } : "skip"
  );

  return {
    historie: historie || [],
    isLoading: user && normuurId && historie === undefined,
  };
}

/**
 * Hook for client-side analysis (useful for previews without server calls)
 */
export function useLeerfeedbackAnalyse(
  nacalculaties: Array<{
    projectId: string;
    projectNaam: string;
    afwijkingenPerScope: Record<string, number>;
    geplandeUrenPerScope: Record<string, number>;
  }>
) {
  const { normuren } = useNormuren();

  const analyse = useMemo((): LeerfeedbackAnalyse | null => {
    if (!normuren || normuren.length === 0) return null;

    return analyzeNacalculaties(
      nacalculaties,
      normuren.map((n) => ({
        _id: n._id,
        activiteit: n.activiteit,
        scope: n.scope,
        normuurPerEenheid: n.normuurPerEenheid,
        eenheid: n.eenheid,
        omschrijving: n.omschrijving,
      }))
    );
  }, [nacalculaties, normuren]);

  return {
    analyse,
    isReady: !!analyse,
  };
}
