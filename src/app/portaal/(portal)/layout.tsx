"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { PortaalThemeProvider } from "@/components/portaal/portaal-theme-provider";
import { PortaalHeader } from "@/components/portaal/portaal-header";
import { PortaalNav } from "@/components/portaal/portaal-nav";
import { NavigationProgress } from "@/components/ui/navigation-progress";
import { LaadIndicator } from "@/components/ui/laad-indicator";

export default function PortaalLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  // Keep staff out of the klantenportaal — the mirror of the dashboard-layout
  // guard that keeps klanten out of the dashboard. Uses the Convex role
  // (reliable) rather than the Clerk session claim, which can be missing or
  // stale (the proxy only redirects on the claim). Users without a role yet
  // (invitation flow, just registered) may stay.
  const currentUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const isStaf = Boolean(currentUser?.role) && currentUser?.role !== "klant";

  useEffect(() => {
    if (isStaf) {
      router.replace("/dashboard");
    }
  }, [isStaf, router]);

  // Only run klant queries once Convex auth is ready and we know the user
  // is not staff (staff would only hit requireKlant errors while redirecting).
  const magKlantQueries =
    isAuthenticated && currentUser !== undefined && !isStaf;
  const overzicht = useQuery(
    api.portaal.getOverzicht,
    magKlantQueries ? undefined : "skip"
  );
  const unreadCounts = useQuery(
    api.chatThreads.getUnreadCounts,
    magKlantQueries ? undefined : "skip"
  );
  const updateLastLogin = useMutation(api.portaal.updateLastLogin);

  useEffect(() => {
    if (!magKlantQueries) return;
    // Delay to allow Convex auth token to fully sync
    const timer = setTimeout(() => {
      updateLastLogin().catch(() => {
        // Ignore — user may not be linked yet (invitation flow)
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [magKlantQueries]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !isAuthenticated || currentUser === undefined || isStaf) {
    return (
      <PortaalThemeProvider>
        {/* WS9: .portal activeert de portaal-tokenscope (globals.css, Stap E). */}
        <div className="portal min-h-screen bg-background flex items-center justify-center">
          <LaadIndicator formaat="pagina" />
        </div>
      </PortaalThemeProvider>
    );
  }

  return (
    <PortaalThemeProvider>
      <NavigationProgress />
      {/* WS9: .portal activeert de portaal-tokenscope (globals.css, Stap E). */}
      <div className="portal min-h-screen bg-background">
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
