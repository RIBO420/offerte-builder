import { ConvexError } from "convex/values";

/**
 * Pure berekeningsmodule voor de vrije offerte-builder (route 2, PRD §2.5b).
 *
 * Staat bewust los van elke Convex-server-import zodat zowel de
 * updateVrijeRegels-mutation (server) als de regel-editor (client) en de
 * unit-tests exact dezelfde doorrekening gebruiken. Dezelfde module gaat in
 * §2.8 de losse factuur-builder voeden.
 *
 * Marge-semantiek (PRD §2.5b, bindend): marge is een percentage van de
 * VERKOOPprijs. Margefactor = 1 ÷ (1 − marge). Dit is bewust ánders dan een
 * opslag óp de inkoopprijs — zie MARGEFACTOR_TOELICHTING.
 */

// (i)-toelichting bij het margeveld — letterlijke PRD-tekst (§2.5b)
export const MARGEFACTOR_TOELICHTING =
  "30% marge → ×1,43 · 40% → ×1,67. Let op: 40% opslag óp inkoop (×1,40) lijkt hetzelfde maar is maar 28,6% marge.";

export type VrijeRegelType = "materiaal" | "arbeid" | "machine";

/** Regel-vorm van de vrije builder; subset/superset-compatibel met offertes.regels. */
export interface VrijeRegel {
  id: string;
  /** Hoofdstuk — opgeslagen in het bestaande scope-veld (PDF groepeert erop) */
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  /** VERKOOPprijs per eenheid (klantzijde) */
  prijsPerEenheid: number;
  totaal: number;
  type: VrijeRegelType;
  margePercentage?: number;
  inkoopprijsPerEenheid?: number;
  btwCode?: 9 | 21;
  kortingPercentage?: number;
  productId?: string;
  prijsOpRegel?: boolean;
  interneNotitie?: string;
  optioneel?: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Artikel zonder bruikbare inkoopprijs (leeg of €0) → prijs hoort op de
 * offerte-regel te worden ingevuld; geen marge-berekening (HERO's "Infinity%").
 * Zelfde definitie als bepaalPrijsOpRegel in convex/producten.ts.
 */
export function isPrijsOpRegel(
  inkoopprijs: number | null | undefined
): boolean {
  return inkoopprijs === null || inkoopprijs === undefined || inkoopprijs <= 0;
}

/** Margefactor volgens PRD: 1 ÷ (1 − marge). 30% → 1,4286; 40% → 1,6667. */
export function margeNaarFactor(margePercentage: number): number {
  if (!Number.isFinite(margePercentage)) {
    throw new ConvexError("Ongeldig marge-percentage");
  }
  if (margePercentage < 0 || margePercentage >= 100) {
    throw new ConvexError("Marge moet tussen 0% en 100% liggen");
  }
  return 1 / (1 - margePercentage / 100);
}

/**
 * Verkoopprijs uit inkoopprijs + marge-% (marge op verkoop, PRD §2.5b).
 * Weigert hard op prijs-op-regel en inkoop ≤ €0 (Infinity%-verbod).
 */
export function verkoopprijsUitMarge(
  inkoopprijs: number,
  margePercentage: number,
  prijsOpRegel: boolean
): number {
  if (prijsOpRegel) {
    throw new ConvexError(
      "Geen marge-berekening mogelijk: prijs wordt op de offerte-regel ingevuld"
    );
  }
  if (inkoopprijs <= 0) {
    throw new ConvexError(
      "Geen marge-berekening mogelijk op een inkoopprijs van €0 of lager"
    );
  }
  return round2(inkoopprijs * margeNaarFactor(margePercentage));
}

/**
 * Marge-% uit inkoop- en verkoopprijs (andere kant op): m = 1 − inkoop/verkoop.
 * Weigert hard op prijs-op-regel, inkoop ≤ €0 en verkoop ≤ €0.
 */
export function margeUitVerkoopprijs(
  inkoopprijs: number,
  verkoopprijs: number,
  prijsOpRegel: boolean
): number {
  if (prijsOpRegel) {
    throw new ConvexError(
      "Geen marge-berekening mogelijk: prijs wordt op de offerte-regel ingevuld"
    );
  }
  if (inkoopprijs <= 0) {
    throw new ConvexError(
      "Geen marge-berekening mogelijk op een inkoopprijs van €0 of lager"
    );
  }
  if (verkoopprijs <= 0) {
    throw new ConvexError(
      "Geen marge-berekening mogelijk op een verkoopprijs van €0 of lager"
    );
  }
  return round2((1 - inkoopprijs / verkoopprijs) * 100);
}

/** Regeltotaal: hoeveelheid × verkoopprijs, minus korting per regel. */
export function berekenRegelTotaal(
  hoeveelheid: number,
  prijsPerEenheid: number,
  kortingPercentage?: number
): number {
  const bruto = hoeveelheid * prijsPerEenheid;
  const korting = kortingPercentage ?? 0;
  if (korting < 0 || korting > 100) {
    throw new ConvexError("Korting per regel moet tussen 0% en 100% liggen");
  }
  return round2(bruto * (1 - korting / 100));
}

/** Product uit de artikel-picker (velden die de picker-query retourneert). */
export interface PickerProduct {
  _id: string;
  productnaam: string;
  eenheid?: string;
  inkoopprijs?: number;
  verkoopprijs?: number;
  btwCode?: number;
  prijsOpRegel?: boolean;
  omschrijving?: string;
  gebruiksteller?: number;
}

/**
 * Artikel aanklikken vult de regel direct (PRD §2.5b): naam, eenheid,
 * inkoopprijs en btw-code. Verkoopprijs uit het productbestand als die er is,
 * anders via de meegegeven standaardmarge; prijs-op-regel-artikelen krijgen
 * bewust €0 en geen marge (kantoor vult de prijs op de regel in).
 */
export function productNaarRegel(
  product: PickerProduct,
  hoofdstuk: string,
  regelId: string,
  standaardMargePercentage?: number
): VrijeRegel {
  const prijsOpRegel =
    product.prijsOpRegel === true || isPrijsOpRegel(product.inkoopprijs);
  const inkoop = prijsOpRegel ? undefined : product.inkoopprijs;

  let verkoop = 0;
  let marge: number | undefined;
  if (!prijsOpRegel && inkoop !== undefined) {
    if (product.verkoopprijs !== undefined && product.verkoopprijs > 0) {
      verkoop = product.verkoopprijs;
      marge = margeUitVerkoopprijs(inkoop, verkoop, false);
    } else if (standaardMargePercentage !== undefined) {
      verkoop = verkoopprijsUitMarge(inkoop, standaardMargePercentage, false);
      marge = standaardMargePercentage;
    } else {
      verkoop = inkoop;
      marge = 0;
    }
  }

  const btwCode: 9 | 21 | undefined =
    product.btwCode === 9 || product.btwCode === 21
      ? product.btwCode
      : undefined;

  return {
    id: regelId,
    scope: hoofdstuk,
    omschrijving: product.productnaam,
    eenheid: product.eenheid ?? "stuk",
    hoeveelheid: 1,
    prijsPerEenheid: verkoop,
    totaal: berekenRegelTotaal(1, verkoop),
    type: "materiaal",
    margePercentage: marge,
    inkoopprijsPerEenheid: inkoop,
    btwCode,
    productId: product._id,
    prijsOpRegel: prijsOpRegel || undefined,
  };
}

/**
 * Gebruiksteller hoort pas bij DEFINITIEF opslaan omhoog te gaan, en alleen
 * voor artikelen die nog niet op de offerte stonden — niet bij elke klik.
 */
export function nieuweProductIdsVoorGebruik(
  bestaandeRegels: ReadonlyArray<{ productId?: string }>,
  nieuweRegels: ReadonlyArray<{ productId?: string }>
): string[] {
  const bestaand = new Set(
    bestaandeRegels.map((r) => r.productId).filter(Boolean)
  );
  const nieuw = new Set<string>();
  for (const regel of nieuweRegels) {
    if (regel.productId && !bestaand.has(regel.productId)) {
      nieuw.add(regel.productId);
    }
  }
  return [...nieuw];
}

/** Hoofdstukken met subtotalen, in de volgorde waarin ze voorkomen. */
export function berekenHoofdstukSubtotalen(
  regels: ReadonlyArray<VrijeRegel>
): Array<{ hoofdstuk: string; subtotaal: number; aantalRegels: number }> {
  const volgorde: string[] = [];
  const map = new Map<string, { subtotaal: number; aantalRegels: number }>();
  for (const regel of regels) {
    if (!map.has(regel.scope)) {
      volgorde.push(regel.scope);
      map.set(regel.scope, { subtotaal: 0, aantalRegels: 0 });
    }
    const entry = map.get(regel.scope)!;
    entry.subtotaal = round2(entry.subtotaal + regel.totaal);
    entry.aantalRegels += 1;
  }
  return volgorde.map((hoofdstuk) => ({ hoofdstuk, ...map.get(hoofdstuk)! }));
}

export interface VrijeTotalen {
  materiaalkosten: number;
  arbeidskosten: number;
  totaalUren: number;
  subtotaal: number;
  marge: number;
  margePercentage: number;
  totaalExBtw: number;
  btw: number;
  totaalInclBtw: number;
}

/**
 * Totalen in de bestaande offertes.totalen-vorm (zelfde record, zelfde
 * PDF-template — PRD "twee routes, één uitgang").
 *
 * - subtotaal      = som regeltotalen (verkoop, ná korting per regel)
 * - totaalExBtw    = subtotaal − korting op totaal
 * - btw            = per regel naar btw-code (9/21), korting op totaal
 *                    naar rato over de regels verdeeld
 * - marge          = verkoop − inkoop (alleen regels met bekende inkoop)
 * - margePercentage = marge ÷ totaalExBtw (marge op verkoop, PRD-semantiek)
 */
export function berekenVrijeTotalen(
  regels: ReadonlyArray<VrijeRegel>,
  kortingOpTotaal = 0
): VrijeTotalen {
  if (kortingOpTotaal < 0) {
    throw new ConvexError("Korting op totaal kan niet negatief zijn");
  }

  let materiaalkosten = 0;
  let arbeidskosten = 0;
  let totaalUren = 0;
  let subtotaal = 0;
  let inkoopTotaal = 0;

  for (const regel of regels) {
    subtotaal += regel.totaal;
    if (regel.type === "materiaal") {
      materiaalkosten += regel.totaal;
    } else {
      arbeidskosten += regel.totaal;
      if (regel.type === "arbeid") totaalUren += regel.hoeveelheid;
    }
    if (regel.inkoopprijsPerEenheid !== undefined && !regel.prijsOpRegel) {
      inkoopTotaal += regel.inkoopprijsPerEenheid * regel.hoeveelheid;
    } else {
      // Zonder bekende inkoop telt de regel als kost = verkoop (marge 0)
      inkoopTotaal += regel.totaal;
    }
  }

  if (kortingOpTotaal > subtotaal) {
    throw new ConvexError(
      "Korting op totaal kan niet groter zijn dan het subtotaal"
    );
  }

  const totaalExBtw = round2(subtotaal - kortingOpTotaal);
  // Korting op totaal naar rato verdelen over de regels voor de btw-grondslag
  const kortingsFactor = subtotaal > 0 ? totaalExBtw / subtotaal : 0;
  let btw = 0;
  for (const regel of regels) {
    const grondslag = regel.totaal * kortingsFactor;
    const code = regel.btwCode ?? 21;
    btw += grondslag * (code / 100);
  }
  btw = round2(btw);

  const marge = round2(totaalExBtw - inkoopTotaal * kortingsFactor);
  const margePercentage =
    totaalExBtw > 0 ? round2((marge / totaalExBtw) * 100) : 0;

  return {
    materiaalkosten: round2(materiaalkosten),
    arbeidskosten: round2(arbeidskosten),
    totaalUren: round2(totaalUren),
    subtotaal: round2(subtotaal),
    marge,
    margePercentage,
    totaalExBtw,
    btw,
    totaalInclBtw: round2(totaalExBtw + btw),
  };
}

export interface VrijOverzicht {
  posten: number;
  werkuren: number;
  inkoop: number;
  margeBedrag: number;
  margePercentage: number;
  netto: number; // totaal ex btw
  bruto: number; // totaal incl btw
}

/** Live overzichtsblok naast de editor (PRD §2.5b, bijlage B deel B). */
export function berekenOverzicht(
  regels: ReadonlyArray<VrijeRegel>,
  kortingOpTotaal = 0
): VrijOverzicht {
  const totalen = berekenVrijeTotalen(regels, kortingOpTotaal);
  let inkoop = 0;
  for (const regel of regels) {
    if (regel.inkoopprijsPerEenheid !== undefined && !regel.prijsOpRegel) {
      inkoop += regel.inkoopprijsPerEenheid * regel.hoeveelheid;
    }
  }
  return {
    posten: regels.length,
    werkuren: totalen.totaalUren,
    inkoop: round2(inkoop),
    margeBedrag: totalen.marge,
    margePercentage: totalen.margePercentage,
    netto: totalen.totaalExBtw,
    bruto: totalen.totaalInclBtw,
  };
}
