import { Skeleton } from "@/components/ui/skeleton";

/**
 * Het weekbord viel terug op planning/loading.tsx — de skeleton van het
 * planningsoverzicht (statistiekenrij plus projectkaarten). Het bord is een
 * raster van teams (rijen) tegen dagen (kolommen), dus die fallback sprong
 * volledig. Het bord komt bovendien met een zware drag-and-drop-bundel, wat
 * de laadstatus hier echt zichtbaar maakt.
 */
export default function WeekbordLoading() {
  return (
    <>
      {/* Breadcrumbbalk: Dashboard / Planning / Weekbord */}
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
        <span className="sr-only">Weekbord laden...</span>

        {/* Kop: titel + uitleg links, navigatieknoppen rechts */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        {/* Bord */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Periodetoggle + weeknavigatie */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-20" />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>

          {/* Raster: teamkolom van 160px + vijf dagkolommen */}
          <div className="overflow-hidden rounded-md border">
            {/* Kolomkoppen */}
            <div
              className="grid gap-px bg-muted"
              style={{ gridTemplateColumns: "160px repeat(5, 1fr)" }}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-card p-2">
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>

            {/* Teamrijen */}
            {Array.from({ length: 4 }).map((_, row) => (
              <div
                key={row}
                className="grid gap-px bg-muted"
                style={{ gridTemplateColumns: "160px repeat(5, 1fr)" }}
              >
                <div className="bg-card p-2">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-3 w-16" />
                </div>
                {Array.from({ length: 5 }).map((_, col) => (
                  <div key={col} className="min-h-[72px] space-y-1 bg-card p-1">
                    {/* Niet elke cel is gepland — een half gevuld bord oogt realistischer */}
                    {(row + col) % 3 !== 0 && (
                      <Skeleton className="h-9 w-full rounded" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
