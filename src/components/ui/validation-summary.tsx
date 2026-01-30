"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationSummaryProps {
  errors: ValidationError[];
  onFieldClick?: (field: string) => void;
  className?: string;
}

const COLLAPSE_THRESHOLD = 5;

/**
 * ValidationSummary Component
 *
 * Displays a summary of validation errors with clickable links to scroll
 * to the relevant fields. Automatically collapses when there are more
 * than 5 errors.
 */
export function ValidationSummary({
  errors,
  onFieldClick,
  className,
}: ValidationSummaryProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  if (errors.length === 0) {
    return null;
  }

  const shouldCollapse = errors.length > COLLAPSE_THRESHOLD;
  const visibleErrors = shouldCollapse && !isExpanded
    ? errors.slice(0, COLLAPSE_THRESHOLD)
    : errors;
  const hiddenCount = errors.length - COLLAPSE_THRESHOLD;

  const handleFieldClick = (field: string) => {
    if (onFieldClick) {
      onFieldClick(field);
    } else {
      // Default behavior: try to scroll to element with matching id or name
      const element =
        document.getElementById(field) ||
        document.querySelector(`[name="${field}"]`) ||
        document.querySelector(`[data-field="${field}"]`);

      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        if (element instanceof HTMLElement) {
          element.focus();
        }
      }
    }
  };

  const errorContent = (
    <ul className="space-y-1.5" role="list">
      {visibleErrors.map((error, index) => (
        <li key={`${error.field}-${index}`} className="flex items-start gap-2">
          <AlertCircle
            className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-destructive"
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => handleFieldClick(error.field)}
            className={cn(
              "text-left text-sm underline-offset-2",
              "hover:underline focus:underline focus:outline-none",
              "text-destructive/90 hover:text-destructive focus:text-destructive"
            )}
            aria-label={`Ga naar veld: ${error.field}`}
          >
            <span className="font-medium">{error.field}:</span>{" "}
            <span>{error.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <Alert
      variant="destructive"
      role="alert"
      aria-live="polite"
      className={cn(
        "border-destructive/50 bg-destructive/10",
        className
      )}
    >
      <AlertCircle className="h-5 w-5" aria-hidden="true" />
      <AlertTitle className="font-semibold">
        {errors.length === 1
          ? "Er is 1 fout gevonden"
          : `Er zijn ${errors.length} fouten gevonden`}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {shouldCollapse ? (
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            {errorContent}

            {!isExpanded && hiddenCount > 0 && (
              <p className="mt-2 text-xs text-destructive/70">
                en {hiddenCount} andere {hiddenCount === 1 ? "fout" : "fouten"}...
              </p>
            )}

            <CollapsibleContent className="mt-2">
              {/* Additional errors shown when expanded */}
              {isExpanded && (
                <ul className="space-y-1.5 mt-2 pt-2 border-t border-destructive/20" role="list">
                  {errors.slice(COLLAPSE_THRESHOLD).map((error, index) => (
                    <li
                      key={`${error.field}-extra-${index}`}
                      className="flex items-start gap-2"
                    >
                      <AlertCircle
                        className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-destructive"
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        onClick={() => handleFieldClick(error.field)}
                        className={cn(
                          "text-left text-sm underline-offset-2",
                          "hover:underline focus:underline focus:outline-none",
                          "text-destructive/90 hover:text-destructive focus:text-destructive"
                        )}
                        aria-label={`Ga naar veld: ${error.field}`}
                      >
                        <span className="font-medium">{error.field}:</span>{" "}
                        <span>{error.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CollapsibleContent>

            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" aria-hidden="true" />
                    Minder tonen
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" aria-hidden="true" />
                    Alle fouten tonen
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        ) : (
          errorContent
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Hook to scroll and focus a field by name
 */
export function useFieldFocus() {
  const focusField = React.useCallback((field: string) => {
    const element =
      document.getElementById(field) ||
      document.querySelector(`[name="${field}"]`) ||
      document.querySelector(`[data-field="${field}"]`);

    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      if (element instanceof HTMLElement) {
        // Small delay to ensure scroll completes before focus
        setTimeout(() => element.focus(), 100);
      }
    }
  }, []);

  return { focusField };
}
