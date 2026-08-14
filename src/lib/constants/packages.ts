/**
 * Snelstart-pakketten: kant-en-klare combinaties van scopes met voorgevulde
 * hoeveelheden, in één klik te kiezen aan het begin van de offerte-wizard.
 *
 * Hier stonden er vijftien in (Klein/Groot Terras Pakket, Gazon Aanleg, Border
 * & Beplanting, Schutting Plaatsen, Vlonder Terras, Tuin Verlichting, Complete
 * Kleine/Grote Tuin, Basis/Compleet Onderhoud, Gazon & Borders, Heg Snoeien,
 * Boom Snoeien, Seizoens Opruiming) met verzonnen maten en prijsindicaties als
 * "vanaf €1.500". Die getallen kwamen niet uit de calculatie van Top Tuinen,
 * maar stonden wél al in het voorstel zodra je zo'n pakket aanklikte.
 *
 * Top Tuinen stelt zijn eigen pakketten samen. Tot die er zijn, begint elke
 * offerte blanco en kies je de werkzaamheden zelf; alle scope-formulieren
 * starten op 0. Vul deze lijsten aan zodra de echte pakketten vastliggen — de
 * wizard pikt ze dan vanzelf weer op.
 */

export interface OffertePackage {
  id: string;
  naam: string;
  omschrijving: string;
  type: "aanleg" | "onderhoud";
  scopes: string[];
  defaultWaarden: Record<string, unknown>;
  icon: string; // Lucide icon name
  geschatteTijd: string; // e.g., "2-3 dagen"
  prijsIndicatie?: string; // e.g., "vanaf €2.500"
}

export const AANLEG_PACKAGES: OffertePackage[] = [];

export const ONDERHOUD_PACKAGES: OffertePackage[] = [];

// Helper function to get packages by type
export function getPackagesByType(type: "aanleg" | "onderhoud"): OffertePackage[] {
  return type === "aanleg" ? AANLEG_PACKAGES : ONDERHOUD_PACKAGES;
}

// Helper function to get package by id
export function getPackageById(id: string): OffertePackage | undefined {
  return [...AANLEG_PACKAGES, ...ONDERHOUD_PACKAGES].find((p) => p.id === id);
}
