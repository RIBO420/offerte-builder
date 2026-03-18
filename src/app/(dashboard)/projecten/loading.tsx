import { Skeleton } from "@/components/ui/skeleton";
import { StatsGridSkeleton, CardTableSkeleton } from "@/components/ui/skeleton-card";

export default function ProjectenLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Projecten laden...</span>

      {/* Page header skeleton */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
        {/* Title */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Stats grid */}
        <StatsGridSkeleton count={4} columns={4} />

        {/* Action required card */}
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-1" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        {/* Tabs + table */}
        <CardTableSkeleton rows={6} />
      </div>
    </div>
  );
}
