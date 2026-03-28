"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Archive,
  FileText,
  Home,
  BookOpen,
  Trees,
  Moon,
  Sun,
  Users,
  UsersRound,
  Clock,
  BarChart3,
  LogOut,
  User,
  FolderKanban,
  Wrench,
  Receipt,
  Truck,
  Shield,
  ShieldCheck,
  Calendar,
  CalendarDays,
  Thermometer,
  ClipboardList,
  ShoppingCart,
  DollarSign,
  CheckSquare,
  MessageSquare,
  ScrollText,
  Settings,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Badge } from "@/components/ui/badge";
import { useIsAdmin, useCurrentUserRole } from "@/hooks/use-users";
import { NotificationCenter } from "@/components/notification-center";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// Sidebar: Werk group - daily operational items
const werkItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Klanten", url: "/klanten", icon: Users },
  { title: "Projecten", url: "/projecten", icon: FolderKanban },
  { title: "Planning", url: "/planning", icon: Calendar },
  { title: "Uren", url: "/uren", icon: Clock },
  { title: "Rapportages", url: "/rapportages", icon: BarChart3 },
  { title: "Chat", url: "/chat", icon: MessageSquare },
];

// Sidebar: Financieel group
const financieelItems = [
  { title: "Offertes", url: "/offertes", icon: FileText },
  { title: "Contracten", url: "/contracten", icon: ScrollText },
  { title: "Facturen", url: "/facturen", icon: Receipt },
  { title: "Inkoop", url: "/inkoop", icon: ShoppingCart },
  { title: "Archief", url: "/archief", icon: Archive },
];

// Profile menu: Personeel group (admin/directie only)
const personeelMenuItems = [
  { title: "Medewerkers", url: "/medewerkers", icon: UsersRound },
  { title: "Verlof", url: "/verlof", icon: CalendarDays, indent: true },
  { title: "Verzuim", url: "/verzuim", icon: Thermometer, indent: true },
  { title: "Gebruikersbeheer", url: "/gebruikers", icon: Shield },
];

// Profile menu: Assets & Data group (admin/directie only)
const assetsMenuItems = [
  { title: "Wagenparkbeheer", url: "/wagenpark", icon: Truck },
  { title: "Machinebeheer", url: "/instellingen/machines", icon: Wrench },
  { title: "Prijsboek", url: "/prijsboek", icon: BookOpen },
  { title: "Garanties", url: "/garanties", icon: ShieldCheck },
  { title: "Servicemeldingen", url: "/servicemeldingen", icon: Wrench },
  { title: "Toolbox", url: "/toolbox", icon: ClipboardList },
];

// Project sub-items (shown within project context) - unchanged
const projectSubItems = [
  { title: "Kosten tracking", urlSuffix: "/kosten", icon: DollarSign },
  { title: "Kwaliteit", urlSuffix: "/kwaliteit", icon: CheckSquare },
];


function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0]?.[0]?.toUpperCase() || "?";
}

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { theme, setTheme } = useTheme();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();
  const [mounted, setMounted] = useState(false);
  const isAdmin = useIsAdmin();
  const role = useCurrentUserRole();

  // Teller voor nieuwe verificatie-aanvragen (alleen geladen als admin)
  const aantalNieuweAanvragen = useQuery(
    api.configuratorAanvragen.countByStatus,
    isAdmin ? {} : "skip"
  );

  // Close mobile sidebar when navigating to a new page
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  // Helper: check if role is directie-level (includes legacy "admin")
  const isDirectieOrAdmin = role === "directie" || role === "admin";

  // Filter Werk items based on 7-role model
  const filteredWerkItems = useMemo(() => {
    if (isDirectieOrAdmin || role === "projectleider") {
      return werkItems;
    }
    if (role === "voorman") {
      return werkItems.filter((item) =>
        ["Dashboard", "Projecten", "Planning", "Uren", "Chat"].includes(item.title)
      );
    }
    if (role === "materiaalman") {
      return werkItems.filter((item) =>
        ["Dashboard", "Chat"].includes(item.title)
      );
    }
    if (role === "onderaannemer_zzp") {
      return werkItems.filter((item) =>
        ["Dashboard", "Planning", "Uren", "Chat"].includes(item.title)
      );
    }
    if (role === "medewerker") {
      return werkItems.filter((item) =>
        ["Dashboard", "Uren", "Chat"].includes(item.title)
      );
    }
    // klant/viewer
    return werkItems.filter((item) => item.title === "Dashboard");
  }, [role, isDirectieOrAdmin]);

  // Filter Financieel items based on role
  const filteredFinancieelItems = useMemo(() => {
    if (isDirectieOrAdmin || role === "projectleider") {
      return financieelItems;
    }
    if (role === "materiaalman") {
      return financieelItems.filter((item) => item.title === "Inkoop");
    }
    return [];
  }, [role, isDirectieOrAdmin]);

  // Extract current project ID from pathname if on a project page
  const currentProjectId = useMemo(() => {
    const match = pathname.match(/^\/projecten\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  // Prevent hydration mismatch
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const handleSignOut = () => {
    signOut({ redirectUrl: "/sign-in" });
  };

  const userInitials = getInitials(user?.fullName || user?.firstName);
  const userDisplayName = user?.fullName || user?.firstName || "Gebruiker";
  const userEmail = user?.primaryEmailAddress?.emailAddress;

  return (
    <Sidebar variant="inset" aria-label="Hoofdnavigatie">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Trees className="size-4" aria-hidden="true" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold" title="Top Tuinen">Top Tuinen</span>
                  <span className="truncate text-xs text-muted-foreground" title="Offerte Builder">
                    Offerte Builder
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Werk - daily operational items */}
        <SidebarGroup>
          <SidebarGroupLabel>Werk</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredWerkItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                      {item.title === "Klanten" && aantalNieuweAanvragen !== undefined && aantalNieuweAanvragen > 0 && (
                        <Badge
                          variant="default"
                          className="ml-auto text-xs h-5 min-w-5 px-1 bg-blue-600 hover:bg-blue-600"
                        >
                          {aantalNieuweAanvragen}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Financieel - quotes, invoices, procurement */}
        {filteredFinancieelItems.length > 0 && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Financieel</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredFinancieelItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === item.url || pathname.startsWith(item.url + "/")}
                        tooltip={item.title}
                      >
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {/* Project Tools - context-sensitive, only on project pages */}
        {currentProjectId && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel>Project Tools</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {projectSubItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === `/projecten/${currentProjectId}${item.urlSuffix}`}
                        tooltip={item.title}
                      >
                        <Link href={`/projecten/${currentProjectId}${item.urlSuffix}`}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="flex-1 cursor-pointer">
                    {mounted && isUserLoaded ? (
                      user?.imageUrl ? (
                        <Image
                          src={user.imageUrl}
                          alt={userDisplayName}
                          width={32}
                          height={32}
                          className="size-8 rounded-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                          {userInitials}
                        </div>
                      )
                    ) : (
                      <div className="size-8 rounded-full bg-muted animate-pulse" />
                    )}
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium" title={mounted && isUserLoaded ? userDisplayName : undefined}>
                        {mounted && isUserLoaded ? userDisplayName : "Laden..."}
                      </span>
                      <span className="truncate text-xs text-muted-foreground" title={mounted && isUserLoaded && userEmail ? userEmail : undefined}>
                        {mounted && isUserLoaded && userEmail ? userEmail : ""}
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="w-64">
                  {/* User info header */}
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium">{userDisplayName}</p>
                    {userEmail && (
                      <p className="text-xs text-muted-foreground">{userEmail}</p>
                    )}
                  </div>
                  <DropdownMenuSeparator />

                  {/* Persoonlijk */}
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/profiel" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" aria-hidden="true" />
                        Profiel
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/instellingen" className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                        Instellingen
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  {/* Personeel - admin/directie only */}
                  {isDirectieOrAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Personeel</DropdownMenuLabel>
                        {personeelMenuItems.map((item) => (
                          <DropdownMenuItem key={item.title} asChild>
                            <Link
                              href={item.url}
                              className={`cursor-pointer ${item.indent ? "pl-8" : ""}`}
                            >
                              <item.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                              {item.title}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </>
                  )}

                  {/* Assets & Data - admin/directie only */}
                  {isDirectieOrAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Assets & Data</DropdownMenuLabel>
                        {assetsMenuItems.map((item) => (
                          <DropdownMenuItem key={item.title} asChild>
                            <Link href={item.url} className="cursor-pointer">
                              <item.icon className="mr-2 h-4 w-4" aria-hidden="true" />
                              {item.title}
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </>
                  )}

                  {/* Theme + Logout */}
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      className="cursor-pointer"
                    >
                      {mounted && theme === "dark" ? (
                        <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
                      )}
                      {mounted ? (theme === "dark" ? "Lichte modus" : "Donkere modus") : "Thema"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                      Uitloggen
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <NotificationCenter />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
