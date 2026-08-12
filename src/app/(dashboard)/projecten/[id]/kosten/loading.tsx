import { Skeleton } from "@/components/ui/skeleton";
import { ProjectKostenSkeleton } from "@/components/skeletons";

/**
 * Zonder eigen loading.tsx viel deze subroute terug op projecten/[id]/loading.tsx
 * — de skeleton van de projectdetailpagina, een heel andere layout. De pagina
 * sprong daardoor bij het binnenkomen. We hergebruiken hier exact de skeleton
 * die page.tsx zelf toont zolang de data laadt, dus de overgang is naadloos.
 */
export default function ProjectKostenLoading() {
  return (
    <>
      {/* Breadcrumbbalk (PageHeader): Dashboard / Projecten / <project> / Kosten */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>

      <ProjectKostenSkeleton />
    </>
  );
}
