/**
 * R5 — Eerlijke periodekiezer, serverkant.
 *
 * De oude kiezer bood 11 presets aan die de client lossy op 4 terugmapte:
 * "vorige maand" toonde deze maand en "vorig jaar" toonde exact dezelfde
 * cijfers als "dit jaar". Hier staan alléén presets die echt bestaan, elk
 * met een echte begin- en eindgrens.
 *
 * Twee vergelijkingen per periode, want een hovenier denkt in allebei:
 *   - `vorigePeriode`        — de direct voorafgaande periode van dezelfde
 *                              soort (juli t.o.v. augustus);
 *   - `zelfdePeriodeVorigJaar` — dezelfde periode een jaar eerder
 *                              (voorjaar 2025 t.o.v. voorjaar 2026). Dit is
 *                              de vergelijking die er in het groen toe doet:
 *                              een natte mei is niet met april te vergelijken.
 *
 * Seizoenen zijn meteorologisch (hele maanden), niet astronomisch — dat sluit
 * aan op hoe het werk in de planning valt:
 *   voorjaar mrt–mei · zomer jun–aug · najaar sep–nov · winter dec–feb.
 * De winter loopt over de jaargrens: "winter 2026" = dec 2026 t/m feb 2027,
 * en heet in de UI "Winter 2026/2027".
 *
 * Alle vensters zijn half-open: `start <= t < eind`. Bewust géén
 * Convex-imports: puur en unit-testbaar.
 */

import type { Venster } from "./omzetDefinities";

// ── Presets ──────────────────────────────────────────────────────────────

export const PERIODE_PRESETS = [
  "deze-maand",
  "vorige-maand",
  "dit-kwartaal",
  "vorig-kwartaal",
  "dit-jaar",
  "vorig-jaar",
  "dit-seizoen",
  "voorjaar",
  "zomer",
  "najaar",
  "winter",
  "alles",
  "aangepast",
] as const;

export type PeriodePreset = (typeof PERIODE_PRESETS)[number];

export type Seizoen = "voorjaar" | "zomer" | "najaar" | "winter";

export const SEIZOENEN: readonly Seizoen[] = [
  "voorjaar",
  "zomer",
  "najaar",
  "winter",
];

/** Startmaand (0-gebaseerd) van elk seizoen. */
export const SEIZOEN_START_MAAND: Record<Seizoen, number> = {
  voorjaar: 2, // maart
  zomer: 5, // juni
  najaar: 8, // september
  winter: 11, // december
};

export type PeriodeSoort =
  | "maand"
  | "kwartaal"
  | "jaar"
  | "seizoen"
  | "vrij"
  | "alles";

/**
 * Canonieke aanduiding van een periode. Hieruit volgen de grenzen, het label
 * en beide vergelijkingsperiodes — zo kan een vergelijking nooit uit de pas
 * lopen met de periode zelf.
 */
export type PeriodeAnker =
  | { soort: "maand"; jaar: number; maand: number } // maand 0-11
  | { soort: "kwartaal"; jaar: number; kwartaal: number } // kwartaal 1-4
  | { soort: "jaar"; jaar: number }
  | { soort: "seizoen"; seizoen: Seizoen; seizoenJaar: number }
  | { soort: "vrij"; start: number; eind: number }
  | { soort: "alles" };

export interface Periode extends Venster {
  soort: PeriodeSoort;
  /** Mensentaal-label, klaar om te tonen: "Augustus 2026", "Zomer 2026". */
  label: string;
  /** Loopt deze periode nu nog? Dan is een 1-op-1-vergelijking oneerlijk. */
  isLopend: boolean;
  /**
   * Hoever de periode gevorderd is (0–1). Bij een lopende periode kan de UI
   * hiermee eerlijk zijn: "halverwege augustus" i.p.v. een kale min-15%.
   */
  voortgangFractie: number;
  anker: PeriodeAnker;
}

export interface PeriodeMetVergelijking extends Periode {
  /** Direct voorafgaande periode van dezelfde soort; null bij "alles". */
  vorigePeriode: Periode | null;
  /** Dezelfde periode één jaar eerder; null bij "alles". */
  zelfdePeriodeVorigJaar: Periode | null;
}

// ── Grenzen ──────────────────────────────────────────────────────────────

/** Ondergrens voor "alles" — ruim vóór elke denkbare Top Tuinen-rij. */
const BEGIN_DER_TIJDEN = 0;
/** Bovengrens voor "alles" — het maximale JS-Date-bereik. */
const EINDE_DER_TIJDEN = 8.64e15;

const MAANDNAMEN = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];

const MAANDNAMEN_KORT = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
];

function metHoofdletter(tekst: string): string {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

function dagLabel(tijdstip: number): string {
  const d = new Date(tijdstip);
  return `${d.getDate()} ${MAANDNAMEN_KORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Grenzen + label van een anker. Eén bron voor beide, dus altijd consistent. */
export function grenzenVan(anker: PeriodeAnker): Venster & { label: string } {
  switch (anker.soort) {
    case "maand":
      return {
        start: new Date(anker.jaar, anker.maand, 1).getTime(),
        eind: new Date(anker.jaar, anker.maand + 1, 1).getTime(),
        label: `${metHoofdletter(MAANDNAMEN[anker.maand])} ${anker.jaar}`,
      };
    case "kwartaal":
      return {
        start: new Date(anker.jaar, (anker.kwartaal - 1) * 3, 1).getTime(),
        eind: new Date(anker.jaar, anker.kwartaal * 3, 1).getTime(),
        label: `Q${anker.kwartaal} ${anker.jaar}`,
      };
    case "jaar":
      return {
        start: new Date(anker.jaar, 0, 1).getTime(),
        eind: new Date(anker.jaar + 1, 0, 1).getTime(),
        label: `${anker.jaar}`,
      };
    case "seizoen": {
      const startMaand = SEIZOEN_START_MAAND[anker.seizoen];
      return {
        start: new Date(anker.seizoenJaar, startMaand, 1).getTime(),
        // Maandoverloop is toegestaan in Date: maand 14 = maart volgend jaar.
        eind: new Date(anker.seizoenJaar, startMaand + 3, 1).getTime(),
        label:
          anker.seizoen === "winter"
            ? `Winter ${anker.seizoenJaar}/${anker.seizoenJaar + 1}`
            : `${metHoofdletter(anker.seizoen)} ${anker.seizoenJaar}`,
      };
    }
    case "vrij":
      return {
        start: anker.start,
        eind: anker.eind,
        label: `${dagLabel(anker.start)} – ${dagLabel(anker.eind - 1)}`,
      };
    case "alles":
      return {
        start: BEGIN_DER_TIJDEN,
        eind: EINDE_DER_TIJDEN,
        label: "Alle tijd",
      };
  }
}

// ── Seizoensrekenwerk ────────────────────────────────────────────────────

/** Het seizoen waarin een tijdstip valt, mét het seizoensjaar. */
export function seizoenVan(tijdstip: number): {
  seizoen: Seizoen;
  seizoenJaar: number;
} {
  const d = new Date(tijdstip);
  const maand = d.getMonth();
  const jaar = d.getFullYear();
  if (maand <= 1) return { seizoen: "winter", seizoenJaar: jaar - 1 }; // jan/feb
  if (maand <= 4) return { seizoen: "voorjaar", seizoenJaar: jaar };
  if (maand <= 7) return { seizoen: "zomer", seizoenJaar: jaar };
  if (maand <= 10) return { seizoen: "najaar", seizoenJaar: jaar };
  return { seizoen: "winter", seizoenJaar: jaar }; // december
}

/** Het seizoensblok dat chronologisch vóór dit blok ligt. */
export function vorigSeizoen(seizoen: Seizoen, seizoenJaar: number): {
  seizoen: Seizoen;
  seizoenJaar: number;
} {
  const index = SEIZOENEN.indexOf(seizoen);
  if (index === 0) return { seizoen: "winter", seizoenJaar: seizoenJaar - 1 };
  return { seizoen: SEIZOENEN[index - 1], seizoenJaar };
}

/**
 * De meest recente uitvoering van een seizoen die al begonnen is.
 * Op 15 augustus 2026 is "najaar" dus najaar 2025 en niet najaar 2026 —
 * anders zou de kiezer een leeg, nog niet begonnen seizoen tonen.
 */
export function laatsteSeizoenUitvoering(
  seizoen: Seizoen,
  referentie: number
): { seizoen: Seizoen; seizoenJaar: number } {
  const d = new Date(referentie);
  const kandidaat = { soort: "seizoen" as const, seizoen, seizoenJaar: d.getFullYear() };
  if (grenzenVan(kandidaat).start <= referentie) {
    return { seizoen, seizoenJaar: d.getFullYear() };
  }
  return { seizoen, seizoenJaar: d.getFullYear() - 1 };
}

// ── Verschuiven ──────────────────────────────────────────────────────────

/** Het anker van de direct voorafgaande periode van dezelfde soort. */
export function vorigAnker(anker: PeriodeAnker): PeriodeAnker | null {
  switch (anker.soort) {
    case "maand": {
      const d = new Date(anker.jaar, anker.maand - 1, 1);
      return { soort: "maand", jaar: d.getFullYear(), maand: d.getMonth() };
    }
    case "kwartaal":
      return anker.kwartaal === 1
        ? { soort: "kwartaal", jaar: anker.jaar - 1, kwartaal: 4 }
        : { soort: "kwartaal", jaar: anker.jaar, kwartaal: anker.kwartaal - 1 };
    case "jaar":
      return { soort: "jaar", jaar: anker.jaar - 1 };
    case "seizoen": {
      const vorig = vorigSeizoen(anker.seizoen, anker.seizoenJaar);
      return { soort: "seizoen", ...vorig };
    }
    case "vrij": {
      const lengte = anker.eind - anker.start;
      return { soort: "vrij", start: anker.start - lengte, eind: anker.start };
    }
    case "alles":
      return null;
  }
}

/** Het anker van dezelfde periode één jaar eerder. */
export function vorigJaarAnker(anker: PeriodeAnker): PeriodeAnker | null {
  switch (anker.soort) {
    case "maand":
      return { soort: "maand", jaar: anker.jaar - 1, maand: anker.maand };
    case "kwartaal":
      return { soort: "kwartaal", jaar: anker.jaar - 1, kwartaal: anker.kwartaal };
    case "jaar":
      return { soort: "jaar", jaar: anker.jaar - 1 };
    case "seizoen":
      return {
        soort: "seizoen",
        seizoen: anker.seizoen,
        seizoenJaar: anker.seizoenJaar - 1,
      };
    case "vrij": {
      // Kalendercorrect een jaar terug, zodat schrikkeljaren niet een dag
      // verschuiven zoals bij een kale aftrek van 365 dagen.
      const start = new Date(anker.start);
      const eind = new Date(anker.eind);
      return {
        soort: "vrij",
        start: new Date(
          start.getFullYear() - 1,
          start.getMonth(),
          start.getDate(),
          start.getHours(),
          start.getMinutes(),
          start.getSeconds(),
          start.getMilliseconds()
        ).getTime(),
        eind: new Date(
          eind.getFullYear() - 1,
          eind.getMonth(),
          eind.getDate(),
          eind.getHours(),
          eind.getMinutes(),
          eind.getSeconds(),
          eind.getMilliseconds()
        ).getTime(),
      };
    }
    case "alles":
      return null;
  }
}

// ── Publieke ingang ──────────────────────────────────────────────────────

function maakPeriode(anker: PeriodeAnker, referentie: number): Periode {
  const { start, eind, label } = grenzenVan(anker);
  const isLopend = referentie >= start && referentie < eind;
  const lengte = eind - start;
  const voortgangFractie = isLopend
    ? Math.min(1, Math.max(0, (referentie - start) / lengte))
    : referentie >= eind
      ? 1
      : 0;
  return { soort: anker.soort, start, eind, label, isLopend, voortgangFractie, anker };
}

/**
 * Vertaal een preset naar een canoniek anker.
 * `aangepast` vereist `start`/`eind`; zonder die twee valt het terug op
 * "alles" in plaats van stilzwijgend iets anders te tonen.
 */
export function ankerVanPreset(
  preset: PeriodePreset,
  referentie: number,
  aangepast?: { start?: number; eind?: number }
): PeriodeAnker {
  const d = new Date(referentie);
  const jaar = d.getFullYear();
  const maand = d.getMonth();
  const kwartaal = Math.floor(maand / 3) + 1;

  switch (preset) {
    case "deze-maand":
      return { soort: "maand", jaar, maand };
    case "vorige-maand": {
      const vorige = new Date(jaar, maand - 1, 1);
      return { soort: "maand", jaar: vorige.getFullYear(), maand: vorige.getMonth() };
    }
    case "dit-kwartaal":
      return { soort: "kwartaal", jaar, kwartaal };
    case "vorig-kwartaal":
      return kwartaal === 1
        ? { soort: "kwartaal", jaar: jaar - 1, kwartaal: 4 }
        : { soort: "kwartaal", jaar, kwartaal: kwartaal - 1 };
    case "dit-jaar":
      return { soort: "jaar", jaar };
    case "vorig-jaar":
      return { soort: "jaar", jaar: jaar - 1 };
    case "dit-seizoen":
      return { soort: "seizoen", ...seizoenVan(referentie) };
    case "voorjaar":
    case "zomer":
    case "najaar":
    case "winter":
      return { soort: "seizoen", ...laatsteSeizoenUitvoering(preset, referentie) };
    case "aangepast":
      if (aangepast?.start === undefined || aangepast?.eind === undefined) {
        return { soort: "alles" };
      }
      return { soort: "vrij", start: aangepast.start, eind: aangepast.eind };
    case "alles":
    default:
      return { soort: "alles" };
  }
}

/**
 * De volledige periode-set voor één preset: het venster zelf plus beide
 * vergelijkingsvensters. Dit is wat `getRapportage` doorgeeft aan de
 * cijferlaag, en wat de UI gebruikt om labels te schrijven.
 */
export function bepaalPeriode(
  preset: PeriodePreset,
  referentie: number = Date.now(),
  aangepast?: { start?: number; eind?: number }
): PeriodeMetVergelijking {
  const anker = ankerVanPreset(preset, referentie, aangepast);
  const huidig = maakPeriode(anker, referentie);
  const vorig = vorigAnker(anker);
  const vorigJaar = vorigJaarAnker(anker);

  return {
    ...huidig,
    vorigePeriode: vorig ? maakPeriode(vorig, referentie) : null,
    zelfdePeriodeVorigJaar: vorigJaar ? maakPeriode(vorigJaar, referentie) : null,
  };
}
