"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

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

const defaultColors = [
  "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
  "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
  "bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300",
  "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
  "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
]

function PipelineView({ stages, onStageClick, className }: PipelineViewProps) {
  if (stages.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <span className="text-sm text-muted-foreground">Geen stages</span>
      </div>
    )
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop: Horizontal layout */}
      <div className="hidden md:flex items-center gap-0">
        {stages.map((stage, index) => (
          <React.Fragment key={stage.id}>
            <PipelineStageItem
              stage={stage}
              index={index}
              onClick={onStageClick}
              isFirst={index === 0}
              isLast={index === stages.length - 1}
            />
            {index < stages.length - 1 && (
              <PipelineConnector />
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
              onClick={onStageClick}
              isFirst={index === 0}
              isLast={index === stages.length - 1}
            />
            {index < stages.length - 1 && (
              <PipelineConnectorVertical />
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
  onClick?: (stageId: string) => void
  isFirst: boolean
  isLast: boolean
}

function PipelineStageItem({
  stage,
  index,
  onClick,
  isFirst,
  isLast,
}: PipelineStageItemProps) {
  const colorClass = stage.color || defaultColors[index % defaultColors.length]
  const isClickable = !!onClick

  return (
    <button
      type="button"
      onClick={() => onClick?.(stage.id)}
      disabled={!isClickable}
      className={cn(
        "relative flex flex-col items-center justify-center px-6 py-3 min-w-[120px]",
        "transition-all duration-200",
        colorClass,
        isFirst && "rounded-l-lg",
        isLast && "rounded-r-lg",
        isClickable && "cursor-pointer hover:brightness-95 dark:hover:brightness-110 active:scale-[0.98]",
        !isClickable && "cursor-default"
      )}
      aria-label={`${stage.label}: ${stage.count} items`}
    >
      <span className="text-2xl font-bold tabular-nums">{stage.count}</span>
      <span className="text-xs font-medium whitespace-nowrap">{stage.label}</span>
    </button>
  )
}

function PipelineStageItemVertical({
  stage,
  index,
  onClick,
  isFirst,
  isLast,
}: PipelineStageItemProps) {
  const colorClass = stage.color || defaultColors[index % defaultColors.length]
  const isClickable = !!onClick

  return (
    <button
      type="button"
      onClick={() => onClick?.(stage.id)}
      disabled={!isClickable}
      className={cn(
        "relative flex items-center justify-between px-4 py-3 w-full",
        "transition-all duration-200",
        colorClass,
        isFirst && "rounded-t-lg",
        isLast && "rounded-b-lg",
        isClickable && "cursor-pointer hover:brightness-95 dark:hover:brightness-110 active:scale-[0.99]",
        !isClickable && "cursor-default"
      )}
      aria-label={`${stage.label}: ${stage.count} items`}
    >
      <span className="text-sm font-medium">{stage.label}</span>
      <span className="text-xl font-bold tabular-nums">{stage.count}</span>
    </button>
  )
}

function PipelineConnector() {
  return (
    <div className="flex items-center -mx-1 z-10">
      <svg
        width="16"
        height="32"
        viewBox="0 0 16 32"
        fill="none"
        className="text-muted-foreground/30"
        aria-hidden="true"
      >
        <path
          d="M0 0 L12 16 L0 32"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
      </svg>
    </div>
  )
}

function PipelineConnectorVertical() {
  return (
    <div className="flex justify-center py-0 -my-px z-10">
      <svg
        width="32"
        height="12"
        viewBox="0 0 32 12"
        fill="none"
        className="text-muted-foreground/30"
        aria-hidden="true"
      >
        <path
          d="M0 0 L16 8 L32 0"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
        />
      </svg>
    </div>
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
