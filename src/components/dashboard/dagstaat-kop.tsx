"use client";

import type { ReactNode } from "react";

/**
 * De kop van de dagstaat is de samenvatting, geen versiering.
 *
 * Waar hier eerst een begroeting van 30px stond met daaronder een losse regel
 * "15 offertes • 11 projecten", staat nu één regel waarin de begroeting en de
 * staat van de zaak samenvallen. De tellers zijn dus niet weggehaald maar
 * opgegaan in de zin — en de ~70px die dat scheelt gaat naar de werkstrook.
 */

export interface DagstaatCijfers {
  /** Openstaande signalen in "Aandacht nodig". */
  aandacht: number;
  /** Aan mij toegewezen klanttaken die nog open staan. */
  takenOpen: number;
  /** Projecten met status `in_uitvoering`. */
  projectenLopend: number;
  /** Offertes in de pipeline (exclusief concepten — §5.3b). */
  offertesPipeline: number;
}

/** Eén clausule van de samenvattingszin: het getal en wat erachter hoort. */
export interface DagstaatClausule {
  getal: string;
  staart: string;
}

/**
 * Bouwt de samenvattingszin. Pure functie, zodat de formulering testbaar is
 * zonder de hele pagina te renderen.
 *
 * Regels: nul is nooit een clausule (behalve bij aandacht — "niets vraagt je
 * aandacht" is juist het bericht dat je wilt lezen), enkelvoud en meervoud
 * kloppen, en de zin bevat nooit meer dan vier clausules.
 */
export function dagstaatClausules(cijfers: DagstaatCijfers): DagstaatClausule[] {
  const clausules: DagstaatClausule[] = [];

  if (cijfers.aandacht === 0) {
    clausules.push({ getal: "niets", staart: "vraagt je aandacht" });
  } else if (cijfers.aandacht === 1) {
    clausules.push({ getal: "1", staart: "ding vraagt je aandacht" });
  } else {
    clausules.push({
      getal: String(cijfers.aandacht),
      staart: "dingen vragen je aandacht",
    });
  }

  if (cijfers.takenOpen > 0) {
    clausules.push({
      getal: String(cijfers.takenOpen),
      staart: cijfers.takenOpen === 1 ? "taak staat open" : "taken staan open",
    });
  }

  if (cijfers.projectenLopend > 0) {
    clausules.push({
      getal: String(cijfers.projectenLopend),
      staart: cijfers.projectenLopend === 1 ? "project loopt" : "projecten lopen",
    });
  }

  if (cijfers.offertesPipeline > 0) {
    clausules.push({
      getal: String(cijfers.offertesPipeline),
      staart:
        cijfers.offertesPipeline === 1
          ? "offerte in de pipeline"
          : "offertes in de pipeline",
    });
  }

  return clausules;
}

/** Platte tekstversie — voor `aria-label`, tests en tooltips. */
export function dagstaatZin(groet: string, cijfers: DagstaatCijfers): string {
  const staart = dagstaatClausules(cijfers)
    .map((c) => `${c.getal} ${c.staart}`)
    .join(", ");
  return `${groet} — ${staart}.`;
}

export function DagstaatKop({
  groet,
  cijfers,
  actie,
}: {
  groet: string;
  cijfers: DagstaatCijfers;
  /** Rechts in de kop. Zie de opmerking bij de aanroeper: black box. */
  actie?: ReactNode;
}) {
  const clausules = dagstaatClausules(cijfers);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      {/* Outfit blijft voorbehouden aan de kop en het ene heldcijfer. De zin
          zelf is gedempt; alleen de getallen staan in foreground, zodat je hem
          kunt scannen zonder hem te lezen. */}
      <h1 className="font-display min-w-0 text-pretty text-[17px] leading-6 font-semibold tracking-tight @[40rem]/dagstaat:text-[19px] @[40rem]/dagstaat:leading-7">
        {groet}
        {clausules.map((clausule, i) => (
          <span key={clausule.staart} className="font-normal text-muted-foreground">
            {i === 0 ? " — " : ", "}
            <span className="font-semibold text-foreground tabular-nums">
              {clausule.getal}
            </span>{" "}
            {clausule.staart}
          </span>
        ))}
        <span className="font-normal text-muted-foreground">.</span>
      </h1>
      {actie && <div className="shrink-0">{actie}</div>}
    </div>
  );
}
