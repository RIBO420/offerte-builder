/**
 * Nederlandse datum- en duurnotatie voor de lijst en de dagkaart.
 *
 * Bewust handmatig in plaats van `Intl.DateTimeFormat("nl-NL")`: die zet een
 * punt achter afgekorte maanden ("okt.") en verschilt per runtime, terwijl de
 * planning overal "ma 12 okt" toont. Alle invoer is een ISO-datum (YYYY-MM-DD)
 * en wordt in UTC gelezen, zodat er nooit een dag verschuift door de tijdzone.
 */

const DAG_KORT = ["zo", "ma", "di", "wo", "do", "vr", "za"] as const;
const DAG_LANG = [
  "zondag",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
] as const;
const MAAND_KORT = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
] as const;
const MAAND_LANG = [
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
] as const;

function delen(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    jaar: d.getUTCFullYear(),
    maand: d.getUTCMonth(),
    dag: d.getUTCDate(),
    weekdag: d.getUTCDay(),
  };
}

/** "ma 12 okt" */
export function datumKort(iso: string): string {
  const d = delen(iso);
  return `${DAG_KORT[d.weekdag]} ${d.dag} ${MAAND_KORT[d.maand]}`;
}

/**
 * Bereik van een (meerdaagse) afspraak: "ma 12 okt", "di 13 – do 15 okt" of
 * "wo 30 sep – vr 2 okt". De maand staat er één keer als hij gelijk is.
 */
export function datumBereikKort(start: string, eind: string): string {
  if (eind === start) return datumKort(start);
  const a = delen(start);
  const b = delen(eind);
  const links =
    a.maand === b.maand && a.jaar === b.jaar
      ? `${DAG_KORT[a.weekdag]} ${a.dag}`
      : datumKort(start);
  return `${links} – ${datumKort(eind)}`;
}

/** Kalenderbereik zonder weekdagen: "12–18 okt" of "28 sep – 4 okt". */
export function dagenBereik(start: string, eind: string): string {
  const a = delen(start);
  const b = delen(eind);
  if (a.maand === b.maand && a.jaar === b.jaar) {
    return `${a.dag}–${b.dag} ${MAAND_KORT[b.maand]}`;
  }
  return `${a.dag} ${MAAND_KORT[a.maand]} – ${b.dag} ${MAAND_KORT[b.maand]}`;
}

/**
 * Periode voluit, voor een samenvattingsregel: "12 tot en met 25 oktober",
 * "28 september tot en met 11 oktober", met jaartal als het jaar wisselt.
 */
export function periodeVoluit(van: string, tot: string): string {
  const a = delen(van);
  const b = delen(tot);
  if (a.jaar !== b.jaar) {
    return `${a.dag} ${MAAND_LANG[a.maand]} ${a.jaar} tot en met ${b.dag} ${MAAND_LANG[b.maand]} ${b.jaar}`;
  }
  if (a.maand === b.maand) {
    return `${a.dag} tot en met ${b.dag} ${MAAND_LANG[b.maand]}`;
  }
  return `${a.dag} ${MAAND_LANG[a.maand]} tot en met ${b.dag} ${MAAND_LANG[b.maand]}`;
}

/**
 * Dagkop voluit: "Zondag 18 oktober". Valt de dag in een ander jaar dan
 * `referentie` (standaard: hetzelfde jaar), dan komt het jaartal erachter.
 */
export function dagVoluit(iso: string, referentie?: string): string {
  const d = delen(iso);
  const dag = DAG_LANG[d.weekdag];
  const basis = `${dag.charAt(0).toUpperCase()}${dag.slice(1)} ${d.dag} ${MAAND_LANG[d.maand]}`;
  if (referentie && delen(referentie).jaar !== d.jaar) return `${basis} ${d.jaar}`;
  return basis;
}

/** ISO-weeknummer en -jaar (week 1 bevat de eerste donderdag van het jaar). */
export function isoWeek(iso: string): { jaar: number; week: number } {
  const d = new Date(`${iso}T00:00:00Z`);
  const weekdag = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  // Donderdag van dezelfde week bepaalt het ISO-jaar
  d.setUTCDate(d.getUTCDate() + 4 - weekdag);
  const jaar = d.getUTCFullYear();
  const jan1 = Date.UTC(jaar, 0, 1);
  const week = Math.ceil(((d.getTime() - jan1) / 86_400_000 + 1) / 7);
  return { jaar, week };
}

/** Duur in minuten als "45 min", "2 u" of "8 u 30 min". */
export function duurTekst(minuten: number): string {
  const m = Math.max(0, Math.round(minuten));
  if (m < 60) return `${m} min`;
  const uren = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${uren} u` : `${uren} u ${rest} min`;
}

/** Uren in Nederlandse notatie: 36 → "36", 7.5 → "7,5". */
export function urenTekst(uren: number): string {
  return uren.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
}

/**
 * Is dit een echte ISO-datum (YYYY-MM-DD)? Voor URL-parameters als
 * `?datum=`: "2026-13-45" of "morgen" mag nooit een query in.
 */
export function isIsoDatum(waarde: string | null | undefined): waarde is string {
  if (!waarde || !/^\d{4}-\d{2}-\d{2}$/.test(waarde)) return false;
  const d = new Date(`${waarde}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === waarde;
}
