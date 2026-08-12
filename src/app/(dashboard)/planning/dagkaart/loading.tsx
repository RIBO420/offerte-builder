import { Skeleton } from "@/components/ui/skeleton";

/**
 * De dagkaart viel terug op planning/loading.tsx — de skeleton van het
 * planningsoverzicht met statistiekenrij en projectkaarten in drie kolommen.
 * De dagkaart is één chronologische kolom klantblokken, dus die fallback
 * sprong. De pagina zelf had alleen de tekst "Dagkaart laden…" in de
 * Suspense-fallback.
 */
export default function DagkaartLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Planning / Dagkaart */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-4 w-px mx-2" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div
        className="flex flex-1 flex-col gap-4 p-4 md:p-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Dagkaart laden...</span>

        {/* Kop: titel + uitleg */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-3/4 max-w-xl" />
        </div>

        {/* Balk met modus (Vandaag / Planvenster), teamkeuze en datum */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-36" />
        </div>

        {/* Chronologische klantblokken */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-md border bg-card p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-4 w-14" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-56" />
                  {/* Taakregels binnen het blok */}
                  <div className="space-y-1">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <Skeleton className="h-4 w-10 rounded" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
