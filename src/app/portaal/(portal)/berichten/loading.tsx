import { Skeleton } from "@/components/ui/skeleton";

export default function PortaalBerichtenLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Berichten laden...</span>

      {/* Page header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div>
          <Skeleton className="h-7 w-32 mb-1" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Message list */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] p-4"
          >
            <div className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
