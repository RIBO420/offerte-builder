import { Skeleton } from "@/components/ui/skeleton";
import { StatsGridSkeleton, CardTableSkeleton } from "@/components/ui/skeleton-card";

export default function InkoopLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Inkoop laden...</span>

      {/* Page header skeleton */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Title + action button */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-44 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Stats grid */}
        <StatsGridSkeleton count={4} columns={4} />

        {/* Search */}
        <div className="relative w-full sm:max-w-sm">
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Table */}
        <CardTableSkeleton rows={7} />
      </div>
    </div>
  );
}
