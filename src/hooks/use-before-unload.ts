"use client";

import { useEffect } from "react";

/**
 * Shows the browser's native "Leave page?" confirmation dialog
 * when the user tries to close/reload the tab while there are unsaved changes.
 *
 * @param hasUnsavedChanges - Whether the form/page has unsaved changes
 */
export function useBeforeUnload(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
