"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// ============================================================================
// Types
// ============================================================================

interface DonutSegment {
  label: string
  value: number
  color?: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  size?: number
  strokeWidth?: number
  showLabels?: boolean
  showLegend?: boolean
  showTotal?: boolean
  totalLabel?: string
  formatValue?: (value: number) => string
  className?: string
}

interface DonutChartWithLegendProps extends DonutChartProps {
  legendPosition?: "bottom" | "right"
}

interface MiniDonutProps {
  percentage: number
  size?: number
  color?: string
  className?: string
}

// ============================================================================
// Default Colors
// ============================================================================

const defaultColors = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  // Fallback colors if more than 5 segments
  "hsl(220, 70%, 50%)",
  "hsl(160, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(280, 65%, 55%)",
  "hsl(340, 75%, 55%)",
]

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatPercentage(value: number, total: number): string {
  if (total === 0) return "0%"
  return `${((value / total) * 100).toFixed(1)}%`
}

// ============================================================================
// DonutChart Component
// ============================================================================

function DonutChart({
  segments,
  size = 200,
  strokeWidth = 40,
  showLabels = false,
  showLegend = false,
  showTotal = true,
  totalLabel = "Totaal",
  formatValue = formatCurrency,
  className,
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)
  const [mounted, setMounted] = React.useState(false)

  // Trigger animation on mount
  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // SVG calculations
  const center = size / 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // Calculate segment positions with memoization
  const { validSegments, total, segmentsWithPositions } = React.useMemo(() => {
    const filtered = segments.filter((s) => s.value > 0)
    const sum = filtered.reduce((acc, s) => acc + s.value, 0)

    if (filtered.length === 0 || sum === 0) {
      return { validSegments: filtered, total: sum, segmentsWithPositions: [] }
    }

    const withPositions = filtered.reduce<{
      accumulated: number
      result: Array<{
        label: string
        value: number
        color: string
        index: number
        percentage: number
        startOffset: number
        dashArray: number
        dashOffset: number
      }>
    }>(
      (acc, segment, index) => {
        const percentage = segment.value / sum
        const startOffset = acc.accumulated
        const segmentColor = segment.color || defaultColors[index % defaultColors.length]

        acc.result.push({
          label: segment.label,
          value: segment.value,
          color: segmentColor,
          index,
          percentage,
          startOffset,
          dashArray: percentage * circumference,
          dashOffset: circumference * (1 - startOffset) + circumference * 0.25,
        })

        acc.accumulated += percentage
        return acc
      },
      { accumulated: 0, result: [] }
    )

    return { validSegments: filtered, total: sum, segmentsWithPositions: withPositions.result }
  }, [segments, circumference])

  // Empty state
  if (validSegments.length === 0 || total === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          className
        )}
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Lege donut chart"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            className="opacity-50"
          />
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-sm"
          >
            Geen data
          </text>
        </svg>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className="relative"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Donut chart met ${validSegments.length} segmenten, totaal ${formatValue(total)}`}
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            className="opacity-30"
          />

          {/* Segments - rendered in reverse so first segment appears on top when hovered */}
          {[...segmentsWithPositions].reverse().map((segment) => {
            const isHovered = hoveredIndex === segment.index
            const scale = isHovered ? 1.05 : 1

            return (
              <Tooltip key={segment.label}>
                <TooltipTrigger asChild>
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${segment.dashArray} ${circumference}`}
                    strokeDashoffset={segment.dashOffset}
                    strokeLinecap="butt"
                    className={cn(
                      "cursor-pointer origin-center",
                      "transition-all duration-300 ease-out"
                    )}
                    style={{
                      transform: `scale(${scale})`,
                      transformOrigin: `${center}px ${center}px`,
                      opacity: mounted ? 1 : 0,
                      strokeDasharray: mounted
                        ? `${segment.dashArray} ${circumference}`
                        : `0 ${circumference}`,
                    }}
                    onMouseEnter={() => setHoveredIndex(segment.index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onFocus={() => setHoveredIndex(segment.index)}
                    onBlur={() => setHoveredIndex(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${segment.label}: ${formatValue(segment.value)} (${formatPercentage(segment.value, total)})`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{segment.label}</span>
                    <span className="text-xs">{formatValue(segment.value)}</span>
                    <span className="text-xs opacity-70">
                      {formatPercentage(segment.value, total)}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </svg>

        {/* Center content */}
        {showTotal && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <span className="text-xs text-muted-foreground">{totalLabel}</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatValue(total)}
            </span>
          </div>
        )}

        {/* Labels around the chart */}
        {showLabels && (
          <div className="absolute inset-0 pointer-events-none">
            {segmentsWithPositions.map((segment) => {
              // Calculate label position at middle of segment
              const midPercentage = segment.startOffset + segment.percentage / 2
              const angle = midPercentage * 2 * Math.PI - Math.PI / 2 // Start from top
              const labelRadius = radius + strokeWidth / 2 + 20
              const x = center + labelRadius * Math.cos(angle)
              const y = center + labelRadius * Math.sin(angle)

              return (
                <div
                  key={`label-${segment.label}`}
                  className="absolute text-xs font-medium whitespace-nowrap"
                  style={{
                    left: x,
                    top: y,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  {segment.label}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {segmentsWithPositions.map((segment) => (
            <div
              key={`legend-${segment.label}`}
              className={cn(
                "flex items-center gap-1.5 transition-opacity duration-200",
                hoveredIndex !== null && hoveredIndex !== segment.index && "opacity-50"
              )}
            >
              <div
                className="h-3 w-3 rounded-sm shrink-0"
                style={{ backgroundColor: segment.color }}
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">
                {segment.label}
              </span>
              <span className="text-xs font-medium tabular-nums">
                {formatPercentage(segment.value, total)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// DonutChartWithLegend Component
// ============================================================================

function DonutChartWithLegend({
  legendPosition = "bottom",
  segments,
  size = 200,
  strokeWidth = 40,
  showTotal = true,
  totalLabel = "Totaal",
  formatValue = formatCurrency,
  className,
}: DonutChartWithLegendProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const center = size / 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius

  // Calculate segment positions with memoization
  const { validSegments, total, segmentsWithPositions } = React.useMemo(() => {
    const filtered = segments.filter((s) => s.value > 0)
    const sum = filtered.reduce((acc, s) => acc + s.value, 0)

    if (filtered.length === 0 || sum === 0) {
      return { validSegments: filtered, total: sum, segmentsWithPositions: [] }
    }

    const withPositions = filtered.reduce<{
      accumulated: number
      result: Array<{
        label: string
        value: number
        color: string
        index: number
        percentage: number
        startOffset: number
        dashArray: number
        dashOffset: number
      }>
    }>(
      (acc, segment, index) => {
        const percentage = segment.value / sum
        const startOffset = acc.accumulated
        const segmentColor = segment.color || defaultColors[index % defaultColors.length]

        acc.result.push({
          label: segment.label,
          value: segment.value,
          color: segmentColor,
          index,
          percentage,
          startOffset,
          dashArray: percentage * circumference,
          dashOffset: circumference * (1 - startOffset) + circumference * 0.25,
        })

        acc.accumulated += percentage
        return acc
      },
      { accumulated: 0, result: [] }
    )

    return { validSegments: filtered, total: sum, segmentsWithPositions: withPositions.result }
  }, [segments, circumference])

  if (validSegments.length === 0 || total === 0) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <span className="text-sm text-muted-foreground">Geen data</span>
      </div>
    )
  }

  const isHorizontal = legendPosition === "right"

  return (
    <div
      className={cn(
        "flex gap-6",
        isHorizontal ? "flex-row items-center" : "flex-col items-center",
        className
      )}
    >
      {/* Chart */}
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`Donut chart met ${validSegments.length} segmenten, totaal ${formatValue(total)}`}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            className="opacity-30"
          />

          {[...segmentsWithPositions].reverse().map((segment) => {
            const isHovered = hoveredIndex === segment.index
            const scale = isHovered ? 1.05 : 1

            return (
              <Tooltip key={segment.label}>
                <TooltipTrigger asChild>
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${segment.dashArray} ${circumference}`}
                    strokeDashoffset={segment.dashOffset}
                    strokeLinecap="butt"
                    className="cursor-pointer transition-all duration-300 ease-out"
                    style={{
                      transform: `scale(${scale})`,
                      transformOrigin: `${center}px ${center}px`,
                      opacity: mounted ? 1 : 0,
                      strokeDasharray: mounted
                        ? `${segment.dashArray} ${circumference}`
                        : `0 ${circumference}`,
                    }}
                    onMouseEnter={() => setHoveredIndex(segment.index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onFocus={() => setHoveredIndex(segment.index)}
                    onBlur={() => setHoveredIndex(null)}
                    tabIndex={0}
                    role="button"
                    aria-label={`${segment.label}: ${formatValue(segment.value)} (${formatPercentage(segment.value, total)})`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{segment.label}</span>
                    <span className="text-xs">{formatValue(segment.value)}</span>
                    <span className="text-xs opacity-70">
                      {formatPercentage(segment.value, total)}
                    </span>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </svg>

        {showTotal && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <span className="text-xs text-muted-foreground">{totalLabel}</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatValue(total)}
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        className={cn(
          "flex gap-2",
          isHorizontal ? "flex-col" : "flex-row flex-wrap justify-center"
        )}
      >
        {segmentsWithPositions.map((segment) => (
          <button
            key={`legend-${segment.label}`}
            type="button"
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded-md transition-all duration-200",
              "hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              hoveredIndex !== null && hoveredIndex !== segment.index && "opacity-50"
            )}
            onMouseEnter={() => setHoveredIndex(segment.index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onFocus={() => setHoveredIndex(segment.index)}
            onBlur={() => setHoveredIndex(null)}
          >
            <div
              className="h-3 w-3 rounded-sm shrink-0"
              style={{ backgroundColor: segment.color }}
              aria-hidden="true"
            />
            <span className="text-sm">{segment.label}</span>
            <span className="text-sm font-medium tabular-nums ml-auto">
              {formatValue(segment.value)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatPercentage(segment.value, total)}
            </span>
          </button>
        ))}

        {/* Total row for right legend */}
        {isHorizontal && (
          <div className="flex items-center justify-between gap-2 px-2 py-1 border-t mt-1 pt-2">
            <span className="text-sm font-semibold">{totalLabel}</span>
            <span className="text-sm font-semibold tabular-nums">
              {formatValue(total)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// MiniDonut Component
// ============================================================================

function MiniDonut({
  percentage,
  size = 24,
  color,
  className,
}: MiniDonutProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Clamp percentage between 0 and 100
  const clampedPercentage = Math.max(0, Math.min(100, percentage))

  const strokeWidth = size / 6
  const center = size / 2
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashArray = (clampedPercentage / 100) * circumference

  // Default color based on percentage
  const fillColor =
    color ||
    (clampedPercentage >= 75
      ? "hsl(142.1, 76.2%, 36.3%)" // Green
      : clampedPercentage >= 50
        ? "hsl(45, 93%, 47%)" // Amber
        : clampedPercentage >= 25
          ? "hsl(25, 95%, 53%)" // Orange
          : "hsl(0, 72%, 51%)") // Red

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className={cn("shrink-0", className)}
          role="img"
          aria-label={`${clampedPercentage.toFixed(0)}%`}
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={strokeWidth}
            className="opacity-40"
          />

          {/* Filled arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={fillColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${mounted ? dashArray : 0} ${circumference}`}
            strokeDashoffset={circumference * 0.25} // Start from top
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
      </TooltipTrigger>
      <TooltipContent>
        <span>{clampedPercentage.toFixed(1)}%</span>
      </TooltipContent>
    </Tooltip>
  )
}

// ============================================================================
// Exports
// ============================================================================

export { DonutChart, DonutChartWithLegend, MiniDonut }
export type { DonutSegment, DonutChartProps, DonutChartWithLegendProps, MiniDonutProps }
