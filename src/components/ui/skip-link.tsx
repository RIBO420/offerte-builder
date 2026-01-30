"use client";

import { cn } from "@/lib/utils";

interface SkipLinkProps {
  href?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Skip link component for keyboard navigation
 * Allows users to skip directly to main content
 */
export function SkipLink({
  href = "#main-content",
  className,
  children = "Ga naar hoofdinhoud",
}: SkipLinkProps) {
  return (
    <a
      data-slot="skip-link"
      href={href}
      className={cn(
        // Hidden by default, visible on focus
        "sr-only focus:not-sr-only",
        // Positioning
        "fixed left-4 top-4 z-[100]",
        // Styling when visible
        "focus:block focus:rounded-md focus:bg-primary focus:px-4 focus:py-2",
        "focus:text-primary-foreground focus:shadow-lg",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Animation
        "transition-all",
        className
      )}
    >
      {children}
    </a>
  );
}
