"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SkipLink } from "@/components/ui/skip-link";
import { OfflineIndicator } from "@/components/ui/offline-indicator";
import { ConnectionStatus } from "@/components/ui/connection-status";
import { CommandProvider } from "@/components/providers/command-provider";
import { ShortcutsProvider } from "@/components/providers/shortcuts-provider";
import { CommandPalette } from "@/components/command-palette";
import { GlobalShortcutsHelp } from "@/components/global-shortcuts-help";
import { NewOfferteDialog } from "@/components/new-offerte-dialog";
import { SequenceKeyIndicator } from "@/components/sequence-key-indicator";
import { PageTransition } from "@/components/page-transition";
import { NavigationProgress } from "@/components/ui/navigation-progress";
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
      <ShortcutsProvider>
        <SidebarProvider>
          <NavigationProgress />
          <SkipLink />
          <OfflineIndicator />
          <ConnectionStatus />
          <AppSidebar />
          <SidebarInset>
            <main id="main-content" className="flex flex-1 flex-col">
              <PageTransition>
                {children}
              </PageTransition>
            </main>
          </SidebarInset>
          <CommandPalette />
          <GlobalShortcutsHelp />
          <NewOfferteDialog />
          <SequenceKeyIndicator />
        </SidebarProvider>
      </ShortcutsProvider>
    </CommandProvider>
  );
}
