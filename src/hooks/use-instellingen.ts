"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";

export function useInstellingen() {
  const { user } = useCurrentUser();

  // Query uses auth context - no userId args needed
  const instellingen = useQuery(
    api.instellingen.get,
    user?._id ? {} : "skip"
  );

  const updateInstellingen = useMutation(api.instellingen.update);
  const getNextOfferteNummer = useMutation(api.instellingen.getNextOfferteNummer);

  const update = async (data: {
    uurtarief?: number;
    standaardMargePercentage?: number;
    scopeMarges?: {
      grondwerk?: number;
      bestrating?: number;
      borders?: number;
      gras?: number;
      houtwerk?: number;
      water_elektra?: number;
      specials?: number;
      gras_onderhoud?: number;
      borders_onderhoud?: number;
      heggen?: number;
      bomen?: number;
      overig?: number;
    };
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
    return updateInstellingen(data);
  };

  const getNextNummer = async () => {
    if (!user?._id) throw new Error("User not found");
    return getNextOfferteNummer({});
  };

  return {
    instellingen,
    isLoading: user && instellingen === undefined,
    update,
    getNextNummer,
  };
}
