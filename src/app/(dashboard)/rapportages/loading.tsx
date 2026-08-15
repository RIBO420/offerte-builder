import { Skeleton } from "@/components/ui/skeleton";
import { RapportageSkelet } from "./components/rapportage-skelet";

/**
 * Route-skeleton met exact het silhouet van de echte pagina (R6): kop,
 * ankerbalk, vier secties met dezelfde kolomverdeling en bewijs-hoogte. De
 * oude versie toonde vier KPI-kaarten en een tabbalk die geen van beide nog
 * bestaan — dat is precies hoe je een pagina laat verspringen.
 */
export default function RapportagesLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Rapportages laden…</span>

      <div className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="mx-2 h-4 w-px" />
        <Skeleton className="h-4 w-24" />
      </div>

      <div className="border-b border-border/70 px-4 pt-6 pb-5 md:px-8 md:pt-9">
        <div className="mx-auto max-w-5xl">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-2.5 h-10 w-[26rem] max-w-full" />
          <Skeleton className="mt-3 h-4 w-[34rem] max-w-full" />
        </div>
      </div>

      <div className="border-b border-border/70 px-4 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 py-2">
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-20" />
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-32 rounded-md" />
            <Skeleton className="h-8 w-44 rounded-md" />
          </div>
        </div>
      </div>

      <div className="px-4 pt-8 pb-16 md:px-8">
        <RapportageSkelet />
      </div>
    </div>
  );
}
