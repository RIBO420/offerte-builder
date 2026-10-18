/**
 * Korte uren- en afwijkingsnotatie voor de projectpagina's (uitvoering,
 * nacalculatie): Nederlandse notatie, hooguit één decimaal.
 *
 * Bestaat omdat uren uit optellingen komen (8,6 + 9 + … ) en dan als
 * `35.150000000000006u` op het scherm belandden. `formatHours` uit
 * `./number` geeft altijd een vaste decimaal ("36,0"); hier valt een ronde
 * waarde terug op een heel getal ("36"), zoals in een zin hoort.
 */

const UREN = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

/** Rondt af op één decimaal en voorkomt een "-0". */
function rond(waarde: number): number {
  const r = Math.round(waarde * 10) / 10;
  return r === 0 ? 0 : r;
}

/**
 * Uren met hooguit één decimaal.
 *
 * @example
 * formatUrenKort(35.150000000000006) // "35,2"
 * formatUrenKort(36) // "36"
 * formatUrenKort(1234.5) // "1.234,5"
 */
export function formatUrenKort(uren: number): string {
  if (!Number.isFinite(uren)) return "0";
  return UREN.format(rond(uren));
}

/**
 * Afwijking in procenten, afgerond op hele procenten, met teken. Het
 * minteken is een echt minteken (U+2212), zodat het in tabelcijfers even
 * breed is als het plusteken.
 *
 * @example
 * formatAfwijkingProcent(-32.4) // "−32%"
 * formatAfwijkingProcent(76) // "+76%"
 * formatAfwijkingProcent(0.2) // "0%"
 */
export function formatAfwijkingProcent(procent: number): string {
  if (!Number.isFinite(procent)) return "0%";
  const r = Math.round(procent);
  if (r === 0) return "0%";
  return `${r > 0 ? "+" : "−"}${Math.abs(r)}%`;
}
