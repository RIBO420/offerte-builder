"use client";

import { useState, useMemo, useCallback } from "react";

export interface SortConfig<T> {
  key: keyof T | null;
  direction: "asc" | "desc";
}

export function useTableSort<T>(data: T[], defaultKey?: keyof T) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    key: defaultKey || null,
    direction: "asc",
  });

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key!];
      const bVal = b[sortConfig.key!];

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortConfig.direction === "asc" ? 1 : -1;
      if (bVal == null) return sortConfig.direction === "asc" ? -1 : 1;

      // Handle string comparison (case-insensitive)
      if (typeof aVal === "string" && typeof bVal === "string") {
        const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
        return sortConfig.direction === "asc" ? comparison : -comparison;
      }

      // Handle numeric and other comparisons
      if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const toggleSort = useCallback((key: keyof T) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const resetSort = useCallback(() => {
    setSortConfig({
      key: defaultKey || null,
      direction: "asc",
    });
  }, [defaultKey]);

  return { sortedData, sortConfig, toggleSort, resetSort };
}
