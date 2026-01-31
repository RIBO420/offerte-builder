"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  Clock,
  ChevronRight,
  BarChart3,
  LogOut,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-badge";
import { useDashboardData } from "@/hooks/use-offertes";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Offertes",
    url: "/offertes",
    icon: FileText,
  },
  {
    title: "Klanten",
    url: "/klanten",
    icon: Users,
  },
  {
    title: "Rapportages",
    url: "/rapportages",
    icon: BarChart3,
  },
];

const nieuweOfferteItems = [
  {
    title: "Aanleg Offerte",
    url: "/offertes/nieuw/aanleg",
    icon: Shovel,
    description: "Nieuwe tuinprojecten en renovaties",
  },
  {
    title: "Onderhoud Offerte",
    url: "/offertes/nieuw/onderhoud",
    icon: Trees,
    description: "Periodiek tuinonderhoud",
  },
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
  const { theme, setTheme } = useTheme();
  const { recentOffertes } = useDashboardData();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { signOut } = useClerk();
  const [mounted, setMounted] = useState(false);

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
                  <Trees className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Top Tuinen</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Offerte Builder
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigatie</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
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

        <SidebarSeparator />

        {/* Recent Offertes Section */}
        {recentOffertes && recentOffertes.length > 0 && (
          <>
            <Collapsible defaultOpen className="group/collapsible">
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="size-3" />
                      Recent
                    </span>
                    <ChevronRight className="size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
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
                              <span className="truncate">{offerte.offerteNummer}</span>
                              <span className="ml-auto text-xs text-muted-foreground truncate max-w-[80px]">
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
            <SidebarSeparator />
          </>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2">
            <Plus className="size-3" />
            Nieuwe Offerte
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nieuweOfferteItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.description}
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
                        <img
                          src={user.imageUrl}
                          alt={userDisplayName}
                          className="size-8 rounded-full object-cover"
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
                      <span className="truncate font-medium">
                        {mounted && isUserLoaded ? userDisplayName : "Laden..."}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
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
                      <User className="mr-2 h-4 w-4" />
                      Profiel
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/prijsboek" className="cursor-pointer">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Prijsboek
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/instellingen" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Instellingen
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Uitloggen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Wissel thema</span>
              </Button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
