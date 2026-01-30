"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export interface CommandItem {
  id: string;
  type: "navigation" | "action" | "offerte" | "klant";
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  shortcut?: string;
  action: () => void;
  keywords?: string[]; // voor fuzzy search
}

interface CommandContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  recentItems: CommandItem[];
  addRecentItem: (item: CommandItem) => void;
  clearRecentItems: () => void;
}

const CommandContext = createContext<CommandContextValue | undefined>(undefined);

const RECENT_ITEMS_KEY = "command-palette-recent-items";
const MAX_RECENT_ITEMS = 5;

interface StoredRecentItem {
  id: string;
  type: CommandItem["type"];
  title: string;
  subtitle?: string;
  timestamp: number;
}

export function CommandProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<CommandItem[]>([]);

  // Load recent items from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_ITEMS_KEY);
      if (stored) {
        const parsed: StoredRecentItem[] = JSON.parse(stored);
        // We only store the IDs and basic info; actual items need to be matched
        // from the available commands when rendering
        setRecentItems(
          parsed.map((item) => ({
            id: item.id,
            type: item.type,
            title: item.title,
            subtitle: item.subtitle,
            action: () => {}, // Will be replaced when rendering
          }))
        );
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const addRecentItem = useCallback((item: CommandItem) => {
    setRecentItems((prev) => {
      // Remove if already exists
      const filtered = prev.filter((i) => i.id !== item.id);
      // Add to front
      const updated = [item, ...filtered].slice(0, MAX_RECENT_ITEMS);

      // Persist to localStorage
      try {
        const toStore: StoredRecentItem[] = updated.map((i) => ({
          id: i.id,
          type: i.type,
          title: i.title,
          subtitle: i.subtitle,
          timestamp: Date.now(),
        }));
        localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(toStore));
      } catch {
        // Ignore localStorage errors
      }

      return updated;
    });
  }, []);

  const clearRecentItems = useCallback(() => {
    setRecentItems([]);
    try {
      localStorage.removeItem(RECENT_ITEMS_KEY);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return (
    <CommandContext.Provider
      value={{
        open,
        setOpen,
        recentItems,
        addRecentItem,
        clearRecentItems,
      }}
    >
      {children}
    </CommandContext.Provider>
  );
}

export function useCommand() {
  const context = useContext(CommandContext);
  if (context === undefined) {
    throw new Error("useCommand must be used within a CommandProvider");
  }
  return context;
}
