"use client";

import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ValidationError {
  field: string;
  message: string;
}

interface ScopeValidation {
  scopeId: string;
  scopeName: string;
  isValid: boolean;
  errors: ValidationError[];
  icon?: React.ComponentType<{ className?: string }>;
}

interface ValidationSummaryProps {
  validations: ScopeValidation[];
  className?: string;
}

export function ValidationSummary({ validations, className }: ValidationSummaryProps) {
  const [expandedScopes, setExpandedScopes] = useState<Set<string>>(new Set());

  const toggleScope = (scopeId: string) => {
    setExpandedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scopeId)) {
        next.delete(scopeId);
      } else {
        next.add(scopeId);
      }
      return next;
    });
  };

  const totalErrors = validations.reduce((sum, v) => sum + v.errors.length, 0);
  const validCount = validations.filter((v) => v.isValid).length;

  if (validations.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Summary header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Validatie status</span>
        <span className={cn(
          "font-medium",
          totalErrors > 0 ? "text-orange-600" : "text-green-600"
        )}>
          {validCount}/{validations.length} compleet
        </span>
      </div>

      {/* Scope list */}
      <div className="space-y-1">
        {validations.map((validation) => {
          const isExpanded = expandedScopes.has(validation.scopeId);
          const hasErrors = validation.errors.length > 0;
          const Icon = validation.icon;

          return (
            <div key={validation.scopeId} className="rounded-lg border bg-card">
              <button
                type="button"
                onClick={() => hasErrors && toggleScope(validation.scopeId)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left",
                  hasErrors && "cursor-pointer hover:bg-muted/50"
                )}
                disabled={!hasErrors}
              >
                <div className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm font-medium">{validation.scopeName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {validation.isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <>
                      <span className="text-xs text-orange-600">
                        {validation.errors.length} fout{validation.errors.length !== 1 ? "en" : ""}
                      </span>
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      {hasErrors && (
                        isExpanded ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )
                      )}
                    </>
                  )}
                </div>
              </button>

              {/* Error details */}
              {isExpanded && hasErrors && (
                <div className="border-t px-3 py-2 bg-orange-50/50">
                  <ul className="space-y-1">
                    {validation.errors.map((error, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-orange-700">
                        <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-orange-500" />
                        <span>
                          <span className="font-medium">{formatFieldName(error.field)}:</span>{" "}
                          {error.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Overall status message */}
      {totalErrors > 0 && (
        <p className="text-xs text-muted-foreground">
          Vul alle verplichte velden in om door te gaan
        </p>
      )}
    </div>
  );
}

// Helper to format field names for display
function formatFieldName(field: string): string {
  // Convert camelCase to readable format
  const formatted = field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  // Common translations
  const translations: Record<string, string> = {
    "Oppervlakte": "Oppervlakte",
    "Dikte Onderlaag": "Dikte onderlaag",
    "Type Bestrating": "Type bestrating",
    "Type Houtwerk": "Type houtwerk",
    "Aantal Punten": "Aantal punten",
    "Sleuven Nodig": "Sleuven nodig",
    "Afmeting": "Afmeting",
    "Beplantingsintensiteit": "Beplantingsintensiteit",
    "Ondergrond": "Ondergrond",
    "Fundering": "Fundering",
    "Items": "Items",
    "Lengte": "Lengte",
    "Hoogte": "Hoogte",
    "Breedte": "Breedte",
    "Aantal Bomen": "Aantal bomen",
    "Border Oppervlakte": "Border oppervlakte",
    "Gras Oppervlakte": "Gras oppervlakte",
    "Terras Oppervlakte": "Terras oppervlakte",
    "Bestrating Oppervlakte": "Bestrating oppervlakte",
  };

  return translations[formatted] || formatted;
}

// Export types for use in wizard pages
export type { ValidationError, ScopeValidation };
