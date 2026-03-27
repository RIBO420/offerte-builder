"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PortaalThemeProvider } from "@/components/portaal/portaal-theme-provider";
import { PortaalHeader } from "@/components/portaal/portaal-header";
import { PortaalNav } from "@/components/portaal/portaal-nav";

export default function PortaalLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const overzicht = useQuery(api.portaal.getOverzicht);
  const unreadCounts = useQuery(api.chatThreads.getUnreadCounts);
  const updateLastLogin = useMutation(api.portaal.updateLastLogin);

  useEffect(() => {
    updateLastLogin();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
