"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface AccessibleLoadingProps {
  /** Loading message for screen readers */
  message?: string;
  /** Show visual spinner */
  showSpinner?: boolean;
  /** Additional class names */
  className?: string;
  /** Size of the spinner */
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

/**
 * Accessible loading component with screen reader support
 * Announces loading state to assistive technology
 */
export function AccessibleLoading({
  message = "Laden...",
  showSpinner = true,
  className,
  size = "md",
}: AccessibleLoadingProps) {
  return (
    <div
      data-slot="accessible-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn("flex items-center gap-2", className)}
    >
      {showSpinner && (
        <Loader2
          className={cn("animate-spin text-muted-foreground", sizeClasses[size])}
          aria-hidden="true"
        />
      )}
      <span className="sr-only">{message}</span>
    </div>
  );
}

/**
 * Full-page loading overlay with accessibility
 */
export function LoadingOverlay({
  message = "Laden...",
}: {
  message?: string;
}) {
  return (
    <div
      data-slot="loading-overlay"
      role="status"
      aria-live="assertive"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{message}</p>
        <span className="sr-only">{message}</span>
      </div>
    </div>
  );
}
