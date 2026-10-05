/**
 * Hook to sync Clerk user to Convex database
 * Creates user in Convex if they don't exist yet
 *
 * Also provides role-based access control information:
 * - role: Canonical company role; unknown identities have no capabilities
 * - isAdmin: Whether the user has admin privileges
 * - isMedewerker: Whether the user is a medewerker
 * - isViewer: Whether the user is a viewer (read-only)
 * - linkedMedewerkerId: The ID of the linked medewerker profile (for medewerker role)
 */

import { useUser, useAuth } from "@clerk/clerk-expo";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useRef, useMemo } from "react";
import type { Id } from "../convex/_generated/dataModel";

/**
 * User roles for role-based access control
 */
import { normalizeRole, isFieldRole, type NativeRole } from '../lib/roles';
export type UserRole = NativeRole;

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
  /** The canonical role, or onbekend while loading/unauthorized */
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
  const { orgId } = useAuth();
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
  useEffect(() => {
    hasAttemptedUpsert.current = false;
    hasInitialized.current = false;
  }, [clerkUser?.id, orgId]);

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
      // clerkId, e-mail en naam worden server-side uit het Clerk-token gehaald —
      // meesturen vanaf de client zou account-overname mogelijk maken (audit §1).
      // De validator accepteert die velden niet meer; meesturen levert een
      // ArgumentValidationError op en dan wordt er nooit een Convex-user gemaakt.
      upsertUser({ bedrijfsnaam: undefined }).catch((error) => {
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
    const role = normalizeRole(isAuthenticated ? convexUser?.role : null);
    const linkedMedewerkerId = isAuthenticated ? convexUser?.linkedMedewerkerId ?? null : null;

    return {
      role,
      isAdmin: role === "directie",
      isMedewerker: isFieldRole(role),
      isViewer: role === "klant",
      linkedMedewerkerId,
    };
  }, [convexUser?.role, convexUser?.linkedMedewerkerId, isAuthenticated]);

  const actuallyLoading = !isClerkLoaded || isConvexLoading || (isAuthenticated && convexUser === undefined);

  return {
    user: convexUser,
    clerkUser,
    isLoading: actuallyLoading,
    isAuthenticated: isAuthenticated && !!convexUser,
    isUserSynced: isAuthenticated && convexUser !== null && convexUser !== undefined,
    ...roleInfo,
  };
}
