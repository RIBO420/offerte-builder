"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

interface FloatingActionBarProps {
  children: React.ReactNode
  position?: "bottom" | "top"
  className?: string
  /**
   * Whether to show the bar. Useful for conditional rendering with animation.
   * @default true
   */
  visible?: boolean
}

function FloatingActionBar({
  children,
  position = "bottom",
  className,
  visible = true,
}: FloatingActionBarProps) {
  const [mounted, setMounted] = React.useState(false)
  const [shouldRender, setShouldRender] = React.useState(visible)

  // Handle mount animation
  React.useEffect(() => {
    if (visible) {
      setShouldRender(true)
      // Small delay to ensure DOM is ready for animation
      const timer = setTimeout(() => setMounted(true), 10)
      return () => clearTimeout(timer)
    } else {
      setMounted(false)
      // Wait for exit animation before removing from DOM
      const timer = setTimeout(() => setShouldRender(false), 300)
      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!shouldRender) return null

  return (
    <div
      data-slot="floating-action-bar"
      role="toolbar"
      aria-label="Actiebalk"
      className={cn(
        "fixed left-0 right-0 z-40",
        // Position
        position === "bottom" && [
          "bottom-0",
          // Safe area padding for home indicator
          "pb-[env(safe-area-inset-bottom)]",
        ],
        position === "top" && [
          "top-0",
          // Safe area padding for notch
          "pt-[env(safe-area-inset-top)]",
        ],
        // Visual styling
        "bg-background/95 backdrop-blur-sm",
        "border-t border-border/50",
        position === "top" && "border-t-0 border-b border-border/50",
        "shadow-lg",
        // Animation
        "transition-transform duration-300 ease-out",
        mounted
          ? "translate-y-0"
          : position === "bottom"
            ? "translate-y-full"
            : "-translate-y-full",
        className
      )}
    >
      <div
        data-slot="floating-action-bar-content"
        className={cn(
          "flex items-center justify-center gap-2",
          "px-4 py-3",
          // Ensure minimum touch target height
          "min-h-[60px]"
        )}
      >
        {children}
      </div>
    </div>
  )
}

// Convenience component for common action button styling
interface FloatingActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost"
}

function FloatingActionButton({
  children,
  variant = "primary",
  className,
  ...props
}: FloatingActionButtonProps) {
  return (
    <button
      data-slot="floating-action-button"
      className={cn(
        // Base styles
        "inline-flex items-center justify-center gap-2",
        "rounded-full font-medium text-sm",
        "transition-all duration-200",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:pointer-events-none",
        // Minimum touch target
        "min-h-[44px] min-w-[44px] px-4",
        // Variants
        variant === "primary" && [
          "bg-primary text-primary-foreground",
          "hover:bg-primary/90 active:bg-primary/80",
          "shadow-md hover:shadow-lg",
        ],
        variant === "secondary" && [
          "bg-secondary text-secondary-foreground",
          "hover:bg-secondary/80 active:bg-secondary/70",
        ],
        variant === "ghost" && [
          "bg-transparent text-foreground",
          "hover:bg-accent hover:text-accent-foreground",
        ],
        // Icon styling
        "[&_svg]:size-5 [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export { FloatingActionBar, FloatingActionButton }
export type { FloatingActionBarProps, FloatingActionButtonProps }
