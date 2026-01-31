"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SkipLink } from "@/components/ui/skip-link";
import { CommandProvider } from "@/components/providers/command-provider";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsHelp } from "@/components/shortcuts-help";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-accessibility";
import { usePrefetchAllCommonData } from "@/hooks/use-prefetch";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();

  // Prefetch common data to warm caches for faster navigation
  // This runs once when the dashboard layout mounts and keeps data fresh
  usePrefetchAllCommonData();

  return (
    <CommandProvider>
      <SidebarProvider>
        <SkipLink />
        <AppSidebar />
        <SidebarInset>
          <main id="main-content" className="flex flex-1 flex-col">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.3, ease: "easeOut" }}
              className="flex flex-1 flex-col"
            >
              {children}
            </motion.div>
          </main>
        </SidebarInset>
        <CommandPalette />
        <ShortcutsHelp />
      </SidebarProvider>
    </CommandProvider>
  );
}
