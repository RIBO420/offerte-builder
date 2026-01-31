"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

export function useUrenRegistratie(projectId: Id<"projecten"> | null) {
  const { user } = useCurrentUser();

  const registraties = useQuery(
    api.urenRegistraties.list,
    projectId ? { projectId } : "skip"
  );

  const totals = useQuery(
    api.urenRegistraties.getTotals,
    projectId ? { projectId } : "skip"
  );

  const addEntry = useMutation(api.urenRegistraties.add);
  const importBatch = useMutation(api.urenRegistraties.importBatch);
  const updateEntry = useMutation(api.urenRegistraties.update);
  const deleteEntry = useMutation(api.urenRegistraties.remove);

  const add = async (entryData: {
    datum: string;
    medewerker: string;
    uren: number;
    taakId?: Id<"planningTaken">;
    scope?: string;
    notities?: string;
  }) => {
    if (!projectId) throw new Error("Project ID required");
    return addEntry({ projectId, ...entryData });
  };

  const importEntries = async (
    entries: Array<{
      datum: string;
      medewerker: string;
      uren: number;
      scope?: string;
      notities?: string;
    }>
  ) => {
    if (!projectId) throw new Error("Project ID required");
    return importBatch({ projectId, entries });
  };

  return {
    registraties: registraties || [],
    totals: totals || {
      totaalUren: 0,
      perMedewerker: {},
      perScope: {},
      perDatum: {},
      aantalRegistraties: 0,
    },
    isLoading: user && projectId && registraties === undefined,
    add,
    importEntries,
    update: updateEntry,
    delete: deleteEntry,
  };
}

export function useUrenRegistratieByDateRange(
  projectId: Id<"projecten"> | null,
  startDate: string,
  endDate: string
) {
  const registraties = useQuery(
    api.urenRegistraties.listByDateRange,
    projectId && startDate && endDate
      ? { projectId, startDate, endDate }
      : "skip"
  );

  return {
    registraties: registraties || [],
    isLoading: projectId && startDate && endDate && registraties === undefined,
  };
}

export function useMachineGebruik(projectId: Id<"projecten"> | null) {
  const { user } = useCurrentUser();

  const usage = useQuery(
    api.machineGebruik.list,
    projectId ? { projectId } : "skip"
  );

  const totals = useQuery(
    api.machineGebruik.getTotals,
    projectId ? { projectId } : "skip"
  );

  const addUsage = useMutation(api.machineGebruik.add);
  const updateUsage = useMutation(api.machineGebruik.update);
  const deleteUsage = useMutation(api.machineGebruik.remove);

  const add = async (usageData: {
    machineId: Id<"machines">;
    datum: string;
    uren: number;
  }) => {
    if (!projectId) throw new Error("Project ID required");
    return addUsage({ projectId, ...usageData });
  };

  return {
    usage: usage || [],
    totals: totals || {
      totaalKosten: 0,
      totaalUren: 0,
      perMachine: {},
      perDatum: {},
      aantalRegistraties: 0,
    },
    isLoading: user && projectId && usage === undefined,
    add,
    update: updateUsage,
    delete: deleteUsage,
  };
}
