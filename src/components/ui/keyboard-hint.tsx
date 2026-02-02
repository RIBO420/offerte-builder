"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { getModifierKey, getShiftKey, getAltKey, isMac } from "@/hooks/use-keyboard-shortcuts";

// SSR-safe mounting check using useSyncExternalStore
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;
function useMounted() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

interface KeyboardHintProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** The keys to display (e.g., ["Cmd", "K"] or ["G", "D"]) */
  keys: string[];
  /** Whether to show the modifier key prefix automatically */
  showModifier?: boolean;
  /** Whether to show shift key */
  showShift?: boolean;
  /** Whether to show alt/option key */
  showAlt?: boolean;
  /** Size variant */
  size?: "xs" | "sm" | "default";
  /** Separator between keys (for sequences) */
  separator?: "plus" | "then" | "none";
}

const sizeClasses = {
  xs: "text-[9px] px-1 py-0.5 min-w-[16px]",
  sm: "text-[10px] px-1.5 py-0.5 min-w-[18px]",
  default: "text-xs px-2 py-1 min-w-[22px]",
};

/**
 * Component for displaying keyboard shortcut hints
 * Shows properly formatted kbd elements with platform-specific symbols
 */
export function KeyboardHint({
  keys,
  showModifier = false,
  showShift = false,
  showAlt = false,
  size = "default",
  separator = "plus",
  className,
  ...props
}: KeyboardHintProps) {
  const mounted = useMounted();

  // Build the full key array with modifiers
  const displayKeys = React.useMemo(() => {
    const result: string[] = [];

    if (showModifier) {
      result.push(mounted ? getModifierKey() : "Ctrl");
    }
    if (showAlt) {
      result.push(mounted ? getAltKey() : "Alt");
    }
    if (showShift) {
      result.push(mounted ? getShiftKey() : "Shift");
    }

    // Add the main keys, converting special names
    keys.forEach((key) => {
      const displayKey = normalizeKeyDisplay(key, mounted);
      result.push(displayKey);
    });

    return result;
  }, [keys, showModifier, showShift, showAlt, mounted]);

  const separatorText = separator === "then" ? " then " : separator === "plus" ? (mounted && isMac() ? "" : "+") : "";

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      {...props}
    >
      {displayKeys.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && separatorText && (
            <span className="text-muted-foreground text-[10px] mx-0.5">
              {separatorText}
            </span>
          )}
          <kbd
            className={cn(
              "inline-flex items-center justify-center rounded bg-muted font-mono font-medium text-muted-foreground border border-border/50 shadow-sm",
              sizeClasses[size]
            )}
          >
            {key}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

/**
 * Normalizes key names for display with proper symbols
 */
function normalizeKeyDisplay(key: string, mounted: boolean): string {
  const lowerKey = key.toLowerCase();
  const mac = mounted && isMac();

  // Map common key names to symbols
  const keyMap: Record<string, string> = {
    cmd: mac ? "\u2318" : "Ctrl",
    meta: mac ? "\u2318" : "Ctrl",
    ctrl: mac ? "\u2303" : "Ctrl",
    control: mac ? "\u2303" : "Ctrl",
    shift: mac ? "\u21E7" : "Shift",
    alt: mac ? "\u2325" : "Alt",
    option: mac ? "\u2325" : "Alt",
    enter: "\u23CE",
    return: "\u23CE",
    escape: "Esc",
    esc: "Esc",
    backspace: "\u232B",
    delete: "\u2326",
    tab: "\u21E5",
    space: "\u2423",
    arrowup: "\u2191",
    arrowdown: "\u2193",
    arrowleft: "\u2190",
    arrowright: "\u2192",
    up: "\u2191",
    down: "\u2193",
    left: "\u2190",
    right: "\u2192",
  };

  if (keyMap[lowerKey]) {
    return keyMap[lowerKey];
  }

  // Return uppercase for single letters
  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key;
}

/**
 * Inline keyboard shortcut display for menus and buttons
 */
export function InlineShortcut({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Shortcut badge for showing in buttons or menu items
 */
export function ShortcutBadge({
  shortcut,
  showModifier = true,
  className,
}: {
  shortcut: string;
  showModifier?: boolean;
  className?: string;
}) {
  const mounted = useMounted();
  const modKey = mounted ? getModifierKey() : "Ctrl";
  const displayText = showModifier ? `${modKey}${shortcut.toUpperCase()}` : shortcut.toUpperCase();

  return (
    <kbd
      className={cn(
        "ml-auto px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono text-muted-foreground",
        className
      )}
    >
      {displayText}
    </kbd>
  );
}
