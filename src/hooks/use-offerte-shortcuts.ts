"use client";

import { useMemo } from "react";
import { useKeyboardShortcuts, type Shortcut } from "./use-keyboard-shortcuts";

interface OfferteEditorShortcuts {
  onSave?: () => void;
  onCancel?: () => void;
  onAddRegel?: () => void;
  onRecalculate?: () => void;
  onPreview?: () => void;
}

/**
 * Hook for registering keyboard shortcuts in the offerte editor
 * Provides Cmd+S for save, Cmd+N for add, Cmd+R for recalculate, etc.
 */
export function useOfferteEditorShortcuts({
  onSave,
  onCancel,
  onAddRegel,
  onRecalculate,
  onPreview,
}: OfferteEditorShortcuts) {
  const shortcuts = useMemo(() => {
    const result: Shortcut[] = [];

    if (onSave) {
      result.push({
        key: "s",
        meta: true,
        description: "Offerte opslaan",
        action: onSave,
      });
    }

    if (onCancel) {
      result.push({
        key: "Escape",
        description: "Annuleren",
        action: onCancel,
      });
    }

    if (onAddRegel) {
      result.push({
        key: "n",
        meta: true,
        description: "Nieuwe regel toevoegen",
        action: onAddRegel,
      });
    }

    if (onRecalculate) {
      result.push({
        key: "r",
        meta: true,
        shift: true,
        description: "Regels herberekenen",
        action: onRecalculate,
      });
    }

    if (onPreview) {
      result.push({
        key: "p",
        meta: true,
        description: "Preview openen",
        action: onPreview,
      });
    }

    return result;
  }, [onSave, onCancel, onAddRegel, onRecalculate, onPreview]);

  useKeyboardShortcuts(shortcuts);
}

interface WizardShortcuts {
  onNext?: () => void;
  onPrevious?: () => void;
  onSave?: () => void;
  scopeToggles?: Record<number, () => void>; // Number key -> toggle action
}

/**
 * Hook for keyboard shortcuts in the offerte wizard
 * Provides number keys for scope toggles, arrow keys for navigation
 */
export function useWizardShortcuts({
  onNext,
  onPrevious,
  onSave,
  scopeToggles,
}: WizardShortcuts) {
  const shortcuts = useMemo(() => {
    const result: Shortcut[] = [];

    // Arrow keys for navigation (only when not in input)
    if (onNext) {
      result.push({
        key: "ArrowRight",
        meta: true,
        description: "Volgende stap",
        action: onNext,
      });
    }

    if (onPrevious) {
      result.push({
        key: "ArrowLeft",
        meta: true,
        description: "Vorige stap",
        action: onPrevious,
      });
    }

    // Cmd+S to save
    if (onSave) {
      result.push({
        key: "s",
        meta: true,
        description: "Offerte opslaan",
        action: onSave,
      });
    }

    // Number keys for scope toggles (1-7)
    if (scopeToggles) {
      for (const [num, action] of Object.entries(scopeToggles)) {
        result.push({
          key: num,
          description: `Toggle scope ${num}`,
          action,
        });
      }
    }

    return result;
  }, [onNext, onPrevious, onSave, scopeToggles]);

  useKeyboardShortcuts(shortcuts);
}

/**
 * Hook for keyboard shortcuts in the offerte list/overview
 */
export function useOfferteListShortcuts({
  onNewAanleg,
  onNewOnderhoud,
  onSearch,
}: {
  onNewAanleg?: () => void;
  onNewOnderhoud?: () => void;
  onSearch?: () => void;
}) {
  const shortcuts = useMemo(() => {
    const result: Shortcut[] = [];

    if (onNewAanleg) {
      result.push({
        key: "a",
        meta: true,
        description: "Nieuwe aanleg offerte",
        action: onNewAanleg,
      });
    }

    if (onNewOnderhoud) {
      result.push({
        key: "o",
        meta: true,
        description: "Nieuwe onderhoud offerte",
        action: onNewOnderhoud,
      });
    }

    if (onSearch) {
      result.push({
        key: "k",
        meta: true,
        description: "Zoeken",
        action: onSearch,
      });
    }

    return result;
  }, [onNewAanleg, onNewOnderhoud, onSearch]);

  useKeyboardShortcuts(shortcuts);
}
