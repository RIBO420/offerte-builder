"use client";

import { useEffect, useRef, useReducer, useSyncExternalStore, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface PriceDisplayProps {
  amount: number;
  currency?: string;
  showDecimals?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "default" | "success" | "warning" | "muted";
  className?: string;
  animated?: boolean; // default false
  animationDuration?: number; // default 500ms
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg font-medium",
  xl: "text-2xl font-semibold",
} as const;

const variantClasses = {
  default: "text-foreground",
  success: "text-green-600 dark:text-green-400",
  warning: "text-amber-600 dark:text-amber-400",
  muted: "text-muted-foreground",
} as const;

/**
 * Formatteert een bedrag naar Nederlandse locale (1.234,56)
 */
function formatPrice(
  amount: number,
  currency: string,
  showDecimals: boolean
): string {
  const formatted = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(amount);

  return `${currency} ${formatted}`;
}

/**
 * Hook to check if user prefers reduced motion
 * Uses useSyncExternalStore for proper React 18+ pattern
 */
function usePrefersReducedMotion(): boolean {
  const subscribe = useCallback((callback: () => void) => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    mediaQuery.addEventListener("change", callback);
    return () => mediaQuery.removeEventListener("change", callback);
  }, []);

  const getSnapshot = useCallback(() => {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Reducer for highlight state - avoids direct setState in effects
type HighlightAction = { type: "HIGHLIGHT" } | { type: "CLEAR" };
function highlightReducer(state: boolean, action: HighlightAction): boolean {
  switch (action.type) {
    case "HIGHLIGHT":
      return true;
    case "CLEAR":
      return false;
    default:
      return state;
  }
}

/**
 * PriceDisplay component voor consistente prijsweergave
 *
 * Features:
 * - Gebruikt tabular-nums class voor alignment in tabellen/lijsten
 * - Nederlandse locale formatting (1.234,56)
 * - Kleur variants voor verschillende contexten
 * - Size variants met passende font-sizes
 * - Optionele animatie bij value changes
 * - Highlight effect bij animated mode
 */
export function PriceDisplay({
  amount,
  currency = "\u20AC",
  showDecimals = true,
  size = "md",
  variant = "default",
  className,
  animated = false,
  animationDuration = 500,
}: PriceDisplayProps) {
  const [isHighlighted, dispatch] = useReducer(highlightReducer, false);
  const previousAmountRef = useRef(amount);
  const isFirstRenderRef = useRef(true);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Highlight effect when value changes (only in animated mode)
  useEffect(() => {
    if (!animated || prefersReducedMotion) {
      previousAmountRef.current = amount;
      return;
    }

    // Skip highlight on first render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousAmountRef.current = amount;
      return;
    }

    // Check if value has actually changed
    if (previousAmountRef.current !== amount) {
      dispatch({ type: "HIGHLIGHT" });
      const timer = setTimeout(() => dispatch({ type: "CLEAR" }), 1000);
      previousAmountRef.current = amount;
      return () => clearTimeout(timer);
    }
  }, [amount, animated, prefersReducedMotion]);

  if (animated) {
    return (
      <span
        className={cn(
          "price-display inline-block rounded px-1 -mx-1",
          sizeClasses[size],
          variantClasses[variant],
          isHighlighted && "highlight-change value-updated",
          className
        )}
      >
        <AnimatedNumber
          value={amount}
          duration={animationDuration}
          prefix={`${currency} `}
          formatOptions={{
            minimumFractionDigits: showDecimals ? 2 : 0,
            maximumFractionDigits: showDecimals ? 2 : 0,
          }}
        />
      </span>
    );
  }

  const formattedPrice = formatPrice(amount, currency, showDecimals);

  return (
    <span
      className={cn(
        "price-display",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {formattedPrice}
    </span>
  );
}
