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

  // Track if we've already attempted initialization
  const hasInitialized = useRef(false);

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

  // Auto-initialize defaults and run data migrations once per session
  // This applies archiving logic, status updates, and creates missing defaults
  useEffect(() => {
    if (convexUser?._id && !hasInitialized.current) {
      hasInitialized.current = true;
      // initializeDefaults now also runs data migrations
      initializeDefaultsMutation({}).catch(() => {
        // Silent failure - user can manually retry via settings
      });
    }
  }, [convexUser?._id, initializeDefaultsMutation]);

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
