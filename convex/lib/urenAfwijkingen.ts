/**
 * Afwijkingsregels + weekgrenzen voor de Controlekamer (`/uren`).
 *
 * Kernprincipes:
 * - De zes afwijkingstypen uit het datacontract (`docs/design/plannen/
 *   uren-controlekamer-plan.md` §2) zijn hier HARDCODED en puur: kantoor
 *   beoordeelt per dag, dus één dag segmenten in → nul of meer redenen uit.
 *   Geen instellingen-knoppen (bewust: een drempel die iedereen kan draaien is
 *   geen norm meer). De "Wie is achter"-drempels uit `veldLogica.ts` staan
 *   hier los van — die gaan over gepland vs. gelogd per bezoek.
 * - Elke regel is strikt: exact op de grens is GEEN afwijking. 9,5 uur is een
 *   lange dag maar geen signaal; 9,6 wel. Zo blijft de wachtrij kort en
 *   betrouwbaar (§6: geen strafbank).
 * - Weekgrenzen zijn Europe/Amsterdam met maandag als start. De datums in de
 *   database zijn kale YYYY-MM-DD-strings; alleen "welke dag is het nu"
 *   heeft een tijdzone nodig (`vandaagAmsterdam`).
 *
 * NB: net als `planbordLogica.ts` en `veldLogica.ts` bewust GEEN
 * runtime-imports naar de Convex-server, zodat unit-tests en de client-UI dit
 * zonder Convex-runtime kunnen gebruiken.
 */

import { addDagen, isoWeekdag } from "../planbordLogica";
import type { SegmentCategorie } from "../veldLogica";

// ============================================
// Datacontract — types (§2 van het plan)
// ============================================

/** Eén segment zoals de Controlekamer het toont (geldvrij, geen ids nodig). */
export interface DagSegment {
  beginTijd: string; // HH:MM
  eindTijd: string; // HH:MM
  categorie: SegmentCategorie;
  label?: string; // werkitem- of klantnaam, alleen ter herkenning
}

/**
 * De zes afwijkingstypen. Elke reden is een volledige zin-in-data: de UI
 * schrijft er één afwijkingszin van, zonder terug te hoeven rekenen.
 */
export type AfwijkingsReden =
  | { type: "lange_dag"; uren: number }
  | { type: "geen_pauze"; uren: number }
  | { type: "zonder_werkitem" }
  | { type: "gat"; vanTijd: string; totTijd: string; minuten: number }
  | { type: "handmatig_ipv_voorstel" }
  | { type: "heropend" };

/** Segment-invoer voor de regels: alleen wat de regels echt nodig hebben. */
export interface AfwijkingSegment {
  beginTijd: string;
  eindTijd: string;
  categorie: SegmentCategorie;
  /** Werkitem-koppeling; bij "werken" verplicht (§2.6). */
  werkitemId?: string | null;
  /** Herkomst: bevestigd dagkaart-voorstel of handmatig ingevoerd. */
  bron?: "voorstel" | "handmatig";
}

/** Wat de regels buiten de segmenten om nodig hebben. */
export interface AfwijkingContext {
  /** Had de ploeg van deze medewerker die dag ingeplande werkitems? */
  heeftPlanning?: boolean;
  /** Staat er een `dag_heropend` in het urenLogboek voor deze dag? */
  isHeropend?: boolean;
}

// ============================================
// Drempels (hardcoded, §2 van het plan)
// ============================================

export const UREN_AFWIJKING_DREMPELS = {
  /** Meer dan 9,5 uur werkende tijd op één dag. */
  langeDagMinuten: 9.5 * 60,
  /** Meer dan 5,5 uur aaneengesloten zonder pauze. */
  geenPauzeMinuten: 5.5 * 60,
  /** Gat van meer dan 60 minuten … */
  gatMinuten: 60,
  /** … binnen het werkvenster 07:00–17:00. */
  gatVensterVan: "07:00",
  gatVensterTot: "17:00",
} as const;

/**
 * Categorieën die als "werkende tijd" tellen: alles behalve pauze. Rijden,
 * teammeeting, materiaalonderhoud en de BES-rit zijn geen vrije tijd — een dag
 * van 8 uur werken plus 2 uur rijden is een lange dag, ook al staat er
 * 8 uur "werken" in.
 */
export function isWerkendeCategorie(categorie: SegmentCategorie): boolean {
  return categorie !== "pauze";
}

/**
 * Indirecte tijd: werkende tijd die niet aan een klus hangt (reistijd,
 * teammeeting, materiaalonderhoud, BES-rit, anders). Bewust hier gedefinieerd
 * en nergens anders, zodat de Controlekamer en de ploegenfilm hetzelfde
 * "indirect" tonen.
 */
export function isIndirecteCategorie(categorie: SegmentCategorie): boolean {
  return categorie !== "pauze" && categorie !== "werken";
}

// ============================================
// Tijd-helpers (HH:MM)
// ============================================

/** HH:MM → minuten sinds middernacht. Ongeldige invoer levert 0. */
export function minutenVanTijd(tijd: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(tijd);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minuten sinds middernacht → HH:MM. */
export function tijdVanMinuten(minuten: number): string {
  const geklemd = Math.max(0, Math.min(24 * 60, Math.round(minuten)));
  const u = Math.floor(geklemd / 60);
  const m = geklemd % 60;
  return `${String(u).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function duurMinuten(segment: AfwijkingSegment): number {
  return Math.max(
    0,
    minutenVanTijd(segment.eindTijd) - minutenVanTijd(segment.beginTijd)
  );
}

/** Segmenten chronologisch (begintijd, dan eindtijd). Muteert niet. */
export function sorteerSegmenten<T extends { beginTijd: string; eindTijd: string }>(
  segmenten: T[]
): T[] {
  return [...segmenten].sort(
    (a, b) =>
      minutenVanTijd(a.beginTijd) - minutenVanTijd(b.beginTijd) ||
      minutenVanTijd(a.eindTijd) - minutenVanTijd(b.eindTijd)
  );
}

/** Uren met één decimaal (de enige afronding die de urenpagina toont). */
export function urenVanMinuten(minuten: number): number {
  return Math.round((minuten / 60) * 10) / 10;
}

// ============================================
// Dag-totalen
// ============================================

/** Werkende minuten van een dag (alles behalve pauze). */
export function werkendeMinuten(segmenten: AfwijkingSegment[]): number {
  return segmenten
    .filter((s) => isWerkendeCategorie(s.categorie))
    .reduce((som, s) => som + duurMinuten(s), 0);
}

/** Indirecte minuten van een dag (werkende tijd zonder klus). */
export function indirecteMinuten(segmenten: AfwijkingSegment[]): number {
  return segmenten
    .filter((s) => isIndirecteCategorie(s.categorie))
    .reduce((som, s) => som + duurMinuten(s), 0);
}

/** Dagtotaal in uren (werkende tijd, pauze telt niet mee). */
export function dagTotaalUren(segmenten: AfwijkingSegment[]): number {
  return urenVanMinuten(werkendeMinuten(segmenten));
}

// ============================================
// De zes regels — elk apart testbaar
// ============================================

/** 1. Lange dag: méér dan 9,5 uur werkende tijd. */
export function langeDagReden(
  segmenten: AfwijkingSegment[]
): AfwijkingsReden | null {
  const minuten = werkendeMinuten(segmenten);
  if (minuten <= UREN_AFWIJKING_DREMPELS.langeDagMinuten) return null;
  return { type: "lange_dag", uren: urenVanMinuten(minuten) };
}

/**
 * 2. Geen pauze: langer dan 5,5 uur aaneengesloten werken. Een pauzesegment
 * breekt de reeks; een gat in de dag ook (dan wérkte hij niet, en dat gat
 * heeft zijn eigen regel).
 */
export function geenPauzeReden(
  segmenten: AfwijkingSegment[]
): AfwijkingsReden | null {
  const gesorteerd = sorteerSegmenten(segmenten);
  let langste = 0;
  let reeks = 0;
  let reeksEind: number | null = null;

  for (const segment of gesorteerd) {
    const begin = minutenVanTijd(segment.beginTijd);
    const eind = minutenVanTijd(segment.eindTijd);
    if (!isWerkendeCategorie(segment.categorie)) {
      langste = Math.max(langste, reeks);
      reeks = 0;
      reeksEind = null;
      continue;
    }
    if (reeksEind !== null && begin > reeksEind) {
      // Gat tussen twee werkblokken: de reeks is gebroken.
      langste = Math.max(langste, reeks);
      reeks = 0;
    }
    reeks += Math.max(0, eind - Math.max(begin, reeksEind ?? begin));
    reeksEind = Math.max(reeksEind ?? eind, eind);
  }
  langste = Math.max(langste, reeks);

  if (langste <= UREN_AFWIJKING_DREMPELS.geenPauzeMinuten) return null;
  return { type: "geen_pauze", uren: urenVanMinuten(langste) };
}

/**
 * 3. Zonder werkitem: een "werken"-segment zonder klus. De mutations dwingen
 * dit af bij nieuwe invoer, dus dit vangt oude rijen en importfouten — precies
 * de dagen die nacalculatie stil zouden vervuilen.
 */
export function zonderWerkitemReden(
  segmenten: AfwijkingSegment[]
): AfwijkingsReden | null {
  const raak = segmenten.some(
    (s) => s.categorie === "werken" && !s.werkitemId
  );
  return raak ? { type: "zonder_werkitem" } : null;
}

/**
 * 4. Gat: onverklaarde tijd van méér dan 60 minuten binnen 07:00–17:00. Het
 * gat wordt geklemd op het venster, zodat een dag die om 15:00 stopt geen
 * "gat" van twee uur tot 17:00 oplevert (dat is gewoon het einde van de dag):
 * alleen gaten TUSSEN twee segmenten tellen.
 */
export function gatRedenen(segmenten: AfwijkingSegment[]): AfwijkingsReden[] {
  const gesorteerd = sorteerSegmenten(segmenten);
  const vensterVan = minutenVanTijd(UREN_AFWIJKING_DREMPELS.gatVensterVan);
  const vensterTot = minutenVanTijd(UREN_AFWIJKING_DREMPELS.gatVensterTot);
  const redenen: AfwijkingsReden[] = [];
  let vorigEind: number | null = null;

  for (const segment of gesorteerd) {
    const begin = minutenVanTijd(segment.beginTijd);
    const eind = minutenVanTijd(segment.eindTijd);
    if (vorigEind !== null && begin > vorigEind) {
      const van = Math.max(vorigEind, vensterVan);
      const tot = Math.min(begin, vensterTot);
      const minuten = tot - van;
      if (minuten > UREN_AFWIJKING_DREMPELS.gatMinuten) {
        redenen.push({
          type: "gat",
          vanTijd: tijdVanMinuten(van),
          totTijd: tijdVanMinuten(tot),
          minuten,
        });
      }
    }
    vorigEind = Math.max(vorigEind ?? eind, eind);
  }
  return redenen;
}

/**
 * 5. Handmatig i.p.v. voorstel: er lág een dagkaart voor de ploeg, maar geen
 * enkel segment komt uit dat voorstel. Dan is de dag met de hand getypt en
 * verdient hij één blik — niet omdat handmatig verboden is, maar omdat het
 * afwijkt van "loggen wordt bevestigen" (§8.10).
 */
export function handmatigIpvVoorstelReden(
  segmenten: AfwijkingSegment[],
  heeftPlanning: boolean | undefined
): AfwijkingsReden | null {
  if (!heeftPlanning || segmenten.length === 0) return null;
  const uitVoorstel = segmenten.some((s) => s.bron === "voorstel");
  return uitVoorstel ? null : { type: "handmatig_ipv_voorstel" };
}

/** 6. Heropend: kantoor heeft deze dag eerder van het slot gehaald. */
export function heropendReden(
  isHeropend: boolean | undefined
): AfwijkingsReden | null {
  return isHeropend ? { type: "heropend" } : null;
}

/**
 * Alle redenen van één dag, in vaste volgorde (lange dag → geen pauze →
 * zonder werkitem → gaten → handmatig → heropend). De UI toont de eerste als
 * afwijkingszin, dus de volgorde is de prioriteit: eerst wat over de mens
 * gaat, dan wat over de administratie gaat.
 */
export function bepaalAfwijkingen(
  segmenten: AfwijkingSegment[],
  context: AfwijkingContext = {}
): AfwijkingsReden[] {
  const redenen: AfwijkingsReden[] = [];
  const voegToe = (reden: AfwijkingsReden | null) => {
    if (reden) redenen.push(reden);
  };
  voegToe(langeDagReden(segmenten));
  voegToe(geenPauzeReden(segmenten));
  voegToe(zonderWerkitemReden(segmenten));
  redenen.push(...gatRedenen(segmenten));
  voegToe(handmatigIpvVoorstelReden(segmenten, context.heeftPlanning));
  voegToe(heropendReden(context.isHeropend));
  return redenen;
}

// ============================================
// Kwijting (logboek-akkoord, §2 van het plan)
// ============================================

/** Logboek-entry zoals de kwijting hem nodig heeft. */
export interface KwijtingEntry {
  actie: string;
  createdAt: number;
}

export interface KwijtingStatus {
  /** Kantoor heeft deze dag akkoord verklaard en er is daarna niets heropend. */
  gekweten: boolean;
  /** De dag is ná het laatste akkoord (of zonder akkoord) heropend. */
  heropend: boolean;
}

/**
 * Kwijting is een logboek-gebeurtenis, geen status. Wie het laatst sprak,
 * heeft gelijk: een `dag_akkoord` ná een `dag_heropend` kweit de dag; een
 * heropening ná een akkoord zet hem terug in de wachtrij. Zo is "akkoord"
 * idempotent (tweede klik verandert niets) zónder dat een heropende dag stil
 * uit het zicht verdwijnt.
 */
export function bepaalKwijting(entries: KwijtingEntry[]): KwijtingStatus {
  let akkoordOp = -1;
  let heropendOp = -1;
  for (const entry of entries) {
    if (entry.actie === "dag_akkoord") {
      akkoordOp = Math.max(akkoordOp, entry.createdAt);
    } else if (entry.actie === "dag_heropend") {
      heropendOp = Math.max(heropendOp, entry.createdAt);
    }
  }
  return {
    gekweten: akkoordOp >= 0 && akkoordOp > heropendOp,
    heropend: heropendOp >= 0 && heropendOp > akkoordOp,
  };
}

// ============================================
// Weekgrenzen (Europe/Amsterdam, maandag als start)
// ============================================

const TIJDZONE = "Europe/Amsterdam";

const MAAND_NAMEN = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

const DAG_NAMEN = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];

export const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

/** Vandaag als YYYY-MM-DD in Europe/Amsterdam (patroon: facturatieLogica). */
export function vandaagAmsterdam(nu: number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIJDZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nu));
}

/** De maandag van de week waarin `datum` valt. */
export function weekStartVan(datum: string): string {
  return addDagen(datum, -(isoWeekdag(datum) - 1));
}

/** De maandag van de huidige week (Europe/Amsterdam). */
export function huidigeWeekStart(nu: number = Date.now()): string {
  return weekStartVan(vandaagAmsterdam(nu));
}

/** De zeven datums van een week, maandag t/m zondag. */
export function weekDagen(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDagen(weekStart, i));
}

/** De vijf werkdagen van een week, maandag t/m vrijdag. */
export function werkdagenVanWeek(weekStart: string): string[] {
  return Array.from({ length: 5 }, (_, i) => addDagen(weekStart, i));
}

/** True als `datum` een maandag is. */
export function isMaandag(datum: string): boolean {
  return isoWeekdag(datum) === 1;
}

/**
 * ISO-weeknummer (donderdag-regel): de week waarin de donderdag valt, bepaalt
 * het jaar en het nummer. Zonder deze regel zou 1 januari 2027 (een vrijdag)
 * in "week 1" vallen terwijl hij bij week 53 van 2026 hoort.
 */
export function isoWeekNummer(datum: string): number {
  const donderdag = addDagen(datum, 4 - isoWeekdag(datum));
  const jaarStart = `${donderdag.slice(0, 4)}-01-01`;
  const dagen = Math.round(
    (Date.parse(`${donderdag}T00:00:00Z`) -
      Date.parse(`${jaarStart}T00:00:00Z`)) /
      (24 * 60 * 60 * 1000)
  );
  return Math.floor(dagen / 7) + 1;
}

/** De laatste `aantal` werkdagen (ma–vr) t/m `datum`, oudste eerst. */
export function laatsteWerkdagen(datum: string, aantal: number): string[] {
  const dagen: string[] = [];
  let cursor = datum;
  // Ruime bovengrens: 5 werkdagen per 7 kalenderdagen, plus marge.
  for (let stap = 0; stap < aantal * 2 + 14 && dagen.length < aantal; stap++) {
    if (isoWeekdag(cursor) <= 5) dagen.push(cursor);
    cursor = addDagen(cursor, -1);
  }
  return dagen.reverse();
}

/**
 * Weeklabel zoals de kop hem toont: "Week 33 · 10 t/m 16 augustus". Loopt de
 * week over een maandgrens, dan staat de maand er twee keer:
 * "Week 31 · 27 juli t/m 2 augustus".
 */
export function weekLabelVan(weekStart: string): string {
  const weekEind = addDagen(weekStart, 6);
  const startDag = Number(weekStart.slice(8, 10));
  const eindDag = Number(weekEind.slice(8, 10));
  const startMaand = MAAND_NAMEN[Number(weekStart.slice(5, 7)) - 1];
  const eindMaand = MAAND_NAMEN[Number(weekEind.slice(5, 7)) - 1];
  const van = startMaand === eindMaand ? `${startDag}` : `${startDag} ${startMaand}`;
  return `Week ${isoWeekNummer(weekStart)} · ${van} t/m ${eindDag} ${eindMaand}`;
}

/** Daglabel zoals de ploegenfilm hem toont: "maandag 11 augustus 2026". */
export function dagLabelVan(datum: string): string {
  const dagNaam = DAG_NAMEN[isoWeekdag(datum) - 1];
  const dag = Number(datum.slice(8, 10));
  const maand = MAAND_NAMEN[Number(datum.slice(5, 7)) - 1];
  return `${dagNaam} ${dag} ${maand} ${datum.slice(0, 4)}`;
}

/** Kort daglabel voor de filmstrip: "ma 11 aug". */
export function kortDagLabelVan(datum: string): string {
  const dagNaam = DAG_NAMEN[isoWeekdag(datum) - 1].slice(0, 2);
  const dag = Number(datum.slice(8, 10));
  const maand = MAAND_NAMEN[Number(datum.slice(5, 7)) - 1].slice(0, 3);
  return `${dagNaam} ${dag} ${maand}`;
}
