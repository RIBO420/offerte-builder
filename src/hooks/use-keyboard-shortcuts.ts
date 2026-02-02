"use client";

import { useEffect, useCallback, useRef, useState } from "react";

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
 * Sequence shortcut definition (e.g., "G then D" for go to dashboard)
 */
export interface SequenceShortcut {
  sequence: string[]; // e.g., ['g', 'd'] for "G then D"
  action: () => void;
  description?: string;
  /** If true, the shortcut works even when focused in an input/textarea */
  allowInInput?: boolean;
}

/**
 * Checks if the current platform is Mac
 */
export function isMac(): boolean {
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
 * Hook for registering sequence keyboard shortcuts (e.g., "G then D")
 * Keys must be pressed within a timeout window (default 1000ms)
 */
export function useSequenceShortcuts(
  shortcuts: SequenceShortcut[],
  timeout: number = 1000
): { pendingKeys: string[] } {
  const shortcutsRef = useRef(shortcuts);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update ref in effect
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  // Clear pending keys after timeout
  const clearPendingKeys = useCallback(() => {
    setPendingKeys([]);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if any modifier is pressed (these are for single shortcuts)
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    // Check if we're in an input
    const inInput = isInputElement(event.target);

    const key = event.key.toLowerCase();

    // Build new sequence
    const newSequence = [...pendingKeys, key];

    // Check if this sequence matches any shortcut
    for (const shortcut of shortcutsRef.current) {
      if (!shortcut.allowInInput && inInput) continue;

      const sequence = shortcut.sequence.map(k => k.toLowerCase());

      // Check if newSequence matches the shortcut sequence
      if (sequence.length === newSequence.length) {
        const matches = sequence.every((k, i) => k === newSequence[i]);
        if (matches) {
          event.preventDefault();
          clearPendingKeys();
          shortcut.action();
          return;
        }
      }

      // Check if newSequence is a prefix of any shortcut
      if (sequence.length > newSequence.length) {
        const isPrefix = newSequence.every((k, i) => k === sequence[i]);
        if (isPrefix) {
          // Valid prefix, update pending keys and reset timeout
          event.preventDefault();
          setPendingKeys(newSequence);

          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(clearPendingKeys, timeout);
          return;
        }
      }
    }

    // No match found, clear pending keys if we had any
    if (pendingKeys.length > 0) {
      clearPendingKeys();
    }
  }, [pendingKeys, timeout, clearPendingKeys]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleKeyDown]);

  return { pendingKeys };
}

/**
 * Returns the appropriate modifier key symbol based on the platform
 */
export function getModifierKey(): string {
  if (typeof window === "undefined") return "Ctrl";
  return isMac() ? "\u2318" : "Ctrl";
}

/**
 * Returns the appropriate shift key symbol based on the platform
 */
export function getShiftKey(): string {
  if (typeof window === "undefined") return "Shift";
  return isMac() ? "\u21E7" : "Shift";
}

/**
 * Returns the appropriate option/alt key symbol based on the platform
 */
export function getAltKey(): string {
  if (typeof window === "undefined") return "Alt";
  return isMac() ? "\u2325" : "Alt";
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

/**
 * Formats a sequence shortcut for display (e.g., "G then D")
 */
export function formatSequenceShortcut(sequence: string[]): string {
  return sequence.map(k => k.toUpperCase()).join(" then ");
}
