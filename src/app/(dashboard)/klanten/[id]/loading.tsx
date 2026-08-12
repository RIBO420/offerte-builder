import { Skeleton } from "@/components/ui/skeleton";

/**
 * De klantdetailpagina viel terug op klanten/loading.tsx — de skeleton van de
 * klantenlijst (statistiekenrij plus tabel). Detail is een drieluik met
 * contact-, bedrijfs- en activiteitenkaarten, dus die fallback sprong.
 * Deze skeleton volgt de echte opbouw van page.tsx.
 */
export default function KlantDetailLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Klanten / <naam> */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div
        className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Klant laden...</span>

        {/* Kop: terugknop + naam met pipeline- en type-badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-9 rounded-md sm:h-8 sm:w-8" />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-40 mt-2" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        {/* Drieluik: contact, bedrijf, kengetallen */}
        <div className="grid gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card">
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-6 w-36" />
                </div>
              </div>
              <div className="space-y-4 p-6 pt-0">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="space-y-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Onderste kaart: offertes / projecten van deze klant */}
        <div className="rounded-xl border bg-card">
          <div className="p-6 pb-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <div className="space-y-3 p-6 pt-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg bg-muted/30 p-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
