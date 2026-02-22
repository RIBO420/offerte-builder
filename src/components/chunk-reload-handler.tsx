"use client";

import { useEffect } from "react";

/**
 * Detecteert ChunkLoadError (stale deployment chunks) en herlaadt de pagina automatisch.
 * Dit voorkomt dat gebruikers een lege pagina zien na een nieuwe deployment.
 * Maximaal 1 automatische reload om infinite loops te voorkomen.
 */
export function ChunkReloadHandler() {
  useEffect(() => {
    const RELOAD_KEY = "__chunk_reload";

    function handleError(event: ErrorEvent) {
      const isChunkError =
        event.message?.includes("ChunkLoadError") ||
        event.message?.includes("Failed to fetch dynamically imported module") ||
        event.message?.includes("Loading chunk") ||
        event.error?.name === "ChunkLoadError";

      if (!isChunkError) return;

      // Voorkom infinite reload loop: max 1 keer per 60 seconden
      const lastReload = sessionStorage.getItem(RELOAD_KEY);
      const now = Date.now();
      if (lastReload && now - Number(lastReload) < 60_000) return;

      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const isChunkError =
        reason?.name === "ChunkLoadError" ||
        reason?.message?.includes("ChunkLoadError") ||
        reason?.message?.includes("Failed to fetch dynamically imported module") ||
        reason?.message?.includes("Failed to load chunk");

      if (!isChunkError) return;

      const lastReload = sessionStorage.getItem(RELOAD_KEY);
      const now = Date.now();
      if (lastReload && now - Number(lastReload) < 60_000) return;

      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
