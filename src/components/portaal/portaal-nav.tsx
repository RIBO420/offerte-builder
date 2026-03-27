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
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/portaal/overzicht", label: "Overzicht", icon: LayoutDashboard },
  { href: "/portaal/offertes", label: "Offertes", icon: FileText },
  { href: "/portaal/projecten", label: "Projecten", icon: FolderOpen },
  { href: "/portaal/facturen", label: "Facturen", icon: Receipt },
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
    <nav className="hidden md:flex bg-white dark:bg-[#1a2e1a] border-b border-gray-200 dark:border-[#2a3e2a] px-6">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm transition-colors border-b-2",
              isActive
                ? "text-[#1a2e1a] dark:text-[#4ADE80] border-[#4ADE80] font-semibold"
                : "text-gray-500 dark:text-gray-400 border-transparent hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {item.label}
            {item.badgeKey === "messages" && unreadMessages && unreadMessages > 0 ? (
              <Badge className="bg-[#4ADE80] text-black text-[10px] h-[18px] min-w-[18px] flex items-center justify-center rounded-full px-1">
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
          "fixed top-0 left-0 h-full w-72 bg-[#1a2e1a] z-50 transform transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#2a3e2a]">
          <div className="flex items-center gap-2">
            <div className="bg-[#4ADE80] w-7 h-7 rounded-md flex items-center justify-center font-bold text-black text-xs">
              TT
            </div>
            <span className="text-white font-semibold text-sm">Top Tuinen</span>
          </div>
          <button onClick={onMobileClose} className="text-gray-400 hover:text-white">
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
                    ? "text-[#4ADE80] font-semibold border-l-3 border-[#4ADE80]"
                    : "text-gray-300 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.badgeKey === "messages" && unreadMessages && unreadMessages > 0 ? (
                  <Badge className="bg-[#4ADE80] text-black text-[10px] h-[18px] ml-auto">
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
