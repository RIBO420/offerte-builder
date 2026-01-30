"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCurrentUser } from "./use-current-user";

export type DateRangePreset = "deze-maand" | "dit-kwartaal" | "dit-jaar" | "alles";

interface DateRange {
  startDate: number | undefined;
  endDate: number | undefined;
}

function getDateRangeFromPreset(preset: DateRangePreset): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case "deze-maand": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: startOfMonth.getTime(),
        endDate: today.getTime(),
      };
    }
    case "dit-kwartaal": {
      const quarter = Math.floor(now.getMonth() / 3);
      const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1);
      return {
        startDate: startOfQuarter.getTime(),
        endDate: today.getTime(),
      };
    }
    case "dit-jaar": {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return {
        startDate: startOfYear.getTime(),
        endDate: today.getTime(),
      };
    }
    case "alles":
    default:
      return {
        startDate: undefined,
        endDate: undefined,
      };
  }
}

export function useAnalytics() {
  const { user } = useCurrentUser();
  const [datePreset, setDatePreset] = useState<DateRangePreset>("dit-jaar");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);

  const dateRange = useMemo(() => {
    if (customRange) {
      return customRange;
    }
    return getDateRangeFromPreset(datePreset);
  }, [datePreset, customRange]);

  const analyticsData = useQuery(
    api.analytics.getAnalyticsData,
    user?._id
      ? {
          userId: user._id,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }
      : "skip"
  );

  const setPreset = (preset: DateRangePreset) => {
    setDatePreset(preset);
    setCustomRange(null);
  };

  const setDateRange = (range: DateRange) => {
    setCustomRange(range);
  };

  return {
    // Data
    kpis: analyticsData?.kpis,
    maandelijkseTrend: analyticsData?.maandelijkseTrend ?? [],
    kwartaalOmzet: analyticsData?.kwartaalOmzet ?? [],
    scopeMarges: analyticsData?.scopeMarges ?? [],
    topKlanten: analyticsData?.topKlanten ?? [],
    statusVerdeling: analyticsData?.statusVerdeling,
    typeVerdeling: analyticsData?.typeVerdeling,
    exportData: analyticsData?.exportData ?? [],

    // State
    isLoading: user && analyticsData === undefined,
    datePreset,
    dateRange,

    // Actions
    setPreset,
    setDateRange,
  };
}
