import { Skeleton } from "@/components/ui/skeleton";

/**
 * Projectplanning wacht op vier queries en toonde zelf alleen een spinner,
 * met daarvóór de projectdetail-skeleton uit de parent-boundary. Deze
 * skeleton volgt de echte opbouw: kop met actieknoppen, voortgangsstepper,
 * de planningskaart en de zijkolom-indeling (2/3 + 1/3).
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
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Projectplanning laden...</span>

        {/* Kop: terugknop + titel, actieknoppen rechts */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-56" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>

        {/* Voortgangsstepper */}
        <div className="rounded-xl border bg-card p-4 md:p-6">
          <div className="flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-1 items-center gap-2">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-20" />
                {i < 4 && <Skeleton className="h-0.5 flex-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Planningskaart met kop, inhoud en voettekst */}
        <div className="rounded-xl border bg-card">
          <div className="p-6 pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </div>
              </div>
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
          <div className="space-y-4 p-6 pt-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-28" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
          <div className="border-t p-6 pt-4">
            <Skeleton className="h-9 w-40" />
          </div>
        </div>

        {/* Onderste raster: 2/3 inhoud + 1/3 zijkolom */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border bg-card p-6">
              <Skeleton className="h-5 w-36 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-xl border bg-card p-6">
              <Skeleton className="h-5 w-28 mb-4" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
