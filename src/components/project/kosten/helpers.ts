import { Package, Users, Wrench, MoreHorizontal } from "lucide-react";

// Cost type configuration
export const kostenTypeConfig = {
  materiaal: { label: "Materiaal", icon: Package, color: "bg-blue-500" },
  arbeid: { label: "Arbeid", icon: Users, color: "bg-green-500" },
  machine: { label: "Machine", icon: Wrench, color: "bg-orange-500" },
  overig: { label: "Overig", icon: MoreHorizontal, color: "bg-gray-500" },
} as const;

// Scope display names
export const scopeDisplayNames: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gazon",
  houtwerk: "Houtwerk",
  water_elektra: "Water/Elektra",
  specials: "Specials",
  gras_onderhoud: "Gras Onderhoud",
  borders_onderhoud: "Borders Onderhoud",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
  algemeen: "Algemeen",
  machines: "Machines",
  materialen: "Materialen",
};

export function getDeviationStatus(percentage: number): "good" | "warning" | "critical" {
  const absPercentage = Math.abs(percentage);
  if (absPercentage <= 5) return "good";
  if (absPercentage <= 15) return "warning";
  return "critical";
}

export function getDeviationColors(status: "good" | "warning" | "critical") {
  switch (status) {
    case "good":
      return {
        text: "text-green-600 dark:text-green-400",
        bg: "bg-green-100 dark:bg-green-900/30",
        border: "border-green-500",
      };
    case "warning":
      return {
        text: "text-yellow-600 dark:text-yellow-400",
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        border: "border-yellow-500",
      };
    case "critical":
      return {
        text: "text-red-600 dark:text-red-400",
        bg: "bg-red-100 dark:bg-red-900/30",
        border: "border-red-500",
      };
  }
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

export function formatCurrencyShort(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// Summary display data type
export interface KostenDisplayData {
  geplandeKosten: { materiaal: number; arbeid: number; machine: number; totaal: number };
  werkelijkeKosten: { materiaal: number; arbeid: number; machine: number; overig: number; totaal: number };
  afwijking: { materiaal: number; arbeid: number; machine: number; overig: number; totaal: number };
  afwijkingPercentage: { materiaal: number; arbeid: number; machine: number; totaal: number };
}
