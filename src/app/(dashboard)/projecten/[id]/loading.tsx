import { ProjectPaginaSkeleton } from "@/components/skeletons/detail-skeletons";

/**
 * Skeleton van het projectoverzicht in de opbouw van het redesign (okt 2026):
 * gedeelde projectkop met fase-tabs, fasetegels en secties links, zijkolom
 * rechts — zoals planning/loading.tsx.
 */
export default function ProjectDetailLoading() {
  return <ProjectPaginaSkeleton metBreadcrumb kpiTegels={4} hoofdPanelen={1} zijPanelen={2} />;
}
