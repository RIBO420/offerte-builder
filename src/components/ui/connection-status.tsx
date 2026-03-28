"use client";

import * as React from "react";
import { useConvexConnectionState } from "convex/react";
import { WifiOff, Wifi } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Monitors the Convex real-time WebSocket connection and shows
 * an unobtrusive banner only when the connection is lost.
 *
 * - Amber banner while disconnected
 * - Brief green banner when the connection is restored
 * - Hidden during normal connected operation
 */
function ConnectionStatus({ className }: { className?: string }) {
  const connectionState = useConvexConnectionState();
  const { isWebSocketConnected, hasEverConnected } = connectionState;

  const [showReconnected, setShowReconnected] = React.useState(false);
  const wasDisconnectedRef = React.useRef(false);
  const dismissTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  React.useEffect(() => {
    if (!isWebSocketConnected && hasEverConnected) {
      // We were connected before but lost the connection
      wasDisconnectedRef.current = true;
    }

    if (isWebSocketConnected && wasDisconnectedRef.current) {
      // Connection restored after a disconnection
      wasDisconnectedRef.current = false;
      setShowReconnected(true);

      dismissTimerRef.current = setTimeout(() => {
        setShowReconnected(false);
      }, 3000);
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [isWebSocketConnected, hasEverConnected]);

  // During initial connection (never connected yet), don't show anything —
  // let the app's own loading states handle that.
  if (!hasEverConnected) return null;

  // Normal connected state — nothing to show
  if (isWebSocketConnected && !showReconnected) return null;

  const isDisconnected = !isWebSocketConnected;

  return (
    <div
      data-slot="connection-status"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(
        "fixed left-0 right-0 z-[60] top-0",
        "pt-[env(safe-area-inset-top)]",
        // Animate in
        "animate-in slide-in-from-top duration-300",
        // Animate out when reconnected (will be removed after timer)
        showReconnected && "animate-out fade-out duration-500 delay-2500 fill-mode-forwards",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center gap-2",
          "px-4 py-2.5",
          "text-sm font-medium",
          "transition-colors duration-300",
          // Disconnected: amber/warning
          isDisconnected && [
            "bg-amber-500 text-amber-950",
            "dark:bg-amber-600 dark:text-amber-50",
          ],
          // Reconnected: green/success
          showReconnected && [
            "bg-emerald-500 text-emerald-950",
            "dark:bg-emerald-600 dark:text-emerald-50",
          ]
        )}
      >
        {/* Icon */}
        {isDisconnected ? (
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <Wifi className="size-4 shrink-0" aria-hidden="true" />
        )}

        {/* Message */}
        <span>
          {showReconnected
            ? "Verbinding hersteld"
            : "Geen internetverbinding. Wijzigingen worden opgeslagen zodra je weer online bent."}
        </span>
      </div>
    </div>
  );
}

export { ConnectionStatus };
