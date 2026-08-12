import { Skeleton } from "@/components/ui/skeleton";

/**
 * Uitvoering wacht op zes queries (project, uren, machines, KLIC, teams,
 * totalen) en had zelf geen laadstatus: de gebruiker zag de projectdetail-
 * skeleton van de parent-boundary en daarna een sprong naar deze layout.
 * Volgt hier de echte opbouw: kop met actieknoppen, voortgangsstepper,
 * KLIC-melding en de drie tabbladen.
 */
export default function ProjectUitvoeringLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Projecten / <project> / Uitvoering */}
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
        <span className="sr-only">Uitvoering laden...</span>

        {/* Kop + actieknoppen */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
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

        {/* KLIC-meldingsbalk (kaart met accentrand links) */}
        <div className="rounded-xl border border-l-4 bg-card p-4">
          <div className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-9 w-32 shrink-0" />
          </div>
        </div>

        {/* Tabbladen: uren / machines / overzicht */}
        <div className="space-y-4">
          <div className="flex w-fit gap-1 rounded-lg bg-muted/50 p-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-28 rounded-md" />
            ))}
          </div>

          <div className="rounded-xl border bg-card">
            <div className="p-6 pb-4 border-b">
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
