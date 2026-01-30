import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SkipLink } from "@/components/ui/skip-link";
import { CommandProvider } from "@/components/providers/command-provider";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsHelp } from "@/components/shortcuts-help";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CommandProvider>
      <SidebarProvider>
        <SkipLink />
        <AppSidebar />
        <SidebarInset>
          <main id="main-content" className="flex flex-1 flex-col">
            {children}
          </main>
        </SidebarInset>
        <CommandPalette />
        <ShortcutsHelp />
      </SidebarProvider>
    </CommandProvider>
  );
}
