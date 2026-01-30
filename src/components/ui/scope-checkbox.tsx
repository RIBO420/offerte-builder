"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Mountain,
  LayoutGrid,
  Trees,
  Leaf,
  Hammer,
  Droplets,
  Sparkles,
  Check,
  type LucideIcon,
} from "lucide-react";

const scopeTypes = [
  "grondwerk",
  "bestrating",
  "borders",
  "gras",
  "houtwerk",
  "water",
  "specials",
] as const;

export type ScopeType = (typeof scopeTypes)[number];

const scopeIcons: Record<ScopeType, LucideIcon> = {
  grondwerk: Mountain,
  bestrating: LayoutGrid,
  borders: Trees,
  gras: Leaf,
  houtwerk: Hammer,
  water: Droplets,
  specials: Sparkles,
};

const scopeLabels: Record<ScopeType, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water: "Water",
  specials: "Specials",
};

const scopeDescriptions: Record<ScopeType, string> = {
  grondwerk: "Graven, egaliseren en grondverzet",
  bestrating: "Tegels, klinkers en verharding",
  borders: "Planten, struiken en borders",
  gras: "Gazon, graszoden en onderhoud",
  houtwerk: "Schuttingen, pergola's en decks",
  water: "Vijvers, fonteinen en drainage",
  specials: "Verlichting, bewatering en extra's",
};

// Background color classes for checked state
const scopeCheckedStyles: Record<ScopeType, string> = {
  grondwerk: "bg-scope-grondwerk text-white",
  bestrating: "bg-scope-bestrating text-white",
  borders: "bg-scope-borders text-white",
  gras: "bg-scope-gras text-white",
  houtwerk: "bg-scope-houtwerk text-white",
  water: "bg-scope-water text-white",
  specials: "bg-scope-specials text-white",
};

// Border color classes for focus/hover
const scopeBorderStyles: Record<ScopeType, string> = {
  grondwerk: "focus-visible:ring-scope-grondwerk/50 hover:border-scope-grondwerk/50",
  bestrating: "focus-visible:ring-scope-bestrating/50 hover:border-scope-bestrating/50",
  borders: "focus-visible:ring-scope-borders/50 hover:border-scope-borders/50",
  gras: "focus-visible:ring-scope-gras/50 hover:border-scope-gras/50",
  houtwerk: "focus-visible:ring-scope-houtwerk/50 hover:border-scope-houtwerk/50",
  water: "focus-visible:ring-scope-water/50 hover:border-scope-water/50",
  specials: "focus-visible:ring-scope-specials/50 hover:border-scope-specials/50",
};

interface ScopeCheckboxProps {
  scope: ScopeType;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

function ScopeCheckbox({
  scope,
  checked,
  onCheckedChange,
  label,
  description,
  disabled = false,
  className,
}: ScopeCheckboxProps) {
  const [animating, setAnimating] = React.useState<"check" | "uncheck" | null>(null);
  const Icon = scopeIcons[scope];
  const displayLabel = label ?? scopeLabels[scope];
  const displayDescription = description ?? scopeDescriptions[scope];

  const handleClick = () => {
    if (disabled) return;

    // Trigger animation
    setAnimating(checked ? "uncheck" : "check");
    onCheckedChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleClick();
    }
  };

  const handleAnimationEnd = () => {
    setAnimating(null);
  };

  return (
    <label
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg p-2 -m-2 transition-colors",
        "hover:bg-muted/50",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {/* Touch target wrapper - 44px minimum */}
      <span className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center shrink-0">
        {/* Checkbox box - 32x32 */}
        <span
          role="checkbox"
          aria-checked={checked}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          onAnimationEnd={handleAnimationEnd}
          className={cn(
            // Base styles
            "relative inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-all duration-200",
            "outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
            // Unchecked state
            !checked && [
              "border-input bg-background",
              scopeBorderStyles[scope],
            ],
            // Checked state
            checked && [
              "border-transparent",
              scopeCheckedStyles[scope],
            ],
            // Animation classes
            animating === "check" && "animate-spring-check",
            animating === "uncheck" && "animate-spring-uncheck",
            // Disabled
            disabled && "pointer-events-none"
          )}
        >
          {/* Icon/Checkmark */}
          <span
            className={cn(
              "flex items-center justify-center transition-all duration-200",
              checked ? "opacity-100 scale-100" : "opacity-0 scale-75"
            )}
          >
            {checked ? (
              <Check className="h-5 w-5" strokeWidth={3} />
            ) : (
              <Icon className="h-4 w-4 text-muted-foreground" />
            )}
          </span>

          {/* Unchecked icon (shown when not checked) */}
          {!checked && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Icon className="h-4 w-4 text-muted-foreground opacity-40 group-hover:opacity-60 transition-opacity" />
            </span>
          )}
        </span>
      </span>

      {/* Label and description */}
      <span className="flex flex-col gap-0.5 pt-2.5">
        <span className="text-sm font-medium leading-none">{displayLabel}</span>
        {displayDescription && (
          <span className="text-xs text-muted-foreground leading-relaxed">
            {displayDescription}
          </span>
        )}
      </span>
    </label>
  );
}

interface ScopeCheckboxGroupProps {
  selectedScopes: ScopeType[];
  onSelectedScopesChange: (scopes: ScopeType[]) => void;
  availableScopes?: ScopeType[];
  columns?: 1 | 2 | 3;
  showDescriptions?: boolean;
  disabled?: boolean;
  className?: string;
}

function ScopeCheckboxGroup({
  selectedScopes,
  onSelectedScopesChange,
  availableScopes = scopeTypes as unknown as ScopeType[],
  columns = 2,
  showDescriptions = true,
  disabled = false,
  className,
}: ScopeCheckboxGroupProps) {
  const handleScopeChange = (scope: ScopeType, checked: boolean) => {
    if (checked) {
      onSelectedScopesChange([...selectedScopes, scope]);
    } else {
      onSelectedScopesChange(selectedScopes.filter((s) => s !== scope));
    }
  };

  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  };

  return (
    <div
      role="group"
      aria-label="Selecteer scopes"
      className={cn("grid gap-2", gridCols[columns], className)}
    >
      {availableScopes.map((scope) => (
        <ScopeCheckbox
          key={scope}
          scope={scope}
          checked={selectedScopes.includes(scope)}
          onCheckedChange={(checked) => handleScopeChange(scope, checked)}
          description={showDescriptions ? undefined : ""}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export {
  ScopeCheckbox,
  ScopeCheckboxGroup,
  scopeTypes,
  scopeIcons,
  scopeLabels,
  scopeDescriptions,
};
export type { ScopeCheckboxProps, ScopeCheckboxGroupProps };
