"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

export type OnderhoudType = "olie" | "apk" | "banden" | "inspectie" | "reparatie" | "overig";
export type OnderhoudStatus = "gepland" | "in_uitvoering" | "voltooid";

export interface OnderhoudRecord {
  _id: Id<"voertuigOnderhoud">;
  voertuigId: Id<"voertuigen">;
  type: OnderhoudType;
  omschrijving: string;
  geplanteDatum: number;
  voltooidDatum?: number;
  kosten?: number;
  status: OnderhoudStatus;
  notities?: string;
  createdAt: number;
  updatedAt: number;
}

export interface KilometerRecord {
  _id: Id<"kilometerStanden">;
  voertuigId: Id<"voertuigen">;
  datum: string;
  kilometerstand: number;
  projectId?: Id<"projecten">;
  notities?: string;
  createdAt: number;
}

export interface BrandstofRecord {
  _id: Id<"brandstofRegistratie">;
  voertuigId: Id<"voertuigen">;
  datum: number;
  liters: number;
  kosten: number;
  kilometerstand: number;
  locatie?: string;
  createdAt: number;
}

export interface BrandstofStats {
  totaalLiters: number;
  totaalKosten: number;
  gemiddeldVerbruik: number;
  aantalTankbeurten: number;
}

export function useVoertuigDetails(voertuigId: Id<"voertuigen"> | null) {
  const { user } = useCurrentUser();

  // Get the vehicle
  const voertuig = useQuery(
    api.voertuigen.get,
    voertuigId ? { id: voertuigId } : "skip"
  );

  // Get maintenance records
  const onderhoudRecords = useQuery(
    api.voertuigOnderhoud.listByVoertuig,
    voertuigId ? { voertuigId } : "skip"
  );

  // Get kilometer records
  const kilometerRecords = useQuery(
    api.kilometerStanden.listByVoertuig,
    voertuigId ? { voertuigId } : "skip"
  );

  // Get fuel records
  const brandstofRecords = useQuery(
    api.brandstofRegistratie.listByVoertuig,
    voertuigId ? { voertuigId } : "skip"
  );

  // Get fuel stats
  const brandstofStats = useQuery(
    api.brandstofRegistratie.getStats,
    voertuigId ? { voertuigId } : "skip"
  );

  // Mutations
  const createOnderhoud = useMutation(api.voertuigOnderhoud.create);
  const updateOnderhoud = useMutation(api.voertuigOnderhoud.update);
  const removeOnderhoud = useMutation(api.voertuigOnderhoud.remove);

  const createKilometer = useMutation(api.kilometerStanden.create);
  const removeKilometer = useMutation(api.kilometerStanden.remove);

  const createBrandstof = useMutation(api.brandstofRegistratie.create);
  const removeBrandstof = useMutation(api.brandstofRegistratie.remove);

  const updateVoertuig = useMutation(api.voertuigen.update);

  const isLoading =
    user &&
    voertuigId !== null &&
    (voertuig === undefined ||
      onderhoudRecords === undefined ||
      kilometerRecords === undefined ||
      brandstofRecords === undefined);

  // Helper functions for compliance status calculations
  const getDaysUntilExpiry = (expiryTimestamp: number | undefined): number | null => {
    if (!expiryTimestamp) return null;
    // eslint-disable-next-line react-hooks/purity -- Date.now() is intentionally impure for real-time calculations
    const now = Date.now();
    const diffMs = expiryTimestamp - now;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const apkDaysLeft = voertuig?.apkVervaldatum
    ? getDaysUntilExpiry(voertuig.apkVervaldatum)
    : null;

  const verzekeringDaysLeft = voertuig?.verzekeringsVervaldatum
    ? getDaysUntilExpiry(voertuig.verzekeringsVervaldatum)
    : null;

  // Count upcoming maintenance
  const upcomingOnderhoud = (onderhoudRecords ?? []).filter(
    (r) => r.status === "gepland" || r.status === "in_uitvoering"
  );

  return {
    voertuig,
    onderhoudRecords: (onderhoudRecords ?? []) as OnderhoudRecord[],
    kilometerRecords: (kilometerRecords ?? []) as KilometerRecord[],
    brandstofRecords: (brandstofRecords ?? []) as BrandstofRecord[],
    brandstofStats: brandstofStats as BrandstofStats | null,
    upcomingOnderhoud,
    apkDaysLeft,
    verzekeringDaysLeft,
    isLoading,
    // Onderhoud mutations
    createOnderhoud: async (data: {
      voertuigId: Id<"voertuigen">;
      type: OnderhoudType;
      omschrijving: string;
      geplanteDatum: number;
      kosten?: number;
      status?: OnderhoudStatus;
      notities?: string;
    }) => createOnderhoud(data),
    updateOnderhoud: async (
      id: Id<"voertuigOnderhoud">,
      data: {
        type?: OnderhoudType;
        omschrijving?: string;
        geplanteDatum?: number;
        voltooidDatum?: number;
        kosten?: number;
        status?: OnderhoudStatus;
        notities?: string;
      }
    ) => updateOnderhoud({ id, ...data }),
    removeOnderhoud: async (id: Id<"voertuigOnderhoud">) => removeOnderhoud({ id }),
    // Kilometer mutations
    createKilometer: async (data: {
      voertuigId: Id<"voertuigen">;
      datum: string;
      kilometerstand: number;
      projectId?: Id<"projecten">;
      notities?: string;
    }) => createKilometer(data),
    removeKilometer: async (id: Id<"kilometerStanden">) => removeKilometer({ id }),
    // Brandstof mutations
    createBrandstof: async (data: {
      voertuigId: Id<"voertuigen">;
      datum: number;
      liters: number;
      kosten: number;
      kilometerstand: number;
      locatie?: string;
    }) => createBrandstof(data),
    removeBrandstof: async (id: Id<"brandstofRegistratie">) => removeBrandstof({ id }),
    // Vehicle update
    updateVoertuig: async (
      id: Id<"voertuigen">,
      data: {
        apkVervaldatum?: number;
        verzekeringsVervaldatum?: number;
        verzekeraar?: string;
        polisnummer?: string;
      }
    ) => updateVoertuig({ id, ...data }),
  };
}

// Hook to get upcoming maintenance count across all vehicles
export function useUpcomingOnderhoud() {
  const { user } = useCurrentUser();

  const upcomingRecords = useQuery(
    api.voertuigOnderhoud.listUpcoming,
    user?._id ? {} : "skip"
  );

  return {
    records: upcomingRecords ?? [],
    count: upcomingRecords?.length ?? 0,
    isLoading: user && upcomingRecords === undefined,
  };
}
