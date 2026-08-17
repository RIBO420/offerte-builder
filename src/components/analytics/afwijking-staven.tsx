"use client";

/**
 * Staven om een nullijn: onder de begroting naar links, erboven naar rechts.
 *
 * Dit is de enige vorm op het grafiekenblad waar de betekenis in de *richting*
 * zit. Dat is bewust, en het is ook noodzakelijk: onze polariteitskleuren zijn
 * Loof-groen (`--chart-1`) en terracotta (`--chart-2`), en die twee vallen onder
 * protanopie om — nagerekend met de validator van het dataviz-programma op onze
 * eigen tokens: ΔE 2,8 (licht) en 5,7 (donker), ver onder de norm van 8. Groen
 * naast terracotta mag daarom nooit het énige verschil zijn.
 *
 * Dus draagt de vorm de boodschap: welke kant van de nullijn de staaf op gaat,
 * plús het ondertekende bedrag als tekst ernaast ("+ € 2.400"), plús een regel
 * boven de lijst die zegt welke kant wat betekent. De kleur is de derde laag.
 *
 * Geen recharts: een lijst van hooguit tien regels met Nederlandse labels heeft
 * geen assenstelsel nodig, kan niet zijwaarts scrollen en drukt af zoals hij op
 * het scherm staat.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AfwijkingRegel {
  sleutel: string;
  label: string;
  /** Ondertekend: positief = boven de begroting, negatief = eronder. */
  waarde: number;
  /** Klaar geformatteerd, mét teken. */
  waardeTekst: string;
  bijschrift?: ReactNode;
}

export function AfwijkingStaven({
  regels,
  /** Wat er links en rechts van de nullijn staat, in taal. */
  linksLabel,
  rechtsLabel,
  className,
}: {
  regels: AfwijkingRegel[];
  linksLabel: string;
  rechtsLabel: string;
  className?: string;
}) {
  // Eén noemer voor beide armen, anders zijn de twee kanten niet vergelijkbaar.
  const noemer = Math.max(1, ...regels.map((regel) => Math.abs(regel.waarde)));

  return (
    <div className={className}>
      <p className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>← {linksLabel}</span>
        <span>{rechtsLabel} →</span>
      </p>
      <ul className="space-y-3.5">
        {regels.map((regel) => {
          const boven = regel.waarde > 0;
          // Halve breedte per arm; de nullijn staat in het midden.
          const arm = Math.max(
            Math.abs(regel.waarde) > 0 ? 1 : 0,
            Math.round((Math.abs(regel.waarde) / noemer) * 50)
          );
          return (
            <li key={regel.sleutel}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm" title={regel.label}>
                  {regel.label}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-medium tabular-nums",
                    boven ? "text-[var(--chart-2)]" : "text-foreground"
                  )}
                >
                  {regel.waardeTekst}
                </span>
              </div>
              <div
                className="relative mt-1.5 h-2 w-full rounded-full bg-muted"
                aria-hidden="true"
              >
                {/* De nullijn: een haarlijn in de vlakkleur, geen streepjes. */}
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                <span
                  className="absolute inset-y-0 rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{
                    width: `${arm}%`,
                    left: boven ? "50%" : undefined,
                    right: boven ? undefined : "50%",
                    backgroundColor: boven
                      ? "var(--chart-2)"
                      : "var(--chart-1)",
                  }}
                />
              </div>
              {regel.bijschrift && (
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {regel.bijschrift}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
