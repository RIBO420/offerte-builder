// Project status configuratie - WCAG AA compliant colors (4.5:1 contrast ratio)
export type ProjectStatus = "voorcalculatie" | "gepland" | "in_uitvoering" | "afgerond" | "nacalculatie_compleet";

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string }> = {
  voorcalculatie: {
    label: "Voorcalculatie",
    color: "text-blue-800 dark:text-blue-200",
    bgColor: "bg-blue-200 dark:bg-blue-900",
  },
  gepland: {
    label: "Gepland",
    color: "text-purple-800 dark:text-purple-200",
    bgColor: "bg-purple-200 dark:bg-purple-900",
  },
  in_uitvoering: {
    label: "In uitvoering",
    color: "text-amber-800 dark:text-amber-200",
    bgColor: "bg-amber-200 dark:bg-amber-900",
  },
  afgerond: {
    label: "Afgerond",
    color: "text-green-800 dark:text-green-200",
    bgColor: "bg-green-200 dark:bg-green-900",
  },
  nacalculatie_compleet: {
    label: "Nacalculatie compleet",
    color: "text-emerald-800 dark:text-emerald-200",
    bgColor: "bg-emerald-200 dark:bg-emerald-900",
  },
};
