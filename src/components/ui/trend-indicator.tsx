"use client"

import * as React from "react"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface TrendIndicatorProps {
  direction: "up" | "down" | "neutral"
  percentage: number
  label?: string
  size?: "sm" | "md"
  showIcon?: boolean
  className?: string
}

const sizeConfig = {
  sm: {
    container: "text-xs gap-0.5",
    icon: "h-3 w-3",
  },
  md: {
    container: "text-sm gap-1",
    icon: "h-4 w-4",
  },
}

const directionConfig = {
  up: {
    icon: TrendingUp,
    color: "text-trend-positive",
    prefix: "+",
  },
  down: {
    icon: TrendingDown,
    color: "text-trend-negative",
    prefix: "-",
  },
  neutral: {
    icon: Minus,
    color: "text-trend-neutral",
    prefix: "",
  },
}

function TrendIndicator({
  direction,
  percentage,
  label,
  size = "md",
  showIcon = true,
  className,
}: TrendIndicatorProps) {
  const sizeStyles = sizeConfig[size]
  const directionStyles = directionConfig[direction]
  const Icon = directionStyles.icon

  // Format percentage with correct prefix
  const formattedPercentage =
    direction === "neutral"
      ? `${percentage}%`
      : `${directionStyles.prefix}${Math.abs(percentage)}%`

  return (
    <span
      className={cn(
        "inline-flex items-center tabular-nums font-medium",
        sizeStyles.container,
        directionStyles.color,
        className
      )}
    >
      {showIcon && <Icon className={cn(sizeStyles.icon, "shrink-0")} />}
      <span>{formattedPercentage}</span>
      {label && (
        <span className="text-muted-foreground font-normal">{label}</span>
      )}
    </span>
  )
}

export { TrendIndicator }
export type { TrendIndicatorProps }
