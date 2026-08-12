import { Skeleton } from "@/components/ui/skeleton";
import { QCPageSkeleton } from "@/components/skeletons";

/**
 * Hergebruikt exact de skeleton die page.tsx zelf toont terwijl de
 * QC-controles laden. Zonder dit bestand kreeg de gebruiker eerst de
 * projectdetail-skeleton van de parent-boundary te zien — andere layout,
 * dus een zichtbare sprong.
 */
export default function ProjectKwaliteitLoading() {
  return (
    <>
      {/* Breadcrumbbalk (PageHeader): Dashboard / Projecten / <project> / Kwaliteit */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      <QCPageSkeleton />
    </>
  );
}
