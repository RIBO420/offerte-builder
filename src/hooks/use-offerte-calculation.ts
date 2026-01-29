"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { useInstellingen } from "./use-instellingen";
import {
  calculateOfferteRegels,
  calculateTotals,
  type OfferteCalculationInput,
  type OfferteRegel,
  type CalculationContext,
  type Normuur,
  type Correctiefactor,
  type Product,
} from "@/lib/offerte-calculator";

export function useOfferteCalculation() {
  const { user } = useCurrentUser();
  const { instellingen } = useInstellingen();

  const normuren = useQuery(
    api.normuren.list,
    user?._id ? { userId: user._id } : "skip"
  );

  const correctiefactoren = useQuery(
    api.correctiefactoren.list,
    user?._id ? { userId: user._id } : "skip"
  );

  const producten = useQuery(
    api.producten.list,
    user?._id ? { userId: user._id } : "skip"
  );

  const isLoading =
    !user ||
    !instellingen ||
    normuren === undefined ||
    correctiefactoren === undefined ||
    producten === undefined;

  const calculate = (input: OfferteCalculationInput): { regels: OfferteRegel[]; totals: ReturnType<typeof calculateTotals> } | null => {
    if (isLoading) return null;

    const context: CalculationContext = {
      normuren: (normuren || []) as Normuur[],
      correctiefactoren: (correctiefactoren || []) as Correctiefactor[],
      producten: (producten || []).filter((p) => p.isActief) as Product[],
      instellingen: {
        uurtarief: instellingen.uurtarief,
        standaardMargePercentage: instellingen.standaardMargePercentage,
        btwPercentage: instellingen.btwPercentage,
      },
      bereikbaarheid: input.bereikbaarheid,
      achterstalligheid: input.achterstalligheid,
    };

    const regels = calculateOfferteRegels(input, context);
    const totals = calculateTotals(
      regels,
      instellingen.standaardMargePercentage,
      instellingen.btwPercentage
    );

    return { regels, totals };
  };

  return {
    calculate,
    isLoading,
    normuren,
    correctiefactoren,
    producten,
    instellingen,
  };
}
