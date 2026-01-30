"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createFocusTrap,
  announceToScreenReader,
  prefersReducedMotion,
  KEYBOARD_KEYS,
} from "@/lib/accessibility";

/**
 * Hook for managing focus trap in modals/dialogs
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trapRef = useRef<ReturnType<typeof createFocusTrap> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (isActive) {
      trapRef.current = createFocusTrap(containerRef.current);
      trapRef.current.activate();
    }

    return () => {
      trapRef.current?.deactivate();
    };
  }, [isActive]);

  return containerRef;
}

/**
 * Hook for announcing messages to screen readers
 * Automatically cleans up announcements on unmount
 */
export function useAnnounce() {
  const cleanupRef = useRef<(() => void) | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const announce = useCallback(
    (message: string, priority: "polite" | "assertive" = "polite") => {
      // Cancel any pending announcement
      cleanupRef.current?.();
      // Start new announcement and store cleanup
      cleanupRef.current = announceToScreenReader(message, priority);
    },
    []
  );

  return announce;
}

/**
 * Hook for keyboard navigation in lists/menus
 * Uses a ref for items to avoid dependency array issues with changing arrays
 */
export function useRovingFocus<T extends HTMLElement>(
  items: T[],
  options: {
    orientation?: "horizontal" | "vertical" | "both";
    loop?: boolean;
    onSelect?: (index: number) => void;
  } = {}
) {
  const { orientation = "vertical", loop = true, onSelect } = options;
  const [activeIndex, setActiveIndex] = useState(0);

  // Use ref for items to avoid dependency issues
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Also ref for onSelect to avoid recreating callback
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const { key } = event;
      const currentItems = itemsRef.current;
      let newIndex = activeIndex;

      const isVertical = orientation === "vertical" || orientation === "both";
      const isHorizontal =
        orientation === "horizontal" || orientation === "both";

      if (isVertical && key === KEYBOARD_KEYS.ARROW_DOWN) {
        event.preventDefault();
        newIndex = activeIndex + 1;
      } else if (isVertical && key === KEYBOARD_KEYS.ARROW_UP) {
        event.preventDefault();
        newIndex = activeIndex - 1;
      } else if (isHorizontal && key === KEYBOARD_KEYS.ARROW_RIGHT) {
        event.preventDefault();
        newIndex = activeIndex + 1;
      } else if (isHorizontal && key === KEYBOARD_KEYS.ARROW_LEFT) {
        event.preventDefault();
        newIndex = activeIndex - 1;
      } else if (key === KEYBOARD_KEYS.HOME) {
        event.preventDefault();
        newIndex = 0;
      } else if (key === KEYBOARD_KEYS.END) {
        event.preventDefault();
        newIndex = currentItems.length - 1;
      } else if (
        key === KEYBOARD_KEYS.ENTER ||
        key === KEYBOARD_KEYS.SPACE
      ) {
        event.preventDefault();
        onSelectRef.current?.(activeIndex);
        return;
      }

      // Handle bounds
      if (loop) {
        if (newIndex < 0) newIndex = currentItems.length - 1;
        if (newIndex >= currentItems.length) newIndex = 0;
      } else {
        newIndex = Math.max(0, Math.min(currentItems.length - 1, newIndex));
      }

      if (newIndex !== activeIndex) {
        setActiveIndex(newIndex);
        currentItems[newIndex]?.focus();
      }
    },
    [activeIndex, loop, orientation]
  );

  return {
    activeIndex,
    setActiveIndex,
    handleKeyDown,
    getTabIndex: (index: number) => (index === activeIndex ? 0 : -1),
  };
}

/**
 * Hook for detecting reduced motion preference
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setReducedMotion(prefersReducedMotion());

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return reducedMotion;
}

/**
 * Hook for managing escape key to close modals/dialogs
 */
export function useEscapeKey(callback: () => void, isEnabled: boolean = true) {
  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYBOARD_KEYS.ESCAPE) {
        event.preventDefault();
        callback();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [callback, isEnabled]);
}

/**
 * Hook for managing focus return after modal closes
 */
export function useFocusReturn() {
  const triggerRef = useRef<HTMLElement | null>(null);

  const saveTrigger = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement;
  }, []);

  const returnFocus = useCallback(() => {
    triggerRef.current?.focus();
  }, []);

  return { saveTrigger, returnFocus };
}

/**
 * Hook for skip links (skip to main content)
 */
export function useSkipLink(targetId: string) {
  const handleSkip = useCallback(() => {
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute("tabindex", "-1");
      target.focus();
      target.removeAttribute("tabindex");
    }
  }, [targetId]);

  return handleSkip;
}
