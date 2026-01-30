"use client";

import { useEffect, useRef, useSyncExternalStore, useCallback, useReducer } from "react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  duration?: number; // ms, default 500
  formatOptions?: Intl.NumberFormatOptions;
  locale?: string; // default 'nl-NL'
  prefix?: string; // bijv '€'
  suffix?: string; // bijv 'm²'
  className?: string;
}

/**
 * Ease-out cubic easing function
 * Starts fast and slows down at the end
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
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

// Reducer for animation state - avoids direct setState in effects
type AnimationAction = { type: "SET_VALUE"; payload: number };
function animationReducer(state: number, action: AnimationAction): number {
  switch (action.type) {
    case "SET_VALUE":
      return action.payload;
    default:
      return state;
  }
}

/**
 * AnimatedNumber component
 *
 * Features:
 * - Count-up/down animatie van oude naar nieuwe waarde
 * - Ease-out easing functie voor natural feel
 * - Respecteert prefers-reduced-motion
 * - Nederlandse number formatting (default)
 * - Smooth transitions met requestAnimationFrame
 */
export function AnimatedNumber({
  value,
  duration = 500,
  formatOptions,
  locale = "nl-NL",
  prefix = "",
  suffix = "",
  className,
}: AnimatedNumberProps) {
  const [displayValue, dispatch] = useReducer(animationReducer, value);
  const previousValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Default format options for Dutch number formatting
  const defaultFormatOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  const mergedFormatOptions = { ...defaultFormatOptions, ...formatOptions };

  useEffect(() => {
    const startValue = previousValueRef.current;
    const endValue = value;

    // Update previous value ref for next animation
    previousValueRef.current = value;

    // If reduced motion is preferred or no change, set value immediately
    if (prefersReducedMotion || startValue === endValue) {
      dispatch({ type: "SET_VALUE", payload: endValue });
      return;
    }

    // Cancel any existing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    const startTime = performance.now();
    const difference = endValue - startValue;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);

      const currentValue = startValue + difference * easedProgress;
      dispatch({ type: "SET_VALUE", payload: currentValue });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        dispatch({ type: "SET_VALUE", payload: endValue });
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration, prefersReducedMotion]);

  const formattedValue = new Intl.NumberFormat(locale, mergedFormatOptions).format(
    displayValue
  );

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {formattedValue}
      {suffix}
    </span>
  );
}
