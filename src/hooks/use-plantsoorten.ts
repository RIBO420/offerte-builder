"use client";

import { useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function usePlantsoorten() {
  const plantsoorten = useQuery(api.plantsoorten.list);
  const createPlantsoort = useMutation(api.plantsoorten.create);
  const updatePlantsoort = useMutation(api.plantsoorten.update);
  const removePlantsoort = useMutation(api.plantsoorten.remove);

  return {
    plantsoorten: plantsoorten ?? [],
    isLoading: plantsoorten === undefined,
    create: createPlantsoort,
    update: updatePlantsoort,
    remove: removePlantsoort,
  };
}

export function usePlantSuggesties(
  lichtbehoefte: "zon" | "halfschaduw" | "schaduw" | undefined,
  bodemvoorkeur?: string
) {
  const suggesties = useQuery(
    api.plantsoorten.getByLichtbehoefte,
    lichtbehoefte ? { lichtbehoefte } : "skip"
  );

  const gefilterd = useMemo(() => {
    if (!suggesties) return [];
    if (!bodemvoorkeur) return suggesties;
    return suggesties.filter(
      (plant) =>
        "bodemvoorkeur" in plant &&
        typeof plant.bodemvoorkeur === "string" &&
        plant.bodemvoorkeur
          .toLowerCase()
          .includes(bodemvoorkeur.toLowerCase())
    );
  }, [suggesties, bodemvoorkeur]);

  return {
    suggesties: gefilterd,
    isLoading: suggesties === undefined,
  };
}
