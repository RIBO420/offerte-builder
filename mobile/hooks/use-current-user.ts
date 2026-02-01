/**
 * Hook to sync Clerk user to Convex database
 * Creates user in Convex if they don't exist yet
 */

import { useUser } from "@clerk/clerk-expo";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useRef } from "react";

export function useCurrentUser() {
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

  return {
    user: convexUser,
    clerkUser,
    isLoading: !isClerkLoaded || isConvexLoading || (isAuthenticated && convexUser === undefined),
    isAuthenticated: isAuthenticated && !!convexUser,
    isUserSynced: convexUser !== null && convexUser !== undefined,
  };
}
