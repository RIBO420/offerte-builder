"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Loader2, Calculator } from "lucide-react";

interface CalculationFeedbackProps {
  isCalculating: boolean;
  affectedScopes?: string[];
  className?: string;
}

/**
 * CalculationFeedback Component
 *
 * Inline indicator showing calculation progress with optional scope details.
 * Uses fade in/out animations for smooth transitions.
 */
export function CalculationFeedback({
  isCalculating,
  affectedScopes,
  className,
}: CalculationFeedbackProps) {
  const [visible, setVisible] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);

  // Handle fade in/out timing
  React.useEffect(() => {
    if (isCalculating) {
      setShouldRender(true);
      // Small delay to ensure mount before fade-in
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      // Wait for fade-out before unmounting
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isCalculating]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={isCalculating}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-md",
        "bg-muted/50 text-muted-foreground text-sm",
        "transition-opacity duration-200 ease-in-out",
        visible ? "opacity-100" : "opacity-0",
        className
      )}
    >
      <Loader2
        className="h-3.5 w-3.5 animate-spin"
        aria-hidden="true"
      />
      <span>Berekenen...</span>
      {affectedScopes && affectedScopes.length > 0 && (
        <span className="text-xs text-muted-foreground/70">
          ({affectedScopes.join(", ")})
        </span>
      )}
      <span className="sr-only">
        Prijzen worden herberekend
        {affectedScopes && affectedScopes.length > 0
          ? ` voor: ${affectedScopes.join(", ")}`
          : ""}
      </span>
    </div>
  );
}

/**
 * Floating calculation indicator for use in toolbars or headers
 */
export function FloatingCalculationIndicator({
  isCalculating,
  affectedScopes,
  className,
}: CalculationFeedbackProps) {
  const [visible, setVisible] = React.useState(false);
  const [shouldRender, setShouldRender] = React.useState(false);

  React.useEffect(() => {
    if (isCalculating) {
      setShouldRender(true);
      const timer = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isCalculating]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={isCalculating}
      className={cn(
        "fixed bottom-4 right-4 z-50",
        "flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg",
        "bg-background border border-border",
        "transition-all duration-200 ease-in-out",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2",
        className
      )}
    >
      <Calculator
        className="h-4 w-4 text-primary"
        aria-hidden="true"
      />
      <Loader2
        className="h-4 w-4 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
      <div className="flex flex-col">
        <span className="text-sm font-medium">Berekenen...</span>
        {affectedScopes && affectedScopes.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {affectedScopes.join(", ")}
          </span>
        )}
      </div>
      <span className="sr-only">
        Prijzen worden herberekend
        {affectedScopes && affectedScopes.length > 0
          ? ` voor: ${affectedScopes.join(", ")}`
          : ""}
      </span>
    </div>
  );
}
