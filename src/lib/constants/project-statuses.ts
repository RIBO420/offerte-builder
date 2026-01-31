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
      bg: "bg-blue-100 dark:bg-blue-900/30",
      text: "text-blue-700 dark:text-blue-300",
      border: "border-blue-300 dark:border-blue-700",
      dot: "bg-blue-500",
    },
  },
  gepland: {
    label: "Gepland",
    description: "Project is gepland en klaar voor uitvoering",
    icon: Calendar,
    color: {
      bg: "bg-purple-100 dark:bg-purple-900/30",
      text: "text-purple-700 dark:text-purple-300",
      border: "border-purple-300 dark:border-purple-700",
      dot: "bg-purple-500",
    },
  },
  in_uitvoering: {
    label: "In Uitvoering",
    description: "Project wordt momenteel uitgevoerd",
    icon: Hammer,
    color: {
      bg: "bg-amber-100 dark:bg-amber-900/30",
      text: "text-amber-700 dark:text-amber-300",
      border: "border-amber-300 dark:border-amber-700",
      dot: "bg-amber-500",
    },
  },
  afgerond: {
    label: "Afgerond",
    description: "Project is afgerond",
    icon: CheckCircle,
    color: {
      bg: "bg-green-100 dark:bg-green-900/30",
      text: "text-green-700 dark:text-green-300",
      border: "border-green-300 dark:border-green-700",
      dot: "bg-green-500",
    },
  },
  nacalculatie_compleet: {
    label: "Nacalculatie",
    description: "Nacalculatie is voltooid",
    icon: Calculator,
    color: {
      bg: "bg-teal-100 dark:bg-teal-900/30",
      text: "text-teal-700 dark:text-teal-300",
      border: "border-teal-300 dark:border-teal-700",
      dot: "bg-teal-500",
    },
  },
  gefactureerd: {
    label: "Gefactureerd",
    description: "Project is gefactureerd",
    icon: Receipt,
    color: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      text: "text-emerald-700 dark:text-emerald-300",
      border: "border-emerald-300 dark:border-emerald-700",
      dot: "bg-emerald-500",
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
