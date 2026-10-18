import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lijstweergave van de planning: kop met samenvatting en tabrij, één
 * filterregel, daarna de afsprakentabel gegroepeerd per week. Viel eerder
 * terug op planning/loading.tsx (baanpanelen) en sprong dan van vorm.
 */
export default function PlanningLijstLoading() {
  return (
    <>
      {/* Breadcrumbbalk */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-16" />
      </div>

      <div
        className="flex flex-1 flex-col gap-4 p-4 md:p-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Afspraken laden...</span>

        {/* Kop: titel + samenvatting links, planningtabs rechts */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-5 w-72 max-w-full" />
          </div>
          <Skeleton className="h-10 w-80 max-w-full rounded-lg" />
        </div>

        {/* Filterregel: Mijn/Alle, zoeken, ploeg, status, periode */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-60 max-w-full" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-80 max-w-full" />
        </div>

        {/* Afsprakentabel */}
        <div className="rounded-lg border bg-card p-1">
          <div className="flex items-center justify-between gap-4 px-3.5 py-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-10" />
          </div>
          {Array.from({ length: 2 }).map((_, week) => (
            <div key={week} className="border-t">
              <div className="flex items-center gap-2 px-3.5 py-2.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              {Array.from({ length: 3 }).map((_, rij) => (
                <div key={rij} className="flex items-center gap-4 px-3.5 py-2.5">
                  <Skeleton className="h-4 w-24 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48 max-w-full" />
                    <Skeleton className="h-3 w-32 max-w-full" />
                  </div>
                  <Skeleton className="h-4 w-10 shrink-0" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
