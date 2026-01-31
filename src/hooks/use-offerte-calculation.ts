"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
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

// Optimized hook using combined query - reduces 4 round-trips to 1
export function useOfferteCalculation() {
  const { user } = useCurrentUser();

  // Single query fetches normuren, correctiefactoren, producten, and instellingen
  const data = useQuery(
    api.berekeningen.getCalculationData,
    user?._id ? {} : "skip"
  );

  const isLoading = !user || data === undefined;

  const calculate = (input: OfferteCalculationInput): { regels: OfferteRegel[]; totals: ReturnType<typeof calculateTotals> } | null => {
    if (isLoading || !data?.instellingen) return null;

    const context: CalculationContext = {
      normuren: (data.normuren || []) as Normuur[],
      correctiefactoren: (data.correctiefactoren || []) as Correctiefactor[],
      producten: (data.producten || []) as Product[],
      instellingen: {
        uurtarief: data.instellingen.uurtarief,
        standaardMargePercentage: data.instellingen.standaardMargePercentage,
        btwPercentage: data.instellingen.btwPercentage,
      },
      bereikbaarheid: input.bereikbaarheid,
      achterstalligheid: input.achterstalligheid,
    };

    const regels = calculateOfferteRegels(input, context);
    const totals = calculateTotals(
      regels,
      data.instellingen.standaardMargePercentage,
      data.instellingen.btwPercentage
    );

    return { regels, totals };
  };

  return {
    calculate,
    isLoading,
    normuren: data?.normuren,
    correctiefactoren: data?.correctiefactoren,
    producten: data?.producten,
    instellingen: data?.instellingen,
  };
}

// Legacy hook for backward compatibility - uses separate queries
// Consider migrating to useOfferteCalculation which uses combined query
export function useOfferteCalculationLegacy() {
  const { user } = useCurrentUser();

  // Queries use auth context - no userId args needed
  const normuren = useQuery(
    api.normuren.list,
    user?._id ? {} : "skip"
  );

  const correctiefactoren = useQuery(
    api.correctiefactoren.list,
    user?._id ? {} : "skip"
  );

  const producten = useQuery(
    api.producten.list,
    user?._id ? {} : "skip"
  );

  const instellingen = useQuery(
    api.instellingen.get,
    user?._id ? {} : "skip"
  );

  const isLoading =
    !user ||
    !instellingen ||
    normuren === undefined ||
    correctiefactoren === undefined ||
    producten === undefined;

  const calculate = (input: OfferteCalculationInput): { regels: OfferteRegel[]; totals: ReturnType<typeof calculateTotals> } | null => {
    if (isLoading || !instellingen) return null;

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
