import { Skeleton } from "@/components/ui/skeleton";
import { CardTableSkeleton } from "@/components/ui/skeleton-card";

export default function PrijsboekLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Prijsboek laden...</span>

      {/* Page header skeleton */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8">
        {/* Title + action button */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-36 mb-2" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-md" />
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-sm">
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Table */}
        <CardTableSkeleton rows={8} />
      </div>
    </div>
  );
}
