"use client";

import { useEffect, useRef, useReducer, useSyncExternalStore, useCallback } from "react";
import { cn } from "@/lib/utils";

interface HighlightOnChangeProps {
  value: unknown; // waarde om te watchen
  children: React.ReactNode;
  highlightClass?: string; // default: highlight-change class
  duration?: number; // ms, default 1000
  className?: string;
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
 * HighlightOnChange component
 *
 * Wraps children and applies a highlight animation when the watched value changes.
 *
 * Features:
 * - Watched value changes -> highlight children briefly
 * - CSS animation voor highlight effect
 * - Respecteert prefers-reduced-motion
 * - Nuttig voor totalen die updaten na input change
 */
export function HighlightOnChange({
  value,
  children,
  highlightClass = "highlight-change",
  duration = 1000,
  className,
}: HighlightOnChangeProps) {
  const [isHighlighted, dispatch] = useReducer(highlightReducer, false);
  const previousValueRef = useRef(value);
  const isFirstRenderRef = useRef(true);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Skip highlight on first render
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      previousValueRef.current = value;
      return;
    }

    // Check if value has actually changed
    const hasChanged = JSON.stringify(previousValueRef.current) !== JSON.stringify(value);
    previousValueRef.current = value;

    if (!hasChanged || prefersReducedMotion) {
      return;
    }

    // Trigger highlight
    dispatch({ type: "HIGHLIGHT" });
    const timer = setTimeout(() => dispatch({ type: "CLEAR" }), duration);

    return () => clearTimeout(timer);
  }, [value, duration, prefersReducedMotion]);

  return (
    <span
      className={cn(
        "inline-block rounded transition-colors",
        isHighlighted && highlightClass,
        className
      )}
    >
      {children}
    </span>
  );
}
