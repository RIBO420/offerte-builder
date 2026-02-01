"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

export function useTeams(filterActief?: boolean) {
  const { user } = useCurrentUser();

  const teams = useQuery(
    api.teams.listWithMedewerkers,
    user?._id ? { isActief: filterActief } : "skip"
  );

  const createMutation = useMutation(api.teams.create);
  const updateMutation = useMutation(api.teams.update);
  const removeMutation = useMutation(api.teams.remove);
  const hardDeleteMutation = useMutation(api.teams.hardDelete);
  const addLidMutation = useMutation(api.teams.addLid);
  const removeLidMutation = useMutation(api.teams.removeLid);

  const isLoading = user && teams === undefined;

  const create = async (teamData: {
    naam: string;
    beschrijving?: string;
    leden: Id<"medewerkers">[];
  }) => {
    if (!user?._id) throw new Error("User not found");
    return await createMutation(teamData);
  };

  const update = async (
    id: Id<"teams">,
    teamData: {
      naam?: string;
      beschrijving?: string;
      leden?: Id<"medewerkers">[];
      isActief?: boolean;
    }
  ) => {
    return await updateMutation({ id, ...teamData });
  };

  const remove = async (id: Id<"teams">) => {
    return await removeMutation({ id });
  };

  const hardDelete = async (id: Id<"teams">) => {
    return await hardDeleteMutation({ id });
  };

  const addLid = async (teamId: Id<"teams">, medewerkerId: Id<"medewerkers">) => {
    return await addLidMutation({ teamId, medewerkerId });
  };

  const removeLid = async (teamId: Id<"teams">, medewerkerId: Id<"medewerkers">) => {
    return await removeLidMutation({ teamId, medewerkerId });
  };

  return {
    teams: teams ?? [],
    activeTeams: (teams ?? []).filter((t) => t.isActief),
    isLoading,
    create,
    update,
    remove,
    hardDelete,
    addLid,
    removeLid,
  };
}

export function useTeam(id: Id<"teams"> | null) {
  const team = useQuery(api.teams.getWithMedewerkers, id ? { id } : "skip");

  return {
    team,
    isLoading: id !== null && team === undefined,
  };
}

export function useTeamPrestaties(id: Id<"teams"> | null) {
  const prestaties = useQuery(api.teams.getTeamPrestaties, id ? { id } : "skip");

  return {
    prestaties,
    isLoading: id !== null && prestaties === undefined,
  };
}

export function useAllTeamsPrestaties() {
  const { user } = useCurrentUser();

  const prestaties = useQuery(
    api.teams.getAllTeamsPrestaties,
    user?._id ? {} : "skip"
  );

  return {
    prestaties,
    isLoading: user && prestaties === undefined,
  };
}
