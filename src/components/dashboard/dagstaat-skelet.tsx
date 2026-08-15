"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  BentoBlok,
  DAGSTAAT_SPAN,
  DagstaatBento,
  DagstaatReveal,
  DagstaatRevealStijl,
} from "./dagstaat-bento";

/**
 * Het skelet van de dagstaat.
 *
 * Bewust hetzelfde raster, dezelfde spans en dezelfde blokhoogtes als de echte
 * pagina: de blokken staan straks precies waar het skelet ze neerzet, dus er is
 * geen sprong als de data binnenkomt. De hoogtes hieronder zijn gemeten op de
 * echte pagina (1680×1000, L-tier): werkstrook 222, cijferbalk 111,
 * pipeline/conversie 151, werkpaar 231, vlootstrip 42.
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
          <Skeleton className="h-6 w-[34rem] max-w-full" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </DagstaatReveal>

      <DagstaatBento>
        <BentoBlok span={DAGSTAAT_SPAN.aandacht} stap={1}>
          <Paneel hoogte="@[50rem]/dagstaat:h-[222px]" primair>
            <KopBalk />
            <Regels aantal={4} />
          </Paneel>
        </BentoBlok>

        <BentoBlok span={DAGSTAAT_SPAN.taken} stap={2}>
          <Paneel hoogte="@[50rem]/dagstaat:h-[222px]" primair>
            <KopBalk />
            <Regels aantal={5} />
          </Paneel>
        </BentoBlok>

        <BentoBlok span={DAGSTAAT_SPAN.cijfers} stap={3}>
          <Paneel hoogte="@[50rem]/dagstaat:h-[111px]">
            <div className="grid h-full grid-cols-1 gap-px bg-border @[26rem]/dagstaat:grid-cols-2 @[52rem]/dagstaat:grid-cols-12">
              {[
                "@[52rem]/dagstaat:col-span-5",
                "@[52rem]/dagstaat:col-span-3",
                "@[52rem]/dagstaat:col-span-2",
                "@[52rem]/dagstaat:col-span-2",
              ].map((span, i) => (
                <div
                  // Twee cellen delen dezelfde span-klasse, dus de klasse is
                  // geen sleutel; de positie in de balk wél.
                  key={i}
                  className={`flex flex-col gap-2 bg-card px-3 py-2.5 ${span}`}
                >
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className={i === 0 ? "h-9 w-44" : "h-6 w-24"} />
                  <Skeleton className="mt-auto h-3 w-28" />
                </div>
              ))}
            </div>
          </Paneel>
        </BentoBlok>

        <BentoBlok span={DAGSTAAT_SPAN.pipeline} stap={4}>
          <Paneel hoogte="@[50rem]/dagstaat:h-[151px]">
            <KopBalk metActie />
            <div className="space-y-3 px-3 py-3">
              <Skeleton className="h-2.5 w-full rounded-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </Paneel>
        </BentoBlok>

        <BentoBlok span={DAGSTAAT_SPAN.conversie} stap={5}>
          <Paneel hoogte="@[50rem]/dagstaat:h-[151px]">
            <KopBalk metActie />
            <div className="flex items-center justify-center gap-4 px-3 py-3">
              <Skeleton className="size-[84px] rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </Paneel>
        </BentoBlok>

        <BentoBlok span={DAGSTAAT_SPAN.lopendWerk} stap={6}>
          <Paneel hoogte="@[50rem]/dagstaat:h-[231px]">
            <KopBalk metActie />
            <Regels aantal={3} hoog />
          </Paneel>
        </BentoBlok>

        <BentoBlok span={DAGSTAAT_SPAN.laatsteOffertes} stap={7}>
          <Paneel hoogte="@[50rem]/dagstaat:h-[231px]">
            <KopBalk metActie />
            <Regels aantal={5} />
          </Paneel>
        </BentoBlok>

        <BentoBlok span={DAGSTAAT_SPAN.vloot} stap={8}>
          <div className="flex h-[42px] items-center gap-2 rounded-lg border bg-card px-3 py-2">
            <Skeleton className="size-1.5 rounded-full" />
            <Skeleton className="h-3 w-56" />
            <Skeleton className="ml-auto h-3 w-16" />
          </div>
        </BentoBlok>
      </DagstaatBento>
    </div>
  );
}
