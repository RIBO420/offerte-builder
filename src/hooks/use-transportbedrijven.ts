"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function useTransportbedrijven() {
  const transportbedrijven = useQuery(api.transportbedrijven.list);
  const createTransportbedrijf = useMutation(api.transportbedrijven.create);
  const updateTransportbedrijf = useMutation(api.transportbedrijven.update);
  const removeTransportbedrijf = useMutation(api.transportbedrijven.remove);

  return {
    transportbedrijven: transportbedrijven ?? [],
    isLoading: transportbedrijven === undefined,
    create: createTransportbedrijf,
    update: updateTransportbedrijf,
    remove: removeTransportbedrijf,
  };
}

export function useNearestTransportbedrijf(
  lat: number | undefined,
  lng: number | undefined
) {
  const nearest = useQuery(
    api.transportbedrijven.getNearest,
    lat !== undefined && lng !== undefined ? { lat, lng } : "skip"
  );

  return {
    nearest: nearest ?? [],
    isLoading: nearest === undefined,
  };
}
