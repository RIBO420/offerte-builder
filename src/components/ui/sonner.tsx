"use client"

import { useSyncExternalStore } from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * Check if user prefers reduced motion using useSyncExternalStore
 * This is the recommended way to subscribe to browser APIs
 */
function usePrefersReducedMotion(): boolean {
  const getSnapshot = () => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  }

  const getServerSnapshot = () => false

  const subscribe = (callback: () => void) => {
    if (typeof window === "undefined") return () => {}
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    mediaQuery.addEventListener("change", callback)
    return () => mediaQuery.removeEventListener("change", callback)
  }

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * Accessible toast notifications with smooth animations.
 *
 * Animation features:
 * - Slide in from bottom-right
 * - Smooth exit animation
 * - Respects prefers-reduced-motion
 *
 * Accessibility features:
 * - Uses aria-live="polite" for non-urgent notifications
 * - Error toasts use role="alert" for assertive announcements
 * - Each toast has proper ARIA attributes for screen readers
 * - Dismiss buttons have accessible labels
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Position toasts at bottom-right for better UX
      position="bottom-right"
      // Animation settings - respect reduced motion
      duration={4000}
      visibleToasts={5}
      gap={12}
      icons={{
        success: <CircleCheckIcon className="size-4" aria-hidden="true" />,
        info: <InfoIcon className="size-4" aria-hidden="true" />,
        warning: <TriangleAlertIcon className="size-4" aria-hidden="true" />,
        error: <OctagonXIcon className="size-4" aria-hidden="true" />,
        loading: <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />,
      }}
      // Sonner automatically handles ARIA live regions
      // These props ensure proper accessibility:
      closeButton
      toastOptions={{
        classNames: {
          toast: [
            "group toast",
            // Animation classes
            "data-[state=entering]:animate-in",
            "data-[state=entering]:slide-in-from-right-full",
            "data-[state=entering]:fade-in-0",
            "data-[state=exiting]:animate-out",
            "data-[state=exiting]:slide-out-to-right-full",
            "data-[state=exiting]:fade-out-0",
            // Duration - faster for reduced motion
            prefersReducedMotion
              ? "data-[state=entering]:duration-0 data-[state=exiting]:duration-0"
              : "data-[state=entering]:duration-300 data-[state=exiting]:duration-200",
            // Easing
            "data-[state=entering]:ease-out",
            "data-[state=exiting]:ease-in",
          ].join(" "),
          closeButton: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          title: "font-medium",
          description: "text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground hover:bg-primary/90",
          cancelButton: "bg-muted text-muted-foreground hover:bg-muted/80",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Subtle shadow for depth
          "--shadow": "0 4px 20px -2px rgba(0, 0, 0, 0.12), 0 2px 8px -2px rgba(0, 0, 0, 0.08)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
