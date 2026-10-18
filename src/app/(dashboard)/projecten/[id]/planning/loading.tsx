import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton van de projectplanning, in de opbouw van het redesign (okt 2026):
 * de gedeelde projectkop met fase-tabs, scopesecties links en de zijkolom
 * (doorlooptijd, voertuigen) rechts.
 */
export default function ProjectPlanningLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Projecten / <project> / Planning */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div
        className="flex flex-1 flex-col gap-5 p-4 md:p-8"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Projectplanning laden...</span>

        {/* Projectkop: naam + status, regel eronder, fase-tabs */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <Skeleton className="h-8 w-80 max-w-full" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-10 w-36" />
            </div>
          </div>
          <Skeleton className="h-11 w-full" />
        </div>

        {/* Scopes links, doorlooptijd en voertuigen rechts */}
        <div className="@container/planning">
          <div className="grid items-start gap-5 @4xl/planning:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
            <div className="flex min-w-0 flex-col gap-4">
              {Array.from({ length: 2 }).map((_, s) => (
                <div key={s} className="overflow-hidden rounded-lg border bg-card">
                  <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2.5">
                    <Skeleton className="size-2 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="ml-auto h-3 w-40" />
                  </div>
                  <div className="space-y-3 p-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-md" />
                        <Skeleton className="h-4 min-w-0 flex-1" />
                        <Skeleton className="h-4 w-10" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-lg border bg-card">
                  <div className="border-b bg-muted/40 px-3 py-2.5">
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
