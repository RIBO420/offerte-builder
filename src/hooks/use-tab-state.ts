"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * Hook for managing tab state in the URL, enabling deep-linking and sharing.
 *
 * @param defaultTab - The default tab to use when no tab is specified in the URL
 * @returns A tuple of [currentTab, setTab] similar to useState
 *
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = useTabState("alle");
 *
 * <Tabs value={activeTab} onValueChange={setActiveTab}>
 *   ...
 * </Tabs>
 * ```
 */
export function useTabState(defaultTab: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const currentTab = searchParams.get("tab") || defaultTab;

  const setTab = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === defaultTab) {
        // Remove the tab param if it's the default to keep URLs clean
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [router, searchParams, pathname, defaultTab]
  );

  return [currentTab, setTab] as const;
}
