"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";

export function useNormuren() {
  const { user } = useCurrentUser();

  // Query uses auth context - no userId args needed
  const normuren = useQuery(
    api.normuren.list,
    user?._id ? {} : "skip"
  );

  const createNormuur = useMutation(api.normuren.create);
  const updateNormuur = useMutation(api.normuren.update);
  const deleteNormuur = useMutation(api.normuren.remove);

  const create = async (data: {
    activiteit: string;
    scope: string;
    normuurPerEenheid: number;
    eenheid: string;
    omschrijving?: string;
  }) => {
    if (!user?._id) throw new Error("User not found");
    return createNormuur(data);
  };

  // Group normuren by scope
  const normurenByScope = normuren?.reduce((acc, normuur) => {
    if (!acc[normuur.scope]) {
      acc[normuur.scope] = [];
    }
    acc[normuur.scope].push(normuur);
    return acc;
  }, {} as Record<string, typeof normuren>);

  // Get all unique scopes
  const scopes = normuren ? [...new Set(normuren.map((n) => n.scope))].sort() : [];

  return {
    normuren: normuren || [],
    normurenByScope: normurenByScope || {},
    scopes,
    isLoading: user && normuren === undefined,
    create,
    update: updateNormuur,
    delete: deleteNormuur,
  };
}

export function useNormurenByScope(scope: string) {
  const { user } = useCurrentUser();

  const normuren = useQuery(
    api.normuren.listByScope,
    user?._id && scope ? { scope } : "skip"
  );

  return {
    normuren: normuren || [],
    isLoading: user && scope && normuren === undefined,
  };
}
