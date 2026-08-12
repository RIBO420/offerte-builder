import { Skeleton } from "@/components/ui/skeleton";

/**
 * De pagina zelf toont alleen een gecentreerde spinner terwijl de
 * projectdata laadt, en viel daarvóór terug op projecten/[id]/loading.tsx —
 * de detailskeleton met een heel andere kolomindeling. Deze skeleton volgt de
 * echte opbouw: kop met terugknop, voortgangsstepper, vier kengetallen en de
 * urenkaart.
 */
export default function ProjectVoorcalculatieLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Projecten / <project> / Voorcalculatie */}
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
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Voorcalculatie laden...</span>

        {/* Kop: terugknop + icoon + titel, actieknoppen rechts */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-md" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
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

        {/* Vier kengetallen */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Uren per scope */}
        <div className="rounded-xl border bg-card">
          <div className="p-6 pb-4">
            <Skeleton className="h-6 w-36 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="p-6 pt-0 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
