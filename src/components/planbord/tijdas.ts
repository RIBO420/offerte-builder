/**
 * Geometrie van het tijdbord (HERO-nabouw fase 4): minuten ↔ positie binnen
 * een dagcel. De zichtbare dag is de werkdag (bv. 07:00–18:00), zodat ook in
 * de weekweergave een kwartier breed genoeg is om op te slepen.
 */

import { snap, stapVoorKwartierBreedte, type Werkdag } from "../../../convex/tijdbordLogica";

export function dagLengte(werkdag: Werkdag): number {
  return Math.max(60, werkdag.eind - werkdag.start);
}

/** Links en breedte in procenten van de dagcel; buiten de werkdag afgekapt. */
export function segmentPositie(
  startMinuten: number,
  eindMinuten: number,
  werkdag: Werkdag
): { left: number; width: number; afgekaptLinks: boolean; afgekaptRechts: boolean } {
  const lengte = dagLengte(werkdag);
  const van = Math.max(werkdag.start, startMinuten);
  const tot = Math.min(werkdag.eind, eindMinuten);
  return {
    left: ((van - werkdag.start) / lengte) * 100,
    width: (Math.max(0, tot - van) / lengte) * 100,
    afgekaptLinks: startMinuten < werkdag.start,
    afgekaptRechts: eindMinuten > werkdag.eind,
  };
}

/** Stap (15 of 60 min) voor een cel van deze breedte. */
export function stapVoorCel(celBreedtePx: number, werkdag: Werkdag): number {
  const kwartieren = dagLengte(werkdag) / 15;
  return stapVoorKwartierBreedte(celBreedtePx / kwartieren);
}

/** Minuut op x-positie binnen een cel, afgerond op de stap. */
export function minuutOpX(
  xInCel: number,
  celBreedtePx: number,
  werkdag: Werkdag,
  stap = stapVoorCel(celBreedtePx, werkdag)
): number {
  const fractie = Math.max(0, Math.min(1, xInCel / Math.max(1, celBreedtePx)));
  return snap(werkdag.start + fractie * dagLengte(werkdag), stap);
}

/** Uurstreepjes voor de kop: elk uur, of om de 2/3 uur als het krap is. */
export function uurMarkeringen(werkdag: Werkdag, celBreedtePx: number): number[] {
  const uren = dagLengte(werkdag) / 60;
  const pxPerUur = celBreedtePx / uren;
  const elke = pxPerUur >= 40 ? 1 : pxPerUur >= 18 ? 2 : 3;
  const uit: number[] = [];
  const eersteUur = Math.ceil(werkdag.start / 60);
  for (let u = eersteUur; u * 60 <= werkdag.eind; u++) {
    if ((u - eersteUur) % elke === 0) uit.push(u * 60);
  }
  return uit;
}

/** Twee vensters op dezelfde dag overlappen (rode rand, niet blokkeren). */
export function overlapt(
  a: { start: number; eind: number },
  b: { start: number; eind: number }
): boolean {
  return a.start < b.eind && b.start < a.eind;
}
