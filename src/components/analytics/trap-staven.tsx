"use client";

/**
 * De trap: een funnel als vier horizontale staven onder elkaar.
 *
 * Geen recharts en geen echte trechtervorm. Een trechter met schuine zijden
 * vraagt de lezer oppervlakken te vergelijken, en dat kan niemand; vier staven
 * op dezelfde grondlijn vergelijk je op lengte, wat wél lukt. De verhouding
 * tussen twee stappen staat er bovendien in taal onder ("62% ging de deur uit"),
 * want dát is het cijfer waar het om gaat.
 *
 * **Kleur.** Funnelstappen zijn een geordende reeks, geen los rijtje namen:
 * daarom één kleur (`--chart-1`, Loof-groen) in aflopende dekking in plaats van
 * vier identiteitskleuren. Zo zit de volgorde in de kleur, en tegelijk staat
 * elk aantal er als tekst naast — de dekking is dus versterking, nooit de enige
 * drager van betekenis.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TrapStap {
  sleutel: string;
  /** Mensentaal; de ruwe statussleutel hoort hier nooit in beeld. */
  label: string;
  /** Bepaalt de staaflengte, en staat als tekst naast het label. */
  waarde: number;
  waardeTekst: string;
  /** Eén gedempte regel eronder: de conversie naar deze stap. */
  bijschrift?: ReactNode;
  href?: string;
}

export function TrapStaven({
  stappen,
  className,
}: {
  stappen: TrapStap[];
  className?: string;
}) {
  const noemer = Math.max(1, ...stappen.map((stap) => Math.max(0, stap.waarde)));

  return (
    <ol className={cn("space-y-3", className)}>
      {stappen.map((stap, index) => {
        const breedte = Math.max(
          // Minimaal 2%: een staaf van 0 px leest als "ontbreekt" in plaats van
          // "nul".
          stap.waarde > 0 ? 2 : 0,
          Math.round((Math.max(0, stap.waarde) / noemer) * 100)
        );
        // Aflopend per stap, met een bodem zodat de laatste stap niet in het
        // vlak verdwijnt.
        const dekking = Math.max(0.4, 1 - index * 0.18);
        const inhoud = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm" title={stap.label}>
                {stap.label}
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {stap.waardeTekst}
              </span>
            </div>
            <div
              className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{
                  width: `${breedte}%`,
                  backgroundColor: "var(--chart-1)",
                  opacity: dekking,
                }}
              />
            </div>
            {stap.bijschrift && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {stap.bijschrift}
              </p>
            )}
          </>
        );

        return (
          <li key={stap.sleutel}>
            {stap.href ? (
              <a
                href={stap.href}
                className="-mx-2 block rounded-md px-2 py-1 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {inhoud}
              </a>
            ) : (
              inhoud
            )}
          </li>
        );
      })}
    </ol>
  );
}
