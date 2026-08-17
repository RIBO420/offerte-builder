import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton van het klantdossier (herindeling v7).
 *
 * Volgt de echte opbouw van page.tsx: identiteitskop, cijferstrip van vier
 * cellen, en het dossiergrid met de navigatiekolom links en één paneel rechts.
 * De vorige versie tekende nog het oude drieluik met kaarten — dan springt de
 * pagina bij het laden van de ene indeling naar de andere.
 */
export default function KlantDetailLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Klanten / <naam> */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="mx-2 h-4 w-px" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div
        className="flex flex-1 flex-col gap-5 p-4 md:p-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Klant laden...</span>

        {/* Identiteitskop: terugknop, monogram, naam met badges, contactregel */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b pb-5">
          <div className="flex min-w-0 items-start gap-2">
            <Skeleton className="mt-1 h-8 w-8 rounded-md" />
            <Skeleton className="mt-1 size-12 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-2 pl-1">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-40" />
              </div>
            </div>
          </div>
          <Skeleton className="h-9 w-40 rounded-md" />
        </div>

        {/* Cijferstrip: vier cellen achter één rand, hairlines uit gap-px */}
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 bg-card px-3 py-2.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </div>

        {/* Dossier: submenu links (kolom van 196px), actief paneel rechts */}
        <div className="grid items-start gap-5 lg:grid-cols-[12.25rem_minmax(0,1fr)]">
          <div className="flex flex-wrap gap-1.5 lg:block">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton
                key={i}
                className="h-9 w-28 rounded-lg lg:mb-px lg:w-full"
              />
            ))}
          </div>

          <div className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
                <Skeleton className="h-5 w-36" />
              </div>
              <div className="divide-y">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-x-2.5 px-3 py-2.5"
                  >
                    <Skeleton className="mt-0.5 size-5 rounded-full" />
                    <div className="min-w-0 space-y-1.5">
                      <Skeleton className="h-3.5 w-[60%]" />
                      <Skeleton className="h-2.5 w-[35%]" />
                    </div>
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
                <Skeleton className="h-5 w-32" />
              </div>
              <div className="space-y-2 px-3 py-3">
                <Skeleton className="h-3.5 w-[70%]" />
                <Skeleton className="h-3.5 w-[45%]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
