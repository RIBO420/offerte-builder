"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { useReducedMotion } from "@/hooks/use-accessibility"
import { transitions } from "@/lib/motion-config"

interface PipelineStage {
  id: string
  label: string
  count: number
  color?: string
}

interface PipelineViewProps {
  stages: PipelineStage[]
  onStageClick?: (stageId: string) => void
  className?: string
}

// Premium color schemes with gradients
const stageColors = [
  {
    bg: "bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900",
    text: "text-slate-700 dark:text-slate-300",
    glow: "group-hover:shadow-slate-500/30",
    border: "border-slate-200 dark:border-slate-700",
    accent: "from-slate-400 to-slate-500",
  },
  {
    bg: "bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/80 dark:to-blue-950",
    text: "text-blue-700 dark:text-blue-300",
    glow: "group-hover:shadow-blue-500/30",
    border: "border-blue-200 dark:border-blue-800",
    accent: "from-blue-400 to-blue-600",
  },
  {
    bg: "bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/80 dark:to-amber-950",
    text: "text-amber-700 dark:text-amber-300",
    glow: "group-hover:shadow-amber-500/30",
    border: "border-amber-200 dark:border-amber-800",
    accent: "from-amber-400 to-orange-500",
  },
  {
    bg: "bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/80 dark:to-emerald-950",
    text: "text-emerald-700 dark:text-emerald-300",
    glow: "group-hover:shadow-emerald-500/30",
    border: "border-emerald-200 dark:border-emerald-800",
    accent: "from-emerald-400 to-green-600",
  },
  {
    bg: "bg-gradient-to-br from-rose-100 to-rose-200 dark:from-rose-900/80 dark:to-rose-950",
    text: "text-rose-700 dark:text-rose-300",
    glow: "group-hover:shadow-rose-500/30",
    border: "border-rose-200 dark:border-rose-800",
    accent: "from-rose-400 to-red-500",
  },
]

function PipelineView({ stages, onStageClick, className }: PipelineViewProps) {
  const prefersReducedMotion = useReducedMotion()

  if (stages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <span className="text-sm text-muted-foreground">Geen stages</span>
      </div>
    )
  }

  // Calculate total for percentage
  const total = stages.reduce((sum, stage) => sum + stage.count, 0)

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop: Horizontal layout */}
      <div className="hidden md:flex items-center gap-0">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.id}>
            <PipelineStageItem
              stage={stage}
              index={index}
              total={total}
              onClick={onStageClick}
              isFirst={index === 0}
              isLast={index === stages.length - 1}
              prefersReducedMotion={prefersReducedMotion}
            />
            {index < stages.length - 1 && (
              <PipelineConnector index={index} prefersReducedMotion={prefersReducedMotion} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Mobile: Vertical layout */}
      <div className="flex md:hidden flex-col gap-0">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.id}>
            <PipelineStageItemVertical
              stage={stage}
              index={index}
              total={total}
              onClick={onStageClick}
              isFirst={index === 0}
              isLast={index === stages.length - 1}
              prefersReducedMotion={prefersReducedMotion}
            />
            {index < stages.length - 1 && (
              <PipelineConnectorVertical index={index} prefersReducedMotion={prefersReducedMotion} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

interface PipelineStageItemProps {
  stage: PipelineStage
  index: number
  total: number
  onClick?: (stageId: string) => void
  isFirst: boolean
  isLast: boolean
  prefersReducedMotion?: boolean
}

function PipelineStageItem({
  stage,
  index,
  total,
  onClick,
  isFirst,
  isLast,
  prefersReducedMotion = false,
}: PipelineStageItemProps) {
  const colors = stageColors[index % stageColors.length]
  const isClickable = !!onClick
  const percentage = total > 0 ? Math.round((stage.count / total) * 100) : 0

  return (
    <motion.button
      type="button"
      onClick={() => onClick?.(stage.id)}
      disabled={!isClickable}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      className={cn(
        "group relative flex flex-col items-center justify-center px-6 py-4 min-w-[130px] flex-1",
        "transition-all duration-300",
        colors.bg,
        colors.text,
        "border",
        colors.border,
        isFirst && "rounded-l-xl",
        isLast && "rounded-r-xl",
        isClickable && `cursor-pointer ${colors.glow} hover:shadow-lg`,
        !isClickable && "cursor-default"
      )}
      aria-label={`${stage.label}: ${stage.count} items`}
    >
      {/* Shine effect on hover - subtle on mobile, stronger on desktop hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl" />

      {/* Accent bar at top - always visible on mobile, brighter on hover */}
      <div className={cn(
        "absolute top-0 left-1/4 right-1/4 h-1 bg-gradient-to-r opacity-50 group-hover:opacity-100 group-active:opacity-100 transition-all duration-300 rounded-b-full",
        colors.accent
      )} />

      <motion.span
        className="text-3xl font-bold tabular-nums relative"
        initial={prefersReducedMotion ? { scale: 1 } : { scale: 0.5 }}
        animate={{ scale: 1 }}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, delay: index * 0.08 + 0.2, type: "spring" }}
      >
        <AnimatedNumber
          value={stage.count}
          duration={800}
          formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
        />
      </motion.span>
      <span className="text-xs font-medium whitespace-nowrap mt-1">{stage.label}</span>

      {/* Percentage badge - visible on mobile, brighter on hover */}
      <div className={cn(
        "absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-lg opacity-70 group-hover:opacity-100 group-active:opacity-100 transition-all duration-300 bg-gradient-to-br",
        colors.accent
      )}>
        {percentage}%
      </div>
    </motion.button>
  )
}

function PipelineStageItemVertical({
  stage,
  index,
  total,
  onClick,
  isFirst,
  isLast,
  prefersReducedMotion = false,
}: PipelineStageItemProps) {
  const colors = stageColors[index % stageColors.length]
  const isClickable = !!onClick
  const percentage = total > 0 ? Math.round((stage.count / total) * 100) : 0

  return (
    <motion.button
      type="button"
      onClick={() => onClick?.(stage.id)}
      disabled={!isClickable}
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      whileHover={prefersReducedMotion ? undefined : { x: 4 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.99 }}
      className={cn(
        "group relative flex items-center justify-between px-4 py-4 w-full",
        "transition-all duration-300",
        colors.bg,
        colors.text,
        "border",
        colors.border,
        isFirst && "rounded-t-xl",
        isLast && "rounded-b-xl",
        isClickable && `cursor-pointer ${colors.glow} hover:shadow-lg`,
        !isClickable && "cursor-default"
      )}
      aria-label={`${stage.label}: ${stage.count} items`}
    >
      {/* Shine effect - visible on touch/active */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-500 pointer-events-none rounded-xl" />

      {/* Left accent bar - always visible, brighter on interaction */}
      <div className={cn(
        "absolute left-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-b opacity-50 group-hover:opacity-100 group-active:opacity-100 transition-all duration-300 rounded-r-full",
        colors.accent
      )} />

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium relative">{stage.label}</span>
        <span className="text-xs text-muted-foreground">({percentage}%)</span>
      </div>
      <span className="text-2xl font-bold tabular-nums relative">
        <AnimatedNumber
          value={stage.count}
          duration={800}
          formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }}
        />
      </span>
    </motion.button>
  )
}

function PipelineConnector({ index, prefersReducedMotion = false }: { index: number; prefersReducedMotion?: boolean }) {
  const colors = stageColors[index % stageColors.length]

  return (
    <motion.div
      className="flex items-center -mx-2 z-10 relative"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, delay: index * 0.08 + 0.3 }}
    >
      {/* Animated flow dots - disabled for reduced motion */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className={cn("absolute w-1.5 h-1.5 rounded-full bg-gradient-to-r will-change-transform", colors.accent)}
            animate={{
              x: [0, 16],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
              delay: index * 0.3,
            }}
            style={{ top: "50%", transform: "translateY(-50%)" }}
          />
        </div>
      )}

      <svg
        width="20"
        height="40"
        viewBox="0 0 20 40"
        fill="none"
        className="text-muted-foreground/40"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`connector-gradient-${index}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.5" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        <path
          d="M0 4 L14 20 L0 36"
          stroke={`url(#connector-gradient-${index})`}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  )
}

function PipelineConnectorVertical({ index, prefersReducedMotion = false }: { index: number; prefersReducedMotion?: boolean }) {
  return (
    <motion.div
      className="flex justify-center py-0 -my-px z-10 relative"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3, delay: index * 0.08 + 0.3 }}
    >
      {/* Animated flow dot - disabled for reduced motion */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 flex justify-center overflow-hidden">
          <motion.div
            className="absolute w-1.5 h-1.5 rounded-full bg-muted-foreground/50 will-change-transform"
            animate={{
              y: [0, 12],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "linear",
              delay: index * 0.3,
            }}
          />
        </div>
      )}

      <svg
        width="40"
        height="16"
        viewBox="0 0 40 16"
        fill="none"
        className="text-muted-foreground/40"
        aria-hidden="true"
      >
        <path
          d="M4 0 L20 12 L36 0"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.div>
  )
}

// Compact variant for smaller spaces
interface CompactPipelineViewProps {
  stages: PipelineStage[]
  onStageClick?: (stageId: string) => void
  className?: string
}

function CompactPipelineView({ stages, onStageClick, className }: CompactPipelineViewProps) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0)

  if (stages.length === 0 || total === 0) {
    return (
      <div className={cn("flex items-center justify-center p-2", className)}>
        <span className="text-xs text-muted-foreground">Geen data</span>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Stacked bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {stages.map((stage, index) => {
          const percentage = (stage.count / total) * 100
          if (percentage === 0) return null

          const bgColors = [
            "bg-slate-400 dark:bg-slate-500",
            "bg-blue-500 dark:bg-blue-400",
            "bg-amber-500 dark:bg-amber-400",
            "bg-emerald-500 dark:bg-emerald-400",
            "bg-purple-500 dark:bg-purple-400",
          ]

          return (
            <div
              key={stage.id}
              className={cn(
                "h-full transition-all duration-300",
                bgColors[index % bgColors.length],
                onStageClick && "cursor-pointer hover:brightness-110"
              )}
              style={{ width: `${percentage}%` }}
              onClick={() => onStageClick?.(stage.id)}
              role={onStageClick ? "button" : "presentation"}
              aria-label={`${stage.label}: ${stage.count}`}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {stages.map((stage, index) => {
          const bgColors = [
            "bg-slate-400 dark:bg-slate-500",
            "bg-blue-500 dark:bg-blue-400",
            "bg-amber-500 dark:bg-amber-400",
            "bg-emerald-500 dark:bg-emerald-400",
            "bg-purple-500 dark:bg-purple-400",
          ]

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onStageClick?.(stage.id)}
              disabled={!onStageClick}
              className={cn(
                "flex items-center gap-1.5",
                onStageClick && "cursor-pointer hover:opacity-80",
                !onStageClick && "cursor-default"
              )}
            >
              <div
                className={cn("h-2 w-2 rounded-full", bgColors[index % bgColors.length])}
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">{stage.label}</span>
              <span className="text-xs font-medium tabular-nums">{stage.count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { PipelineView, CompactPipelineView }
export type { PipelineViewProps, PipelineStage }
