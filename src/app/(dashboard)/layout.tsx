"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SkipLink } from "@/components/ui/skip-link";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { CommandProvider } from "@/components/providers/command-provider";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { PageTransition } from "@/components/page-transition";
import { usePrefetchAllCommonData } from "@/hooks/use-prefetch";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prefetch common data to warm caches for faster navigation
  // This runs once when the dashboard layout mounts and keeps data fresh
  usePrefetchAllCommonData();

  return (
    <CommandProvider>
      <SidebarProvider>
        <SkipLink />
        <OfflineIndicator />
        <AppSidebar />
        <SidebarInset>
          <main id="main-content" className="flex flex-1 flex-col">
            <PageTransition>
              {children}
            </PageTransition>
          </main>
        </SidebarInset>
        <CommandPalette />
        <ShortcutsHelp />
      </SidebarProvider>
    </CommandProvider>
  );
}
