"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useGarantiePakketten() {
  const pakketten = useQuery(api.garantiePakketten.list);
  const createPakket = useMutation(api.garantiePakketten.create);
  const updatePakket = useMutation(api.garantiePakketten.update);
  const removePakket = useMutation(api.garantiePakketten.remove);

  return {
    pakketten: pakketten ?? [],
    isLoading: pakketten === undefined,
    create: createPakket,
    update: updatePakket,
    remove: removePakket,
  };
}

export function useGarantiePakketByTier(
  tier: "basis" | "premium" | "premium_plus" | undefined
) {
  const pakketten = useQuery(
    api.garantiePakketten.getByTier,
    tier ? { tier } : "skip"
  );

  return {
    pakketten: pakketten ?? [],
    isLoading: pakketten === undefined,
  };
}
