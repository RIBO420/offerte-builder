import { Skeleton } from "@/components/ui/skeleton";

/**
 * De bewerkpagina viel terug op offertes/[id]/loading.tsx — de detailskeleton
 * met klantgegevens- en totalenkaart. De bewerker heeft een andere indeling
 * (regels-editor van 2/3 met notities eronder, samenvatting in de zijkolom),
 * dus die fallback sprong. Deze skeleton volgt de echte opbouw.
 */
export default function OfferteBewerkenLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Offertes / <nummer> / Bewerken */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Offerte laden...</span>

        {/* Kop: terugknop + type-icoon + titel, actieknoppen rechts */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-md sm:h-8 sm:w-8" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-4 w-44" />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        {/* Regels (2/3) + samenvatting (1/3) */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {/* Offerteregels */}
            <div className="rounded-xl border bg-card">
              <div className="p-6 pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                  <Skeleton className="h-9 w-32" />
                </div>
              </div>
              <div className="space-y-3 p-6 pt-0">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-4 border-b py-2 last:border-0"
                  >
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>

            {/* Notities */}
            <div className="rounded-xl border bg-card">
              <div className="p-6 pb-4">
                <Skeleton className="h-6 w-24 mb-2" />
                <Skeleton className="h-4 w-56" />
              </div>
              <div className="p-6 pt-0">
                <Skeleton className="h-24 w-full" />
              </div>
            </div>
          </div>

          {/* Zijkolom */}
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-6">
              <Skeleton className="h-6 w-28 mb-4" />
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-20" />
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
