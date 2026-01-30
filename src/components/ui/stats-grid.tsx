"use client"

import * as React from "react"
import { motion } from "framer-motion"
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
  animated?: boolean
}

const columnConfig = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
}

// Animation variants for staggered card animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
}

const cardVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.46, 0.45, 0.94] as const,
    },
  },
}

function StatsGrid({
  stats,
  columns = 4,
  loading = false,
  className,
  animated = true,
}: StatsGridProps) {
  // When loading, show skeleton cards based on stats length or default to columns count
  const itemCount = loading && stats.length === 0 ? columns : stats.length

  const GridWrapper = animated && !loading ? motion.div : "div"
  const CardWrapper = animated && !loading ? motion.div : "div"

  return (
    <GridWrapper
      className={cn(
        "grid grid-cols-1 gap-4",
        columnConfig[columns],
        className
      )}
      {...(animated && !loading ? {
        initial: "hidden",
        animate: "visible",
        variants: containerVariants,
      } : {})}
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
            <CardWrapper
              key={index}
              {...(animated ? { variants: cardVariants } : {})}
            >
              <DataCard
                title={stat.title}
                value={stat.value}
                trend={stat.trend}
                icon={stat.icon}
                description={stat.description}
              />
            </CardWrapper>
          ))}
    </GridWrapper>
  )
}

export { StatsGrid }
export type { StatsGridProps, StatItem }
