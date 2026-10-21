/**
 * Nummerreeksen voor offertes en facturen — pure functies, één plek voor het
 * formaat (HERO-nabouw, docs/hero-nabouw/offerte/OFFERTE-MODULE.md).
 *
 * Twee formaten:
 * - "jaar"       → {prefix}{jaar}-{001}   (het oorspronkelijke app-formaat)
 * - "doorlopend" → {prefix}{01399}        (HERO: offertes "01399", facturen
 *                  "FACT01129"); geen jaartal, vaste lengte met voorloopnullen
 *
 * De teller zelf (laatsteOfferteNummer / laatsteFactuurNummer) loopt in beide
 * formaten door; het startnummer na HERO is een instelling, geen hardcode.
 * Creditnota's delen de factuurteller (zoals de reeks "Factuur" in HERO).
 */

import { ConvexError } from "convex/values";

export type NummerFormaat = "jaar" | "doorlopend";

export const STANDAARD_CIJFERS_DOORLOPEND = 5;
export const STANDAARD_OFFERTE_PREFIX = "OFF-";
export const STANDAARD_FACTUUR_PREFIX = "FAC-";
const CREDITNOTA_PREFIX_JAAR = "CN-";

export interface Nummerreeks {
  prefix: string;
  formaat: NummerFormaat;
  /** Lengte van het volgnummer bij "doorlopend" */
  cijfers: number;
}

export function formatteerDocumentNummer(
  reeks: Nummerreeks,
  volgnummer: number,
  jaar: number
): string {
  if (reeks.formaat === "doorlopend") {
    return `${reeks.prefix}${String(volgnummer).padStart(reeks.cijfers, "0")}`;
  }
  return `${reeks.prefix}${jaar}-${String(volgnummer).padStart(3, "0")}`;
}

interface NummerInstellingen {
  offerteNummerPrefix: string;
  offerteNummerFormaat?: NummerFormaat;
  offerteNummerCijfers?: number;
  factuurNummerPrefix?: string;
  factuurNummerFormaat?: NummerFormaat;
  factuurNummerCijfers?: number;
}

export function offerteReeks(instellingen: NummerInstellingen): Nummerreeks {
  return {
    prefix: instellingen.offerteNummerPrefix,
    formaat: instellingen.offerteNummerFormaat ?? "jaar",
    cijfers: instellingen.offerteNummerCijfers ?? STANDAARD_CIJFERS_DOORLOPEND,
  };
}

export function factuurReeks(instellingen: NummerInstellingen): Nummerreeks {
  return {
    prefix: instellingen.factuurNummerPrefix ?? STANDAARD_FACTUUR_PREFIX,
    formaat: instellingen.factuurNummerFormaat ?? "jaar",
    cijfers: instellingen.factuurNummerCijfers ?? STANDAARD_CIJFERS_DOORLOPEND,
  };
}

/**
 * Factuur- of creditnotanummer. In het jaarformaat houdt de creditnota zijn
 * eigen "CN-"-voorvoegsel (bestaand gedrag); doorlopend volgt hij HERO en
 * krijgt hij het factuurvoorvoegsel, want het is dezelfde reeks.
 */
export function formatteerFactuurNummer(
  instellingen: NummerInstellingen,
  volgnummer: number,
  jaar: number,
  soort: "factuur" | "creditnota" = "factuur"
): string {
  const reeks = factuurReeks(instellingen);
  if (soort === "creditnota" && reeks.formaat === "jaar") {
    return formatteerDocumentNummer(
      { ...reeks, prefix: CREDITNOTA_PREFIX_JAAR },
      volgnummer,
      jaar
    );
  }
  return formatteerDocumentNummer(reeks, volgnummer, jaar);
}

/**
 * Controle bij het instellen van een reeks. Het volgende nummer mag nooit
 * terug: anders kan een nummer twee keer worden uitgegeven.
 */
export function valideerNummerreeks(
  reeks: Nummerreeks,
  volgendNummer: number,
  laatsteNummer: number
): void {
  if (!Number.isInteger(volgendNummer) || volgendNummer < 1) {
    throw new ConvexError("Het volgende nummer moet een geheel getal vanaf 1 zijn");
  }
  if (volgendNummer <= laatsteNummer) {
    throw new ConvexError(
      `Het volgende nummer kan niet lager dan ${laatsteNummer + 1}: dat nummer is al uitgegeven`
    );
  }
  if (!Number.isInteger(reeks.cijfers) || reeks.cijfers < 3 || reeks.cijfers > 8) {
    throw new ConvexError("Het aantal cijfers moet tussen 3 en 8 liggen");
  }
  if (
    reeks.formaat === "doorlopend" &&
    String(volgendNummer).length > reeks.cijfers
  ) {
    throw new ConvexError(
      `Nummer ${volgendNummer} past niet in ${reeks.cijfers} cijfers`
    );
  }
  if (reeks.prefix.length > 10 || /\s/.test(reeks.prefix)) {
    throw new ConvexError("Het voorvoegsel mag maximaal 10 tekens zonder spaties hebben");
  }
}
