import { Skeleton } from "@/components/ui/skeleton";

export default function PortaalProjectenLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Projecten laden...</span>

      {/* Page header */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div>
          <Skeleton className="h-7 w-32 mb-1" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>

      {/* Project cards */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a] p-5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-32 mt-1.5" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <div className="flex gap-2 mt-4">
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
