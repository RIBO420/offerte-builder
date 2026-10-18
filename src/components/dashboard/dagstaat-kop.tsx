"use client";

import type { ReactNode } from "react";
import { format, getISOWeek } from "date-fns";
import { nl } from "date-fns/locale";

/**
 * De kop van de dagstaat is de samenvatting, geen versiering.
 *
 * Datumregel, begroeting en één samenvattingsregel met de vier tellers. De
 * tellers komen uit `dagstaatClausules`, dus de formulering (enkelvoud,
 * meervoud, "niets vraagt je aandacht") blijft op één plek.
 */

export interface DagstaatCijfers {
  /** Openstaande signalen in "Aandacht nodig". */
  aandacht: number;
  /** Aan mij toegewezen klanttaken die nog open staan. */
  takenOpen: number;
  /**
   * De takenquery is begrensd (limit): zat de lijst vol, dan zijn er
   * mogelijk meer en toont de kop "25+" in plaats van een te laag getal.
   */
  takenAfgekapt?: boolean;
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
      getal: `${cijfers.takenOpen}${cijfers.takenAfgekapt ? "+" : ""}`,
      staart:
        cijfers.takenOpen === 1 && !cijfers.takenAfgekapt
          ? "taak staat open"
          : "taken staan open",
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

/**
 * "Zaterdag 17 oktober · week 42" — de bovenregel van de kop. ISO-weeknummer,
 * want zo telt de planning (het weekbord begint op maandag).
 */
export function dagstaatDatumregel(datum: Date): string {
  const dag = format(datum, "EEEE d MMMM", { locale: nl });
  return `${dag.charAt(0).toUpperCase()}${dag.slice(1)} · week ${getISOWeek(datum)}`;
}

export function DagstaatKop({
  groet,
  cijfers,
  actie,
  datum = new Date(),
}: {
  groet: string;
  cijfers: DagstaatCijfers;
  /** Rechts in de kop. Zie de opmerking bij de aanroeper: black box. */
  actie?: ReactNode;
  /** Alleen voor tests; de pagina laat hem weg. */
  datum?: Date;
}) {
  const clausules = dagstaatClausules(cijfers);

  return (
    // Dashboard A (okt 2026): drie regels in plaats van één. De datum zet de
    // dag neer, de begroeting is de kop en de samenvatting staat eronder als
    // scanbare regel. Eén lange kopzin las als alinea: je moest hem lezen om
    // te weten wat er speelt, nu vang je de vier getallen in één blik.
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {dagstaatDatumregel(datum)}
        </p>
        {/* Outfit blijft voorbehouden aan de kop en het ene heldcijfer. */}
        <h1 className="font-display text-balance text-[26px] leading-tight font-semibold tracking-tight @[40rem]/dagstaat:text-[34px]">
          {groet}
        </h1>
        {/* Gedempt; alleen de getallen staan in foreground, zodat je de regel
            kunt scannen zonder hem te lezen. */}
        <p className="text-pretty text-[15px] leading-6 text-muted-foreground">
          {clausules.map((clausule, i) => (
            <span key={clausule.staart}>
              {i > 0 && " · "}
              <span className="font-semibold text-foreground tabular-nums">
                {clausule.getal}
              </span>{" "}
              {clausule.staart}
            </span>
          ))}
        </p>
      </div>
      {actie && <div className="shrink-0">{actie}</div>}
    </div>
  );
}
