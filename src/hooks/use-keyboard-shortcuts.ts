"use client";

import { useEffect, useCallback, useRef } from "react";

export interface Shortcut {
  key: string; // 'k', 'n', 'o', etc
  ctrl?: boolean;
  meta?: boolean; // Cmd on Mac
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description?: string;
  /** If true, the shortcut works even when focused in an input/textarea */
  allowInInput?: boolean;
}

/**
 * Checks if the current platform is Mac
 */
function isMac(): boolean {
  if (typeof window === "undefined") return false;
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

/**
 * Checks if the target element is an input, textarea, or contenteditable
 */
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea") return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Hook for registering global keyboard shortcuts
 * Supports both Ctrl (Windows/Linux) and Cmd (Mac)
 * Automatically ignores shortcuts when focus is in input/textarea
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  const shortcutsRef = useRef(shortcuts);

  // Update ref in effect to avoid lint warning about ref access during render
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const mac = isMac();

    for (const shortcut of shortcutsRef.current) {
      // Skip if focused in input and not allowed
      if (!shortcut.allowInInput && isInputElement(event.target)) {
        continue;
      }

      // Check the key (case insensitive)
      if (event.key.toLowerCase() !== shortcut.key.toLowerCase()) {
        continue;
      }

      // Check modifiers
      // For meta/ctrl: on Mac use metaKey, on Windows/Linux use ctrlKey
      const needsMainModifier = shortcut.meta || shortcut.ctrl;
      const hasMainModifier = mac ? event.metaKey : event.ctrlKey;

      if (needsMainModifier && !hasMainModifier) continue;
      if (!needsMainModifier && (event.metaKey || event.ctrlKey)) continue;

      if (shortcut.shift && !event.shiftKey) continue;
      if (!shortcut.shift && event.shiftKey) continue;

      if (shortcut.alt && !event.altKey) continue;
      if (!shortcut.alt && event.altKey) continue;

      // All conditions met, execute the action
      event.preventDefault();
      event.stopPropagation();
      shortcut.action();
      return;
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

/**
 * Returns the appropriate modifier key symbol based on the platform
 */
export function getModifierKey(): string {
  if (typeof window === "undefined") return "Ctrl";
  return isMac() ? "\u2318" : "Ctrl";
}

/**
 * Formats a shortcut for display
 */
export function formatShortcut(shortcut: Pick<Shortcut, "key" | "ctrl" | "meta" | "shift" | "alt">): string {
  const parts: string[] = [];
  const mac = typeof window !== "undefined" && isMac();

  if (shortcut.ctrl || shortcut.meta) {
    parts.push(mac ? "\u2318" : "Ctrl");
  }
  if (shortcut.alt) {
    parts.push(mac ? "\u2325" : "Alt");
  }
  if (shortcut.shift) {
    parts.push(mac ? "\u21E7" : "Shift");
  }
  parts.push(shortcut.key.toUpperCase());

  return parts.join(mac ? "" : "+");
}
