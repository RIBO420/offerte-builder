"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2, Check, Circle } from "lucide-react";

interface SaveIndicatorProps {
  isSaving: boolean;
  isDirty: boolean;
  lastSaved: Date | null;
  className?: string;
}

/**
 * Format time as HH:mm
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * SaveIndicator Component
 *
 * Shows save status:
 * - "Opslaan..." with spinner when isSaving
 * - "Niet-opgeslagen wijzigingen" with orange dot when isDirty
 * - "Opgeslagen om HH:mm" with green checkmark when everything is saved
 */
export function SaveIndicator({
  isSaving,
  isDirty,
  lastSaved,
  className,
}: SaveIndicatorProps) {
  // Saving state
  if (isSaving) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <Loader2
          className="h-3.5 w-3.5 animate-spin"
          aria-hidden="true"
        />
        <span>Opslaan...</span>
        <span className="sr-only">Wijzigingen worden opgeslagen</span>
      </div>
    );
  }

  // Dirty state (unsaved changes)
  if (isDirty) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-500",
          className
        )}
      >
        <Circle
          className="h-2 w-2 fill-current"
          aria-hidden="true"
        />
        <span>Niet-opgeslagen wijzigingen</span>
        <span className="sr-only">Er zijn niet-opgeslagen wijzigingen</span>
      </div>
    );
  }

  // Saved state
  if (lastSaved) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <Check
          className="h-3.5 w-3.5 text-green-600 dark:text-green-500"
          aria-hidden="true"
        />
        <span>
          Opgeslagen om{" "}
          <span className="font-medium">{formatTime(lastSaved)}</span>
        </span>
        <span className="sr-only">
          Opgeslagen om {formatTime(lastSaved)}
        </span>
      </div>
    );
  }

  // No state to show (nothing saved yet, not dirty, not saving)
  return null;
}

/**
 * Compact SaveIndicator for tight spaces
 * Shows only icons with tooltips
 */
export function CompactSaveIndicator({
  isSaving,
  isDirty,
  lastSaved,
  className,
}: SaveIndicatorProps) {
  const getTitle = () => {
    if (isSaving) return "Opslaan...";
    if (isDirty) return "Niet-opgeslagen wijzigingen";
    if (lastSaved) return `Opgeslagen om ${formatTime(lastSaved)}`;
    return "";
  };

  // No state to show
  if (!isSaving && !isDirty && !lastSaved) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      title={getTitle()}
      className={cn(
        "inline-flex items-center justify-center",
        className
      )}
    >
      {isSaving && (
        <Loader2
          className="h-4 w-4 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
      )}
      {!isSaving && isDirty && (
        <Circle
          className="h-2.5 w-2.5 fill-orange-500 text-orange-500"
          aria-hidden="true"
        />
      )}
      {!isSaving && !isDirty && lastSaved && (
        <Check
          className="h-4 w-4 text-green-600 dark:text-green-500"
          aria-hidden="true"
        />
      )}
      <span className="sr-only">{getTitle()}</span>
    </div>
  );
}
