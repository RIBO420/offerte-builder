import { Skeleton } from "@/components/ui/skeleton";
import { PlanningPageSkeleton } from "@/components/ui/skeleton-card";

export default function PlanningLoading() {
  return (
    <>
      {/* Breadcrumbbalk */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Zelfde container als de planningpagina (PaginaReveal) */}
      <div className="mx-auto flex w-full max-w-[86rem] flex-1 flex-col p-4 md:p-6">
        <PlanningPageSkeleton />
      </div>
    </>
  );
}
