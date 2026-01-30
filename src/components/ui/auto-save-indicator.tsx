"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2, Check, AlertTriangle, Cloud, CloudOff } from "lucide-react";

interface AutoSaveIndicatorProps {
  status: "idle" | "saving" | "saved" | "error";
  lastSaved?: Date;
  onRetry?: () => void;
  className?: string;
}

/**
 * Format relative time in Dutch
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 5) {
    return "zojuist";
  }
  if (diffInSeconds < 60) {
    return `${diffInSeconds} sec geleden`;
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? "1 min geleden" : `${diffInMinutes} min geleden`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1 ? "1 uur geleden" : `${diffInHours} uur geleden`;
  }

  // Format as date for older saves
  return date.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * AutoSaveIndicator Component
 *
 * Small inline indicator for auto-save status, suitable for headers or toolbars.
 * Shows nothing when idle, and transitions smoothly between states.
 */
export function AutoSaveIndicator({
  status,
  lastSaved,
  onRetry,
  className,
}: AutoSaveIndicatorProps) {
  const [displayedTime, setDisplayedTime] = React.useState<string>("");

  // Update relative time every minute
  React.useEffect(() => {
    if (!lastSaved) return;

    const updateTime = () => {
      setDisplayedTime(formatRelativeTime(lastSaved));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, [lastSaved]);

  // Don't render anything when idle
  if (status === "idle") {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-xs transition-all duration-200",
        className
      )}
    >
      {status === "saving" && (
        <>
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
          <span className="text-muted-foreground">Opslaan...</span>
          <span className="sr-only">Wijzigingen worden opgeslagen</span>
        </>
      )}

      {status === "saved" && (
        <>
          <Check
            className="h-3.5 w-3.5 text-green-600 dark:text-green-500"
            aria-hidden="true"
          />
          <span className="text-muted-foreground">
            Opgeslagen
            {displayedTime && (
              <span className="ml-1 text-muted-foreground/70">
                {displayedTime}
              </span>
            )}
          </span>
          <span className="sr-only">
            Wijzigingen opgeslagen{displayedTime ? `, ${displayedTime}` : ""}
          </span>
        </>
      )}

      {status === "error" && (
        <>
          <AlertTriangle
            className="h-3.5 w-3.5 text-destructive"
            aria-hidden="true"
          />
          <span className="text-destructive">Niet opgeslagen</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 underline underline-offset-2 hover:text-destructive focus:text-destructive focus:outline-none"
              aria-label="Probeer opnieuw op te slaan"
            >
              Opnieuw
            </button>
          )}
          <span className="sr-only">
            Wijzigingen konden niet worden opgeslagen
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Cloud-style auto-save indicator with icon states
 */
export function CloudSaveIndicator({
  status,
  lastSaved,
  onRetry,
  className,
}: AutoSaveIndicatorProps) {
  const [displayedTime, setDisplayedTime] = React.useState<string>("");

  React.useEffect(() => {
    if (!lastSaved) return;

    const updateTime = () => {
      setDisplayedTime(formatRelativeTime(lastSaved));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, [lastSaved]);

  if (status === "idle") {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 px-2 py-1 rounded-md",
        "transition-all duration-200",
        status === "error"
          ? "bg-destructive/10 text-destructive"
          : "text-muted-foreground",
        className
      )}
    >
      {status === "saving" && (
        <>
          <div className="relative">
            <Cloud className="h-4 w-4" aria-hidden="true" />
            <Loader2
              className="h-2 w-2 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
          </div>
          <span className="text-xs">Synchroniseren...</span>
          <span className="sr-only">Wijzigingen worden gesynchroniseerd</span>
        </>
      )}

      {status === "saved" && (
        <>
          <div className="relative">
            <Cloud className="h-4 w-4 text-green-600 dark:text-green-500" aria-hidden="true" />
            <Check
              className="h-2 w-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-green-600 dark:text-green-500"
              aria-hidden="true"
            />
          </div>
          <span className="text-xs">
            Gesynchroniseerd
            {displayedTime && (
              <span className="ml-1 opacity-70">{displayedTime}</span>
            )}
          </span>
          <span className="sr-only">
            Wijzigingen gesynchroniseerd{displayedTime ? `, ${displayedTime}` : ""}
          </span>
        </>
      )}

      {status === "error" && (
        <>
          <CloudOff className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs">Synchronisatie mislukt</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="text-xs underline underline-offset-2 hover:no-underline focus:outline-none"
              aria-label="Probeer opnieuw te synchroniseren"
            >
              Opnieuw
            </button>
          )}
          <span className="sr-only">
            Synchronisatie mislukt. Klik om opnieuw te proberen.
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Hook for managing auto-save state
 */
export function useAutoSaveStatus() {
  const [status, setStatus] = React.useState<AutoSaveIndicatorProps["status"]>("idle");
  const [lastSaved, setLastSaved] = React.useState<Date | undefined>();

  const startSaving = React.useCallback(() => {
    setStatus("saving");
  }, []);

  const markSaved = React.useCallback(() => {
    setStatus("saved");
    setLastSaved(new Date());
  }, []);

  const markError = React.useCallback(() => {
    setStatus("error");
  }, []);

  const reset = React.useCallback(() => {
    setStatus("idle");
  }, []);

  return {
    status,
    lastSaved,
    startSaving,
    markSaved,
    markError,
    reset,
  };
}
