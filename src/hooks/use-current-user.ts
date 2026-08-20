"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useCallback, useMemo } from "react";
import { createBackgroundErrorHandler } from "@/lib/error-handling";

/**
 * Bootstrap-boekhouding op module-niveau, bewust niet in een `useRef`.
 *
 * `useCurrentUser` hangt in ~80 componenten. Met een ref per hook-instantie
 * vuurde elke gemounte component zijn eigen `initializeDefaults` af — en bij
 * een fout die niet vanzelf overgaat (JWT wijst naar een organisatie die
 * Convex niet kent) kwam diezelfde storm bij elke remount terug. Eén poging
 * per gebruiker per paginalading is genoeg; daarna stoppen we.
 */
const geinitialiseerdeGebruikers = new Set<string>();
let initialisatieGestaakt = false;

/** Alleen voor tests: zet de module-brede bootstrap-boekhouding terug. */
export function _resetInitialisatieBoekhouding() {
  geinitialiseerdeGebruikers.clear();
  initialisatieGestaakt = false;
}

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

  // Sync Clerk user to Convex on first load
  // The upsert mutation also creates default settings for new users
  // clerkId, e-mail en naam worden server-side uit het Clerk-token gehaald —
  // meesturen vanaf de client zou account-overname mogelijk maken (audit §1).
  useEffect(() => {
    if (isClerkLoaded && clerkUser && convexUser === null) {
      upsertUser({ bedrijfsnaam: undefined });
    }
  }, [isClerkLoaded, clerkUser, convexUser, upsertUser]);

  // Auto-initialize defaults and run data migrations once per session
  // This applies archiving logic, status updates, and creates missing defaults
  useEffect(() => {
    const userId = convexUser?._id;
    if (!userId || initialisatieGestaakt || geinitialiseerdeGebruikers.has(userId)) {
      return;
    }
    geinitialiseerdeGebruikers.add(userId);
    // initializeDefaults now also runs data migrations
    initializeDefaultsMutation({}).catch((fout: unknown) => {
      // Niet opnieuw proberen. Wat hier nog kan falen (geen bekende
      // organisatie, geen rechten, schema-fout) gaat niet vanzelf over; een
      // herhaallus levert alleen dezelfde melding in de console en in Sentry —
      // per gemounte component opnieuw.
      initialisatieGestaakt = true;
      createBackgroundErrorHandler("initializeDefaults", { userId })(fout);
    });
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
