"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface PriceBreakdownChartProps {
  materialen: number
  arbeid: number
  marge: number
  btw: number
  showLabels?: boolean
  showValues?: boolean
  className?: string
}

interface SegmentData {
  key: string
  label: string
  value: number
  percentage: number
  color: string
  hoverColor: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

function PriceBreakdownChart({
  materialen,
  arbeid,
  marge,
  btw,
  showLabels = true,
  showValues = true,
  className,
}: PriceBreakdownChartProps) {
  // Memoize total and segments calculation
  const { total, segments } = React.useMemo(() => {
    const calculatedTotal = materialen + arbeid + marge + btw

    if (calculatedTotal === 0) {
      return { total: 0, segments: [] }
    }

    const allSegments: SegmentData[] = [
      {
        key: "materialen",
        label: "Materialen",
        value: materialen,
        percentage: (materialen / calculatedTotal) * 100,
        color: "bg-blue-500 dark:bg-blue-400",
        hoverColor: "hover:bg-blue-600 dark:hover:bg-blue-500",
      },
      {
        key: "arbeid",
        label: "Arbeid",
        value: arbeid,
        percentage: (arbeid / calculatedTotal) * 100,
        color: "bg-amber-500 dark:bg-amber-400",
        hoverColor: "hover:bg-amber-600 dark:hover:bg-amber-500",
      },
      {
        key: "marge",
        label: "Marge",
        value: marge,
        percentage: (marge / calculatedTotal) * 100,
        color: "bg-emerald-500 dark:bg-emerald-400",
        hoverColor: "hover:bg-emerald-600 dark:hover:bg-emerald-500",
      },
      {
        key: "btw",
        label: "BTW",
        value: btw,
        percentage: (btw / calculatedTotal) * 100,
        color: "bg-gray-400 dark:bg-gray-500",
        hoverColor: "hover:bg-gray-500 dark:hover:bg-gray-600",
      },
    ]

    return {
      total: calculatedTotal,
      segments: allSegments.filter((segment) => segment.value > 0),
    }
  }, [materialen, arbeid, marge, btw])

  // Prevent division by zero
  if (total === 0) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="h-8 rounded-lg bg-muted flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Geen data</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Stacked Bar */}
      <div className="flex h-8 w-full overflow-hidden rounded-lg bg-muted">
        {segments.map((segment, index) => (
          <Tooltip key={segment.key}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  "h-full transition-all duration-200 cursor-default",
                  segment.color,
                  segment.hoverColor,
                  index === 0 && "rounded-l-lg",
                  index === segments.length - 1 && "rounded-r-lg"
                )}
                style={{ width: `${segment.percentage}%` }}
                role="presentation"
                aria-label={`${segment.label}: ${formatCurrency(segment.value)} (${formatPercentage(segment.percentage)})`}
              />
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{segment.label}</span>
                <span className="text-xs">{formatCurrency(segment.value)}</span>
                <span className="text-xs text-muted-foreground">
                  {formatPercentage(segment.percentage)}
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Labels */}
      {showLabels && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((segment) => (
            <div key={segment.key} className="flex items-center gap-1.5">
              <div
                className={cn("h-3 w-3 rounded-sm", segment.color)}
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">
                {segment.label}
              </span>
              {showValues && (
                <span className="text-xs font-medium tabular-nums">
                  {formatPercentage(segment.percentage)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {showValues && (
        <div className="flex items-center justify-between border-t pt-2">
          <span className="text-sm font-medium">Totaal</span>
          <span className="text-sm font-semibold tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      )}
    </div>
  )
}

export { PriceBreakdownChart }
export type { PriceBreakdownChartProps }
