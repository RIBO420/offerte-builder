"use client";

import { useScopePriceEstimate } from "@/hooks/use-smart-analytics";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingUp, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriceEstimateBadgeProps {
  scope: string;
  oppervlakte?: number;
  className?: string;
  showDetails?: boolean;
}

function formatCurrency(amount: number | undefined): string {
  if (amount === undefined) return "-";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Badge that shows price estimation based on historical data for a scope
 * Displays typical price range and estimated price if oppervlakte is provided
 */
export function PriceEstimateBadge({
  scope,
  oppervlakte,
  className,
  showDetails = false,
}: PriceEstimateBadgeProps) {
  const estimate = useScopePriceEstimate(scope, oppervlakte);

  if (estimate.isLoading) {
    return (
      <Badge variant="outline" className={cn("gap-1 text-xs", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Laden...</span>
      </Badge>
    );
  }

  if (!estimate.hasEstimate || !("typicalRange" in estimate) || !estimate.typicalRange) {
    // No historical data - graceful degradation
    return null;
  }

  const priceRange = estimate.typicalRange;

  const badgeContent = (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 text-xs font-normal bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
        className
      )}
    >
      <TrendingUp className="h-3 w-3" />
      <span>
        Typisch: {formatCurrency(priceRange.low)} - {formatCurrency(priceRange.high)}
      </span>
    </Badge>
  );

  if (!showDetails) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badgeContent}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p className="font-semibold">Prijsinschatting op basis van uw data</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Gemiddeld:</span>
                <span>{formatCurrency(estimate.avgPrice)}</span>
                <span className="text-muted-foreground">Mediaan:</span>
                <span>{formatCurrency(estimate.medianPrice)}</span>
                <span className="text-muted-foreground">Bereik:</span>
                <span>
                  {formatCurrency(estimate.minPrice)} - {formatCurrency(estimate.maxPrice)}
                </span>
              </div>
              {estimate.estimatedPrice && (
                <div className="pt-1 border-t mt-1">
                  <span className="text-muted-foreground">Geschatte prijs: </span>
                  <span className="font-medium">{formatCurrency(estimate.estimatedPrice)}</span>
                </div>
              )}
              <p className="text-muted-foreground pt-1">
                Gebaseerd op {estimate.dataPoints} offertes
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed view
  return (
    <div className={cn("rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-3", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
        <TrendingUp className="h-4 w-4" />
        <span>Prijsinschatting</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3 w-3 text-blue-500" />
            </TooltipTrigger>
            <TooltipContent>
              Gebaseerd op {estimate.dataPoints} vergelijkbare offertes
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Typisch bereik:</span>
        <span className="font-medium">
          {formatCurrency(priceRange.low)} - {formatCurrency(priceRange.high)}
        </span>
        {estimate.estimatedPrice && (
          <>
            <span className="text-muted-foreground">Geschat totaal:</span>
            <span className="font-medium text-blue-700 dark:text-blue-300">
              {formatCurrency(estimate.estimatedPrice)}
            </span>
          </>
        )}
        {estimate.avgPricePerM2 && (
          <>
            <span className="text-muted-foreground">Gemiddeld per m2:</span>
            <span>{formatCurrency(estimate.avgPricePerM2)}</span>
          </>
        )}
      </div>
    </div>
  );
}
