"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  debounceMs?: number; // default 2000
  enabled?: boolean;
}

interface UseAutoSaveResult {
  isSaving: boolean;
  isDirty: boolean;
  lastSaved: Date | null;
  saveNow: () => Promise<void>;
  error: Error | null;
}

/**
 * Hook for auto-saving data with debounce
 *
 * Features:
 * - Debounced auto-save after specified inactivity period
 * - Tracks unsaved changes (isDirty)
 * - Tracks last save timestamp
 * - Manual save function for immediate save
 * - Cleanup on unmount
 */
export function useAutoSave<T>({
  data,
  onSave,
  debounceMs = 2000,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveResult {
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Refs for tracking state across renders
  const lastSavedDataRef = useRef<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isInitializedRef = useRef(false);

  // Serialize data for comparison
  const serializedData = JSON.stringify(data);

  // Check if data has changed
  useEffect(() => {
    // Skip first render - we don't want to mark as dirty on initial load
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      lastSavedDataRef.current = serializedData;
      return;
    }

    // Compare with last saved data
    if (lastSavedDataRef.current !== serializedData) {
      setIsDirty(true);
      setError(null);
    }
  }, [serializedData]);

  // Perform the save operation
  const performSave = useCallback(async () => {
    if (!isMountedRef.current || !enabled) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(data);

      if (isMountedRef.current) {
        lastSavedDataRef.current = JSON.stringify(data);
        setLastSaved(new Date());
        setIsDirty(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error("Save failed"));
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false);
      }
    }
  }, [data, onSave, enabled]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!enabled || !isDirty) return;

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout
    debounceTimeoutRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    // Cleanup
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [isDirty, debounceMs, enabled, performSave]);

  // Manual save function
  const saveNow = useCallback(async () => {
    // Clear any pending debounced save
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    await performSave();
  }, [performSave]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    isSaving,
    isDirty,
    lastSaved,
    saveNow,
    error,
  };
}
