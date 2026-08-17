import { Skeleton } from "@/components/ui/skeleton";

/**
 * Laadstaat van de Controlekamer.
 *
 * Hier stond een `StatsGridSkeleton count={4}` met een filterrij en een tabel —
 * de vorm van een pagina die niet meer bestaat. Een skelet dat iets anders
 * belooft dan wat er komt, is een sprong bij elke navigatie. Dit skelet heeft
 * dus de vorm van het echte scherm: kopzin met weeknavigatie, drie vraagblokken
 * waarvan het middelste een dagkaart met dagbalk is, en een archiefblok.
 */
export default function UrenLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Controlekamer laden…</span>

      {/* Paginakop (breadcrumbbalk) */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="mx-2 h-4 w-px" />
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="flex flex-1 flex-col gap-5 p-4 md:p-8">
        {/* Kop-als-samenvatting + weeknavigatie + export */}
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-[22rem] max-w-full" />
            <Skeleton className="h-3.5 w-64" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="ml-1 h-8 w-36 rounded-md" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Wie is achter? */}
          <BlokSkelet titelBreedte="w-28">
            <Skeleton className="h-4 w-[60%]" />
            <Skeleton className="h-4 w-[45%]" />
          </BlokSkelet>

          {/* Wat wijkt af? — de dagkaart met dagbalk */}
          <BlokSkelet titelBreedte="w-24">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-[22px] w-full rounded-md" />
            <Skeleton className="h-3 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </BlokSkelet>

          {/* Wat kan door? — één regel */}
          <BlokSkelet titelBreedte="w-28">
            <Skeleton className="h-4 w-[55%]" />
          </BlokSkelet>

          {/* Archief */}
          <BlokSkelet titelBreedte="w-20">
            <Skeleton className="h-4 w-[70%]" />
            <Skeleton className="h-4 w-[62%]" />
          </BlokSkelet>
        </div>
      </div>
    </div>
  );
}

function BlokSkelet({
  titelBreedte,
  children,
}: {
  titelBreedte: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
        <Skeleton className={`h-4 ${titelBreedte}`} />
      </div>
      <div className="flex flex-col gap-2.5 p-3">{children}</div>
    </div>
  );
}
