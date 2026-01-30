"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"
import { useLongPress } from "@/hooks/use-long-press"

interface MenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: "default" | "destructive"
  disabled?: boolean
}

interface LongPressMenuProps {
  children: React.ReactNode
  items: MenuItem[]
  delay?: number // ms, default 500
  disabled?: boolean
  className?: string
  enableRightClick?: boolean // Desktop right-click fallback, default true
}

interface MenuPosition {
  x: number
  y: number
}

function LongPressMenu({
  children,
  items,
  delay = 500,
  disabled = false,
  className,
  enableRightClick = true,
}: LongPressMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [menuPosition, setMenuPosition] = React.useState<MenuPosition>({ x: 0, y: 0 })
  const menuRef = React.useRef<HTMLDivElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false)

  // Ensure portal only renders on client
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const handleLongPress = React.useCallback(
    (_event: TouchEvent | MouseEvent, position: { x: number; y: number }) => {
      if (disabled || items.length === 0) return

      setMenuPosition(position)
      setIsOpen(true)
    },
    [disabled, items.length]
  )

  const handlePress = React.useCallback(() => {
    // Regular tap/click - do nothing special, let normal click handlers work
  }, [])

  const longPressProps = useLongPress({
    delay,
    onLongPress: handleLongPress,
    onPress: handlePress,
    threshold: 10,
  })

  const closeMenu = React.useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleItemClick = React.useCallback(
    (item: MenuItem) => {
      if (item.disabled) return
      closeMenu()
      // Small delay to allow menu close animation
      requestAnimationFrame(() => {
        item.onClick()
      })
    },
    [closeMenu]
  )

  // Close menu when clicking outside or pressing escape
  React.useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMenu()
      }
    }

    // Use setTimeout to avoid immediately closing from the same touch event
    const timeoutId = setTimeout(() => {
      document.addEventListener("touchstart", handleClickOutside, { passive: true })
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscape)
    }, 0)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener("touchstart", handleClickOutside)
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, closeMenu])

  // Adjust menu position to stay within viewport
  const adjustedPosition = React.useMemo(() => {
    if (!isOpen || !mounted) return menuPosition

    const menuWidth = 200 // Approximate menu width
    const menuHeight = items.length * 48 + 16 // Approximate height
    const padding = 8

    let { x, y } = menuPosition

    // Adjust horizontal position
    if (typeof window !== "undefined") {
      if (x + menuWidth > window.innerWidth - padding) {
        x = window.innerWidth - menuWidth - padding
      }
      if (x < padding) {
        x = padding
      }

      // Adjust vertical position
      if (y + menuHeight > window.innerHeight - padding) {
        y = window.innerHeight - menuHeight - padding
      }
      if (y < padding) {
        y = padding
      }
    }

    return { x, y }
  }, [isOpen, mounted, menuPosition, items.length])

  // Don't apply long press handlers if disabled
  const handlers = disabled
    ? {}
    : {
        onTouchStart: longPressProps.onTouchStart,
        onTouchEnd: longPressProps.onTouchEnd,
        onTouchMove: longPressProps.onTouchMove,
        onMouseDown: longPressProps.onMouseDown,
        onMouseUp: longPressProps.onMouseUp,
        onMouseLeave: longPressProps.onMouseLeave,
        ...(enableRightClick && { onContextMenu: longPressProps.onContextMenu }),
      }

  return (
    <>
      <div
        ref={containerRef}
        data-slot="long-press-container"
        className={cn(
          "relative select-none",
          // Visual feedback during long press
          longPressProps.isPressed && !disabled && "scale-[0.98] transition-transform",
          className
        )}
        {...handlers}
      >
        {/* Progress indicator during long press */}
        {longPressProps.isPressed && !disabled && longPressProps.progress > 0 && (
          <div
            data-slot="long-press-progress"
            className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]"
          >
            <div
              className="absolute inset-0 bg-foreground/5"
              style={{
                clipPath: `inset(0 ${100 - longPressProps.progress * 100}% 0 0)`,
              }}
            />
            {/* Radial progress indicator at touch point */}
            <svg
              className="absolute pointer-events-none"
              style={{
                left: (containerRef.current?.getBoundingClientRect().left ?? 0) > 0
                  ? "50%"
                  : "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 48,
                height: 48,
              }}
            >
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-primary/30"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 20}
                strokeDashoffset={2 * Math.PI * 20 * (1 - longPressProps.progress)}
                className="text-primary transition-[stroke-dashoffset] duration-75"
                style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
              />
            </svg>
          </div>
        )}

        {children}
      </div>

      {/* Menu portal */}
      {mounted &&
        isOpen &&
        createPortal(
          <>
            {/* Backdrop */}
            <div
              data-slot="long-press-menu-backdrop"
              className="fixed inset-0 z-50 bg-black/20 animate-in fade-in-0 duration-150"
              onClick={closeMenu}
              onTouchStart={closeMenu}
            />

            {/* Menu */}
            <div
              ref={menuRef}
              data-slot="long-press-menu"
              role="menu"
              aria-label="Context menu"
              className={cn(
                "fixed z-50 min-w-[180px] max-w-[280px]",
                "bg-popover text-popover-foreground",
                "rounded-lg border shadow-lg",
                "p-1",
                "animate-in fade-in-0 zoom-in-95 duration-150",
                // Safe area padding
                "pb-[max(0.25rem,env(safe-area-inset-bottom))]"
              )}
              style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y,
              }}
            >
              {items.map((item, index) => (
                <button
                  key={index}
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-md px-3 py-3",
                    "min-h-[44px]", // Touch-friendly target size
                    "text-sm font-medium text-left",
                    "transition-colors duration-100",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    // Default variant
                    item.variant !== "destructive" && [
                      "text-foreground",
                      "hover:bg-accent hover:text-accent-foreground",
                      "active:bg-accent/80",
                    ],
                    // Destructive variant
                    item.variant === "destructive" && [
                      "text-destructive",
                      "hover:bg-destructive/10 hover:text-destructive",
                      "active:bg-destructive/20",
                    ],
                    // Disabled state
                    item.disabled && "pointer-events-none opacity-50"
                  )}
                >
                  {item.icon && (
                    <span
                      className={cn(
                        "[&_svg]:size-5",
                        item.variant === "destructive"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="flex-1">{item.label}</span>
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  )
}

export { LongPressMenu }
export type { LongPressMenuProps, MenuItem }
