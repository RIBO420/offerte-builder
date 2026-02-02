"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  XCircle,
  Info,
  WifiOff,
  RefreshCw,
  Home,
} from "lucide-react";

interface ErrorAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive";
}

interface ErrorRecoveryProps {
  error: Error | string;
  type: "retryable" | "fatal" | "validation" | "network";
  title?: string;
  actions?: ErrorAction[];
  onRetry?: () => void;
  className?: string;
}

const errorConfig = {
  retryable: {
    icon: AlertTriangle,
    defaultTitle: "Er ging iets mis",
    variant: "default" as const,
    iconClass: "text-amber-600 dark:text-amber-500",
    containerClass: "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20",
  },
  fatal: {
    icon: XCircle,
    defaultTitle: "Kritieke fout",
    variant: "destructive" as const,
    iconClass: "text-destructive",
    containerClass: "border-destructive/50 bg-destructive/10",
  },
  validation: {
    icon: Info,
    defaultTitle: "Validatiefout",
    variant: "default" as const,
    iconClass: "text-blue-600 dark:text-blue-500",
    containerClass: "border-blue-500/50 bg-blue-50 dark:bg-blue-950/20",
  },
  network: {
    icon: WifiOff,
    defaultTitle: "Netwerkfout",
    variant: "default" as const,
    iconClass: "text-amber-600 dark:text-amber-500",
    containerClass: "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20",
  },
};

function getDefaultActions(
  type: ErrorRecoveryProps["type"],
  onRetry?: () => void
): ErrorAction[] {
  switch (type) {
    case "retryable":
      return onRetry
        ? [{ label: "Probeer opnieuw", onClick: onRetry, variant: "default" }]
        : [];
    case "fatal":
      return [
        {
          label: "Terug naar dashboard",
          onClick: () => (window.location.href = "/"),
          variant: "default",
        },
      ];
    case "network":
      return onRetry
        ? [
            {
              label: "Opnieuw verbinden",
              onClick: onRetry,
              variant: "default",
            },
          ]
        : [];
    case "validation":
      return [];
    default:
      return [];
  }
}

/**
 * ErrorRecovery Component
 *
 * Displays error messages with appropriate styling and recovery actions
 * based on the error type.
 *
 * Types:
 * - retryable: Warning style with retry button
 * - fatal: Error style with dashboard redirect
 * - validation: Info style for form validation errors
 * - network: Warning with reconnect option and offline indicator
 */
export function ErrorRecovery({
  error,
  type,
  title,
  actions,
  onRetry,
  className,
}: ErrorRecoveryProps) {
  const config = errorConfig[type];
  const Icon = config.icon;
  const errorMessage = error instanceof Error ? error.message : error;
  const displayTitle = title ?? config.defaultTitle;
  const displayActions = actions ?? getDefaultActions(type, onRetry);

  return (
    <Alert
      role="alert"
      aria-live="assertive"
      className={cn(config.containerClass, className)}
    >
      <Icon
        className={cn("h-5 w-5", config.iconClass)}
        aria-hidden="true"
      />
      <AlertTitle className="font-semibold">{displayTitle}</AlertTitle>
      <AlertDescription className="mt-1">
        <p className="text-sm text-foreground/80">{errorMessage}</p>

        {type === "network" && (
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse"
              aria-hidden="true"
            />
            <span>Geen internetverbinding</span>
          </div>
        )}

        {displayActions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {displayActions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant ?? "default"}
                size="sm"
                onClick={action.onClick}
              >
                {type === "retryable" && action.label === "Probeer opnieuw" && (
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {type === "network" && action.label === "Opnieuw verbinden" && (
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {type === "fatal" && action.label === "Terug naar dashboard" && (
                  <Home className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

interface InlineErrorProps {
  message: string;
  className?: string;
}

/**
 * Compact inline error display for form fields or small spaces
 */
export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <p
      role="alert"
      aria-live="polite"
      className={cn(
        "text-sm text-destructive flex items-center gap-1.5",
        className
      )}
    >
      <XCircle className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export type { ErrorRecoveryProps, ErrorAction, InlineErrorProps };
