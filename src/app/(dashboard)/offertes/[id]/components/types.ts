// Projectstatuskleuren uit de centrale bron (WS4): zelfde status = zelfde kleur.
import { PROJECT_STATUS_CONFIG as CENTRAL_PROJECT_STATUS_CONFIG } from "@/lib/constants/statuses";

export type ProjectStatus = "voorcalculatie" | "gepland" | "in_uitvoering" | "afgerond" | "nacalculatie_compleet";

export const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bgColor: string }> = Object.fromEntries(
  (
    [
      "voorcalculatie",
      "gepland",
      "in_uitvoering",
      "afgerond",
      "nacalculatie_compleet",
    ] as const
  ).map((key) => [
    key,
    {
      label: CENTRAL_PROJECT_STATUS_CONFIG[key].label,
      color: CENTRAL_PROJECT_STATUS_CONFIG[key].color.text,
      bgColor: CENTRAL_PROJECT_STATUS_CONFIG[key].color.bg,
    },
  ])
) as Record<ProjectStatus, { label: string; color: string; bgColor: string }>;
