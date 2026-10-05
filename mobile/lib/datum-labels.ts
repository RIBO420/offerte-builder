/**
 * Nederlandse datumlabels voor de veldapp — zonder Intl-maand/dagnamen, zodat
 * ze op Hermes overal gelijk zijn. Werkt op ISO-dagen ("2026-10-05").
 */

const DAGEN = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
const DAGEN_KORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const MAANDEN_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function delen(datum: string) {
  const d = new Date(`${datum}T12:00:00Z`);
  return { dag: d.getUTCDate(), maand: d.getUTCMonth(), jaar: d.getUTCFullYear(), weekdag: d.getUTCDay() };
}

/** "maandag 5 oktober" */
export function dagLabel(datum: string): string {
  const { dag, maand, weekdag } = delen(datum);
  return `${DAGEN[weekdag]} ${dag} ${MAANDEN[maand]}`;
}

/** "Maandag" */
export function weekdagNaam(datum: string): string {
  const naam = DAGEN[delen(datum).weekdag];
  return naam.charAt(0).toUpperCase() + naam.slice(1);
}

/** "ma" */
export function weekdagKort(datum: string): string {
  return DAGEN_KORT[delen(datum).weekdag];
}

/** 5 */
export function dagNummer(datum: string): number {
  return delen(datum).dag;
}

/** "5 okt" */
export function korteDatum(datum: string): string {
  const { dag, maand } = delen(datum);
  return `${dag} ${MAANDEN_KORT[maand]}`;
}

/** "oktober 2026" */
export function maandLabel(datum: string): string {
  const { maand, jaar } = delen(datum);
  return `${MAANDEN[maand]} ${jaar}`;
}

/** "5 – 11 oktober" of "28 sep – 4 okt" */
export function periodeLabel(van: string, tot: string): string {
  const a = delen(van);
  const b = delen(tot);
  if (a.maand === b.maand) return `${a.dag} – ${b.dag} ${MAANDEN[b.maand]}`;
  return `${a.dag} ${MAANDEN_KORT[a.maand]} – ${b.dag} ${MAANDEN_KORT[b.maand]}`;
}

/** ISO-weeknummer. */
export function weekNummer(datum: string): number {
  const d = new Date(`${datum}T12:00:00Z`);
  const dagNr = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dagNr + 3);
  const eersteDonderdag = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  return 1 + Math.round(((d.getTime() - eersteDonderdag.getTime()) / 86400000 - 3 + ((eersteDonderdag.getUTCDay() + 6) % 7)) / 7);
}

/** "3u 45m" → compact "3:45" voor heldcijfers. */
export function urenKlok(minuten: number): string {
  const totaal = Math.max(0, Math.round(minuten));
  return `${Math.floor(totaal / 60)}:${String(totaal % 60).padStart(2, '0')}`;
}
