"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";

export function useCurrentUser() {
  const { user: clerkUser, isLoaded: isClerkLoaded } = useUser();

  const convexUser = useQuery(
    api.users.current,
    clerkUser?.id ? { clerkId: clerkUser.id } : "skip"
  );

  const upsertUser = useMutation(api.users.upsert);
  const createDefaultSettings = useMutation(api.instellingen.createDefaults);
  const createDefaultNormuren = useMutation(api.normuren.createDefaults);
  const createDefaultProducts = useMutation(api.producten.createDefaults);

  // Sync Clerk user to Convex on first load
  useEffect(() => {
    if (isClerkLoaded && clerkUser && convexUser === null) {
      const syncUser = async () => {
        const userId = await upsertUser({
          clerkId: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || "",
          name: clerkUser.fullName || clerkUser.firstName || "Gebruiker",
          bedrijfsnaam: undefined,
        });

        // Create default settings, normuren, and products for new user
        await createDefaultSettings({ userId });
        await createDefaultNormuren({ userId });
        await createDefaultProducts({ userId });
      };

      syncUser();
    }
  }, [isClerkLoaded, clerkUser, convexUser, upsertUser, createDefaultSettings, createDefaultNormuren, createDefaultProducts]);

  return {
    user: convexUser,
    clerkUser,
    isLoading: !isClerkLoaded || (clerkUser && convexUser === undefined),
    isAuthenticated: !!clerkUser,
  };
}
