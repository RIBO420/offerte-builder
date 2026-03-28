"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Inner component that uses useSearchParams (requires Suspense boundary).
 * Tracks pathname + searchParams changes to drive the progress bar.
 */
function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "loading" | "completing">("idle");
  const prevPathRef = useRef(pathname);
  const prevSearchRef = useRef(searchParams.toString());
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const currentSearch = searchParams.toString();
    const pathChanged = pathname !== prevPathRef.current;
    const searchChanged = currentSearch !== prevSearchRef.current;

    if (pathChanged || searchChanged) {
      prevPathRef.current = pathname;
      prevSearchRef.current = currentSearch;

      // Route has completed — animate to 100% then fade out
      // eslint-disable-next-line react-compiler/react-compiler -- intentional sync setState reacting to route change
      setState("completing");
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        setState("idle");
      }, 300);
    }

    return clearTimer;
  }, [pathname, searchParams, clearTimer]);

  // When state changes to idle after completing, we start fresh.
  // We detect navigation *start* by observing that the browser has triggered
  // a route change — but since Next.js App Router doesn't expose "start" events,
  // we use a click listener on links to trigger the loading state.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      if (anchor.getAttribute("target") === "_blank") return;
      if (anchor.getAttribute("download")) return;

      // Check if navigating to a different path
      const url = new URL(href, window.location.origin);
      const currentSearch = new URLSearchParams(window.location.search).toString();
      if (url.pathname !== window.location.pathname || url.searchParams.toString() !== currentSearch) {
        setState("loading");
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  if (state === "idle") return null;

  return (
    <div
      role="progressbar"
      aria-label="Pagina laden"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={state === "loading" ? 80 : 100}
      className="fixed top-0 left-0 right-0 z-50 h-[2px] pointer-events-none"
    >
      <div
        className={`h-full bg-primary ${
          state === "loading"
            ? "w-[80%] transition-all duration-500 ease-out"
            : "w-full transition-all duration-200 ease-in opacity-0"
        }`}
        style={{
          boxShadow: state === "loading" ? "0 0 8px hsl(var(--primary) / 0.4)" : "none",
        }}
      />
    </div>
  );
}

/**
 * Top-of-page navigation progress bar.
 * Shows a thin animated bar during route transitions.
 */
export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
