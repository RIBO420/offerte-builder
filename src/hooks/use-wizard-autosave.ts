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

export function useWizardAutosave<T>({
  key,
  type,
  initialData,
  initialStep = 0,
  expirationHours = DRAFT_EXPIRATION_HOURS,
}: UseWizardAutosaveOptions<T>): UseWizardAutosaveReturn<T> {
  const storageKey = `offerte-wizard-${key}`;

  const [data, setDataState] = useState<T>(initialData);
  const [step, setStepState] = useState(initialStep);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftAge, setDraftAge] = useState<string | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Check for existing draft on mount
  useEffect(() => {
    if (initialized) return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const draft: WizardDraft<T> = JSON.parse(stored);

        // Check if draft is for the same type and not expired
        if (draft.type === type && !isExpired(draft.timestamp, expirationHours)) {
          setHasDraft(true);
          setDraftAge(formatDraftAge(draft.timestamp));
          setShowRestoreDialog(true);
        } else {
          // Remove expired or wrong-type draft
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.error("Error reading draft from localStorage:", error);
      localStorage.removeItem(storageKey);
    }

    setInitialized(true);
  }, [storageKey, type, expirationHours, initialized]);

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
    } catch (error) {
      console.error("Error saving draft to localStorage:", error);
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
    } catch (error) {
      console.error("Error restoring draft:", error);
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
