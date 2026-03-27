"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CapaciteitIndicatorProps {
  bezetting: number; // percentage 0-100+
  variant?: "badge" | "bar" | "dot";
  showLabel?: boolean;
  className?: string;
}

/**
 * Capacity indicator with color coding:
 * - Green: < 70% (low utilization)
 * - Yellow: 70-90% (medium)
 * - Red: > 90% (high/overloaded)
 */
export function getCapaciteitKleur(bezetting: number) {
  if (bezetting < 70) {
    return {
      bg: "bg-green-500/10",
      text: "text-green-700 dark:text-green-400",
      border: "border-green-200 dark:border-green-800",
      fill: "bg-green-500",
      label: "Beschikbaar",
    };
  }
  if (bezetting <= 90) {
    return {
      bg: "bg-yellow-500/10",
      text: "text-yellow-700 dark:text-yellow-400",
      border: "border-yellow-200 dark:border-yellow-800",
      fill: "bg-yellow-500",
      label: "Druk",
    };
  }
  return {
    bg: "bg-red-500/10",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
    fill: "bg-red-500",
    label: "Vol",
  };
}

export const CapaciteitIndicator = React.memo(function CapaciteitIndicator({
  bezetting,
  variant = "badge",
  showLabel = true,
  className,
}: CapaciteitIndicatorProps) {
  const kleuren = getCapaciteitKleur(bezetting);

  if (variant === "dot") {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5", className)}
        title={`${bezetting}% bezetting`}
      >
        <span className={cn("h-2 w-2 rounded-full", kleuren.fill)} />
        {showLabel && (
          <span className={cn("text-xs", kleuren.text)}>{bezetting}%</span>
        )}
      </span>
    );
  }

  if (variant === "bar") {
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center justify-between text-xs mb-1">
          {showLabel && (
            <span className={cn(kleuren.text)}>{kleuren.label}</span>
          )}
          <span className={cn("font-medium", kleuren.text)}>{bezetting}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all", kleuren.fill)}
            style={{ width: `${Math.min(bezetting, 100)}%` }}
          />
        </div>
      </div>
    );
  }

  // Default: badge
  return (
    <Badge
      variant="outline"
      className={cn(kleuren.bg, kleuren.text, kleuren.border, className)}
    >
      {bezetting}%
      {showLabel && <span className="ml-1">{kleuren.label}</span>}
    </Badge>
  );
});
