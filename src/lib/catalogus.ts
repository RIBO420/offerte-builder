/**
 * UI-constanten voor de bouwstenencatalogus (PRD §2.5f + bijlage A).
 *
 * Spiegel van de domeinconstanten in convex/bouwstenen.ts — de UI importeert
 * bewust niet uit convex-servermodules (zelfde conventie als scopeLabels in
 * de machines-pagina).
 */

export const BOUWSTEEN_CATEGORIEEN = [
  "gras_gazon",
  "borders_beplanting",
  "heggen_bomen",
  "bestrating_terras",
  "reiniging",
  "seizoen",
  "kosten_regels",
] as const;

export type BouwsteenCategorie = (typeof BOUWSTEEN_CATEGORIEEN)[number];

export const CATEGORIE_LABELS: Record<BouwsteenCategorie, string> = {
  gras_gazon: "Gras & Gazon",
  borders_beplanting: "Borders & Beplanting",
  heggen_bomen: "Heggen & Bomen",
  bestrating_terras: "Bestrating & Terras",
  reiniging: "Reiniging",
  seizoen: "Seizoen",
  kosten_regels: "Kosten & regels",
};

export const BOUWSTEEN_SOORTEN = [
  "terugkerend",
  "eenmalig",
  "op_afroep",
  "kostenregel",
  "keuzeregel",
  "bundel",
] as const;

export type BouwsteenSoort = (typeof BOUWSTEEN_SOORTEN)[number];

export const SOORT_LABELS: Record<BouwsteenSoort, string> = {
  terugkerend: "Terugkerend",
  eenmalig: "Eenmalig",
  op_afroep: "Op afroep",
  kostenregel: "Kostenregel",
  keuzeregel: "Keuzeregel",
  bundel: "Bundel",
};

export const MAAND_LABELS = [
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

/** Kort maandbereik, bv. "mrt – nov". */
export function formatSeizoensvenster(
  van: number | undefined,
  tot: number | undefined
): string | null {
  if (van === undefined || tot === undefined) return null;
  const kort = (m: number) => MAAND_LABELS[m - 1]?.slice(0, 3) ?? "?";
  return `${kort(van)} – ${kort(tot)}`;
}
