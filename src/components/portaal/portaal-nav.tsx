"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  Receipt,
  MessageSquare,
  Download,
  AlertCircle,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TopTuinenLogo } from "@/components/ui/top-tuinen-logo";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/portaal/overzicht", label: "Overzicht", icon: LayoutDashboard },
  { href: "/portaal/offertes", label: "Offertes", icon: FileText },
  { href: "/portaal/projecten", label: "Werkzaamheden", icon: FolderOpen },
  { href: "/portaal/facturen", label: "Facturen", icon: Receipt },
  { href: "/portaal/meldingen", label: "Meldingen", icon: AlertCircle },
  { href: "/portaal/chat", label: "Berichten", icon: MessageSquare, badgeKey: "messages" as const },
  { href: "/portaal/documenten", label: "Documenten", icon: Download },
];

interface PortaalNavProps {
  unreadMessages?: number;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function PortaalNav({ unreadMessages, mobileOpen, onMobileClose }: PortaalNavProps) {
  const pathname = usePathname();

  // Desktop horizontal nav
  const desktopNav = (
    <nav className="hidden md:flex bg-card border-b border-border px-6">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm transition-colors border-b-2",
              isActive
                ? "text-foreground border-accent-warm font-semibold"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            {item.label}
            {item.badgeKey === "messages" && unreadMessages && unreadMessages > 0 ? (
              <Badge className="bg-primary text-primary-foreground text-[10px] h-[18px] min-w-[18px] flex items-center justify-center rounded-full px-1">
                {unreadMessages}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  // Mobile slide-out menu
  const mobileNav = (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-72 max-w-[calc(100vw-3rem)] bg-sidebar z-50 transform transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary">
              <TopTuinenLogo variant="wit" size={24} className="size-5" />
            </span>
            <span className="text-sidebar-accent-foreground font-semibold text-sm uppercase tracking-[0.12em]">
              Top Tuinen
            </span>
          </div>
          <button onClick={onMobileClose} className="text-sidebar-foreground hover:text-sidebar-accent-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="py-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onMobileClose}
                className={cn(
                  "flex items-center gap-3 px-5 py-3.5 text-sm transition-colors",
                  isActive
                    ? "text-sidebar-accent-foreground font-semibold border-l-3 border-accent-warm bg-sidebar-accent"
                    : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.badgeKey === "messages" && unreadMessages && unreadMessages > 0 ? (
                  <Badge className="bg-sidebar-primary text-sidebar-primary-foreground text-[10px] h-[18px] ml-auto">
                    {unreadMessages}
                  </Badge>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );

  return (
    <>
      {desktopNav}
      {mobileNav}
    </>
  );
}
