"use client";

import { useState, useEffect, useCallback } from "react";

interface WizardDraft<T> {
  data: T;
  step: number;
  timestamp: number;
  type: "aanleg" | "onderhoud";
}

interface UseWizardAutosaveOptions<T> {
  key: string;
  type: "aanleg" | "onderhoud";
  initialData: T;
  initialStep?: number;
  expirationHours?: number;
}

interface UseWizardAutosaveReturn<T> {
  data: T;
  step: number;
  setData: (data: T | ((prev: T) => T)) => void;
  setStep: (step: number) => void;
  hasDraft: boolean;
  draftAge: string | null;
  restoreDraft: () => void;
  discardDraft: () => void;
  clearDraft: () => void;
  showRestoreDialog: boolean;
  setShowRestoreDialog: (show: boolean) => void;
}

const DRAFT_EXPIRATION_HOURS = 24;

function formatDraftAge(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} minuten geleden`;
  if (hours < 24) return `${hours} uur geleden`;
  return `${days} dagen geleden`;
}

function isExpired(timestamp: number, expirationHours: number): boolean {
  const now = Date.now();
  const expirationMs = expirationHours * 60 * 60 * 1000;
  return now - timestamp > expirationMs;
}

// Helper to check for valid draft during initialization
function checkForDraft<T>(
  storageKey: string,
  type: "aanleg" | "onderhoud",
  expirationHours: number
): { hasDraft: boolean; draftAge: string | null } {
  if (typeof window === "undefined") {
    return { hasDraft: false, draftAge: null };
  }

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const draft: WizardDraft<T> = JSON.parse(stored);
      if (draft.type === type && !isExpired(draft.timestamp, expirationHours)) {
        return {
          hasDraft: true,
          draftAge: formatDraftAge(draft.timestamp),
        };
      } else {
        // Remove expired or wrong-type draft
        localStorage.removeItem(storageKey);
      }
    }
  } catch {
    // Failed to parse draft, remove corrupted data
    localStorage.removeItem(storageKey);
  }

  return { hasDraft: false, draftAge: null };
}

export function useWizardAutosave<T>({
  key,
  type,
  initialData,
  initialStep = 0,
  expirationHours = DRAFT_EXPIRATION_HOURS,
}: UseWizardAutosaveOptions<T>): UseWizardAutosaveReturn<T> {
  const storageKey = `offerte-wizard-${key}`;

  // Use lazy initialization to check for draft on mount
  const [draftState] = useState(() =>
    checkForDraft<T>(storageKey, type, expirationHours)
  );

  const [data, setDataState] = useState<T>(initialData);
  const [step, setStepState] = useState(initialStep);
  const [hasDraft, setHasDraft] = useState(draftState.hasDraft);
  const [draftAge, setDraftAge] = useState<string | null>(draftState.draftAge);
  const [showRestoreDialog, setShowRestoreDialog] = useState(draftState.hasDraft);
  const [initialized] = useState(true);

  // Save to localStorage when data or step changes
  useEffect(() => {
    if (!initialized) return;

    // Don't save if we're showing the restore dialog (user hasn't decided yet)
    if (showRestoreDialog) return;

    // Don't save on initial step with initial data
    if (step === initialStep && JSON.stringify(data) === JSON.stringify(initialData)) {
      return;
    }

    try {
      const draft: WizardDraft<T> = {
        data,
        step,
        timestamp: Date.now(),
        type,
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
    } catch {
      // Silent failure - localStorage might be full or disabled
    }
  }, [data, step, storageKey, type, initialized, showRestoreDialog, initialData, initialStep]);

  const setData = useCallback((newData: T | ((prev: T) => T)) => {
    if (typeof newData === "function") {
      setDataState((prev) => (newData as (prev: T) => T)(prev));
    } else {
      setDataState(newData);
    }
  }, []);

  const setStep = useCallback((newStep: number) => {
    setStepState(newStep);
  }, []);

  const restoreDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: WizardDraft<T> = JSON.parse(stored);
        setDataState(draft.data);
        setStepState(draft.step);
      }
    } catch {
      // Silent failure - draft data corrupted
    }
    setShowRestoreDialog(false);
    setHasDraft(false);
  }, [storageKey]);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setShowRestoreDialog(false);
    setHasDraft(false);
    setDraftAge(null);
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
    setHasDraft(false);
    setDraftAge(null);
  }, [storageKey]);

  return {
    data,
    step,
    setData,
    setStep,
    hasDraft,
    draftAge,
    restoreDraft,
    discardDraft,
    clearDraft,
    showRestoreDialog,
    setShowRestoreDialog,
  };
}
