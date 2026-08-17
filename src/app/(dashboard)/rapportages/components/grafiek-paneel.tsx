"use client";

/**
 * Eén paneel op het grafiekenblad: een vraag in de kopbalk, één grafiek eronder.
 *
 * Bewust `SectiePaneel` met `kopbalk` (klantdossier v7 §2) en géén nieuw frame:
 * dit blad is een werkscherm — een raster van vlakken dat je scant — en niet de
 * leespagina waar `AntwoordBlok` voor bedoeld is. Zo krijgt het blad gratis de
 * app-brede kopbalk, de uitleg-tooltip en de lege regel.
 *
 * Die lege regel is het hele antwoord op "wat als er geen data is": de vraag
 * blijft staan, de reden staat erachter, en er komt géén leeg assenkruis in
 * beeld. Een lege sectie mag nooit meer ruimte innemen dan een gevulde.
 */

import type { ReactNode } from "react";
import { SectiePaneel, type SectieLegeRegel } from "@/components/ui/sectie-paneel";

export function GrafiekPaneel({
  vraag,
  /** Waar dit paneel over gaat qua tijd: "Augustus 2026", "Nu openstaand". */
  reikwijdte,
  uitleg,
  /** Gevuld = er is niets te tekenen; dan blijft `children` weg. */
  leeg,
  children,
}: {
  vraag: string;
  reikwijdte?: string;
  uitleg?: ReactNode;
  leeg?: SectieLegeRegel;
  children: ReactNode;
}) {
  return (
    <SectiePaneel
      titel={vraag}
      kopbalk
      uitleg={uitleg}
      legeRegel={leeg}
      acties={
        reikwijdte && !leeg ? (
          <span className="truncate text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {reikwijdte}
          </span>
        ) : undefined
      }
    >
      {/* @container/blok: de staafprimitieven uit `staafwerk.tsx` schakelen op
          `@min-[26rem]/blok`. Zonder deze naam blijven ze eenkoloms — wat op een
          smal paneel klopt, maar op een breed paneel ruimte weggooit. */}
      {!leeg && <div className="@container/blok px-3 py-3.5">{children}</div>}
    </SectiePaneel>
  );
}
