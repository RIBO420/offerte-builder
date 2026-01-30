"use client"

import * as React from "react"
import { WifiOff, Wifi } from "lucide-react"

import { cn } from "@/lib/utils"

interface OfflineIndicatorProps {
  className?: string
  /**
   * Position of the indicator banner
   * @default "top"
   */
  position?: "top" | "bottom"
  /**
   * Optional count of pending changes to display
   */
  pendingChanges?: number
  /**
   * Custom message to display when offline
   * @default "Je bent offline"
   */
  offlineMessage?: string
  /**
   * Whether to show a brief "back online" message when reconnecting
   * @default true
   */
  showReconnectMessage?: boolean
}

function OfflineIndicator({
  className,
  position = "top",
  pendingChanges,
  offlineMessage = "Je bent offline",
  showReconnectMessage = true,
}: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = React.useState(true)
  const [showReconnected, setShowReconnected] = React.useState(false)
  const wasOfflineRef = React.useRef(false)

  React.useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      // Show reconnected message if we were offline
      if (wasOfflineRef.current && showReconnectMessage) {
        setShowReconnected(true)
        // Hide after 3 seconds
        setTimeout(() => setShowReconnected(false), 3000)
      }
      wasOfflineRef.current = false
    }

    const handleOffline = () => {
      setIsOnline(false)
      wasOfflineRef.current = true
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [showReconnectMessage])

  // Don't render if online and not showing reconnected message
  if (isOnline && !showReconnected) return null

  return (
    <div
      data-slot="offline-indicator"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "fixed left-0 right-0 z-50",
        // Position
        position === "top" && [
          "top-0",
          "pt-[env(safe-area-inset-top)]",
        ],
        position === "bottom" && [
          "bottom-0",
          "pb-[env(safe-area-inset-bottom)]",
        ],
        // Animation
        "animate-in slide-in-from-top duration-300",
        position === "bottom" && "slide-in-from-bottom",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center gap-2",
          "px-4 py-2.5",
          "text-sm font-medium",
          "transition-colors duration-300",
          // Offline state: amber/warning colors
          !isOnline && [
            "bg-amber-500 text-amber-950",
            "dark:bg-amber-600 dark:text-amber-50",
          ],
          // Reconnected state: green/success colors
          showReconnected && [
            "bg-emerald-500 text-emerald-950",
            "dark:bg-emerald-600 dark:text-emerald-50",
          ]
        )}
      >
        {/* Icon */}
        {isOnline ? (
          <Wifi className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
        )}

        {/* Message */}
        <span>
          {showReconnected
            ? "Je bent weer online"
            : pendingChanges !== undefined && pendingChanges > 0
              ? `${offlineMessage} - ${pendingChanges} ${pendingChanges === 1 ? "wijziging wordt" : "wijzigingen worden"} opgeslagen wanneer je verbindt`
              : `${offlineMessage} - wijzigingen worden lokaal opgeslagen`}
        </span>

        {/* Visual indicator for pending changes */}
        {!isOnline && pendingChanges !== undefined && pendingChanges > 0 && (
          <span
            className={cn(
              "ml-1 inline-flex items-center justify-center",
              "min-w-[20px] h-5 px-1.5 rounded-full",
              "bg-amber-700/20 text-amber-950",
              "dark:bg-amber-900/30 dark:text-amber-50",
              "text-xs font-bold"
            )}
            aria-label={`${pendingChanges} openstaande ${pendingChanges === 1 ? "wijziging" : "wijzigingen"}`}
          >
            {pendingChanges}
          </span>
        )}
      </div>
    </div>
  )
}

// Hook for checking online status (can be used independently)
function useOnlineStatus() {
  const [isOnline, setIsOnline] = React.useState(true)

  React.useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return isOnline
}

export { OfflineIndicator, useOnlineStatus }
export type { OfflineIndicatorProps }
