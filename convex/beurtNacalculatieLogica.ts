/**
 * Beurt-nacalculatie — pure, testbare functies (PRD §3.4 + §2.5a + §2.6).
 *
 * De nacalculatie-loop voor onderhoudsbeurten: werkelijke tijd per werkitem
 * uit bevestigde/ingediende urensegmenten (fase 1, §2.6) wordt afgezet tegen
 * de planning (geschatteUren / bouwsteen-normtijden) en per bouwsteen
 * geaggregeerd tot een NORMUUR-SUGGESTIE.
 *
 * Kernprincipe (PRD §2.5a): "na één seizoen echte urendata weet het systeem
 * wat een bouwsteen daadwerkelijk kost — tot die tijd schat de mens en rekent
 * de app". De loop levert dus uitsluitend suggesties aan de mens; niets hier
 * schrijft automatisch normen terug en de offerte-calculatie-engine
 * (berekeningen/normuren/correctiefactoren) blijft ongewijzigd.
 *
 * BES apart (§2.6): de rit naar/het lossen bij de afvalverwerker telt NIET
 * mee in de werktijd van een bouwsteen — de werkelijke afvoertijd staat als
 * eigen kolom naast de gefactureerde afvoerkosten (bouwsteen 21, bijlage A).
 *
 * NB: net als dagkaartLogica.ts bewust GEEN runtime-imports, zodat de
 * client-UI en unit-tests dit zonder Convex-runtime kunnen gebruiken.
 */

import { naarMinuten, isGeldigeTijd } from "./dagkaartLogica";

// ============================================
// Constanten
// ============================================

/**
 * Default drempel (instelbaar via instellingen.nacalculatieInstellingen):
 * pas vanaf dit aantal uitgevoerde beurten met een bouwsteen verschijnt een
 * normuur-suggestie (4 beurten = geen suggestie, 5 wel).
 */
export const DEFAULT_SUGGESTIE_DREMPEL_BEURTEN = 5;

/** Alleen bevestigde/ingediende segmenten tellen mee (concept = nog van de medewerker). */
export const NACALC_TELBARE_STATUSSEN = ["bevestigd", "ingediend"] as const;

/**
 * Beurt-statussen die meedoen in de nacalculatie. Voor de per-bouwsteen-
 * aggregatie (normuur-suggesties) tellen alleen VOLLEDIG uitgevoerde beurten
 * mee — een deels uitgevoerde beurt zou het gemiddelde vertekenen.
 */
export const NACALC_BEURT_STATUSSEN = [
  "uitgevoerd",
  "gefactureerd",
  "deels_uitgevoerd",
] as const;

export const NACALC_VOLLEDIGE_STATUSSEN = ["uitgevoerd", "gefactureerd"] as const;

// ============================================
// Segmenten → werkelijke tijd per werkitem
// ============================================

export interface NacalcSegment {
  categorie: string;
  beginTijd: string; // HH:MM
  eindTijd: string; // HH:MM
  status: string;
}

export interface WerkitemTijden {
  werkenMinuten: number;
  reistijdMinuten: number;
  besMinuten: number;
}

/** Duur van één segment in minuten (ongeldige of negatieve tijden → 0). */
export function segmentMinuten(beginTijd: string, eindTijd: string): number {
  if (!isGeldigeTijd(beginTijd) || !isGeldigeTijd(eindTijd)) return 0;
  return Math.max(0, naarMinuten(eindTijd) - naarMinuten(beginTijd));
}

/**
 * Telt de segmenten van één werkitem op tot werkelijke tijd, per categorie:
 * werken / reistijd / BES apart (§2.6). Alleen bevestigd/ingediend telt;
 * pauze/teammeeting/onderhoud/anders zijn geen klantwerk en tellen niet mee.
 */
export function telSegmenten(segmenten: NacalcSegment[]): WerkitemTijden {
  const tijden: WerkitemTijden = {
    werkenMinuten: 0,
    reistijdMinuten: 0,
    besMinuten: 0,
  };
  for (const segment of segmenten) {
    if (!(NACALC_TELBARE_STATUSSEN as readonly string[]).includes(segment.status)) {
      continue;
    }
    const minuten = segmentMinuten(segment.beginTijd, segment.eindTijd);
    if (minuten <= 0) continue;
    if (segment.categorie === "werken") tijden.werkenMinuten += minuten;
    else if (segment.categorie === "reistijd") tijden.reistijdMinuten += minuten;
    else if (segment.categorie === "afvalverwerker_bes") tijden.besMinuten += minuten;
  }
  return tijden;
}

// ============================================
// Werktijd toerekenen aan bouwstenen
// ============================================

export interface BeurtTaak {
  bouwsteenId: string | null;
  /** Normuur van de bouwsteen (urenPerBeurt ?? normurenPerEenheid), indien bekend. */
  normUren: number | null;
}

export interface BouwsteenBijdrage {
  bouwsteenId: string;
  minuten: number;
}

/**
 * Verdeelt de werkelijke werktijd van één beurt over zijn bouwstenen:
 * - één bouwsteen-taak → alle werktijd naar die bouwsteen (eenduidig);
 * - meerdere taken → naar rato van de normuren, maar alleen als ALLE taken
 *   een norm hebben (anders is de verdeling giswerk → null, de beurt telt
 *   dan niet mee voor de suggesties maar blijft zichtbaar in de lijst).
 */
export function verdeelWerktijdOverBouwstenen(
  taken: BeurtTaak[],
  werkenMinuten: number
): BouwsteenBijdrage[] | null {
  if (werkenMinuten <= 0) return null;
  const metBouwsteen = taken.filter(
    (t): t is BeurtTaak & { bouwsteenId: string } => t.bouwsteenId !== null
  );
  if (metBouwsteen.length === 0) return null;
  if (metBouwsteen.length === 1) {
    return [{ bouwsteenId: metBouwsteen[0].bouwsteenId, minuten: werkenMinuten }];
  }
  const totaalNorm = metBouwsteen.reduce(
    (som, t) => som + (t.normUren ?? 0),
    0
  );
  if (
    totaalNorm <= 0 ||
    metBouwsteen.some((t) => t.normUren === null || t.normUren <= 0)
  ) {
    return null;
  }
  return metBouwsteen.map((t) => ({
    bouwsteenId: t.bouwsteenId,
    minuten: (werkenMinuten * (t.normUren as number)) / totaalNorm,
  }));
}

// ============================================
// Aggregatie per bouwsteen
// ============================================

export interface BouwsteenAggregatie {
  bouwsteenId: string;
  aantalBeurten: number;
  totaalMinuten: number;
  gemiddeldeUren: number;
}

/**
 * Aggregeert de bijdragen van meerdere beurten per bouwsteen: gemiddelde
 * werkelijke duur per uitgevoerde taak. Elke beurt telt maximaal één keer
 * per bouwsteen (aantalBeurten = aantal beurten, niet aantal segmenten).
 */
export function aggregeerPerBouwsteen(
  perBeurt: BouwsteenBijdrage[][]
): BouwsteenAggregatie[] {
  const map = new Map<string, { aantal: number; minuten: number }>();
  for (const bijdragen of perBeurt) {
    const gezien = new Set<string>();
    for (const bijdrage of bijdragen) {
      const huidig = map.get(bijdrage.bouwsteenId) ?? { aantal: 0, minuten: 0 };
      huidig.minuten += bijdrage.minuten;
      if (!gezien.has(bijdrage.bouwsteenId)) {
        huidig.aantal += 1;
        gezien.add(bijdrage.bouwsteenId);
      }
      map.set(bijdrage.bouwsteenId, huidig);
    }
  }
  return [...map.entries()].map(([bouwsteenId, { aantal, minuten }]) => ({
    bouwsteenId,
    aantalBeurten: aantal,
    totaalMinuten: minuten,
    gemiddeldeUren: aantal > 0 ? minuten / 60 / aantal : 0,
  }));
}

// ============================================
// Normuur-suggestie (de mens beslist)
// ============================================

export interface NormuurSuggestie {
  voorgesteldeNormUren: number; // afgerond op 0,1 uur
  gemiddeldeUren: number;
  huidigeNormUren: number | null;
  aantalBeurten: number;
}

/**
 * Bepaalt of er een normuur-suggestie is: pas vanaf `drempel` beurten
 * (default 5; 4 = geen suggestie) en alleen als het afgeronde gemiddelde
 * afwijkt van de huidige norm. Suggesties worden op 0,1 uur afgerond
 * (minimaal 0,1 — een norm van 0 bestaat niet).
 */
export function bepaalNormuurSuggestie(opties: {
  aantalBeurten: number;
  gemiddeldeUren: number;
  huidigeNormUren: number | null;
  drempel: number;
}): NormuurSuggestie | null {
  const { aantalBeurten, gemiddeldeUren, huidigeNormUren, drempel } = opties;
  if (aantalBeurten < drempel) return null;
  if (!Number.isFinite(gemiddeldeUren) || gemiddeldeUren <= 0) return null;
  const voorgesteld = Math.max(0.1, Math.round(gemiddeldeUren * 10) / 10);
  if (huidigeNormUren !== null && Math.abs(voorgesteld - huidigeNormUren) < 0.05) {
    return null; // norm klopt al — geen suggestie nodig
  }
  return {
    voorgesteldeNormUren: voorgesteld,
    gemiddeldeUren,
    huidigeNormUren,
    aantalBeurten,
  };
}

/**
 * In welk veld van het bouwsteen-record de norm leeft: bij prijsmodel "uren"
 * is urenPerBeurt de norm (én de prijsbasis: uren × uurtarief-op-datum, de
 * bestaande regels blijven gelden); anders is normurenPerEenheid de
 * hulpsuggestie. Zelfde voorrang als de dagkaart-normtijd.
 */
export function normuurVeldVoorBouwsteen(bouwsteen: {
  prijsmodel: "uren" | "vast";
  urenPerBeurt?: number;
}): "urenPerBeurt" | "normurenPerEenheid" {
  return bouwsteen.prijsmodel === "uren" ? "urenPerBeurt" : "normurenPerEenheid";
}

/** Huidige norm van een bouwsteen (zelfde voorrang als de dagkaart). */
export function huidigeNormVoorBouwsteen(bouwsteen: {
  urenPerBeurt?: number;
  normurenPerEenheid?: number;
}): number | null {
  return bouwsteen.urenPerBeurt ?? bouwsteen.normurenPerEenheid ?? null;
}

/** Drempel-instelling valideren (geheel getal, 1 t/m 1000). */
export function isGeldigeSuggestieDrempel(drempel: number): boolean {
  return Number.isInteger(drempel) && drempel >= 1 && drempel <= 1000;
}
