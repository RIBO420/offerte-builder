"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface SwipeAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "default" | "destructive"
}

interface SwipeableRowProps {
  children: React.ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  threshold?: number // px to trigger action
  className?: string
}

function SwipeableRow({
  children,
  leftActions = [],
  rightActions = [],
  threshold = 80,
  className,
}: SwipeableRowProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [translateX, setTranslateX] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const startX = React.useRef(0)
  const startTranslateX = React.useRef(0)

  // Calculate max swipe distances based on action button widths
  const leftActionsWidth = leftActions.length * 72 // 72px per action button
  const rightActionsWidth = rightActions.length * 72

  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    setIsDragging(true)
    startX.current = e.touches[0].clientX
    startTranslateX.current = translateX
  }, [translateX])

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return

      const currentX = e.touches[0].clientX
      const diff = currentX - startX.current
      let newTranslateX = startTranslateX.current + diff

      // Limit swipe distance with resistance at edges
      if (newTranslateX > 0) {
        // Swiping right (revealing left actions)
        if (leftActions.length === 0) {
          newTranslateX = newTranslateX * 0.2 // Resistance when no left actions
        } else {
          newTranslateX = Math.min(newTranslateX, leftActionsWidth + 20)
        }
      } else {
        // Swiping left (revealing right actions)
        if (rightActions.length === 0) {
          newTranslateX = newTranslateX * 0.2 // Resistance when no right actions
        } else {
          newTranslateX = Math.max(newTranslateX, -(rightActionsWidth + 20))
        }
      }

      setTranslateX(newTranslateX)
    },
    [isDragging, leftActions.length, rightActions.length, leftActionsWidth, rightActionsWidth]
  )

  const handleTouchEnd = React.useCallback(() => {
    if (!isDragging) return

    setIsDragging(false)

    // Determine final position based on threshold
    if (translateX > threshold && leftActions.length > 0) {
      // Snap to reveal left actions
      setTranslateX(leftActionsWidth)
    } else if (translateX < -threshold && rightActions.length > 0) {
      // Snap to reveal right actions
      setTranslateX(-rightActionsWidth)
    } else {
      // Spring back to center
      setTranslateX(0)
    }
  }, [isDragging, translateX, threshold, leftActions.length, rightActions.length, leftActionsWidth, rightActionsWidth])

  const handleActionClick = React.useCallback((action: SwipeAction) => {
    action.onClick()
    // Reset position after action
    setTranslateX(0)
  }, [])

  // Keyboard handler for accessibility
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    // Delete or Backspace reveals right actions (typically delete)
    if ((e.key === "Delete" || e.key === "Backspace") && rightActions.length > 0) {
      e.preventDefault()
      if (translateX === -rightActionsWidth) {
        // If already revealed, trigger the first right action
        rightActions[0].onClick()
        setTranslateX(0)
      } else {
        // Reveal right actions
        setTranslateX(-rightActionsWidth)
      }
    }
    // Enter reveals left actions (typically edit/confirm)
    else if (e.key === "Enter" && leftActions.length > 0) {
      e.preventDefault()
      if (translateX === leftActionsWidth) {
        // If already revealed, trigger the first left action
        leftActions[0].onClick()
        setTranslateX(0)
      } else {
        // Reveal left actions
        setTranslateX(leftActionsWidth)
      }
    }
    // Escape closes any revealed actions
    else if (e.key === "Escape" && translateX !== 0) {
      e.preventDefault()
      setTranslateX(0)
    }
  }, [leftActions, rightActions, translateX, leftActionsWidth, rightActionsWidth])

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setTranslateX(0)
      }
    }

    if (translateX !== 0) {
      document.addEventListener("touchstart", handleClickOutside)
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [translateX])

  return (
    <div
      ref={containerRef}
      data-slot="swipeable-row"
      className={cn("relative overflow-hidden", className)}
    >
      {/* Left Actions (revealed when swiping right) */}
      {leftActions.length > 0 && (
        <div
          data-slot="swipeable-row-left-actions"
          className="absolute inset-y-0 left-0 flex"
          style={{ width: leftActionsWidth }}
        >
          {leftActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              aria-label={action.label}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1",
                "min-h-[44px] min-w-[72px]", // Touch-friendly targets
                "text-xs font-medium transition-colors",
                action.variant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {action.icon && (
                <span className="[&_svg]:size-5">{action.icon}</span>
              )}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right Actions (revealed when swiping left) */}
      {rightActions.length > 0 && (
        <div
          data-slot="swipeable-row-right-actions"
          className="absolute inset-y-0 right-0 flex"
          style={{ width: rightActionsWidth }}
        >
          {rightActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              aria-label={action.label}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1",
                "min-h-[44px] min-w-[72px]", // Touch-friendly targets
                "text-xs font-medium transition-colors",
                action.variant === "destructive"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/90"
              )}
            >
              {action.icon && (
                <span className="[&_svg]:size-5">{action.icon}</span>
              )}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div
        data-slot="swipeable-row-content"
        className={cn(
          "relative bg-background",
          !isDragging && "transition-transform duration-300 ease-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="group"
        aria-label={`Swipeable rij${leftActions.length > 0 ? `, druk Enter voor ${leftActions.map(a => a.label).join(", ")}` : ""}${rightActions.length > 0 ? `, druk Delete voor ${rightActions.map(a => a.label).join(", ")}` : ""}`}
      >
        {children}
      </div>
    </div>
  )
}

export { SwipeableRow }
export type { SwipeableRowProps, SwipeAction }
