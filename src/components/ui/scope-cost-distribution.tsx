"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ScopeItem {
  scope: string
  cost: number
  percentage: number
}

interface ScopeCostDistributionProps {
  scopes: ScopeItem[]
  total: number
  className?: string
}

// Map scope names to CSS variable colors from globals.css
const scopeColorMap: Record<string, string> = {
  grondwerk: "bg-scope-grondwerk",
  bestrating: "bg-scope-bestrating",
  borders: "bg-scope-borders",
  gras: "bg-scope-gras",
  houtwerk: "bg-scope-houtwerk",
  water: "bg-scope-water",
  specials: "bg-scope-specials",
}

// Fallback colors for unknown scopes
const fallbackColors = [
  "bg-slate-500 dark:bg-slate-400",
  "bg-zinc-500 dark:bg-zinc-400",
  "bg-stone-500 dark:bg-stone-400",
  "bg-neutral-500 dark:bg-neutral-400",
]

function getScopeColor(scopeName: string, index: number): string {
  const normalizedName = scopeName.toLowerCase().trim()
  return scopeColorMap[normalizedName] || fallbackColors[index % fallbackColors.length]
}

// Map scope names to readable Dutch labels
const scopeLabelMap: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water: "Water",
  specials: "Specials",
}

function getScopeLabel(scopeName: string): string {
  const normalizedName = scopeName.toLowerCase().trim()
  return scopeLabelMap[normalizedName] || scopeName
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function ScopeCostDistribution({
  scopes,
  total,
  className,
}: ScopeCostDistributionProps) {
  // Sort by cost descending
  const sortedScopes = React.useMemo(
    () => [...scopes].sort((a, b) => b.cost - a.cost),
    [scopes]
  )

  // Find max cost for relative bar widths
  const maxCost = React.useMemo(
    () => Math.max(...sortedScopes.map((s) => s.cost), 1),
    [sortedScopes]
  )

  if (sortedScopes.length === 0) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <span className="text-sm text-muted-foreground">Geen scope data</span>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Scope list with bars */}
      <div className="flex flex-col gap-2">
        {sortedScopes.map((item, index) => {
          const barWidth = (item.cost / maxCost) * 100
          const colorClass = getScopeColor(item.scope, index)

          return (
            <div key={item.scope} className="flex flex-col gap-1">
              {/* Label row */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={cn("h-3 w-3 rounded-sm shrink-0", colorClass)}
                    aria-hidden="true"
                  />
                  <span className="font-medium">{getScopeLabel(item.scope)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {item.percentage.toFixed(1)}%
                  </span>
                  <span className="font-medium tabular-nums min-w-[80px] text-right">
                    {formatCurrency(item.cost)}
                  </span>
                </div>
              </div>

              {/* Bar */}
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500 ease-out",
                    colorClass
                  )}
                  style={{ width: `${barWidth}%` }}
                  role="progressbar"
                  aria-valuenow={item.cost}
                  aria-valuemin={0}
                  aria-valuemax={maxCost}
                  aria-label={`${getScopeLabel(item.scope)}: ${formatCurrency(item.cost)}`}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between border-t pt-3">
        <span className="font-semibold">Totaal</span>
        <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}

// Compact variant showing just stacked bar
interface CompactScopeCostDistributionProps {
  scopes: ScopeItem[]
  className?: string
  showLegend?: boolean
}

function CompactScopeCostDistribution({
  scopes,
  className,
  showLegend = true,
}: CompactScopeCostDistributionProps) {
  // Sort by cost descending
  const sortedScopes = React.useMemo(
    () => [...scopes].sort((a, b) => b.cost - a.cost),
    [scopes]
  )

  const totalPercentage = sortedScopes.reduce((sum, s) => sum + s.percentage, 0)

  if (sortedScopes.length === 0 || totalPercentage === 0) {
    return (
      <div className={cn("flex items-center justify-center p-2", className)}>
        <span className="text-xs text-muted-foreground">Geen data</span>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Stacked bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {sortedScopes.map((item, index) => {
          if (item.percentage === 0) return null
          const colorClass = getScopeColor(item.scope, index)

          return (
            <div
              key={item.scope}
              className={cn("h-full transition-all duration-300", colorClass)}
              style={{ width: `${item.percentage}%` }}
              role="presentation"
              aria-label={`${getScopeLabel(item.scope)}: ${item.percentage.toFixed(1)}%`}
            />
          )
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {sortedScopes.map((item, index) => {
            const colorClass = getScopeColor(item.scope, index)

            return (
              <div key={item.scope} className="flex items-center gap-1.5">
                <div
                  className={cn("h-2 w-2 rounded-full", colorClass)}
                  aria-hidden="true"
                />
                <span className="text-xs text-muted-foreground">
                  {getScopeLabel(item.scope)}
                </span>
                <span className="text-xs font-medium tabular-nums">
                  {item.percentage.toFixed(0)}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { ScopeCostDistribution, CompactScopeCostDistribution }
export type { ScopeCostDistributionProps, ScopeItem }
