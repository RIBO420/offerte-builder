"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  showArea?: boolean
  className?: string
}

// Generate smooth bezier curve path
function generateSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ""
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  if (pts.length === 2) {
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`
  }

  let path = `M ${pts[0].x} ${pts[0].y}`

  for (let i = 0; i < pts.length - 1; i++) {
    const current = pts[i]
    const next = pts[i + 1]

    // Control point distance (tension)
    const tension = 0.3
    const dx = (next.x - current.x) * tension

    // Calculate control points
    const cp1x = current.x + dx
    const cp1y = current.y
    const cp2x = next.x - dx
    const cp2y = next.y

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`
  }

  return path
}

/**
 * Sparkline - Pure presentational SVG component
 * Memoized to prevent re-renders when parent updates
 */
const Sparkline = React.memo(function Sparkline({
  data,
  width = 100,
  height = 32,
  color = "currentColor",
  showArea = false,
  className,
}: SparklineProps) {
  // Generate unique ID for gradient
  const gradientId = React.useId()

  // Memoize expensive calculations
  const { linePath, areaPath, lastPoint } = React.useMemo(() => {
    if (!data || data.length === 0) {
      return { linePath: "", areaPath: "", lastPoint: null }
    }

    // Calculate min and max for scaling
    const minValue = Math.min(...data)
    const maxValue = Math.max(...data)
    const range = maxValue - minValue || 1 // Prevent division by zero

    // Padding to ensure the line doesn't touch edges
    const paddingY = 4
    const effectiveHeight = height - paddingY * 2

    // Calculate points
    const calculatedPoints = data.map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * width
      const y = paddingY + effectiveHeight - ((value - minValue) / range) * effectiveHeight
      return { x, y }
    })

    const calculatedLinePath = generateSmoothPath(calculatedPoints)

    // Generate area path (closed shape)
    const calculatedAreaPath = calculatedLinePath
      ? `${calculatedLinePath} L ${calculatedPoints[calculatedPoints.length - 1].x} ${height} L ${calculatedPoints[0].x} ${height} Z`
      : ""

    return {
      linePath: calculatedLinePath,
      areaPath: calculatedAreaPath,
      lastPoint: calculatedPoints[calculatedPoints.length - 1],
    }
  }, [data, width, height])

  // Return empty if no data
  if (!data || data.length === 0) {
    return null
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {showArea && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}

      {/* Area fill */}
      {showArea && areaPath && (
        <path
          d={areaPath}
          fill={`url(#${gradientId})`}
          stroke="none"
        />
      )}

      {/* Line */}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Last point highlight */}
      {lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  )
})

export { Sparkline }
export type { SparklineProps }
