"use client";

import { useEffect, useState } from "react";

interface LiveRegionProps {
  message: string;
  /** 'polite' waits for idle, 'assertive' interrupts */
  priority?: "polite" | "assertive";
  /** Clear message after this many ms (0 = never) */
  clearAfter?: number;
}

/**
 * Accessible live region for screen reader announcements
 * Visually hidden but announced to assistive technology
 */
export function LiveRegion({
  message,
  priority = "polite",
  clearAfter = 0,
}: LiveRegionProps) {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    setCurrentMessage(message);

    if (clearAfter > 0 && message) {
      const timer = setTimeout(() => {
        setCurrentMessage("");
      }, clearAfter);
      return () => clearTimeout(timer);
    }
  }, [message, clearAfter]);

  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {currentMessage}
    </div>
  );
}

/**
 * Provider component that creates a global live region
 */
export function LiveRegionProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div
        id="live-region-polite"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        id="live-region-assertive"
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  );
}
