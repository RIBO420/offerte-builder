"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useCallback } from "react";

export function useCurrentUser() {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();

  // Query uses auth context - no args needed, just skip if not logged in
  const convexUser = useQuery(
    api.users.current,
    clerkUser?.id ? {} : "skip"
  );

  // Check if user has normuren (to detect missing defaults)
  const normuren = useQuery(
    api.normuren.list,
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

  // Manual initialization function
  const initializeDefaults = useCallback(async () => {
    if (!convexUser?._id) {
      throw new Error("User not found");
    }
    return initializeDefaultsMutation({});
  }, [convexUser?._id, initializeDefaultsMutation]);

  return {
    user: convexUser,
    clerkUser,
    isLoading: !isClerkLoaded || (clerkUser && convexUser === undefined),
    isAuthenticated: !!clerkUser,
    initializeDefaults,
    hasMissingDefaults: normuren !== undefined && normuren.length === 0,
  };
}
