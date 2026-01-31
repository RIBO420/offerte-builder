"use client";

import { usePriceAnomalyCheck } from "@/hooks/use-smart-analytics";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TrendingDown, TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PriceAnomalyAlertProps {
  scope: string;
  price: number | null;
  oppervlakte?: number;
  className?: string;
  compact?: boolean;
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
 * Alert that shows when a price is significantly different from historical norms
 * Uses percentile-based anomaly detection for accuracy
 */
export function PriceAnomalyAlert({
  scope,
  price,
  oppervlakte,
  className,
  compact = false,
}: PriceAnomalyAlertProps) {
  const anomaly = usePriceAnomalyCheck(scope, price, oppervlakte);

  // Don't show anything while loading or if no data
  if (anomaly.isLoading) {
    if (!compact) return null;
    return (
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3 w-3 animate-spin" />
      </div>
    );
  }

  // We know we have an anomaly, so these fields exist
  const isTooLow = "isTooLow" in anomaly ? anomaly.isTooLow : false;
  const isTooHigh = "isTooHigh" in anomaly ? anomaly.isTooHigh : false;
  const severity = "severity" in anomaly ? anomaly.severity : "warning";
  const message = "message" in anomaly ? anomaly.message : "";
  const stats = "stats" in anomaly ? anomaly.stats : undefined;

  if (!anomaly.hasCheck || !anomaly.isAnomaly || !stats) {
    // No anomaly detected or no stats
    return null;
  }

  const Icon = isTooLow ? TrendingDown : TrendingUp;
  const iconColor = severity === "critical" ? "text-red-600" : "text-amber-600";
  const bgColor =
    severity === "critical"
      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
      : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30";
  const textColor =
    severity === "critical"
      ? "text-red-700 dark:text-red-300"
      : "text-amber-700 dark:text-amber-300";

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                bgColor,
                textColor,
                className
              )}
            >
              <Icon className={cn("h-3 w-3", iconColor)} />
              <span>{isTooLow ? "Laag" : "Hoog"}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p className="font-semibold">{message}</p>
              {stats && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <span className="text-muted-foreground">Uw prijs:</span>
                  <span>{formatCurrency(stats.yourValue)}</span>
                  <span className="text-muted-foreground">Mediaan:</span>
                  <span>{formatCurrency(stats.median)}</span>
                  <span className="text-muted-foreground">Normaal bereik:</span>
                  <span>
                    {formatCurrency(stats.p10)} - {formatCurrency(stats.p90)}
                  </span>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Alert className={cn(bgColor, className)}>
      <Icon className={cn("h-4 w-4", iconColor)} />
      <AlertTitle className={cn("text-sm font-medium", textColor)}>
        {isTooLow ? "Prijs onder verwachting" : "Prijs boven verwachting"}
      </AlertTitle>
      <AlertDescription className="text-xs space-y-2">
        <p className={textColor}>{message}</p>
        {stats && (
          <div className="flex items-center gap-4 text-muted-foreground">
            <span>
              Mediaan: <strong className="text-foreground">{formatCurrency(stats.median)}</strong>
            </span>
            <span>
              Normaal: {formatCurrency(stats.p10)} - {formatCurrency(stats.p90)}
            </span>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Simpler inline indicator for anomaly detection in tables/lists
 */
export function PriceAnomalyIndicator({
  scope,
  price,
  oppervlakte,
}: {
  scope: string;
  price: number | null;
  oppervlakte?: number;
}) {
  const anomaly = usePriceAnomalyCheck(scope, price, oppervlakte);

  if (!anomaly.hasCheck || !anomaly.isAnomaly) {
    return null;
  }

  const isTooLow = "isTooLow" in anomaly ? anomaly.isTooLow : false;
  const severity = "severity" in anomaly ? anomaly.severity : "warning";
  const message = "message" in anomaly ? anomaly.message : "";

  const Icon = isTooLow ? TrendingDown : TrendingUp;
  const color = severity === "critical" ? "text-red-500" : "text-amber-500";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Icon className={cn("h-4 w-4", color)} />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p>{message}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
