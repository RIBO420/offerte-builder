"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
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
import { TemplatesSheet } from "@/components/offerte/templates-sheet";
import { SequenceKeyIndicator } from "@/components/sequence-key-indicator";
import { PageTransition } from "@/components/page-transition";
import { NavigationProgress } from "@/components/ui/navigation-progress";
import { Skeleton } from "@/components/ui/skeleton";
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
          {/* Derde ingang van het entree-menu; net als de dialog één instantie,
              zodat elke "Nieuwe offerte"-knop dezelfde Sheet opent. */}
          <TemplatesSheet />
          <SequenceKeyIndicator />
        </SidebarProvider>
      </ShortcutsProvider>
    </CommandProvider>
  );
}

/**
 * Statisch shell-silhouet dat tijdens de Clerk→Convex-keten wordt getoond
 * (optimize O11). Voorheen stond hier alleen een spinner op een leeg vlak:
 * bij elke harde load 3–7 s "zwart laadgat" in dev. Dit silhouet bevat géén
 * enkele query of gebruikersdata — het rendert dus al in de server-HTML —
 * en spiegelt de maten van de echte shell (sidebar 16rem, inset-contentvlak),
 * zodat de wissel naar de echte shell niet verspringt.
 */
function DashboardShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full bg-sidebar" aria-busy="true">
      {/* Sidebar-silhouet — alleen desktop; op mobiel is de sidebar offcanvas */}
      <div
        className="hidden w-[16rem] shrink-0 flex-col gap-6 p-4 md:flex"
        aria-hidden="true"
      >
        <div className="flex items-center gap-2 px-2 pt-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2 px-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>
      {/* Contentvlak in dezelfde inset-stijl als SidebarInset */}
      <main className="relative flex w-full min-w-0 flex-1 flex-col bg-background md:m-2 md:ml-0 md:rounded-xl md:shadow-sm">
        <div
          className="flex flex-1 flex-col gap-6 p-4 md:p-8"
          role="status"
          aria-label="Bezig met laden"
        >
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-40 w-full" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const router = useRouter();

  // Keep klanten out of the staff dashboard — they belong in the klantenportaal.
  // Uses the Convex role (reliable) rather than the Clerk session claim.
  const currentUser = useQuery(api.users.current, isAuthenticated ? {} : "skip");
  const isKlant = currentUser?.role === "klant";

  useEffect(() => {
    if (isKlant) {
      router.replace("/portaal/overzicht");
    }
  }, [isKlant, router]);

  // Rolbeveiliging (hard): tot de Convex-rol binnen is — en altijd voor de
  // klant-rol — rendert hier uitsluitend het statische silhouet zonder data.
  // Alleen de wachtervaring is veranderd (silhouet i.p.v. spinner op een leeg
  // vlak, optimize O11); de gate zelf staat nog exact even dicht als voorheen:
  // geen stafcontent, geen sidebar-data en geen paginaqueries vóór
  // isAuthenticated + rol-check, en de redirect naar /portaal blijft werken.
  // Middleware garandeert al dat de gebruiker ingelogd is; dit dekt de korte
  // laadperiode van de Clerk→Convex-token-keten direct na login.
  if (isLoading || !isAuthenticated || currentUser === undefined || isKlant) {
    return <DashboardShellSkeleton />;
  }

  return <DashboardShell>{children}</DashboardShell>;
}
