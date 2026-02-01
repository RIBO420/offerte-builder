"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { Id } from "../../convex/_generated/dataModel";

export type UserRole = "admin" | "medewerker" | "viewer";

export interface UserWithDetails {
  _id: Id<"users">;
  clerkId: string;
  email: string;
  name: string;
  role: UserRole;
  linkedMedewerkerId?: Id<"medewerkers">;
  linkedMedewerkerNaam?: string | null;
  createdAt: number;
}

export interface MedewerkerForLinking {
  _id: Id<"medewerkers">;
  naam: string;
  email: string | null;
  functie: string | null;
}

/**
 * Hook for user management - Admin only functionality
 */
export function useUsers() {
  const { user } = useCurrentUser();

  const users = useQuery(
    api.users.listUsersWithDetails,
    user?._id ? {} : "skip"
  );

  const availableMedewerkers = useQuery(
    api.users.getAvailableMedewerkersForLinking,
    user?._id ? {} : "skip"
  );

  const updateRoleMutation = useMutation(api.users.updateUserRole);
  const linkMedewerkerMutation = useMutation(api.users.linkUserToMedewerker);

  const isLoading = user && users === undefined;

  const updateRole = async (userId: Id<"users">, role: UserRole) => {
    return await updateRoleMutation({ userId, role });
  };

  const linkToMedewerker = async (
    userId: Id<"users">,
    medewerkerId: Id<"medewerkers"> | undefined
  ) => {
    return await linkMedewerkerMutation({ userId, medewerkerId });
  };

  return {
    users: (users ?? []) as UserWithDetails[],
    availableMedewerkers: (availableMedewerkers ?? []) as MedewerkerForLinking[],
    isLoading,
    updateRole,
    linkToMedewerker,
  };
}

/**
 * Hook to check if current user is an admin
 */
export function useIsAdmin() {
  const { user, isLoading } = useCurrentUser();

  // Not admin during loading or if not authenticated
  if (isLoading || !user) {
    return false;
  }

  // Check actual role - default to false if not set (secure default)
  return user.role === "admin";
}

/**
 * Hook to get current user's role
 */
export function useCurrentUserRole(): UserRole | null {
  const { user, isLoading } = useCurrentUser();

  if (isLoading || !user) {
    return null;
  }

  // Default to medewerker for security (secure default)
  return (user.role ?? "medewerker") as UserRole;
}
