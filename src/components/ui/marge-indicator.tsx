"use client"

import * as React from "react"
import { memo, useMemo } from "react"
import { cn } from "@/lib/utils";

interface MargeIndicatorProps {
  percentage: number
  target?: number
  showTarget?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}

type MargeLevel = "critical" | "low" | "good" | "excellent"

function getMargeLevel(percentage: number): MargeLevel {
  if (percentage < 10) return "critical"
  if (percentage < 15) return "low"
  if (percentage <= 25) return "good"
  return "excellent"
}

function getMargeLevelConfig(level: MargeLevel) {
  const configs = {
    critical: {
      color: "text-status-vervallen-text",
      bgColor: "bg-status-vervallen-dot",
      trackColor: "bg-status-vervallen",
      label: "Kritiek",
    },
    low: {
      color: "text-status-in-uitvoering-text",
      bgColor: "bg-status-in-uitvoering-dot",
      trackColor: "bg-status-in-uitvoering",
      label: "Laag",
    },
    good: {
      color: "text-status-geaccepteerd-text",
      bgColor: "bg-status-geaccepteerd-dot",
      trackColor: "bg-status-geaccepteerd",
      label: "Goed",
    },
    excellent: {
      color: "text-primary",
      bgColor: "bg-primary",
      trackColor: "bg-primary/15",
      label: "Uitstekend",
    },
  }
  return configs[level]
}

const sizeConfig = {
  sm: {
    container: "h-2",
    text: "text-xs",
    targetWidth: "w-0.5",
  },
  md: {
    container: "h-3",
    text: "text-sm",
    targetWidth: "w-0.5",
  },
  lg: {
    container: "h-4",
    text: "text-base",
    targetWidth: "w-1",
  },
}

/**
 * MargeIndicator - Pure presentational component
 * Memoized to prevent re-renders when parent updates
 */
const MargeIndicator = memo(function MargeIndicator({
  percentage,
  target = 20,
  showTarget = false,
  size = "md",
  className,
}: MargeIndicatorProps) {
  // Memoize computed values
  const { config, sizes, displayWidth, targetPosition } = useMemo(() => {
    const margeLevel = getMargeLevel(percentage)
    const margeConfig = getMargeLevelConfig(margeLevel)
    const sizeStyles = sizeConfig[size]

    // Clamp percentage for display (0-50% range for visual)
    const maxDisplay = 50
    const clampedPercentage = Math.min(Math.max(percentage, 0), maxDisplay)
    const width = (clampedPercentage / maxDisplay) * 100
    const targetPos = (target / maxDisplay) * 100

    return {
      level: margeLevel,
      config: margeConfig,
      sizes: sizeStyles,
      displayWidth: width,
      targetPosition: targetPos,
    }
  }, [percentage, target, size])

  const maxDisplay = 50

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Header with percentage and level */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("font-semibold tabular-nums", sizes.text, config.color)}>
            {percentage.toFixed(1)}%
          </span>
          <span className={cn("text-muted-foreground", sizes.text)}>
            marge
          </span>
        </div>
        <span className={cn("text-xs font-medium", config.color)}>
          {config.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div
          className={cn(
            "w-full rounded-full overflow-hidden",
            config.trackColor,
            sizes.container
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-standaard motion-reduce:transition-none",
              config.bgColor
            )}
            style={{ width: `${displayWidth}%` }}
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={maxDisplay}
            aria-label={`Marge: ${percentage.toFixed(1)}%`}
          />
        </div>

        {/* Target marker */}
        {showTarget && (
          <div
            className={cn(
              "absolute top-0 h-full bg-foreground/70 dark:bg-foreground/50 rounded-full",
              sizes.targetWidth
            )}
            style={{ left: `${targetPosition}%` }}
            aria-label={`Target: ${target}%`}
          />
        )}
      </div>

      {/* Target label */}
      {showTarget && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span
            className="relative"
            style={{ left: `calc(${targetPosition}% - 50%)` }}
          >
            Target: {target}%
          </span>
          <span>{maxDisplay}%</span>
        </div>
      )}
    </div>
  )
})

// Circular variant
interface CircularMargeIndicatorProps extends Omit<MargeIndicatorProps, "showTarget"> {
  strokeWidth?: number
}

/**
 * CircularMargeIndicator - Pure presentational component
 * Memoized with useMemo for expensive SVG calculations
 */
const CircularMargeIndicator = memo(function CircularMargeIndicator({
  percentage,
  size = "md",
  strokeWidth,
  className,
}: CircularMargeIndicatorProps) {
  // Memoize all expensive calculations
  const { level, config, dimension, stroke, fontSize, radius, circumference, offset } = useMemo(() => {
    const margeLevel = getMargeLevel(percentage)
    const margeConfig = getMargeLevelConfig(margeLevel)

    const sizeValues = {
      sm: { dimension: 48, stroke: strokeWidth ?? 4, fontSize: "text-xs" },
      md: { dimension: 64, stroke: strokeWidth ?? 5, fontSize: "text-sm" },
      lg: { dimension: 80, stroke: strokeWidth ?? 6, fontSize: "text-base" },
    }

    const { dimension: dim, stroke: str, fontSize: fs } = sizeValues[size]
    const rad = (dim - str) / 2
    const circ = 2 * Math.PI * rad

    // Clamp percentage for display (0-50% range)
    const maxDisplay = 50
    const displayPercentage = Math.min(Math.max(percentage, 0), maxDisplay)
    const progress = (displayPercentage / maxDisplay) * circ
    const off = circ - progress

    return {
      level: margeLevel,
      config: margeConfig,
      dimension: dim,
      stroke: str,
      fontSize: fs,
      radius: rad,
      circumference: circ,
      offset: off,
    }
  }, [percentage, size, strokeWidth])

  // Color mapping for SVG stroke
  const strokeColors = {
    critical: "stroke-status-vervallen-dot",
    low: "stroke-status-in-uitvoering-dot",
    good: "stroke-status-geaccepteerd-dot",
    excellent: "stroke-primary",
  }

  const trackColors = {
    critical: "stroke-status-vervallen",
    low: "stroke-status-in-uitvoering",
    good: "stroke-status-geaccepteerd",
    excellent: "stroke-primary/15",
  }

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: dimension, height: dimension }}
    >
      <svg
        width={dimension}
        height={dimension}
        viewBox={`0 0 ${dimension} ${dimension}`}
        className="-rotate-90"
        role="img"
        aria-label={`Marge: ${percentage.toFixed(1)}%, ${config.label}`}
      >
        {/* Track */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={trackColors[level]}
        />
        {/* Progress */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(strokeColors[level], "transition-[stroke-dashoffset] duration-500 ease-standaard motion-reduce:transition-none")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-semibold tabular-nums", fontSize, config.color)}>
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  )
})

export { MargeIndicator, CircularMargeIndicator }
export type { MargeIndicatorProps, CircularMargeIndicatorProps }
