"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useAfvalverwerkers() {
  const afvalverwerkers = useQuery(api.afvalverwerkers.list);
  const createAfvalverwerker = useMutation(api.afvalverwerkers.create);
  const updateAfvalverwerker = useMutation(api.afvalverwerkers.update);
  const removeAfvalverwerker = useMutation(api.afvalverwerkers.remove);

  return {
    afvalverwerkers: afvalverwerkers ?? [],
    isLoading: afvalverwerkers === undefined,
    create: createAfvalverwerker,
    update: updateAfvalverwerker,
    remove: removeAfvalverwerker,
  };
}

export function useNearestAfvalverwerker(
  lat: number | undefined,
  lng: number | undefined
) {
  const nearest = useQuery(
    api.afvalverwerkers.getNearest,
    lat !== undefined && lng !== undefined ? { lat, lng } : "skip"
  );

  return {
    nearest: nearest ?? [],
    isLoading: nearest === undefined,
  };
}
