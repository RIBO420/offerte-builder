/**
 * R2 — DÉ cijferdefinitie. Eén bestand, twee omzetbegrippen, nul discussie.
 *
 * ── Waarom dit bestand bestaat ──────────────────────────────────────────
 * Voor het rapportage-herontwerp berekenden `convex/dashboard.ts` en
 * `convex/analytics.ts` allebei hun eigen "omzet". De schouw mat daardoor
 * vier verschillende bedragen die allemaal "omzet" heetten:
 *   1. analytics: geaccepteerde offertes incl. btw, peildatum createdAt,
 *      inclusief gearchiveerde en verwijderde offertes;
 *   2. dashboard: idem, maar mét archief/prullenbak-filter;
 *   3. getFinancieelOverzicht: idem, maar EX btw;
 *   4. dashboard-facturen: som van álle facturen, ook concepten.
 * Dashboard en rapportage lezen nu allebei uit dit bestand. Als het cijfer
 * moet veranderen, verandert het hier — en dus op beide plekken tegelijk.
 *
 * ── De twee begrippen ───────────────────────────────────────────────────
 * **GETEKENDE OMZET** (`getekendeOmzet*`) — de opdrachtwaarde die de klant
 * heeft getekend: offertes met status `geaccepteerd`. Dit is het cijfer voor
 * "wat hebben we binnengehaald".
 *   - Peildatum: het moment van accepteren (`customerResponse.respondedAt`,
 *     anders `updatedAt`) — NIET `createdAt`. Een offerte van april die in
 *     augustus getekend wordt, is omzet van augustus.
 *   - Gearchiveerde en zachtverwijderde offertes tellen niet mee.
 *   - Beschikbaar ex én incl. btw. De UI MOET het gekozen begrip labelen.
 *
 * **GEFACTUREERD** (`gefactureerd*`) — de som van facturen waarvan het
 * document de deur uit is (`documentStatus === "verzonden"`). Concept- en
 * definitief-facturen zijn nog niet naar de klant en tellen dus niet mee.
 *   - Peildatum: `factuurdatum`.
 *   - Daarvan afgeleid: `ontvangen` (binnengekomen geld, inclusief
 *     deelbetalingen) en `openstaand` (verzonden minus ontvangen).
 *
 * Deze twee zijn NOOIT gelijk en horen dat ook niet te zijn: getekend werk
 * loopt vóór op de facturatie. Toon ze naast elkaar, nooit als één "omzet".
 *
 * Bewust géén Convex-imports behalve de pure factuurstatus-helper: dit
 * bestand is puur en unit-testbaar.
 */

import { effectieveStatussen } from "../facturatieLogica";

// ── Periode-venster ──────────────────────────────────────────────────────

/** Half-open venster: `start <= t < eind`. */
export interface Venster {
  start: number;
  eind: number;
}

export function binnenVenster(tijdstip: number, venster?: Venster | null): boolean {
  if (!venster) return true;
  return tijdstip >= venster.start && tijdstip < venster.eind;
}

// ── Getekende omzet (offertes) ───────────────────────────────────────────

/** Minimale offertevorm die de omzetdefinitie nodig heeft. */
export interface OfferteVoorOmzet {
  status: string;
  createdAt: number;
  updatedAt: number;
  verzondenAt?: number;
  isArchived?: boolean;
  deletedAt?: number;
  customerResponse?: { respondedAt: number } | null;
  totalen: {
    totaalExBtw: number;
    totaalInclBtw: number;
    marge: number;
  };
}

/**
 * Archief en prullenbak tellen nergens mee — voor offertes, facturen én
 * projecten. Dashboard deed dit al, analytics niet; dat was verschil #1
 * tussen de twee omzetten.
 */
export function isTelbaar(document: {
  isArchived?: boolean;
  deletedAt?: number;
}): boolean {
  return !document.isArchived && !document.deletedAt;
}

/** Status `geaccepteerd`, niet gearchiveerd, niet verwijderd. */
export function isGetekend(offerte: OfferteVoorOmzet): boolean {
  return offerte.status === "geaccepteerd" && isTelbaar(offerte);
}

/**
 * Peildatum van getekende omzet: wanneer de klant tekende.
 * Volgorde: expliciete klantreactie → laatste wijziging → aanmaakdatum.
 * `updatedAt` is de fallback voor offertes die het kantoor zelf op
 * "geaccepteerd" zet (telefonisch akkoord); dat is per definitie het moment
 * waarop die statuswissel plaatsvond.
 */
export function peildatumGetekend(offerte: OfferteVoorOmzet): number {
  return offerte.customerResponse?.respondedAt ?? offerte.updatedAt ?? offerte.createdAt;
}

export interface GetekendeOmzet {
  /** Opdrachtwaarde ex btw — het bedrag waar het bedrijf van leeft. */
  getekendeOmzetExclBtw: number;
  /** Opdrachtwaarde incl. btw — het bedrag dat op de offerte staat. */
  getekendeOmzetInclBtw: number;
  /** Somtotaal van de marge op de getekende offertes (ex btw). */
  getekendeMarge: number;
  /** Marge als percentage van `getekendeOmzetExclBtw`, 1 decimaal. */
  getekendeMargePercentage: number;
  /** Aantal getekende offertes in het venster. */
  aantalGetekend: number;
  /** Gemiddelde opdrachtwaarde ex btw. */
  gemiddeldeOpdrachtwaarde: number;
}

export function berekenGetekendeOmzet(
  offertes: ReadonlyArray<OfferteVoorOmzet>,
  venster?: Venster | null
): GetekendeOmzet {
  let exclBtw = 0;
  let inclBtw = 0;
  let marge = 0;
  let aantal = 0;

  for (const offerte of offertes) {
    if (!isGetekend(offerte)) continue;
    if (!binnenVenster(peildatumGetekend(offerte), venster)) continue;
    exclBtw += offerte.totalen.totaalExBtw ?? 0;
    inclBtw += offerte.totalen.totaalInclBtw ?? 0;
    marge += offerte.totalen.marge ?? 0;
    aantal++;
  }

  return {
    getekendeOmzetExclBtw: rond(exclBtw),
    getekendeOmzetInclBtw: rond(inclBtw),
    getekendeMarge: rond(marge),
    getekendeMargePercentage: exclBtw > 0 ? rond1((marge / exclBtw) * 100) : 0,
    aantalGetekend: aantal,
    gemiddeldeOpdrachtwaarde: aantal > 0 ? rond(exclBtw / aantal) : 0,
  };
}

// ── Gefactureerd / openstaand (facturen) ─────────────────────────────────

/** Minimale factuurvorm die de omzetdefinitie nodig heeft. */
export interface FactuurVoorOmzet {
  status: "concept" | "definitief" | "verzonden" | "betaald" | "vervallen";
  documentStatus?: "concept" | "definitief" | "verzonden";
  betaalStatus?:
    | "open"
    | "gedeeltelijk_betaald"
    | "betaald"
    | "vervallen"
    | "geannuleerd";
  betaaldBedrag?: number;
  subtotaal: number;
  totaalInclBtw: number;
  factuurdatum: number;
  vervaldatum: number;
  createdAt: number;
  isArchived?: boolean;
  isCreditnota?: boolean;
}

/**
 * Een factuur telt pas als "gefactureerd" zodra het document verzonden is.
 * Concept en definitief liggen nog op kantoor. Geannuleerde facturen tellen
 * nergens mee. Gebruikt `effectieveStatussen`, nooit het kale legacy-veld.
 */
export function isGefactureerd(factuur: FactuurVoorOmzet): boolean {
  if (factuur.isArchived) return false;
  const { documentStatus, betaalStatus } = effectieveStatussen(factuur);
  return documentStatus === "verzonden" && betaalStatus !== "geannuleerd";
}

/** Peildatum van een factuur: de factuurdatum, niet het aanmaakmoment. */
export function peildatumFactuur(factuur: FactuurVoorOmzet): number {
  return factuur.factuurdatum ?? factuur.createdAt;
}

/** Reeds ontvangen bedrag; legacy "betaald" zonder deelbetalingen telt vol. */
export function ontvangenBedrag(factuur: FactuurVoorOmzet): number {
  const { betaalStatus } = effectieveStatussen(factuur);
  if (typeof factuur.betaaldBedrag === "number") return factuur.betaaldBedrag;
  return betaalStatus === "betaald" ? factuur.totaalInclBtw : 0;
}

/** Wat er van deze factuur nog binnen moet komen (nooit negatief). */
export function openstaandBedrag(factuur: FactuurVoorOmzet): number {
  if (!isGefactureerd(factuur)) return 0;
  return Math.max(0, factuur.totaalInclBtw - ontvangenBedrag(factuur));
}

export interface Facturatie {
  /** Verzonden facturen incl. btw in het venster. */
  gefactureerdInclBtw: number;
  /** Verzonden facturen ex btw (subtotaal) in het venster. */
  gefactureerdExclBtw: number;
  aantalFacturen: number;
  /** Daadwerkelijk binnengekomen geld op die facturen (incl. deelbetalingen). */
  ontvangen: number;
  /** Verzonden minus ontvangen — het geld dat nog buiten staat. */
  openstaand: number;
  /** Deel van `openstaand` op facturen waarvan de vervaldatum voorbij is. */
  vervallenBedrag: number;
  aantalVervallen: number;
}

export function berekenFacturatie(
  facturen: ReadonlyArray<FactuurVoorOmzet>,
  venster?: Venster | null,
  nu: number = Date.now()
): Facturatie {
  let inclBtw = 0;
  let exclBtw = 0;
  let aantal = 0;
  let ontvangen = 0;
  let openstaand = 0;
  let vervallen = 0;
  let aantalVervallen = 0;

  for (const factuur of facturen) {
    if (!isGefactureerd(factuur)) continue;
    if (!binnenVenster(peildatumFactuur(factuur), venster)) continue;
    inclBtw += factuur.totaalInclBtw ?? 0;
    exclBtw += factuur.subtotaal ?? 0;
    aantal++;
    ontvangen += ontvangenBedrag(factuur);
    const open = openstaandBedrag(factuur);
    openstaand += open;
    if (open > 0 && factuur.vervaldatum < nu) {
      vervallen += open;
      aantalVervallen++;
    }
  }

  return {
    gefactureerdInclBtw: rond(inclBtw),
    gefactureerdExclBtw: rond(exclBtw),
    aantalFacturen: aantal,
    ontvangen: rond(ontvangen),
    openstaand: rond(openstaand),
    vervallenBedrag: rond(vervallen),
    aantalVervallen,
  };
}

// ── Gecombineerd ─────────────────────────────────────────────────────────

export type OmzetCijfers = GetekendeOmzet & Facturatie;

/**
 * De volledige cijferset voor één periode. Dít is wat sectie 1 van de
 * rapportage toont en waar het dashboard zijn omzetkaart uit haalt.
 */
export function berekenOmzetCijfers(
  offertes: ReadonlyArray<OfferteVoorOmzet>,
  facturen: ReadonlyArray<FactuurVoorOmzet>,
  venster?: Venster | null,
  nu: number = Date.now()
): OmzetCijfers {
  return {
    ...berekenGetekendeOmzet(offertes, venster),
    ...berekenFacturatie(facturen, venster, nu),
  };
}

/**
 * Procentuele verandering t.o.v. een vergelijkingswaarde.
 * `null` als er geen basis is — dan is "+100%" een leugen en hoort de UI
 * "geen vergelijking mogelijk" te tonen.
 */
export function verschilPercentage(
  huidig: number,
  vorig: number
): number | null {
  if (!vorig) return null;
  return rond1(((huidig - vorig) / Math.abs(vorig)) * 100);
}

// ── Afronding ────────────────────────────────────────────────────────────

function rond(n: number): number {
  return Math.round(n * 100) / 100;
}

function rond1(n: number): number {
  return Math.round(n * 10) / 10;
}
