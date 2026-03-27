import { Skeleton } from "@/components/ui/skeleton";
import { FacturenPageSkeleton } from "@/components/ui/skeleton-card";

export default function FacturenLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Facturen laden...</span>

      {/* Page header skeleton */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        <FacturenPageSkeleton />
      </div>
    </div>
  );
}
