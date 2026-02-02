import {
  Calendar,
  Hammer,
  CheckCircle,
  Calculator,
  Receipt,
  type LucideIcon,
} from "lucide-react";

export type ProjectStatus =
  | "voorcalculatie"
  | "gepland"
  | "in_uitvoering"
  | "afgerond"
  | "nacalculatie_compleet"
  | "gefactureerd";

export interface ProjectStatusConfig {
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

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, ProjectStatusConfig> = {
  voorcalculatie: {
    label: "Voorcalculatie",
    description: "Legacy status - project is in voorcalculatie fase",
    icon: Calculator,
    color: {
      bg: "bg-status-voorcalculatie",
      text: "text-status-voorcalculatie-text",
      border: "border-status-voorcalculatie-border",
      dot: "bg-status-voorcalculatie-dot",
    },
  },
  gepland: {
    label: "Gepland",
    description: "Project is gepland en klaar voor uitvoering",
    icon: Calendar,
    color: {
      bg: "bg-status-gepland",
      text: "text-status-gepland-text",
      border: "border-status-gepland-border",
      dot: "bg-status-gepland-dot",
    },
  },
  in_uitvoering: {
    label: "In Uitvoering",
    description: "Project wordt momenteel uitgevoerd",
    icon: Hammer,
    color: {
      bg: "bg-status-in-uitvoering",
      text: "text-status-in-uitvoering-text",
      border: "border-status-in-uitvoering-border",
      dot: "bg-status-in-uitvoering-dot",
    },
  },
  afgerond: {
    label: "Afgerond",
    description: "Project is afgerond",
    icon: CheckCircle,
    color: {
      bg: "bg-status-afgerond",
      text: "text-status-afgerond-text",
      border: "border-status-afgerond-border",
      dot: "bg-status-afgerond-dot",
    },
  },
  nacalculatie_compleet: {
    label: "Nacalculatie",
    description: "Nacalculatie is voltooid",
    icon: Calculator,
    color: {
      bg: "bg-status-nacalculatie",
      text: "text-status-nacalculatie-text",
      border: "border-status-nacalculatie-border",
      dot: "bg-status-nacalculatie-dot",
    },
  },
  gefactureerd: {
    label: "Gefactureerd",
    description: "Project is gefactureerd",
    icon: Receipt,
    color: {
      bg: "bg-status-gefactureerd",
      text: "text-status-gefactureerd-text",
      border: "border-status-gefactureerd-border",
      dot: "bg-status-gefactureerd-dot",
    },
  },
};

export const ALL_PROJECT_STATUSES: ProjectStatus[] = [
  "voorcalculatie",
  "gepland",
  "in_uitvoering",
  "afgerond",
  "nacalculatie_compleet",
  "gefactureerd",
];

export function getProjectStatusConfig(status: string): ProjectStatusConfig {
  return PROJECT_STATUS_CONFIG[status as ProjectStatus] ?? PROJECT_STATUS_CONFIG.gepland;
}
