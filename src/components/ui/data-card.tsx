"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendIndicator } from "@/components/ui/trend-indicator"

interface TrendData {
  direction: "up" | "down" | "neutral"
  percentage: number
  label?: string // bijv "vs vorige maand"
}

interface DataCardProps {
  title: string
  value: React.ReactNode
  trend?: TrendData
  icon?: React.ReactNode
  description?: string
  loading?: boolean
  className?: string
}

function DataCard({
  title,
  value,
  trend,
  icon,
  description,
  loading = false,
  className,
}: DataCardProps) {
  if (loading) {
    return (
      <Card className={cn("h-full gap-4 py-4", className)}>
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-start justify-between">
            <Skeleton className="h-4 w-24" />
            {icon && <Skeleton className="h-8 w-8 rounded-full" />}
          </div>
          <Skeleton className="h-8 w-20" />
          <div className="mt-auto flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("h-full gap-4 py-4", className)}>
      <CardContent className="flex h-full flex-col gap-1">
        {/* Header row: title + icon */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm text-muted-foreground truncate">{title}</span>
          {icon && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {icon}
            </div>
          )}
        </div>

        {/* Value */}
        <div className="text-2xl font-bold tabular-nums">{value}</div>

        {/* Footer row: description/label + trend indicator - pushed to bottom */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          {description && (
            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{description}</span>
          )}
          {!description && <span />}
          {trend && (
            <TrendIndicator
              direction={trend.direction}
              percentage={trend.percentage}
              label={trend.label}
              size="sm"
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export { DataCard }
export type { DataCardProps, TrendData }
