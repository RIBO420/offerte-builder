import { Skeleton } from "@/components/ui/skeleton";

/**
 * De voorcalculatie toonde zelf alleen een gecentreerde spinner, met daarvóór
 * de offertedetail-skeleton uit de parent-boundary. Deze skeleton volgt de
 * echte opbouw: kop met terugknop, de workflow-stepperkaart en het raster van
 * teamconfiguratie (2/3) met de samenvatting in de zijkolom.
 */
export default function OfferteVoorcalculatieLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Offertes / <nummer> / Voorcalculatie */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-28" />
      </div>

      <div
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Voorcalculatie laden...</span>

        {/* Kop: terugknop + icoon + titel, opslagindicator rechts */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-md sm:h-8 sm:w-8" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-44" />
                <Skeleton className="h-4 w-52" />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        {/* Workflow-stepperkaart */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="space-y-4 p-4 md:p-6">
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
        </div>

        {/* Teamconfiguratie (2/3) + samenvatting (1/3) */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-xl border bg-card">
              <div className="p-6 pb-4">
                <Skeleton className="h-6 w-40 mb-2" />
                <Skeleton className="h-4 w-64" />
              </div>
              <div className="space-y-4 p-6 pt-0">
                <div className="grid gap-2 sm:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </div>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-xl border bg-card">
              <div className="p-6 pb-4">
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="p-6 pt-0">
                <div className="grid gap-6 sm:grid-cols-4 lg:grid-cols-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-7 w-20" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
