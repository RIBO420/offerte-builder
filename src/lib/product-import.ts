/**
 * Kolommapping-logica voor de productbestand-import (PRD §2.5c).
 *
 * Puur en client-side: zet geparste CSV/Excel-rijen (string-matrix) via
 * een door de gebruiker gekozen kolommapping om naar import-rijen voor
 * convex/productenImport. Er is geen vast voorbeeldbestand (§7.4), dus
 * de mapping is volledig generiek: elke kolom kan elk veld zijn.
 */

/** Velden waarop een kolom gemapt kan worden. Alleen `naam` is verplicht. */
export const IMPORT_VELDEN = [
  "naam",
  "inkoopprijs",
  "eenheid",
  "btwCode",
  "omschrijving",
  "categorie",
] as const;

export type ImportVeld = (typeof IMPORT_VELDEN)[number];

export const IMPORT_VELD_LABELS: Record<ImportVeld, string> = {
  naam: "Naam (verplicht)",
  inkoopprijs: "Inkoopprijs",
  eenheid: "Eenheid",
  btwCode: "Btw-code (9/21)",
  omschrijving: "Omschrijving",
  categorie: "Categorie",
};

/** Kolomindex per veld; undefined = veld niet gemapt. */
export type KolomMapping = Partial<Record<ImportVeld, number>>;

/** Import-rij zoals convex/productenImport die verwacht. */
export interface GemapteImportRij {
  naam: string;
  inkoopprijs?: number;
  eenheid?: string;
  btwCode?: number;
  omschrijving?: string;
  categorie?: string;
}

/**
 * Parse een prijs-/getalcel met NL- én EN-notatie:
 * "1.234,56" → 1234.56, "1,234.56" → 1234.56, "€ 12,50" → 12.5.
 * Lege of onleesbare cellen → undefined.
 */
export function parseGetal(waarde: string | undefined): number | undefined {
  if (waarde === undefined) return undefined;
  let s = waarde.replace(/[^\d,.-]/g, "").trim();
  if (s.length === 0) return undefined;

  const laatsteKomma = s.lastIndexOf(",");
  const laatstePunt = s.lastIndexOf(".");
  if (laatsteKomma > -1 && laatstePunt > -1) {
    // Beide aanwezig: het laatste teken is de decimaalscheider
    if (laatsteKomma > laatstePunt) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (laatsteKomma > -1) {
    s = s.replace(",", ".");
  }

  const getal = Number(s);
  return Number.isFinite(getal) ? getal : undefined;
}

/** Parse een btw-cel: "21", "21%", "9,0" → 21 / 9; anders undefined. */
export function parseBtwCode(waarde: string | undefined): number | undefined {
  const getal = parseGetal(waarde);
  if (getal === undefined) return undefined;
  return Math.round(getal);
}

/**
 * Raad een kolommapping op basis van de kopregel (kleine hulp; de
 * gebruiker kan de mapping altijd zelf aanpassen).
 */
export function raadMapping(kopregel: string[]): KolomMapping {
  const mapping: KolomMapping = {};
  const patronen: Record<ImportVeld, RegExp> = {
    naam: /naam|artikel|product|omschr?ijving artikel/i,
    inkoopprijs: /inkoop|prijs|kostprijs|netto/i,
    eenheid: /eenheid|unit|per\b/i,
    btwCode: /btw|vat/i,
    omschrijving: /omschrijving|beschrijving|toelichting/i,
    categorie: /categorie|groep|rubriek/i,
  };
  for (const veld of IMPORT_VELDEN) {
    const index = kopregel.findIndex((kop) => patronen[veld].test(kop ?? ""));
    if (index > -1 && !Object.values(mapping).includes(index)) {
      mapping[veld] = index;
    }
  }
  return mapping;
}

/**
 * Zet de ruwe data-rijen (zonder kopregel) via de mapping om naar
 * import-rijen. Rijen zonder enige inhoud worden overgeslagen.
 */
export function bouwImportRijen(
  rijen: string[][],
  mapping: KolomMapping
): GemapteImportRij[] {
  if (mapping.naam === undefined) {
    throw new Error("Kolom voor 'Naam' is verplicht");
  }

  const cel = (rij: string[], index: number | undefined) => {
    if (index === undefined) return undefined;
    const waarde = rij[index]?.trim();
    return waarde && waarde.length > 0 ? waarde : undefined;
  };

  return rijen
    .filter((rij) => rij.some((c) => (c ?? "").trim().length > 0))
    .map((rij) => ({
      naam: cel(rij, mapping.naam) ?? "",
      inkoopprijs: parseGetal(cel(rij, mapping.inkoopprijs)),
      eenheid: cel(rij, mapping.eenheid),
      btwCode: parseBtwCode(cel(rij, mapping.btwCode)),
      omschrijving: cel(rij, mapping.omschrijving),
      categorie: cel(rij, mapping.categorie),
    }));
}
