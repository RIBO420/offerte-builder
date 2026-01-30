"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { DataCard, type TrendData } from "@/components/ui/data-card"

interface StatItem {
  title: string
  value: React.ReactNode
  trend?: TrendData
  icon?: React.ReactNode
  description?: string
}

interface StatsGridProps {
  stats: StatItem[]
  columns?: 2 | 3 | 4
  loading?: boolean
  className?: string
}

const columnConfig = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
}

function StatsGrid({
  stats,
  columns = 4,
  loading = false,
  className,
}: StatsGridProps) {
  // When loading, show skeleton cards based on stats length or default to columns count
  const itemCount = loading && stats.length === 0 ? columns : stats.length

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        columnConfig[columns],
        className
      )}
    >
      {loading
        ? Array.from({ length: itemCount }).map((_, index) => (
            <DataCard
              key={index}
              title=""
              value=""
              loading={true}
            />
          ))
        : stats.map((stat, index) => (
            <DataCard
              key={index}
              title={stat.title}
              value={stat.value}
              trend={stat.trend}
              icon={stat.icon}
              description={stat.description}
            />
          ))}
    </div>
  )
}

export { StatsGrid }
export type { StatsGridProps, StatItem }
