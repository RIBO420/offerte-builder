"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useCallback, useMemo } from "react";

export function useCurrentUser() {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();

  // Query uses auth context - no args needed, just skip if not logged in
  const convexUser = useQuery(
    api.users.current,
    clerkUser?.id ? {} : "skip"
  );

  // Check if user has normuren (to detect missing defaults)
  // IMPORTANT: Must wait for convexUser to exist before running this query
  // Otherwise new sign-ups get AuthError because the user document hasn't been created yet
  const normuren = useQuery(
    api.normuren.list,
    // Only run when the Convex user exists - prevents race condition on new sign-ups
    convexUser?._id ? {} : "skip"
  );

  const upsertUser = useMutation(api.users.upsert);
  const initializeDefaultsMutation = useMutation(api.users.initializeDefaults);
  const runDataMigrationsMutation = useMutation(api.users.runDataMigrations);

  // Track if we've already attempted initialization and migration
  const hasInitialized = useRef(false);
  const hasMigrated = useRef(false);

  // Sync Clerk user to Convex on first load
  // The upsert mutation also creates default settings for new users
  useEffect(() => {
    if (isClerkLoaded && clerkUser && convexUser === null) {
      upsertUser({
        clerkId: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || "",
        name: clerkUser.fullName || clerkUser.firstName || "Gebruiker",
        bedrijfsnaam: undefined,
      });
    }
  }, [isClerkLoaded, clerkUser, convexUser, upsertUser]);

  // Auto-initialize defaults for existing users missing data
  useEffect(() => {
    // Only run once per session, when we have a user but they have no normuren
    if (
      convexUser?._id &&
      normuren !== undefined &&
      normuren.length === 0 &&
      !hasInitialized.current
    ) {
      hasInitialized.current = true;
      initializeDefaultsMutation({}).catch(() => {
        // Silent failure - user can manually retry via settings
      });
    }
  }, [convexUser?._id, normuren, initializeDefaultsMutation]);

  // Auto-run data migrations once per session
  // This applies archiving logic and status updates to existing data
  useEffect(() => {
    if (convexUser?._id && !hasMigrated.current) {
      hasMigrated.current = true;
      runDataMigrationsMutation({}).catch(() => {
        // Silent failure - migrations are non-critical
      });
    }
  }, [convexUser?._id, runDataMigrationsMutation]);

  // Manual initialization function - memoized
  const initializeDefaults = useCallback(async () => {
    if (!convexUser?._id) {
      throw new Error("User not found");
    }
    return initializeDefaultsMutation({});
  }, [convexUser?._id, initializeDefaultsMutation]);

  // Memoize the return object to prevent unnecessary re-renders
  const hasMissingDefaults = useMemo(
    () => normuren !== undefined && normuren.length === 0,
    [normuren]
  );

  return {
    user: convexUser,
    clerkUser,
    isLoading: !isClerkLoaded || (clerkUser && convexUser === undefined),
    isAuthenticated: !!clerkUser,
    initializeDefaults,
    hasMissingDefaults,
  };
}
