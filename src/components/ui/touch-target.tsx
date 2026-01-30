import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

interface TouchTargetProps {
  children: React.ReactNode
  /** Use Radix Slot to merge props with child element */
  asChild?: boolean
  className?: string
}

/**
 * TouchTarget - Wrapper component that ensures minimum 44px touch targets on mobile
 *
 * This component provides WCAG 2.1 compliant touch targets for small interactive elements.
 * On mobile (< sm breakpoint), it enforces a minimum 44x44px touch area.
 * On desktop, it allows the natural size of the child element.
 *
 * @example
 * // Wrap small icons or links
 * <TouchTarget>
 *   <button className="size-6">
 *     <Icon />
 *   </button>
 * </TouchTarget>
 *
 * @example
 * // With asChild for Radix components
 * <TouchTarget asChild>
 *   <DropdownMenuTrigger>...</DropdownMenuTrigger>
 * </TouchTarget>
 */
function TouchTarget({
  children,
  asChild = false,
  className,
}: TouchTargetProps) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="touch-target"
      className={cn(
        // Ensure minimum touch area on mobile
        "relative inline-flex items-center justify-center",
        "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0",
        // Add touch target padding on mobile, remove on desktop
        "p-2 sm:p-0",
        // Negative margin to compensate for padding visually
        "-m-2 sm:m-0",
        className
      )}
    >
      {children}
    </Comp>
  )
}

/**
 * TouchTargetArea - Invisible expanded touch area overlay
 *
 * Alternative approach: instead of wrapping, this provides an invisible
 * expanded hit area that can be positioned over small interactive elements.
 *
 * @example
 * <div className="relative">
 *   <SmallButton />
 *   <TouchTargetArea />
 * </div>
 */
function TouchTargetArea({ className }: { className?: string }) {
  return (
    <span
      data-slot="touch-target-area"
      className={cn(
        "absolute inset-0",
        // Extend touch area to minimum 44px centered on the element
        "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0",
        "-translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2",
        // Only apply expansion on mobile
        "sm:translate-x-0 sm:translate-y-0 sm:left-0 sm:top-0 sm:inset-0",
        className
      )}
      aria-hidden="true"
    />
  )
}

export { TouchTarget, TouchTargetArea }
export type { TouchTargetProps }
