"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import Fuse from "fuse.js";
import {
  Home,
  FileText,
  Users,
  UsersRound,
  BookOpen,
  Settings,
  Plus,
  Shovel,
  Trees,
  BarChart3,
  User,
  Search,
  Clock,
  LogOut,
  Moon,
  Sun,
  FolderKanban,
  Calendar,
  Truck,
  Archive,
  Receipt,
  Wrench,
  Shield,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useCommand, CommandItem as CommandItemType } from "@/components/providers/command-provider";
import {
  useKeyboardShortcuts,
  getModifierKey,
} from "@/hooks/use-keyboard-shortcuts";

interface CommandPaletteProps {
  /** Optional: custom items to add */
  additionalItems?: CommandItemType[];
}

/**
 * Command Palette component
 * Opens with Cmd/Ctrl + K
 * Provides quick navigation and actions throughout the app
 */
export function CommandPalette({ additionalItems = [] }: CommandPaletteProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { theme, setTheme } = useTheme();
  const { open, setOpen, recentItems, addRecentItem } = useCommand();
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  // Navigate and track in recent items
  const navigateTo = useCallback(
    (item: CommandItemType) => {
      setOpen(false);
      addRecentItem(item);
      item.action();
    },
    [setOpen, addRecentItem]
  );

  // Default navigation items
  const navigationItems: CommandItemType[] = useMemo(
    () => [
      {
        id: "nav-dashboard",
        type: "navigation",
        title: "Dashboard",
        subtitle: "Overzicht en statistieken",
        icon: <Home className="size-4" />,
        action: () => router.push("/dashboard"),
        keywords: ["home", "overzicht", "start", "begin"],
      },
      {
        id: "nav-projecten",
        type: "navigation",
        title: "Projecten",
        subtitle: "Alle projecten bekijken",
        icon: <FolderKanban className="size-4" />,
        action: () => router.push("/projecten"),
        keywords: ["projects", "werk", "lopend"],
      },
      {
        id: "nav-planning",
        type: "navigation",
        title: "Planning",
        subtitle: "Werk en afspraken plannen",
        icon: <Calendar className="size-4" />,
        action: () => router.push("/planning"),
        keywords: ["schedule", "agenda", "kalender", "afspraken"],
      },
      {
        id: "nav-uren",
        type: "navigation",
        title: "Uren",
        subtitle: "Urenregistratie",
        icon: <Clock className="size-4" />,
        action: () => router.push("/uren"),
        keywords: ["hours", "tijd", "registratie", "timetracking"],
      },
      {
        id: "nav-offertes",
        type: "navigation",
        title: "Offertes",
        subtitle: "Alle offertes bekijken",
        icon: <FileText className="size-4" />,
        action: () => router.push("/offertes"),
        keywords: ["quotes", "lijst", "overzicht", "aanbiedingen"],
      },
      {
        id: "nav-facturen",
        type: "navigation",
        title: "Facturen",
        subtitle: "Facturen beheren",
        icon: <Receipt className="size-4" />,
        action: () => router.push("/facturen"),
        keywords: ["invoices", "rekeningen", "betaling"],
      },
      {
        id: "nav-archief",
        type: "navigation",
        title: "Archief",
        subtitle: "Gearchiveerde items",
        icon: <Archive className="size-4" />,
        action: () => router.push("/archief"),
        keywords: ["archive", "oud", "verwijderd", "history"],
      },
      {
        id: "nav-klanten",
        type: "navigation",
        title: "Klanten",
        subtitle: "Klantenbeheer",
        icon: <Users className="size-4" />,
        action: () => router.push("/klanten"),
        keywords: ["customers", "clients", "beheer", "contacten"],
      },
      {
        id: "nav-medewerkers",
        type: "navigation",
        title: "Medewerkers",
        subtitle: "Teamleden beheren",
        icon: <UsersRound className="size-4" />,
        action: () => router.push("/medewerkers"),
        keywords: ["employees", "team", "personeel", "collega"],
      },
      {
        id: "nav-wagenpark",
        type: "navigation",
        title: "Wagenpark",
        subtitle: "Voertuigen beheren",
        icon: <Truck className="size-4" />,
        action: () => router.push("/wagenpark"),
        keywords: ["vehicles", "auto", "bus", "fleet", "voertuig"],
      },
      {
        id: "nav-rapportages",
        type: "navigation",
        title: "Rapportages",
        subtitle: "Rapporten en analyses",
        icon: <BarChart3 className="size-4" />,
        action: () => router.push("/rapportages"),
        keywords: ["reports", "analytics", "statistieken", "data"],
      },
      {
        id: "nav-prijsboek",
        type: "navigation",
        title: "Prijsboek",
        subtitle: "Producten en prijzen beheren",
        icon: <BookOpen className="size-4" />,
        action: () => router.push("/prijsboek"),
        keywords: ["products", "prices", "catalog", "catalogus", "tarieven"],
      },
      {
        id: "nav-instellingen",
        type: "navigation",
        title: "Instellingen",
        subtitle: "App configuratie",
        icon: <Settings className="size-4" />,
        action: () => router.push("/instellingen"),
        keywords: ["settings", "config", "preferences", "configuratie"],
      },
      {
        id: "nav-machines",
        type: "navigation",
        title: "Machinepark",
        subtitle: "Machines en gereedschap",
        icon: <Wrench className="size-4" />,
        action: () => router.push("/instellingen/machines"),
        keywords: ["machines", "equipment", "gereedschap", "tools"],
      },
      {
        id: "nav-gebruikers",
        type: "navigation",
        title: "Gebruikersbeheer",
        subtitle: "Toegang en rechten",
        icon: <Shield className="size-4" />,
        action: () => router.push("/gebruikers"),
        keywords: ["users", "permissions", "rechten", "toegang", "admin"],
      },
      {
        id: "nav-profiel",
        type: "navigation",
        title: "Profiel",
        subtitle: "Accountinstellingen",
        icon: <User className="size-4" />,
        action: () => router.push("/profiel"),
        keywords: ["account", "profile", "user", "mijn"],
      },
    ],
    [router]
  );

  // Handle sign out
  const handleSignOut = useCallback(() => {
    signOut({ redirectUrl: "/sign-in" });
  }, [signOut]);

  // Handle theme toggle
  const handleThemeToggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  // Default action items
  const actionItems: CommandItemType[] = useMemo(
    () => [
      {
        id: "action-nieuwe-offerte-aanleg",
        type: "action",
        title: "Nieuwe offerte aanleg",
        subtitle: "Start een nieuwe tuinaanleg offerte",
        icon: <Shovel className="size-4" />,
        action: () => router.push("/offertes/nieuw/aanleg"),
        keywords: ["new", "create", "aanleg", "tuin", "nieuw", "offerte"],
      },
      {
        id: "action-nieuwe-offerte-onderhoud",
        type: "action",
        title: "Nieuwe offerte onderhoud",
        subtitle: "Start een nieuwe onderhoudsofferte",
        icon: <Trees className="size-4" />,
        action: () => router.push("/offertes/nieuw/onderhoud"),
        keywords: ["new", "create", "onderhoud", "maintenance", "nieuw", "offerte"],
      },
      {
        id: "action-nieuwe-klant",
        type: "action",
        title: "Nieuwe klant",
        subtitle: "Voeg een nieuwe klant toe",
        icon: <Plus className="size-4" />,
        action: () => router.push("/klanten?nieuw=true"),
        keywords: ["new", "customer", "client", "toevoegen", "nieuw", "klant"],
      },
      {
        id: "action-thema-wisselen",
        type: "action",
        title: "Thema wisselen",
        subtitle: mounted ? `Wissel naar ${theme === "dark" ? "licht" : "donker"} thema` : "Wissel thema",
        icon: mounted && theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />,
        action: handleThemeToggle,
        keywords: ["theme", "dark", "light", "donker", "licht", "mode", "nacht", "dag"],
      },
      {
        id: "action-uitloggen",
        type: "action",
        title: "Uitloggen",
        subtitle: "Log uit van je account",
        icon: <LogOut className="size-4" />,
        action: handleSignOut,
        keywords: ["logout", "signout", "exit", "afmelden", "uit"],
      },
    ],
    [router, mounted, theme, handleThemeToggle, handleSignOut]
  );

  // All items combined
  const allItems = useMemo(
    () => [...navigationItems, ...actionItems, ...additionalItems],
    [navigationItems, actionItems, additionalItems]
  );

  // Configure Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(allItems, {
      keys: [
        { name: "title", weight: 2 },
        { name: "subtitle", weight: 1 },
        { name: "keywords", weight: 1.5 },
      ],
      threshold: 0.4, // Lower = stricter matching
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 1,
    });
  }, [allItems]);

  // Filter items based on search using fuzzy matching
  const filteredItems = useMemo(() => {
    if (!search) return allItems;
    const results = fuse.search(search);
    return results.map((result) => result.item);
  }, [allItems, fuse, search]);

  // Group items by type
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItemType[]> = {
      navigation: [],
      action: [],
      offerte: [],
      klant: [],
    };
    for (const item of filteredItems) {
      groups[item.type]?.push(item);
    }
    return groups;
  }, [filteredItems]);

  // Get recent items that are still valid
  const validRecentItems = useMemo(() => {
    if (search) return []; // Don't show recent when searching
    return recentItems
      .map((recent) => allItems.find((item) => item.id === recent.id))
      .filter((item): item is CommandItemType => item !== undefined)
      .slice(0, 3);
  }, [recentItems, allItems, search]);

  // Register keyboard shortcuts - Cmd+K (primary) and Cmd+. (alternative)
  useKeyboardShortcuts([
    {
      key: "k",
      meta: true,
      description: "Open command palette",
      action: () => setOpen(true),
      allowInInput: true, // Allow Cmd+K even in inputs
    },
    {
      key: ".",
      meta: true,
      description: "Open command palette (alternative)",
      action: () => setOpen(true),
    },
  ]);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const modKey = getModifierKey();

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Zoek naar navigatie of acties"
      showCloseButton={false}
    >
      <CommandInput
        placeholder="Zoek naar pagina's, acties..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>
          <div className="flex flex-col items-center gap-2 py-6">
            <Search className="size-8 text-muted-foreground" />
            <p>Geen resultaten gevonden.</p>
            <p className="text-xs text-muted-foreground">
              Probeer een andere zoekterm
            </p>
          </div>
        </CommandEmpty>

        {/* Recent Items */}
        {validRecentItems.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {validRecentItems.map((item) => (
                <CommandItem
                  key={`recent-${item.id}`}
                  value={`recent-${item.id}`}
                  onSelect={() => navigateTo(item)}
                >
                  <Clock className="size-4 mr-2 text-muted-foreground" />
                  {item.icon}
                  <span className="ml-2">{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.subtitle}
                    </span>
                  )}
                  {item.shortcut && (
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        {groupedItems.navigation.length > 0 && (
          <CommandGroup heading="Navigatie">
            {groupedItems.navigation.map((item) => (
              <CommandItem
                key={item.id}
                value={item.id}
                onSelect={() => navigateTo(item)}
              >
                {item.icon}
                <span className="ml-2">{item.title}</span>
                {item.subtitle && (
                  <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
                    {item.subtitle}
                  </span>
                )}
                {item.shortcut && (
                  <CommandShortcut>{item.shortcut}</CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Actions */}
        {groupedItems.action.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Acties">
              {groupedItems.action.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => navigateTo(item)}
                >
                  {item.icon}
                  <span className="ml-2">{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 text-xs text-muted-foreground hidden sm:inline">
                      {item.subtitle}
                    </span>
                  )}
                  {item.shortcut && (
                    <CommandShortcut>{item.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Offertes (for additional items) */}
        {groupedItems.offerte.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Offertes">
              {groupedItems.offerte.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => navigateTo(item)}
                >
                  {item.icon}
                  <span className="ml-2">{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Klanten (for additional items) */}
        {groupedItems.klant.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Klanten">
              {groupedItems.klant.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => navigateTo(item)}
                >
                  {item.icon}
                  <span className="ml-2">{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {item.subtitle}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer with keyboard hints */}
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{modKey}K</kbd>
            <span>openen</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>
            <span>selecteren</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
            <span>sluiten</span>
          </span>
        </div>
        <span className="hidden sm:inline text-muted-foreground/70">Typ om te zoeken</span>
      </div>
    </CommandDialog>
  );
}
