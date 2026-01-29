"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";

export function useInstellingen() {
  const { user } = useCurrentUser();

  const instellingen = useQuery(
    api.instellingen.get,
    user?._id ? { userId: user._id } : "skip"
  );

  const updateInstellingen = useMutation(api.instellingen.update);
  const getNextOfferteNummer = useMutation(api.instellingen.getNextOfferteNummer);

  const update = async (data: {
    uurtarief?: number;
    standaardMargePercentage?: number;
    btwPercentage?: number;
    bedrijfsgegevens?: {
      naam: string;
      adres: string;
      postcode: string;
      plaats: string;
      kvk?: string;
      btw?: string;
      iban?: string;
      email?: string;
      telefoon?: string;
      logo?: string;
    };
    offerteNummerPrefix?: string;
  }) => {
    if (!user?._id) throw new Error("User not found");
    return updateInstellingen({ userId: user._id, ...data });
  };

  const getNextNummer = async () => {
    if (!user?._id) throw new Error("User not found");
    return getNextOfferteNummer({ userId: user._id });
  };

  return {
    instellingen,
    isLoading: user && instellingen === undefined,
    update,
    getNextNummer,
  };
}
