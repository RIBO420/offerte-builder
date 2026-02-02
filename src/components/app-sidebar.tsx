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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Archive,
  FileText,
  Home,
  Plus,
  BookOpen,
  Settings,
  Shovel,
  Trees,
  Moon,
  Sun,
  Users,
  UsersRound,
  Clock,
  ChevronRight,
  BarChart3,
  LogOut,
  User,
  FolderKanban,
  Wrench,
  Receipt,
  Truck,
  Shield,
  Calendar,
  Building2,
  ShoppingCart,
  Package,
  DollarSign,
  CheckSquare,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-badge";
import { useDashboardData } from "@/hooks/use-offertes";
import { useIsAdmin, useCurrentUserRole } from "@/hooks/use-users";
import { NotificationCenter } from "@/components/notification-center";

// Primary navigation - always visible (most used)
const primaryNavItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Projecten", url: "/projecten", icon: FolderKanban },
  { title: "Planning", url: "/planning", icon: Calendar },
  { title: "Uren", url: "/uren", icon: Clock },
];

// Offertes & Facturen section - admin only, collapsible
const offertesItems = [
  { title: "Offertes", url: "/offertes", icon: FileText },
  { title: "Facturen", url: "/facturen", icon: Receipt },
  { title: "Archief", url: "/archief", icon: Archive },
];

// Organization section - admin only
const organizationItems = [
  { title: "Klanten", url: "/klanten", icon: Users },
  { title: "Medewerkers", url: "/medewerkers", icon: UsersRound },
  { title: "Wagenpark", url: "/wagenpark", icon: Truck },
  { title: "Rapportages", url: "/rapportages", icon: BarChart3 },
];

// Quick actions for new items
const nieuweOfferteItems = [
  { title: "Aanleg", url: "/offertes/nieuw/aanleg", icon: Shovel },
  { title: "Onderhoud", url: "/offertes/nieuw/onderhoud", icon: Trees },
];

// Inkoop section - admin only
const inkoopItems = [
  { title: "Leveranciers", url: "/leveranciers", icon: Building2 },
  { title: "Inkooporders", url: "/inkoop", icon: ShoppingCart },
  { title: "Voorraad", url: "/voorraad", icon: Package },
];

// Project sub-items (shown within project context)
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
  const { recentOffertes } = useDashboardData();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();
  const [mounted, setMounted] = useState(false);
  const isAdmin = useIsAdmin();
  const role = useCurrentUserRole();

  // Close mobile sidebar when navigating to a new page
  useEffect(() => {
    setOpenMobile(false);
  }, [pathname, setOpenMobile]);

  // Filter organization items based on user role
  const filteredOrganizationItems = useMemo(() => {
    if (role === "admin") {
      return organizationItems;
    }
    // medewerker/viewer only sees Wagenpark
    return organizationItems.filter((item) => item.title === "Wagenpark");
  }, [role]);

  // Check if any offerte/facturen section is active (for collapsible default state)
  const isOfferteSectionActive = useMemo(() => {
    return offertesItems.some(
      (item) => pathname === item.url || pathname.startsWith(item.url + "/")
    );
  }, [pathname]);

  // Check if organization section is active
  const isOrganizationSectionActive = useMemo(() => {
    return filteredOrganizationItems.some(
      (item) => pathname === item.url || pathname.startsWith(item.url + "/")
    );
  }, [pathname, filteredOrganizationItems]);

  // Check if inkoop section is active
  const isInkoopSectionActive = useMemo(() => {
    return inkoopItems.some(
      (item) => pathname === item.url || pathname.startsWith(item.url + "/")
    );
  }, [pathname]);

  // Extract current project ID from pathname if on a project page
  const currentProjectId = useMemo(() => {
    const match = pathname.match(/^\/projecten\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  // Check if project sub-section is active
  const isProjectSubSectionActive = useMemo(() => {
    if (!currentProjectId) return false;
    return projectSubItems.some(
      (item) => pathname === `/projecten/${currentProjectId}${item.urlSuffix}`
    );
  }, [pathname, currentProjectId]);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
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
        {/* Primary Navigation - Always visible, most used items */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNavItems.map((item) => (
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

        {/* Offertes & Facturen - Admin only, collapsible */}
        {isAdmin && (
          <>
            <SidebarSeparator />
            <Collapsible defaultOpen={isOfferteSectionActive} className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between">
                    <span>Offertes & Facturen</span>
                    <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" aria-hidden="true" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {offertesItems.map((item) => (
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
                      {/* Quick add buttons inline */}
                      <SidebarMenuItem>
                        <div className="flex gap-1 px-2 py-1">
                          {nieuweOfferteItems.map((item) => (
                            <SidebarMenuButton
                              key={item.title}
                              asChild
                              size="sm"
                              className="flex-1 justify-center"
                              tooltip={`Nieuwe ${item.title} Offerte`}
                            >
                              <Link href={item.url}>
                                <Plus className="size-3" aria-hidden="true" />
                                <span className="text-xs">{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          ))}
                        </div>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </>
        )}

        {/* Inkoop - Admin only, collapsible */}
        {isAdmin && (
          <>
            <SidebarSeparator />
            <Collapsible defaultOpen={isInkoopSectionActive} className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between">
                    <span>Inkoop</span>
                    <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" aria-hidden="true" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {inkoopItems.map((item) => (
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
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </>
        )}

        {/* Project Sub-navigation - Only visible when on a project page */}
        {currentProjectId && (
          <>
            <SidebarSeparator />
            <Collapsible defaultOpen={isProjectSubSectionActive} className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between">
                    <span>Project Tools</span>
                    <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" aria-hidden="true" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
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
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </>
        )}

        {/* Organization - Collapsible */}
        <SidebarSeparator />
        <Collapsible defaultOpen={isOrganizationSectionActive} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <span>{isAdmin ? "Organisatie" : "Bedrijf"}</span>
                <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {filteredOrganizationItems.map((item) => (
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
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Recent Offertes - Admin only, collapsed by default to save space */}
        {isAdmin && recentOffertes && recentOffertes.length > 0 && (
          <>
            <SidebarSeparator />
            <Collapsible defaultOpen={false} className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="size-3" aria-hidden="true" />
                      Recent
                    </span>
                    <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" aria-hidden="true" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {recentOffertes.slice(0, 5).map((offerte) => (
                        <SidebarMenuItem key={offerte._id}>
                          <SidebarMenuButton
                            asChild
                            isActive={pathname === `/offertes/${offerte._id}`}
                            tooltip={`${offerte.klant.naam} - ${offerte.offerteNummer}`}
                          >
                            <Link href={`/offertes/${offerte._id}`}>
                              <StatusDot status={offerte.status} />
                              <span className="truncate" title={offerte.offerteNummer}>{offerte.offerteNummer}</span>
                              <span className="ml-auto text-xs text-muted-foreground truncate max-w-[80px]" title={offerte.klant?.naam || "Klant"}>
                                {offerte.klant?.naam?.split(" ")?.[0] || "Klant"}
                              </span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
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
                <DropdownMenuContent align="start" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{userDisplayName}</p>
                    {userEmail && (
                      <p className="text-xs text-muted-foreground">{userEmail}</p>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profiel" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" aria-hidden="true" />
                      Mijn Profiel
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isAdmin && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/instellingen" className="cursor-pointer">
                          <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                          Instellingen
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/gebruikers" className="cursor-pointer">
                          <Shield className="mr-2 h-4 w-4" aria-hidden="true" />
                          Gebruikersbeheer
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/prijsboek" className="cursor-pointer">
                          <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                          Prijsboek
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/instellingen/machines" className="cursor-pointer">
                      <Wrench className="mr-2 h-4 w-4" aria-hidden="true" />
                      Machinepark
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                    Uitloggen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex items-center gap-1">
                <NotificationCenter />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 sm:size-8 shrink-0"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label={theme === "dark" ? "Schakel naar lichte modus" : "Schakel naar donkere modus"}
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden="true" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
