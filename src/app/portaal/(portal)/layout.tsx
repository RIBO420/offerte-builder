"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PortaalThemeProvider } from "@/components/portaal/portaal-theme-provider";
import { PortaalHeader } from "@/components/portaal/portaal-header";
import { PortaalNav } from "@/components/portaal/portaal-nav";
import { Loader2 } from "lucide-react";

export default function PortaalLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading } = useConvexAuth();

  // Only run queries once Convex auth is ready
  const overzicht = useQuery(
    api.portaal.getOverzicht,
    isAuthenticated ? undefined : "skip"
  );
  const unreadCounts = useQuery(
    api.chatThreads.getUnreadCounts,
    isAuthenticated ? undefined : "skip"
  );
  const updateLastLogin = useMutation(api.portaal.updateLastLogin);

  useEffect(() => {
    if (!isAuthenticated) return;
    // Delay to allow Convex auth token to fully sync
    const timer = setTimeout(() => {
      updateLastLogin().catch(() => {
        // Ignore — user may not be linked yet (invitation flow)
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !isAuthenticated) {
    return (
      <PortaalThemeProvider>
        <div className="min-h-screen bg-[#f8faf8] dark:bg-[#0a0f0a] flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-[#4ADE80] animate-spin" />
        </div>
      </PortaalThemeProvider>
    );
  }

  return (
    <PortaalThemeProvider>
      <div className="min-h-screen bg-[#f8faf8] dark:bg-[#0a0f0a]">
        <PortaalHeader
          klantNaam={overzicht?.klantNaam}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <PortaalNav
          unreadMessages={unreadCounts?.total}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <main className="p-4 md:p-6 max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </PortaalThemeProvider>
  );
}
