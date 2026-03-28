import { Skeleton } from "@/components/ui/skeleton";

export default function PortaalDocumentenLoading() {
  return (
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Documenten laden...</span>

      {/* Page header */}
      <div>
        <Skeleton className="h-7 w-36 mb-1" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Document section cards */}
      {[1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-gray-200 dark:border-[#2a3e2a] bg-white dark:bg-[#1a2e1a]"
        >
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
          <div className="h-px bg-gray-100 dark:bg-[#2a3e2a]" />
          <div className="p-5 pt-3 space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center justify-between py-3">
                <div>
                  <Skeleton className="h-4 w-28 mb-1" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
