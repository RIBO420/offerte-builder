"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  DagstaatKolommen,
  DagstaatReveal,
  DagstaatRevealStijl,
} from "./dagstaat-bento";

/**
 * Het skelet van de dagstaat.
 *
 * Bewust dezelfde twee kolommen als de echte pagina (dashboard A), zodat de
 * blokken straks staan waar het skelet ze neerzet. De hoogtes zijn een
 * benadering van de gevulde panelen.
 *
 * Op smallere cellen zijn ze een benadering — daar wikkelen echte regels en
 * skeletbalken niet, en een skelet dat één seconde leeft is die precisie niet
 * waard.
 */

function KopBalk({ metActie = false }: { metActie?: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <Skeleton className="h-4 w-28" />
      {metActie && <Skeleton className="ml-auto h-4 w-20" />}
    </div>
  );
}

function Regels({ aantal, hoog = false }: { aantal: number; hoog?: boolean }) {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: aantal }).map((_, i) => (
        <div key={i} className={hoog ? "space-y-1.5 px-3 py-2" : "px-3 py-1.5"}>
          <Skeleton className="h-5 w-full" />
          {hoog && <Skeleton className="h-1 w-full" />}
        </div>
      ))}
    </div>
  );
}

function Paneel({
  hoogte,
  primair = false,
  children,
}: {
  hoogte: string;
  primair?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border ${
        primair ? "bg-surface-primair shadow-xs" : "bg-card"
      } ${hoogte}`}
    >
      {children}
    </div>
  );
}

export function DagstaatSkelet() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="contents">
      <span className="sr-only">Dashboard laden…</span>
      <DagstaatRevealStijl />

      <DagstaatReveal stap={0}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-9 w-80 max-w-full" />
            <Skeleton className="h-4 w-[30rem] max-w-full" />
          </div>
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </DagstaatReveal>

      <DagstaatKolommen>
        <div className="flex min-w-0 flex-col gap-3">
          <Skeleton className="h-4 w-16" />
          <DagstaatReveal stap={1}>
            <Paneel hoogte="h-[262px]" primair>
              <KopBalk />
              <Regels aantal={4} hoog />
            </Paneel>
          </DagstaatReveal>
          <DagstaatReveal stap={2}>
            <Paneel hoogte="h-[150px]" primair>
              <KopBalk />
              <Regels aantal={2} />
            </Paneel>
          </DagstaatReveal>
          <DagstaatReveal stap={3}>
            <Paneel hoogte="h-[210px]">
              <KopBalk metActie />
              <Regels aantal={3} hoog />
            </Paneel>
          </DagstaatReveal>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <DagstaatReveal stap={2}>
            <Paneel hoogte="h-[190px]">
              <div className="grid h-full grid-cols-2 gap-px bg-border">
                <div className="col-span-2 flex flex-col gap-2 bg-card px-4 py-4">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-10 w-52" />
                  <Skeleton className="h-3 w-24" />
                </div>
                {[0, 1].map((i) => (
                  <div key={i} className="flex flex-col gap-2 bg-card px-4 py-2.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            </Paneel>
          </DagstaatReveal>
          <DagstaatReveal stap={3}>
            <Paneel hoogte="h-[250px]">
              <KopBalk metActie />
              <div className="space-y-3 px-3 py-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-3 w-full" />
                ))}
              </div>
            </Paneel>
          </DagstaatReveal>
          <DagstaatReveal stap={4}>
            <Paneel hoogte="h-[230px]">
              <KopBalk metActie />
              <Regels aantal={5} />
            </Paneel>
          </DagstaatReveal>
        </div>
      </DagstaatKolommen>
    </div>
  );
}
