import {
  Pencil,
  Calculator,
  Send,
  ThumbsUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export type OfferteStatus = "concept" | "voorcalculatie" | "verzonden" | "geaccepteerd" | "afgewezen";

export interface StatusConfig {
  label: string;
  description: string;
  icon: LucideIcon;
  color: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
}

export const STATUS_CONFIG: Record<OfferteStatus, StatusConfig> = {
  concept: {
    label: "Concept",
    description: "Offerte is in bewerking en nog niet definitief",
    icon: Pencil,
    color: {
      bg: "bg-gray-100 dark:bg-gray-800",
      text: "text-gray-700 dark:text-gray-300",
      border: "border-gray-300 dark:border-gray-600",
      dot: "bg-gray-500",
    },
  },
  voorcalculatie: {
    label: "Voorcalculatie",
    description: "Voorcalculatie is ingevuld en offerte is klaar om te verzenden",
    icon: Calculator,
    color: {
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-300 dark:border-blue-700",
      dot: "bg-blue-500",
    },
  },
  verzonden: {
    label: "Verzonden",
    description: "Offerte is naar de klant verzonden",
    icon: Send,
    color: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-300 dark:border-amber-700",
      dot: "bg-amber-500",
    },
  },
  geaccepteerd: {
    label: "Geaccepteerd",
    description: "Klant heeft de offerte geaccepteerd",
    icon: ThumbsUp,
    color: {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-300",
      border: "border-green-300 dark:border-green-700",
      dot: "bg-green-500",
    },
  },
  afgewezen: {
    label: "Afgewezen",
    description: "Klant heeft de offerte afgewezen",
    icon: XCircle,
    color: {
      bg: "bg-red-100 dark:bg-red-900/30",
      text: "text-red-700 dark:text-red-300",
      border: "border-red-300 dark:border-red-700",
      dot: "bg-red-500",
    },
  },
};

export const ALL_STATUSES: OfferteStatus[] = [
  "concept",
  "voorcalculatie",
  "verzonden",
  "geaccepteerd",
  "afgewezen",
];

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status as OfferteStatus] ?? STATUS_CONFIG.concept;
}
