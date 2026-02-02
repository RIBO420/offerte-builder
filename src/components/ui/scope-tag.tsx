"use client";

import { memo } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  Mountain,
  LayoutGrid,
  Trees,
  Leaf,
  Hammer,
  Droplets,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

const scopeTagVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
  {
    variants: {
      size: {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-sm",
      },
      scope: {
        grondwerk: "bg-scope-grondwerk/15 text-scope-grondwerk",
        bestrating: "bg-scope-bestrating/15 text-scope-bestrating",
        borders: "bg-scope-borders/15 text-scope-borders",
        gras: "bg-scope-gras/15 text-scope-gras",
        houtwerk: "bg-scope-houtwerk/15 text-scope-houtwerk",
        water: "bg-scope-water/15 text-scope-water",
        specials: "bg-scope-specials/15 text-scope-specials",
      },
    },
    defaultVariants: {
      size: "md",
      scope: "grondwerk",
    },
  }
);

export interface ScopeTagProps
  extends Omit<VariantProps<typeof scopeTagVariants>, "scope">,
    React.HTMLAttributes<HTMLSpanElement> {
  scope: ScopeType;
  showIcon?: boolean;
}

/**
 * ScopeTag - Pure presentational component for displaying scope badges
 * Memoized to prevent unnecessary re-renders in lists
 */
export const ScopeTag = memo(function ScopeTag({
  scope,
  size,
  showIcon = false,
  className,
  children,
  ...props
}: ScopeTagProps) {
  const Icon = scopeIcons[scope];
  const label = scopeLabels[scope];

  return (
    <span
      className={cn(scopeTagVariants({ size, scope }), className)}
      {...props}
    >
      {showIcon && (
        <Icon className={cn(size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      )}
      {children ?? label}
    </span>
  );
});

export { scopeTypes, scopeIcons, scopeLabels };
