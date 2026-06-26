"use client";

import { useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
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

function DashboardShell({ children }: { children: React.ReactNode }) {
  // Prefetch common data to warm caches for faster navigation. This lives in the
  // authenticated branch so its queries only fire once Convex auth is ready —
  // otherwise they race the Clerk→Convex token handshake and throw AuthError.
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  // Wait for the Clerk→Convex token handshake before mounting any authenticated
  // dashboard query. Middleware already guarantees the user is signed in here,
  // so this only covers the brief loading window right after login.
  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
