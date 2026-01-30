"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

import { cn } from "@/lib/utils"

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  children: React.ReactNode
  snapPoints?: number[] // percentages like [0.5, 0.9]
  className?: string
}

function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  snapPoints = [0.5, 0.9],
  className,
}: BottomSheetProps) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [currentSnapIndex, setCurrentSnapIndex] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragOffset, setDragOffset] = React.useState(0)
  const startY = React.useRef(0)
  const startHeight = React.useRef(0)

  // Reset state when opening
  React.useEffect(() => {
    if (open) {
      setCurrentSnapIndex(0)
      setDragOffset(0)
    }
  }, [open])

  const currentHeight = snapPoints[currentSnapIndex] * 100

  const handleTouchStart = React.useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true)
      startY.current = e.touches[0].clientY
      startHeight.current = snapPoints[currentSnapIndex] * window.innerHeight
    },
    [currentSnapIndex, snapPoints]
  )

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return

      const currentY = e.touches[0].clientY
      const diff = currentY - startY.current
      setDragOffset(diff)
    },
    [isDragging]
  )

  const handleTouchEnd = React.useCallback(() => {
    if (!isDragging) return

    setIsDragging(false)
    const threshold = 50 // px threshold for snap change

    if (dragOffset > threshold) {
      // Swiping down
      if (currentSnapIndex === 0) {
        // Close the sheet
        onOpenChange(false)
      } else {
        // Go to smaller snap point
        setCurrentSnapIndex((prev) => Math.max(0, prev - 1))
      }
    } else if (dragOffset < -threshold) {
      // Swiping up - go to larger snap point
      setCurrentSnapIndex((prev) => Math.min(snapPoints.length - 1, prev + 1))
    }

    setDragOffset(0)
  }, [isDragging, dragOffset, currentSnapIndex, snapPoints.length, onOpenChange])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="bottom-sheet-overlay"
          className={cn(
            "fixed inset-0 z-50 bg-black/50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          ref={contentRef}
          data-slot="bottom-sheet-content"
          aria-describedby={description ? undefined : undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50",
            "bg-background rounded-t-2xl border-t shadow-lg",
            "flex flex-col",
            "outline-none",
            // Safe area padding for home indicator
            "pb-[env(safe-area-inset-bottom)]",
            // Animation
            !isDragging && [
              "transition-all duration-300 ease-out",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
            ],
            className
          )}
          style={{
            height: `${currentHeight}vh`,
            transform: isDragging ? `translateY(${Math.max(0, dragOffset)}px)` : undefined,
            maxHeight: "90vh",
          }}
        >
          {/* Drag Handle */}
          <div
            data-slot="bottom-sheet-handle"
            className="flex-shrink-0 flex items-center justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            role="slider"
            aria-label="Versleep om de hoogte aan te passen of sluit door naar beneden te vegen"
            aria-valuemin={0}
            aria-valuemax={snapPoints.length - 1}
            aria-valuenow={currentSnapIndex}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault()
                setCurrentSnapIndex((prev) => Math.min(snapPoints.length - 1, prev + 1))
              } else if (e.key === "ArrowDown") {
                e.preventDefault()
                if (currentSnapIndex === 0) {
                  onOpenChange(false)
                } else {
                  setCurrentSnapIndex((prev) => Math.max(0, prev - 1))
                }
              } else if (e.key === "Escape") {
                onOpenChange(false)
              }
            }}
          >
            <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
          </div>

          {/* Header */}
          {(title || description) && (
            <div
              data-slot="bottom-sheet-header"
              className="flex-shrink-0 px-4 pb-4 border-b"
            >
              {title && (
                <DialogPrimitive.Title
                  data-slot="bottom-sheet-title"
                  className="text-lg font-semibold text-foreground"
                >
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description
                  data-slot="bottom-sheet-description"
                  className="text-sm text-muted-foreground mt-1"
                >
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
          )}

          {/* Content */}
          <div
            data-slot="bottom-sheet-body"
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
          >
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// Compound components for more flexibility
function BottomSheetTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="bottom-sheet-trigger" {...props} />
}

function BottomSheetClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="bottom-sheet-close" {...props} />
}

export { BottomSheet, BottomSheetTrigger, BottomSheetClose }
export type { BottomSheetProps }
