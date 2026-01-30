"use client";

import * as React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  FileText,
  Users,
  BookOpen,
  Settings,
  Plus,
  Shovel,
  Trees,
  BarChart3,
  User,
  Search,
  Clock,
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
  const { open, setOpen, recentItems, addRecentItem } = useCommand();
  const [search, setSearch] = useState("");

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
        action: () => router.push("/"),
        keywords: ["home", "overzicht", "start"],
      },
      {
        id: "nav-offertes",
        type: "navigation",
        title: "Offertes",
        subtitle: "Alle offertes bekijken",
        icon: <FileText className="size-4" />,
        action: () => router.push("/offertes"),
        keywords: ["quotes", "lijst", "overzicht"],
      },
      {
        id: "nav-klanten",
        type: "navigation",
        title: "Klanten",
        subtitle: "Klantenbeheer",
        icon: <Users className="size-4" />,
        action: () => router.push("/klanten"),
        keywords: ["customers", "clients", "beheer"],
      },
      {
        id: "nav-rapportages",
        type: "navigation",
        title: "Rapportages",
        subtitle: "Rapporten en analyses",
        icon: <BarChart3 className="size-4" />,
        action: () => router.push("/rapportages"),
        keywords: ["reports", "analytics", "statistieken"],
      },
      {
        id: "nav-prijsboek",
        type: "navigation",
        title: "Prijsboek",
        subtitle: "Producten en prijzen beheren",
        icon: <BookOpen className="size-4" />,
        action: () => router.push("/prijsboek"),
        keywords: ["products", "prices", "catalog", "catalogus"],
      },
      {
        id: "nav-instellingen",
        type: "navigation",
        title: "Instellingen",
        subtitle: "App configuratie",
        icon: <Settings className="size-4" />,
        action: () => router.push("/instellingen"),
        keywords: ["settings", "config", "preferences"],
      },
      {
        id: "nav-profiel",
        type: "navigation",
        title: "Profiel",
        subtitle: "Accountinstellingen",
        icon: <User className="size-4" />,
        action: () => router.push("/profiel"),
        keywords: ["account", "profile", "user"],
      },
    ],
    [router]
  );

  // Default action items
  const actionItems: CommandItemType[] = useMemo(
    () => [
      {
        id: "action-nieuwe-offerte-aanleg",
        type: "action",
        title: "Nieuwe Aanleg Offerte",
        subtitle: "Start een nieuwe tuinaanleg offerte",
        icon: <Shovel className="size-4" />,
        action: () => router.push("/offertes/nieuw/aanleg"),
        keywords: ["new", "create", "aanleg", "tuin", "nieuw"],
      },
      {
        id: "action-nieuwe-offerte-onderhoud",
        type: "action",
        title: "Nieuwe Onderhoud Offerte",
        subtitle: "Start een nieuwe onderhoudsofferte",
        icon: <Trees className="size-4" />,
        action: () => router.push("/offertes/nieuw/onderhoud"),
        keywords: ["new", "create", "onderhoud", "maintenance", "nieuw"],
      },
      {
        id: "action-nieuwe-klant",
        type: "action",
        title: "Nieuwe Klant",
        subtitle: "Voeg een nieuwe klant toe",
        icon: <Plus className="size-4" />,
        action: () => router.push("/klanten?nieuw=true"),
        keywords: ["new", "customer", "client", "toevoegen", "nieuw"],
      },
    ],
    [router]
  );

  // All items combined
  const allItems = useMemo(
    () => [...navigationItems, ...actionItems, ...additionalItems],
    [navigationItems, actionItems, additionalItems]
  );

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search) return allItems;
    const searchLower = search.toLowerCase();
    return allItems.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(searchLower);
      const subtitleMatch = item.subtitle?.toLowerCase().includes(searchLower);
      const keywordsMatch = item.keywords?.some((kw) =>
        kw.toLowerCase().includes(searchLower)
      );
      return titleMatch || subtitleMatch || keywordsMatch;
    });
  }, [allItems, search]);

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

  // Register keyboard shortcut - only Cmd+. for command palette (safe, no conflicts)
  useKeyboardShortcuts([
    {
      key: ".",
      meta: true,
      description: "Open command palette",
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
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{modKey}.</kbd>
            <span>openen</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
            <span>sluiten</span>
          </span>
        </div>
        <span className="text-muted-foreground/70">Typ om te zoeken</span>
      </div>
    </CommandDialog>
  );
}
