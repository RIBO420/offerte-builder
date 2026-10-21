/**
 * Factuurketen van een offerte (HERO-nabouw fase 3,
 * docs/hero-nabouw/documenten/DOCUMENTEN-MODULE.md §3): termijnfacturen en
 * de eindfactuur. Pure functies.
 *
 * - Een termijnfactuur heeft één regel per btw-tarief:
 *   "Termijn 1 – 50% na gunning van offerte 01400 (21% btw)".
 * - De eindfactuur toont de offerte en trekt de eerdere termijnen per tarief
 *   af. De btw is de restmethode: btw over het hele offertebedrag min de al
 *   gefactureerde btw, zodat de som van alle facturen op de cent gelijk is
 *   aan de offerte (acceptatietest 1, offerte 01399).
 */

import { berekenBtwPerTarief, type BtwPerTarief } from "../vrijeOfferteBerekening";

const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface TermijnStap {
  percentage: number;
  label: string;
}

/** Standaard bij aanleg (HERO: 50% na gunning · 30% bij de start · 20% bij oplevering). */
export const STANDAARD_TERMIJNSCHEMA: TermijnStap[] = [
  { percentage: 50, label: "na gunning" },
  { percentage: 30, label: "bij de start" },
  { percentage: 20, label: "bij oplevering" },
];

/**
 * Schema voor een nieuwe offerte: aanleg krijgt het eerste sjabloon uit
 * Instellingen → Deelfacturen (of 50/30/20), onderhoud geen schema.
 */
export function standaardTermijnschemaVoor(
  type: "aanleg" | "onderhoud",
  sjablonen: ReadonlyArray<{ stappen: TermijnStap[] }> | undefined
): TermijnStap[] | undefined {
  if (type !== "aanleg") return undefined;
  const sjabloon = sjablonen?.[0]?.stappen;
  return sjabloon && !valideerTermijnschema(sjabloon) ? sjabloon : STANDAARD_TERMIJNSCHEMA;
}

/** Melding als het schema niet klopt, anders undefined. */
export function valideerTermijnschema(stappen: ReadonlyArray<TermijnStap>): string | undefined {
  if (stappen.length === 0) return undefined; // geen schema = in één keer factureren
  if (stappen.length > 10) return "Maximaal 10 termijnen";
  for (const s of stappen) {
    if (!Number.isFinite(s.percentage) || s.percentage <= 0 || s.percentage > 100) {
      return "Elk termijnpercentage ligt tussen 0 en 100";
    }
    if (!s.label.trim()) return "Elke termijn heeft een omschrijving";
  }
  const som = round2(stappen.reduce((t, s) => t + s.percentage, 0));
  if (som !== 100) return `De termijnen tellen op tot ${som}% in plaats van 100%`;
  return undefined;
}

export interface OfferteVoorFacturatie {
  bron?: "wizard" | "vrij";
  regels: ReadonlyArray<{ totaal: number; btwCode?: 9 | 21; optioneel?: boolean }>;
  kortingOpTotaal?: number;
  totalen: { totaalExBtw: number; btw: number };
}

/**
 * Netto per btw-tarief van de offerte. De vrije builder kent btw per regel;
 * de wizard rekent met één tarief over het totaal.
 */
export function offerteGrondslagPerTarief(offerte: OfferteVoorFacturatie): BtwPerTarief[] {
  if (offerte.bron === "vrij") {
    return berekenBtwPerTarief(
      offerte.regels.filter((r) => !r.optioneel),
      offerte.kortingOpTotaal ?? 0
    );
  }
  const { totaalExBtw, btw } = offerte.totalen;
  const percentage = totaalExBtw > 0 ? Math.round((btw / totaalExBtw) * 100) : 21;
  return [{ percentage, grondslag: round2(totaalExBtw), bedrag: round2(btw) }];
}

export interface FactuurRegelUit {
  id: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  totaal: number;
  btwCode: 9 | 21;
}

const btwCodeVan = (percentage: number): 9 | 21 => (percentage === 9 ? 9 : 21);

/** Regels van termijn `nummer` (1-based): één per btw-tarief. */
export function termijnRegels(
  grondslag: ReadonlyArray<BtwPerTarief>,
  stap: TermijnStap,
  nummer: number,
  offerteNummer: string
): FactuurRegelUit[] {
  return grondslag
    .filter((g) => g.grondslag !== 0)
    .map((g) => {
      const totaal = round2((g.grondslag * stap.percentage) / 100);
      return {
        id: `termijn-${nummer}-${g.percentage}`,
        omschrijving: `Termijn ${nummer} – ${stap.percentage}% ${stap.label} van offerte ${offerteNummer} (${g.percentage}% btw)`,
        eenheid: "termijn",
        hoeveelheid: 1,
        prijsPerEenheid: totaal,
        totaal,
        btwCode: btwCodeVan(g.percentage),
      };
    });
}

/** Wat een eerdere termijnfactuur per tarief heeft gefactureerd. */
export interface TermijnAftrek {
  omschrijving: string;
  percentage: number;
  netto: number;
  btw: number;
}

export function aftrekVanFactuur(factuur: {
  factuurnummer: string;
  deelfactuurNummer?: number;
  btwUitsplitsing?: ReadonlyArray<{ percentage: number; grondslag: number; bedrag: number }>;
}): TermijnAftrek[] {
  const naam =
    factuur.deelfactuurNummer !== undefined
      ? `Termijn ${factuur.deelfactuurNummer} (factuur ${factuur.factuurnummer})`
      : `Factuur ${factuur.factuurnummer}`;
  return (factuur.btwUitsplitsing ?? []).map((u) => ({
    omschrijving: naam,
    percentage: u.percentage,
    netto: u.grondslag,
    btw: u.bedrag,
  }));
}

export interface EindTotalen {
  subtotaal: number;
  btwBedrag: number;
  totaalInclBtw: number;
  btwUitsplitsing: BtwPerTarief[];
}

/**
 * Totalen van de eindfactuur volgens de restmethode. `regels` zijn de posten
 * van de offerte (plus eventueel meerwerk); `aftrek` de eerdere termijnen.
 * Per tarief: netto = regels − aftrek; btw = afgerond(regels × tarief) − aftrek-btw.
 */
export function berekenEindfactuurTotalen(
  regels: ReadonlyArray<{ totaal: number; btwCode?: 9 | 21 }>,
  aftrek: ReadonlyArray<TermijnAftrek>,
  defaultPercentage = 21
): EindTotalen {
  const vol = berekenBtwPerTarief(
    regels.map((r) => ({ totaal: r.totaal, btwCode: r.btwCode ?? btwCodeVan(defaultPercentage) }))
  );
  const tarieven = new Set([...vol.map((v) => v.percentage), ...aftrek.map((a) => a.percentage)]);
  const btwUitsplitsing = [...tarieven]
    .sort((a, b) => a - b)
    .map((percentage) => {
      const v = vol.find((x) => x.percentage === percentage);
      const af = aftrek.filter((a) => a.percentage === percentage);
      return {
        percentage,
        grondslag: round2((v?.grondslag ?? 0) - af.reduce((t, a) => t + a.netto, 0)),
        bedrag: round2((v?.bedrag ?? 0) - af.reduce((t, a) => t + a.btw, 0)),
      };
    });
  const subtotaal = round2(btwUitsplitsing.reduce((t, u) => t + u.grondslag, 0));
  const btwBedrag = round2(btwUitsplitsing.reduce((t, u) => t + u.bedrag, 0));
  return { subtotaal, btwBedrag, totaalInclBtw: round2(subtotaal + btwBedrag), btwUitsplitsing };
}

/** Regels van de eindfactuur: één post per tarief met het hele offertebedrag. */
export function eindfactuurRegels(
  grondslag: ReadonlyArray<BtwPerTarief>,
  offerteNummer: string
): FactuurRegelUit[] {
  return grondslag
    .filter((g) => g.grondslag !== 0)
    .map((g) => ({
      id: `eind-${g.percentage}`,
      omschrijving: `Werkzaamheden conform offerte ${offerteNummer} (${g.percentage}% btw)`,
      eenheid: "post",
      hoeveelheid: 1,
      prijsPerEenheid: g.grondslag,
      totaal: g.grondslag,
      btwCode: btwCodeVan(g.percentage),
    }));
}

// ── Totalen van elke factuur (één ingang) ─────────────────────────────────

export interface FactuurVoorTotalen {
  regels: ReadonlyArray<{ totaal: number; btwCode?: 9 | 21 }>;
  correcties?: ReadonlyArray<{ bedrag: number }>;
  btwPercentage: number;
  termijnAftrek?: ReadonlyArray<TermijnAftrek>;
  btwVerlegd?: "nl" | "eu";
}

/**
 * Totalen van een factuur: gewoon per tarief, de eindfactuur volgens de
 * restmethode, en bij btw verlegd zonder btw (één regel "0%").
 * Correcties dragen geen btwCode en vallen op het factuurpercentage.
 */
export function berekenTotalenVoorFactuur(f: FactuurVoorTotalen): EindTotalen {
  const alle = [
    ...f.regels,
    ...(f.correcties ?? []).map((c) => ({ totaal: c.bedrag })),
  ];
  const basis = f.termijnAftrek?.length
    ? berekenEindfactuurTotalen(alle, f.termijnAftrek, f.btwPercentage)
    : berekenEindfactuurTotalen(alle, [], f.btwPercentage);
  if (!f.btwVerlegd) return basis;
  return {
    subtotaal: basis.subtotaal,
    btwBedrag: 0,
    totaalInclBtw: basis.subtotaal,
    btwUitsplitsing: [{ percentage: 0, grondslag: basis.subtotaal, bedrag: 0 }],
  };
}

/**
 * Correcties zoals ze op papier en PDF staan: de eigen correcties plus de
 * eerdere termijnen die op een eindfactuur in mindering komen (netto).
 */
export function weergaveCorrecties(f: {
  correcties?: ReadonlyArray<{ omschrijving: string; bedrag: number }>;
  termijnAftrek?: ReadonlyArray<TermijnAftrek>;
}): { omschrijving: string; bedrag: number }[] {
  return [
    ...(f.correcties ?? []),
    ...(f.termijnAftrek ?? []).map((a) => ({
      omschrijving: `In mindering: ${a.omschrijving}, ${a.percentage}% btw`,
      bedrag: -a.netto,
    })),
  ];
}

/** Btw-vermelding onder de totalen bij btw verlegd, of undefined. */
export function btwVerlegdRegel(f: {
  btwVerlegd?: "nl" | "eu";
  btwVerlegdVermelding?: string;
  klantBtwNummer?: string;
}): string | undefined {
  if (!f.btwVerlegd) return undefined;
  const nummer = f.klantBtwNummer ? `\nBtw-nummer afnemer: ${f.klantBtwNummer}` : "";
  return `${f.btwVerlegdVermelding ?? "Btw verlegd."}${nummer}`;
}
