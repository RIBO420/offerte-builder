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
 * Bezettingskleur in drie stappen (tot 70% / 70–90% / boven 90%), uit de
 * statusreceptuur: succes (152), wachten (85) en negatief (30). Geen losse
 * paletkleuren — zie DESIGN.md, De Eén-Bron-regel.
 */
export function getCapaciteitKleur(bezetting: number) {
  if (bezetting < 70) {
    return {
      bg: "bg-status-geaccepteerd",
      text: "text-status-geaccepteerd-text",
      border: "border-status-geaccepteerd-border",
      fill: "bg-status-geaccepteerd-dot",
      label: "Beschikbaar",
    };
  }
  if (bezetting <= 90) {
    return {
      bg: "bg-status-verzonden",
      text: "text-status-verzonden-text",
      border: "border-status-verzonden-border",
      fill: "bg-status-verzonden-dot",
      label: "Druk",
    };
  }
  return {
    bg: "bg-status-afgewezen",
    text: "text-status-afgewezen-text",
    border: "border-status-afgewezen-border",
    fill: "bg-status-afgewezen-dot",
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
