"use client";

/**
 * R6 — skeleton met exact de eindafmetingen.
 *
 * De oude pagina laadde in drie verspringende fasen: eerst vier KPI-blokken
 * terwijl er acht komen, dan een lege contentzone met spinner, dan een pop-in
 * van de grafieken zodra de recharts-chunk binnen was. Dit silhouet heeft
 * dezelfde kolomverdeling, dezelfde bewijs-hoogte (`BEWIJS_HOOGTE`) en
 * dezelfde sectie-afstanden als het echte verhaal, zodat er bij hydratie van
 * de grafieken niets meer verschuift.
 */

import { Skeleton } from "@/components/ui/skeleton";
import { BEWIJS_HOOGTE } from "@/components/analytics/maten";
import { SECTIES } from "./antwoord-blok";

function SectieSkelet({ eerste }: { eerste: boolean }) {
  return (
    <div
      className={
        eerste
          ? "pt-2 pb-12 md:pb-16"
          : "border-t border-border/70 py-12 md:py-16"
      }
    >
      <div className="mb-7">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-2.5 h-8 w-72 max-w-full" />
      </div>
      <div className="grid gap-x-12 gap-y-9 @min-[54rem]/verhaal:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <div className="mb-7 space-y-2">
            <Skeleton className="h-4 w-full max-w-[46ch]" />
            <Skeleton className="h-4 w-full max-w-[38ch]" />
          </div>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2.5 h-14 w-56" />
          <Skeleton className="mt-3 h-4 w-64 max-w-full" />
          <div className="mt-7 space-y-3.5 border-y border-border/70 py-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
          <Skeleton className="mt-7 h-4 w-48" />
        </div>
        <div>
          <div className="mb-3 border-b border-border/70 pb-2">
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton
            className="w-full"
            style={{ height: BEWIJS_HOOGTE }}
          />
        </div>
      </div>
    </div>
  );
}

export function RapportageSkelet() {
  return (
    <div
      className="@container/verhaal mx-auto w-full max-w-5xl"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Rapport wordt opgebouwd…</span>
      {SECTIES.map((sectie, index) => (
        <SectieSkelet key={sectie.id} eerste={index === 0} />
      ))}
    </div>
  );
}
