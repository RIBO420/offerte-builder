/**
 * Periode-helpers voor het weekbord (PRD §2.2): de periodetoggle
 * dag / 3 dagen / week / 14 dagen / 4 weken / maand.
 */

import { addDagen } from "../../../convex/planbordLogica";

export type Periode = "dag" | "3dagen" | "week" | "14dagen" | "4weken" | "maand";

export const PERIODES: { id: Periode; label: string }[] = [
  { id: "dag", label: "Dag" },
  { id: "3dagen", label: "3 dagen" },
  { id: "week", label: "Week" },
  { id: "14dagen", label: "14 dagen" },
  { id: "4weken", label: "4 weken" },
  { id: "maand", label: "Maand" },
];

export function vandaagIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Maandag van de week waar `datum` in valt. */
export function maandagVan(datum: string): string {
  const d = new Date(`${datum}T00:00:00Z`);
  const dag = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  return addDagen(datum, 1 - dag);
}

/**
 * Datumbereik (inclusief) voor een periode rond een ankerdatum:
 * - dag: alleen het anker;
 * - 3 dagen: anker + 2;
 * - week/14 dagen/4 weken: vanaf de maandag van de ankerweek;
 * - maand: de kalendermaand van het anker.
 */
export function periodeBereik(
  periode: Periode,
  anker: string
): { start: string; eind: string } {
  switch (periode) {
    case "dag":
      return { start: anker, eind: anker };
    case "3dagen":
      return { start: anker, eind: addDagen(anker, 2) };
    case "week": {
      const start = maandagVan(anker);
      return { start, eind: addDagen(start, 6) };
    }
    case "14dagen": {
      const start = maandagVan(anker);
      return { start, eind: addDagen(start, 13) };
    }
    case "4weken": {
      const start = maandagVan(anker);
      return { start, eind: addDagen(start, 27) };
    }
    case "maand": {
      const [jaar, maand] = [Number(anker.slice(0, 4)), Number(anker.slice(5, 7))];
      const start = `${anker.slice(0, 7)}-01`;
      const laatste = new Date(Date.UTC(jaar, maand, 0)).getUTCDate();
      return { start, eind: `${anker.slice(0, 7)}-${String(laatste).padStart(2, "0")}` };
    }
  }
}

/** Alle kolomdatums (YYYY-MM-DD) binnen het bereik. */
export function kolomDatums(start: string, eind: string): string[] {
  const datums: string[] = [];
  let d = start;
  while (d <= eind && datums.length < 62) {
    datums.push(d);
    d = addDagen(d, 1);
  }
  return datums;
}

/** Vorige/volgende ankerdatum bij navigatie met pijltjes. */
export function schuifAnker(periode: Periode, anker: string, richting: 1 | -1): string {
  switch (periode) {
    case "dag":
      return addDagen(anker, richting);
    case "3dagen":
      return addDagen(anker, 3 * richting);
    case "week":
      return addDagen(anker, 7 * richting);
    case "14dagen":
      return addDagen(anker, 14 * richting);
    case "4weken":
      return addDagen(anker, 28 * richting);
    case "maand": {
      const jaar = Number(anker.slice(0, 4));
      const maand = Number(anker.slice(5, 7)) + richting;
      const d = new Date(Date.UTC(jaar, maand - 1, 1));
      return d.toISOString().slice(0, 10);
    }
  }
}

const DAG_KORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MAAND_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function kolomLabel(datum: string): { dag: string; datum: string } {
  const d = new Date(`${datum}T00:00:00Z`);
  return {
    dag: DAG_KORT[d.getUTCDay()],
    datum: `${d.getUTCDate()} ${MAAND_KORT[d.getUTCMonth()]}`,
  };
}

export function isWeekend(datum: string): boolean {
  const dag = new Date(`${datum}T00:00:00Z`).getUTCDay();
  return dag === 0 || dag === 6;
}

export function bereikLabel(start: string, eind: string): string {
  const s = kolomLabel(start);
  const e = kolomLabel(eind);
  const jaar = eind.slice(0, 4);
  return start === eind ? `${s.dag} ${s.datum} ${jaar}` : `${s.datum} t/m ${e.datum} ${jaar}`;
}

// ============================================
// Bordraster: kolommen die altijd passen
// ============================================

/**
 * Hoe dicht het weekbord zijn kolommen pakt:
 * - ruim: t/m 7 dagen — volledige blokken, smallere weekendkolommen;
 * - smal: t/m 14 dagen — kortere koppen, blokken met één regel;
 * - krap: 4 weken / maand — 1-letterdag + dagnummer, blokken als kleur + naam.
 *
 * Nooit zijwaarts scrollen (harde regel 1): elke dichtheid past in de
 * beschikbare breedte; de kolommen dikken in, het bord groeit niet.
 */
export type BordDichtheid = "ruim" | "smal" | "krap";

export function bordDichtheid(aantalKolommen: number): BordDichtheid {
  if (aantalKolommen <= 7) return "ruim";
  if (aantalKolommen <= 14) return "smal";
  return "krap";
}

/** Op de weekweergave krijgen za en zo ruim de helft van een werkdag. */
export const WEEKEND_GEWICHT = 0.6;

export function kolomGewicht(datum: string, dichtheid: BordDichtheid): number {
  return dichtheid === "ruim" && isWeekend(datum) ? WEEKEND_GEWICHT : 1;
}

/**
 * `grid-template-columns` voor het bord: een teamkolom die op een smal
 * scherm meegeeft (percentage-plafond), daarna alle dagen als
 * `minmax(0, …fr)` — geen enkele kolom heeft een ondergrens, dus het raster
 * is nooit breder dan zijn container.
 */
export function bordRasterKolommen(kolommen: string[]): string {
  const dichtheid = bordDichtheid(kolommen.length);
  const team = dichtheid === "ruim" ? "min(220px, 28%)" : "min(160px, 22%)";
  const dagen = kolommen.map((datum) => `minmax(0, ${kolomGewicht(datum, dichtheid)}fr)`);
  return [team, ...dagen].join(" ");
}

/**
 * Horizontale ruimte (px) die een cel naast zijn inhoud inneemt: padding
 * links + rechts + de 1px linkerrand. Een blok dat over meerdere cellen
 * loopt, telt die ruimte per overgestoken celgrens mee.
 */
export function celRandPx(dichtheid: BordDichtheid): number {
  return dichtheid === "krap" ? 2 * 2 + 1 : 2 * 6 + 1;
}

/**
 * Breedte van een blok in startcellen, op de kolomgewichten: een blok van
 * vrijdag t/m maandag op de weekweergave telt de smallere za/zo-kolommen
 * naar verhouding mee. Alleen de zichtbare dagen tellen.
 */
export function blokSpanFactor(kolommen: string[], start: string, eind: string): number {
  const dichtheid = bordDichtheid(kolommen.length);
  const zichtbaar = kolommen.filter((d) => d >= start && d <= eind);
  if (zichtbaar.length === 0) return 1;
  const som = zichtbaar.reduce((t, d) => t + kolomGewicht(d, dichtheid), 0);
  return som / kolomGewicht(zichtbaar[0], dichtheid);
}

const DAG_LETTER = ["Z", "M", "D", "W", "D", "V", "Z"];

/**
 * Kolomkop per dichtheid: ruim en smal "ma" + "13"; krap "M" + "13".
 * `voluit` ("ma 13 okt") gaat in de title/aria, zodat de ingekorte kop
 * niets verliest.
 */
export function kolomKop(
  datum: string,
  dichtheid: BordDichtheid
): { dag: string; nummer: string; voluit: string } {
  const label = kolomLabel(datum);
  const d = new Date(`${datum}T00:00:00Z`);
  return {
    dag: dichtheid === "krap" ? DAG_LETTER[d.getUTCDay()] : label.dag,
    nummer: String(d.getUTCDate()),
    voluit: `${label.dag} ${label.datum}`,
  };
}
