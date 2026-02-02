"use client";

import { useState, useCallback, useMemo } from "react";

// Generic filter state type - each page can define its own filter structure
export type FilterState = Record<string, unknown>;

// Preset structure
export interface FilterPreset<T extends FilterState = FilterState> {
  id: string;
  name: string;
  filters: T;
  isDefault?: boolean;
  createdAt: number;
}

// Storage key for presets per page
type PageKey = "offertes" | "projecten" | "planning" | "uren";

const STORAGE_KEY_PREFIX = "filter-presets-";

function getStorageKey(pageKey: PageKey): string {
  return `${STORAGE_KEY_PREFIX}${pageKey}`;
}

// Generate unique ID
function generateId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Default presets for each page
export function getDefaultPresets<T extends FilterState>(pageKey: PageKey): FilterPreset<T>[] {
  const basePresets: Record<PageKey, FilterPreset[]> = {
    offertes: [
      {
        id: "default-openstaand",
        name: "Openstaande offertes",
        filters: {
          status: "concept,verzonden",
          type: "alle",
        },
        isDefault: true,
        createdAt: 0,
      },
      {
        id: "default-deze-maand",
        name: "Deze maand",
        filters: {
          dateFrom: getStartOfMonth(),
          dateTo: getEndOfMonth(),
          type: "alle",
        },
        isDefault: true,
        createdAt: 0,
      },
    ],
    projecten: [
      {
        id: "default-actief",
        name: "Actieve projecten",
        filters: {
          status: "gepland,in_uitvoering",
        },
        isDefault: true,
        createdAt: 0,
      },
      {
        id: "default-afgerond",
        name: "Afgeronde projecten",
        filters: {
          status: "afgerond,nacalculatie_compleet",
        },
        isDefault: true,
        createdAt: 0,
      },
    ],
    planning: [
      {
        id: "default-deze-week",
        name: "Deze week",
        filters: {
          dateRange: "week",
        },
        isDefault: true,
        createdAt: 0,
      },
      {
        id: "default-mijn-projecten",
        name: "Mijn projecten",
        filters: {
          medewerker: "current",
        },
        isDefault: true,
        createdAt: 0,
      },
    ],
    uren: [
      {
        id: "default-deze-week",
        name: "Deze week",
        filters: {
          dateRange: "week",
          medewerker: "all",
          project: "all",
        },
        isDefault: true,
        createdAt: 0,
      },
      {
        id: "default-mijn-uren",
        name: "Mijn uren",
        filters: {
          dateRange: "month",
          medewerker: "current",
          project: "all",
        },
        isDefault: true,
        createdAt: 0,
      },
      {
        id: "default-deze-maand",
        name: "Deze maand",
        filters: {
          dateRange: "month",
          medewerker: "all",
          project: "all",
        },
        isDefault: true,
        createdAt: 0,
      },
    ],
  };

  return basePresets[pageKey] as FilterPreset<T>[];
}

// Helper functions for date calculations
function getStartOfMonth(): string {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function getEndOfMonth(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

// Helper function to load presets from localStorage
function loadPresetsFromStorage<T extends FilterState>(pageKey: PageKey): FilterPreset<T>[] {
  if (typeof window === "undefined") {
    return getDefaultPresets<T>(pageKey);
  }

  try {
    const stored = localStorage.getItem(getStorageKey(pageKey));
    if (stored) {
      const parsed = JSON.parse(stored) as FilterPreset<T>[];
      // Merge with default presets (defaults always first, user presets after)
      const defaults = getDefaultPresets<T>(pageKey);
      const userPresets = parsed.filter(p => !p.isDefault);
      return [...defaults, ...userPresets];
    }
  } catch (error) {
    console.error("Error loading filter presets:", error);
  }
  return getDefaultPresets<T>(pageKey);
}

// Hook for managing filter presets
export function useFilterPresets<T extends FilterState>(pageKey: PageKey) {
  // Initialize with loaded presets (lazy initialization)
  const [presets, setPresets] = useState<FilterPreset<T>[]>(() =>
    loadPresetsFromStorage<T>(pageKey)
  );

  // Save presets to localStorage (only user presets, not defaults)
  const savePresets = useCallback((newPresets: FilterPreset<T>[]) => {
    if (typeof window === "undefined") return;

    try {
      const userPresets = newPresets.filter(p => !p.isDefault);
      localStorage.setItem(getStorageKey(pageKey), JSON.stringify(userPresets));
    } catch (error) {
      console.error("Error saving filter presets:", error);
    }
  }, [pageKey]);

  // Add a new preset
  const addPreset = useCallback((name: string, filters: T): FilterPreset<T> => {
    const newPreset: FilterPreset<T> = {
      id: generateId(),
      name,
      filters,
      isDefault: false,
      createdAt: Date.now(),
    };

    setPresets(prev => {
      const updated = [...prev, newPreset];
      savePresets(updated);
      return updated;
    });

    return newPreset;
  }, [savePresets]);

  // Update an existing preset
  const updatePreset = useCallback((id: string, name: string, filters: T) => {
    setPresets(prev => {
      const updated = prev.map(p =>
        p.id === id && !p.isDefault
          ? { ...p, name, filters }
          : p
      );
      savePresets(updated);
      return updated;
    });
  }, [savePresets]);

  // Delete a preset (only user presets can be deleted)
  const deletePreset = useCallback((id: string) => {
    setPresets(prev => {
      const updated = prev.filter(p => p.id !== id || p.isDefault);
      savePresets(updated);
      return updated;
    });
  }, [savePresets]);

  // Get a preset by ID
  const getPreset = useCallback((id: string): FilterPreset<T> | undefined => {
    return presets.find(p => p.id === id);
  }, [presets]);

  // Separate default and user presets for display
  const { defaultPresets, userPresets } = useMemo(() => {
    return {
      defaultPresets: presets.filter(p => p.isDefault),
      userPresets: presets.filter(p => !p.isDefault),
    };
  }, [presets]);

  return {
    presets,
    defaultPresets,
    userPresets,
    addPreset,
    updatePreset,
    deletePreset,
    getPreset,
  };
}

// Types for specific page filters
export interface OfferteFilterState extends FilterState {
  status?: string;
  type: "alle" | "aanleg" | "onderhoud";
  dateFrom?: string;
  dateTo?: string;
  amountMin?: string;
  amountMax?: string;
}

export interface ProjectenFilterState extends FilterState {
  status?: string;
  searchQuery?: string;
}

export interface PlanningFilterState extends FilterState {
  dateRange?: "week" | "month" | "all";
  medewerker?: string;
}

export interface UrenFilterState extends FilterState {
  dateRange?: "week" | "month" | "quarter" | "year" | "all";
  medewerker?: string;
  project?: string;
  searchTerm?: string;
}
