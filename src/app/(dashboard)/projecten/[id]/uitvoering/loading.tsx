import { ProjectPaginaSkeleton } from "@/components/skeletons/detail-skeletons";

/**
 * Skeleton van de uitvoering in de opbouw van het redesign (okt 2026):
 * gedeelde projectkop met fase-tabs, urenbegroting en registraties links,
 * volgende stap rechts — zoals planning/loading.tsx.
 */
export default function ProjectUitvoeringLoading() {
  return (
    <ProjectPaginaSkeleton
      label="Uitvoering laden..."
      metBreadcrumb
      hoofdPanelen={2}
      zijPanelen={1}
    />
  );
}
