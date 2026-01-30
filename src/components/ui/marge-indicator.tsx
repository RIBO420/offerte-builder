"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

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
      color: "text-red-500 dark:text-red-400",
      bgColor: "bg-red-500 dark:bg-red-400",
      trackColor: "bg-red-100 dark:bg-red-950",
      label: "Kritiek",
    },
    low: {
      color: "text-amber-500 dark:text-amber-400",
      bgColor: "bg-amber-500 dark:bg-amber-400",
      trackColor: "bg-amber-100 dark:bg-amber-950",
      label: "Laag",
    },
    good: {
      color: "text-emerald-500 dark:text-emerald-400",
      bgColor: "bg-emerald-500 dark:bg-emerald-400",
      trackColor: "bg-emerald-100 dark:bg-emerald-950",
      label: "Goed",
    },
    excellent: {
      color: "text-blue-500 dark:text-blue-400",
      bgColor: "bg-blue-500 dark:bg-blue-400",
      trackColor: "bg-blue-100 dark:bg-blue-950",
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

function MargeIndicator({
  percentage,
  target = 20,
  showTarget = false,
  size = "md",
  className,
}: MargeIndicatorProps) {
  const level = getMargeLevel(percentage)
  const config = getMargeLevelConfig(level)
  const sizes = sizeConfig[size]

  // Clamp percentage for display (0-50% range for visual)
  const maxDisplay = 50
  const displayPercentage = Math.min(Math.max(percentage, 0), maxDisplay)
  const displayWidth = (displayPercentage / maxDisplay) * 100
  const targetPosition = (target / maxDisplay) * 100

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
              "h-full rounded-full transition-all duration-500 ease-out",
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
}

// Circular variant
interface CircularMargeIndicatorProps extends Omit<MargeIndicatorProps, "showTarget"> {
  strokeWidth?: number
}

function CircularMargeIndicator({
  percentage,
  size = "md",
  strokeWidth,
  className,
}: CircularMargeIndicatorProps) {
  const level = getMargeLevel(percentage)
  const config = getMargeLevelConfig(level)

  const sizeValues = {
    sm: { dimension: 48, stroke: strokeWidth ?? 4, fontSize: "text-xs" },
    md: { dimension: 64, stroke: strokeWidth ?? 5, fontSize: "text-sm" },
    lg: { dimension: 80, stroke: strokeWidth ?? 6, fontSize: "text-base" },
  }

  const { dimension, stroke, fontSize } = sizeValues[size]
  const radius = (dimension - stroke) / 2
  const circumference = 2 * Math.PI * radius

  // Clamp percentage for display (0-50% range)
  const maxDisplay = 50
  const displayPercentage = Math.min(Math.max(percentage, 0), maxDisplay)
  const progress = (displayPercentage / maxDisplay) * circumference
  const offset = circumference - progress

  // Color mapping for SVG stroke
  const strokeColors = {
    critical: "stroke-red-500 dark:stroke-red-400",
    low: "stroke-amber-500 dark:stroke-amber-400",
    good: "stroke-emerald-500 dark:stroke-emerald-400",
    excellent: "stroke-blue-500 dark:stroke-blue-400",
  }

  const trackColors = {
    critical: "stroke-red-100 dark:stroke-red-950",
    low: "stroke-amber-100 dark:stroke-amber-950",
    good: "stroke-emerald-100 dark:stroke-emerald-950",
    excellent: "stroke-blue-100 dark:stroke-blue-950",
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
          className={cn(strokeColors[level], "transition-all duration-500 ease-out")}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-semibold tabular-nums", fontSize, config.color)}>
          {percentage.toFixed(0)}%
        </span>
      </div>
    </div>
  )
}

export { MargeIndicator, CircularMargeIndicator }
export type { MargeIndicatorProps, CircularMargeIndicatorProps }
