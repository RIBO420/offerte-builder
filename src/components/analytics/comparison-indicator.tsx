"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatPercentage, formatDecimal } from "@/lib/format";

interface ComparisonIndicatorProps {
  currentValue: number;
  previousValue: number;
  format?: "percentage" | "currency" | "number";
  showAbsolute?: boolean;
  size?: "sm" | "md" | "lg";
  positiveIsGood?: boolean;
  className?: string;
}

function formatValue(value: number, format: "percentage" | "currency" | "number"): string {
  switch (format) {
    case "percentage":
      return formatPercentage(value, 1);
    case "currency":
      return formatCurrency(value, "nl-NL", false);
    case "number":
    default:
      return formatDecimal(value, 1);
  }
}

export const ComparisonIndicator = memo(function ComparisonIndicator({
  currentValue,
  previousValue,
  format = "percentage",
  showAbsolute = false,
  size = "md",
  positiveIsGood = true,
  className,
}: ComparisonIndicatorProps) {
  const absoluteChange = currentValue - previousValue;
  const percentageChange = previousValue !== 0
    ? ((currentValue - previousValue) / Math.abs(previousValue)) * 100
    : currentValue > 0 ? 100 : 0;

  const isPositive = absoluteChange > 0;
  const isNeutral = Math.abs(percentageChange) < 0.5;
  const isGood = positiveIsGood ? isPositive : !isPositive;

  const sizeClasses = {
    sm: "text-xs gap-0.5",
    md: "text-sm gap-1",
    lg: "text-base gap-1.5",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const getColorClasses = () => {
    if (isNeutral) return "text-muted-foreground bg-muted/50";
    if (isGood) return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10";
    return "text-red-600 dark:text-red-400 bg-red-500/10";
  };

  const Icon = isNeutral
    ? Minus
    : isPositive
    ? size === "sm" ? TrendingUp : ArrowUpRight
    : size === "sm" ? TrendingDown : ArrowDownRight;

  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 font-medium",
        sizeClasses[size],
        getColorClasses(),
        className
      )}
    >
      <Icon className={iconSizes[size]} />
      <span>
        {isPositive && !isNeutral ? "+" : ""}
        {percentageChange.toFixed(1)}%
      </span>
      {showAbsolute && !isNeutral && (
        <span className="text-muted-foreground ml-1">
          ({isPositive ? "+" : ""}{formatValue(absoluteChange, format)})
        </span>
      )}
    </motion.div>
  );
});

// Compact version for inline use
export const ComparisonArrow = memo(function ComparisonArrow({
  currentValue,
  previousValue,
  positiveIsGood = true,
  className,
}: {
  currentValue: number;
  previousValue: number;
  positiveIsGood?: boolean;
  className?: string;
}) {
  const percentageChange = previousValue !== 0
    ? ((currentValue - previousValue) / Math.abs(previousValue)) * 100
    : currentValue > 0 ? 100 : 0;

  const isPositive = percentageChange > 0;
  const isNeutral = Math.abs(percentageChange) < 0.5;
  const isGood = positiveIsGood ? isPositive : !isPositive;

  if (isNeutral) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 text-xs text-muted-foreground", className)}>
        <Minus className="h-3 w-3" />
        0%
      </span>
    );
  }

  return (
    <motion.span
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isGood ? "text-emerald-500" : "text-red-500",
        className
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      {isPositive ? "+" : ""}{percentageChange.toFixed(1)}%
    </motion.span>
  );
});

// Large comparison display for KPI cards
export const ComparisonDisplay = memo(function ComparisonDisplay({
  currentValue,
  previousValue,
  label = "vs vorige periode",
  format = "number",
  positiveIsGood = true,
  className,
}: {
  currentValue: number;
  previousValue: number;
  label?: string;
  format?: "percentage" | "currency" | "number";
  positiveIsGood?: boolean;
  className?: string;
}) {
  const absoluteChange = currentValue - previousValue;
  const percentageChange = previousValue !== 0
    ? ((currentValue - previousValue) / Math.abs(previousValue)) * 100
    : currentValue > 0 ? 100 : 0;

  const isPositive = absoluteChange > 0;
  const isNeutral = Math.abs(percentageChange) < 0.5;
  const isGood = positiveIsGood ? isPositive : !isPositive;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={cn("flex flex-col gap-1", className)}
    >
      <div className={cn(
        "flex items-center gap-1.5 text-sm font-semibold",
        isNeutral ? "text-muted-foreground" : isGood ? "text-emerald-500" : "text-red-500"
      )}>
        {isNeutral ? (
          <Minus className="h-4 w-4" />
        ) : isPositive ? (
          <ArrowUpRight className="h-4 w-4" />
        ) : (
          <ArrowDownRight className="h-4 w-4" />
        )}
        <span>
          {isPositive && !isNeutral ? "+" : ""}
          {percentageChange.toFixed(1)}%
        </span>
        {!isNeutral && (
          <span className="font-normal text-muted-foreground">
            ({isPositive ? "+" : ""}{formatValue(absoluteChange, format)})
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </motion.div>
  );
});
