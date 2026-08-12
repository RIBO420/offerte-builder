import { Skeleton } from "@/components/ui/skeleton";

/**
 * De vrije-offertebuilder rendert géén PageHeader en heeft een eigen indeling
 * (editor links, overzichtsblok van 320px rechts). De fallback van
 * offertes/[id]/loading.tsx tekende hier dus zowel een breadcrumbbalk als een
 * heel andere kolomverdeling — een dubbele sprong. Deze skeleton volgt de
 * echte opbouw van page.tsx.
 */
export default function OfferteVrijLoading() {
  return (
    <div
      className="space-y-6 p-4 md:p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Vrije offerte laden...</span>

      {/* Kop: titel links, badge en actieknoppen rechts */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* Regeleditor + tekstblokken links, overzichtsblok rechts */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Vrije regeleditor */}
          <div className="rounded-xl border bg-card">
            <div className="p-6 pb-4">
              <Skeleton className="h-6 w-32 mb-2" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="space-y-3 p-6 pt-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-20" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              ))}
              <Skeleton className="h-9 w-36" />
            </div>
          </div>

          {/* Tekstblokkiezer */}
          <div className="rounded-xl border bg-card">
            <div className="p-6 pb-4">
              <Skeleton className="h-6 w-36 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="space-y-3 p-6 pt-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </div>

        {/* Overzichtsblok */}
        <div className="rounded-xl border bg-card p-6">
          <Skeleton className="h-6 w-28 mb-4" />
          <div className="space-y-4">
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
  );
}
