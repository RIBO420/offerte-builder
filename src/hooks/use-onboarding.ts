"use client";

import { useMemo, useCallback, useSyncExternalStore } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";
import { useIsAdmin } from "./use-users";

// LocalStorage keys
const ONBOARDING_COMPLETED_KEY = "top-offerte-onboarding-completed";
const WELCOME_SHOWN_KEY = "top-offerte-welcome-shown";
const ONBOARDING_DISMISSED_KEY = "top-offerte-onboarding-dismissed";

export interface OnboardingStep {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href: string;
  adminOnly?: boolean;
}

// Custom store for localStorage that handles SSR
function createLocalStorageStore(key: string) {
  let listeners: Array<() => void> = [];

  const subscribe = (callback: () => void) => {
    listeners.push(callback);

    // Also listen to storage events for cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) {
        callback();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      listeners = listeners.filter(l => l !== callback);
      window.removeEventListener("storage", handleStorage);
    };
  };

  const getSnapshot = () => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(key) === "true";
  };

  const getServerSnapshot = () => false;

  const setValue = (value: boolean) => {
    if (typeof window === "undefined") return;
    if (value) {
      localStorage.setItem(key, "true");
    } else {
      localStorage.removeItem(key);
    }
    // Notify all listeners
    listeners.forEach(listener => listener());
  };

  return { subscribe, getSnapshot, getServerSnapshot, setValue };
}

// Create stores for each localStorage key
const welcomeShownStore = createLocalStorageStore(WELCOME_SHOWN_KEY);
const dismissedStore = createLocalStorageStore(ONBOARDING_DISMISSED_KEY);
const completedStore = createLocalStorageStore(ONBOARDING_COMPLETED_KEY);

/**
 * Hook for managing onboarding state
 * Uses localStorage for persistence and Convex data for completion checks
 */
export function useOnboarding() {
  const { user, clerkUser } = useCurrentUser();
  const isAdmin = useIsAdmin();

  // Use useSyncExternalStore for localStorage to avoid hydration issues
  const welcomeShown = useSyncExternalStore(
    welcomeShownStore.subscribe,
    welcomeShownStore.getSnapshot,
    welcomeShownStore.getServerSnapshot
  );

  const dismissed = useSyncExternalStore(
    dismissedStore.subscribe,
    dismissedStore.getSnapshot,
    dismissedStore.getServerSnapshot
  );

  // Query data needed to check step completion
  const instellingen = useQuery(
    api.instellingen.get,
    user?._id ? {} : "skip"
  );

  const klantenData = useQuery(
    api.klanten.listWithRecent,
    user?._id ? {} : "skip"
  );

  const offertesData = useQuery(
    api.offertes.getDashboardData,
    user?._id ? {} : "skip"
  );

  const medewerkers = useQuery(
    api.medewerkers.list,
    user?._id && isAdmin ? { isActief: true } : "skip"
  );

  // Check if profile is filled (bedrijfsgegevens has naam filled in)
  const isProfileComplete = useMemo(() => {
    if (!instellingen) return false;
    const { bedrijfsgegevens } = instellingen;
    return !!(
      bedrijfsgegevens.naam &&
      bedrijfsgegevens.adres &&
      bedrijfsgegevens.postcode &&
      bedrijfsgegevens.plaats
    );
  }, [instellingen]);

  // Check if at least one klant exists
  const hasKlant = useMemo(() => {
    return klantenData?.klanten && klantenData.klanten.length > 0;
  }, [klantenData]);

  // Check if at least one offerte exists
  const hasOfferte = useMemo(() => {
    return offertesData?.offertes && offertesData.offertes.length > 0;
  }, [offertesData]);

  // Check if user has viewed prijsboek (we check if they've been to the page)
  // For now, we'll just check if there are products (which are seeded by default)
  // A more sophisticated check could track page visits
  const hasPrijsboekViewed = useMemo(() => {
    // Since products are auto-seeded, we'll consider this complete if user exists
    // In a real implementation, you'd track actual page visits
    return !!user;
  }, [user]);

  // Check if medewerker is added (admin only)
  const hasMedewerker = useMemo(() => {
    return medewerkers && medewerkers.length > 0;
  }, [medewerkers]);

  // Define onboarding steps
  const steps: OnboardingStep[] = useMemo(() => {
    const baseSteps: OnboardingStep[] = [
      {
        id: "profile",
        label: "Profiel invullen",
        description: "Vul je bedrijfsgegevens in voor op offertes",
        completed: isProfileComplete,
        href: "/instellingen",
      },
      {
        id: "klant",
        label: "Eerste klant toevoegen",
        description: "Voeg je eerste klant toe aan het systeem",
        completed: !!hasKlant,
        href: "/klanten",
      },
      {
        id: "offerte",
        label: "Eerste offerte maken",
        description: "Maak je eerste offerte aan",
        completed: !!hasOfferte,
        href: "/offertes/nieuw/aanleg",
      },
      {
        id: "prijsboek",
        label: "Prijsboek bekijken",
        description: "Bekijk en pas je prijsboek aan",
        completed: hasPrijsboekViewed,
        href: "/prijsboek",
      },
    ];

    // Add admin-only step
    if (isAdmin) {
      baseSteps.push({
        id: "medewerker",
        label: "Eerste medewerker toevoegen",
        description: "Voeg een medewerker toe voor planning",
        completed: !!hasMedewerker,
        href: "/medewerkers",
        adminOnly: true,
      });
    }

    return baseSteps;
  }, [isProfileComplete, hasKlant, hasOfferte, hasPrijsboekViewed, hasMedewerker, isAdmin]);

  // Calculate completion stats
  const completedSteps = steps.filter((step) => step.completed).length;
  const totalSteps = steps.length;
  const progressPercentage = Math.round((completedSteps / totalSteps) * 100);
  const isComplete = completedSteps === totalSteps;

  // Check if data is still loading
  const isLoading = useMemo(() => {
    if (!user) return false;
    if (instellingen === undefined) return true;
    if (klantenData === undefined) return true;
    if (offertesData === undefined) return true;
    if (isAdmin && medewerkers === undefined) return true;
    return false;
  }, [user, instellingen, klantenData, offertesData, isAdmin, medewerkers]);

  // Actions
  const markWelcomeShown = useCallback(() => {
    welcomeShownStore.setValue(true);
  }, []);

  const dismissOnboarding = useCallback(() => {
    dismissedStore.setValue(true);
  }, []);

  const resetOnboarding = useCallback(() => {
    welcomeShownStore.setValue(false);
    dismissedStore.setValue(false);
    completedStore.setValue(false);
  }, []);

  // Determine if we should show onboarding components
  // Only show after hydration (check window is available)
  const isClient = typeof window !== "undefined";
  const shouldShowWelcome = isClient && !welcomeShown && !!user;
  const shouldShowChecklist = isClient && !dismissed && !isComplete && !!user;

  return {
    // State
    steps,
    completedSteps,
    totalSteps,
    progressPercentage,
    isComplete,
    isLoading,

    // Visibility
    shouldShowWelcome,
    shouldShowChecklist,

    // Actions
    markWelcomeShown,
    dismissOnboarding,
    resetOnboarding,

    // User info for welcome message
    userName: clerkUser?.firstName || user?.name?.split(" ")[0] || "Gebruiker",
  };
}
