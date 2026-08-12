import { Skeleton } from "@/components/ui/skeleton";

/**
 * Nacalculatie heeft een eigen, afwijkende layout (smallere gaps, extra
 * onderrand voor de mobiele actiebalk, margekaart bovenaan, drie tabbladen).
 * De parent-boundary toonde hier de projectdetail-skeleton, wat een zichtbare
 * sprong gaf. Deze skeleton volgt de echte opbouw van page.tsx.
 */
export default function ProjectNacalculatieLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Projecten / <project> / Nacalculatie */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div
        className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6 pb-28 md:pb-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Nacalculatie laden...</span>

        {/* Kop: terugknop + titel met statusbadges */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-7 w-56" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>

        {/* Toelichtingskaart (gestippeld) */}
        <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 shrink-0 rounded" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>

        {/* Margekaart: samenvatting links, twee kengetallen rechts */}
        <div className="rounded-xl border-2 bg-card px-4 py-4 md:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:w-auto md:gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>

        {/* Voortgangsstepper */}
        <div className="rounded-xl border bg-card p-3 md:p-6">
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

        {/* Twee actiekaarten naast elkaar */}
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border bg-card py-8"
            >
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-9 w-36" />
            </div>
          ))}
        </div>

        {/* Tabbladen: overzicht / details / leerfeedback */}
        <div className="space-y-4 md:space-y-6">
          <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-muted/50 p-1 md:flex md:w-auto">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md md:w-32" />
            ))}
          </div>

          <div className="rounded-xl border bg-card">
            <div className="border-b p-6 pb-4">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
