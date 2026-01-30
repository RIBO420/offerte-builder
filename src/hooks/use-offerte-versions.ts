"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export function useOfferteVersions(offerteId: Id<"offertes"> | null) {
  const versions = useQuery(
    api.offerteVersions.listByOfferte,
    offerteId ? { offerteId } : "skip"
  );

  const rollbackMutation = useMutation(api.offerteVersions.rollback);

  const rollback = async (versionId: Id<"offerte_versions">, userId: Id<"users">) => {
    return await rollbackMutation({ versionId, userId });
  };

  return {
    versions: versions ?? [],
    isLoading: versions === undefined,
    rollback,
  };
}

export function useOfferteVersion(versionId: Id<"offerte_versions"> | null) {
  const version = useQuery(
    api.offerteVersions.get,
    versionId ? { id: versionId } : "skip"
  );

  return {
    version: version ?? null,
    isLoading: version === undefined,
  };
}

export function useCompareVersions(
  versionId1: Id<"offerte_versions"> | null,
  versionId2: Id<"offerte_versions"> | null
) {
  const comparison = useQuery(
    api.offerteVersions.compareVersions,
    versionId1 && versionId2 ? { versionId1, versionId2 } : "skip"
  );

  return {
    comparison: comparison ?? null,
    isLoading: comparison === undefined,
  };
}
