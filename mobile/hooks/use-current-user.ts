/**
 * Hook to sync Clerk user to Convex database
 * Creates user in Convex if they don't exist yet
 *
 * Also provides role-based access control information:
 * - role: The user's role (admin, medewerker, viewer)
 * - isAdmin: Whether the user has admin privileges
 * - isMedewerker: Whether the user is a medewerker
 * - isViewer: Whether the user is a viewer (read-only)
 * - linkedMedewerkerId: The ID of the linked medewerker profile (for medewerker role)
 */

import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useRef, useMemo } from "react";
import type { Id } from "../convex/_generated/dataModel";

/**
 * User roles for role-based access control
 */
export type UserRole = "admin" | "medewerker" | "viewer";

/**
 * Return type for the useCurrentUser hook
 */
export interface CurrentUserResult {
  /** The Convex user object, or null/undefined if not loaded */
  user: typeof api.users.current._returnType | null | undefined;
  /** The Clerk user object */
  clerkUser: ReturnType<typeof useUser>["user"];
  /** Whether the user data is still loading */
  isLoading: boolean;
  /** Whether the user is fully authenticated (Clerk + Convex) */
  isAuthenticated: boolean;
  /** Whether the Convex user has been synced */
  isUserSynced: boolean;
  /** The user's role (defaults to 'admin' for backwards compatibility) */
  role: UserRole;
  /** Whether the user has admin privileges */
  isAdmin: boolean;
  /** Whether the user is a medewerker */
  isMedewerker: boolean;
  /** Whether the user is a viewer (read-only) */
  isViewer: boolean;
  /** The ID of the linked medewerker profile (for medewerker role) */
  linkedMedewerkerId: Id<"medewerkers"> | null;
}

export function useCurrentUser(): CurrentUserResult {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { isAuthenticated, isLoading: isConvexLoading } = useConvexAuth();

  // Query current user - skip if not authenticated
  const convexUser = useQuery(
    api.users.current,
    isAuthenticated ? {} : "skip"
  );

  const upsertUser = useMutation(api.users.upsert);
  const initializeDefaultsMutation = useMutation(api.users.initializeDefaults);

  // Track if we've already attempted user creation
  const hasAttemptedUpsert = useRef(false);
  const hasInitialized = useRef(false);

  // Sync Clerk user to Convex on first load
  useEffect(() => {
    // Only run when:
    // 1. Clerk is loaded
    // 2. We have a Clerk user
    // 3. Convex auth is ready
    // 4. Convex user query returned null (not undefined = loading)
    // 5. We haven't already attempted to create the user
    if (
      isClerkLoaded &&
      clerkUser &&
      isAuthenticated &&
      convexUser === null &&
      !hasAttemptedUpsert.current
    ) {
      hasAttemptedUpsert.current = true;
      console.log("[useCurrentUser] Creating user in Convex:", clerkUser.id);

      upsertUser({
        clerkId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        name: clerkUser.fullName || clerkUser.firstName || "Gebruiker",
        bedrijfsnaam: undefined,
      }).catch((error) => {
        console.error("[useCurrentUser] Failed to create user:", error);
        hasAttemptedUpsert.current = false; // Allow retry
      });
    }
  }, [isClerkLoaded, clerkUser, isAuthenticated, convexUser, upsertUser]);

  // Initialize defaults once user exists
  useEffect(() => {
    if (convexUser?._id && !hasInitialized.current) {
      hasInitialized.current = true;
      initializeDefaultsMutation({}).catch((error) => {
        console.error("[useCurrentUser] Failed to initialize defaults:", error);
      });
    }
  }, [convexUser?._id, initializeDefaultsMutation]);

  // Compute role-based access control values
  const roleInfo = useMemo(() => {
    // Default to 'admin' for backwards compatibility (users without a role are admins)
    const role: UserRole = (convexUser?.role as UserRole) || "admin";
    const linkedMedewerkerId = convexUser?.linkedMedewerkerId ?? null;

    return {
      role,
      isAdmin: role === "admin",
      isMedewerker: role === "medewerker",
      isViewer: role === "viewer",
      linkedMedewerkerId,
    };
  }, [convexUser?.role, convexUser?.linkedMedewerkerId]);

  return {
    user: convexUser,
    clerkUser,
    isLoading: !isClerkLoaded || isConvexLoading || (isAuthenticated && convexUser === undefined),
    isAuthenticated: isAuthenticated && !!convexUser,
    isUserSynced: convexUser !== null && convexUser !== undefined,
    ...roleInfo,
  };
}
