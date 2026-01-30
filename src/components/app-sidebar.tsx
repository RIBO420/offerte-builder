"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
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
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
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

const beheerItems = [
  {
    title: "Prijsboek",
    url: "/prijsboek",
    icon: BookOpen,
  },
  {
    title: "Instellingen",
    url: "/instellingen",
    icon: Settings,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
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

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Beheer</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {beheerItems.map((item) => (
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
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between px-2">
              <SidebarMenuButton size="lg" className="cursor-default flex-1">
                <UserButton
                  afterSignOutUrl="/sign-in"
                  appearance={{
                    elements: {
                      avatarBox: "size-8",
                    },
                  }}
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate text-xs text-muted-foreground">
                    Ingelogd als
                  </span>
                </div>
              </SidebarMenuButton>
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
