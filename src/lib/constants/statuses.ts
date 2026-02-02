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
    description: "Offerte is in bewerking en nog niet klaar voor voorcalculatie",
    icon: Pencil,
    color: {
      bg: "bg-status-concept",
      text: "text-status-concept-text",
      border: "border-status-concept-border",
      dot: "bg-status-concept-dot",
    },
  },
  voorcalculatie: {
    label: "Voorcalculatie",
    description: "Voorcalculatie is ingevuld en offerte is klaar om te verzenden",
    icon: Calculator,
    color: {
      bg: "bg-status-voorcalculatie",
      text: "text-status-voorcalculatie-text",
      border: "border-status-voorcalculatie-border",
      dot: "bg-status-voorcalculatie-dot",
    },
  },
  verzonden: {
    label: "Verzonden",
    description: "Offerte is naar de klant verzonden",
    icon: Send,
    color: {
      bg: "bg-status-verzonden",
      text: "text-status-verzonden-text",
      border: "border-status-verzonden-border",
      dot: "bg-status-verzonden-dot",
    },
  },
  geaccepteerd: {
    label: "Geaccepteerd",
    description: "Klant heeft de offerte geaccepteerd",
    icon: ThumbsUp,
    color: {
      bg: "bg-status-geaccepteerd",
      text: "text-status-geaccepteerd-text",
      border: "border-status-geaccepteerd-border",
      dot: "bg-status-geaccepteerd-dot",
    },
  },
  afgewezen: {
    label: "Afgewezen",
    description: "Klant heeft de offerte afgewezen",
    icon: XCircle,
    color: {
      bg: "bg-status-afgewezen",
      text: "text-status-afgewezen-text",
      border: "border-status-afgewezen-border",
      dot: "bg-status-afgewezen-dot",
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
