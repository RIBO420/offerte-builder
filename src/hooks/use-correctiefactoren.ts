"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";

export function useCorrectiefactoren() {
  const { user } = useCurrentUser();

  // Query uses auth context - no userId args needed
  const factoren = useQuery(
    api.correctiefactoren.list,
    user?._id ? {} : "skip"
  );

  const upsertFactor = useMutation(api.correctiefactoren.upsert);
  const resetFactor = useMutation(api.correctiefactoren.resetToDefault);
  const initDefaults = useMutation(api.correctiefactoren.initializeSystemDefaults);

  const upsert = async (data: {
    type: string;
    waarde: string;
    factor: number;
  }) => {
    if (!user?._id) throw new Error("User not found");
    return upsertFactor(data);
  };

  const reset = async (type: string, waarde: string) => {
    if (!user?._id) throw new Error("User not found");
    return resetFactor({ type, waarde });
  };

  // Group factoren by type
  const factorenByType = factoren?.reduce((acc, factor) => {
    if (!acc[factor.type]) {
      acc[factor.type] = [];
    }
    acc[factor.type].push(factor);
    return acc;
  }, {} as Record<string, typeof factoren>);

  // Get all unique types
  const types = factoren ? [...new Set(factoren.map((f) => f.type))].sort() : [];

  return {
    factoren: factoren || [],
    factorenByType: factorenByType || {},
    types,
    isLoading: user && factoren === undefined,
    upsert,
    reset,
    initDefaults,
  };
}

export function useCorrectiefactorenByType(type: string) {
  const { user } = useCurrentUser();

  const factoren = useQuery(
    api.correctiefactoren.getByType,
    user?._id && type ? { type } : "skip"
  );

  return {
    factoren: factoren || [],
    isLoading: user && type && factoren === undefined,
  };
}

export function useCorrectiefactor(type: string, waarde: string) {
  const { user } = useCurrentUser();

  const factor = useQuery(
    api.correctiefactoren.getByTypeAndValue,
    user?._id && type && waarde ? { type, waarde } : "skip"
  );

  return {
    factor,
    isLoading: user && type && waarde && factor === undefined,
  };
}
