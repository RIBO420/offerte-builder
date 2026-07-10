/**
 * UI-constanten voor de tekstblokkenbibliotheek (PRD §2.5b).
 *
 * Spiegel van de domeinconstanten in convex/tekstblokken.ts — de UI
 * importeert bewust niet uit convex-servermodules (zelfde conventie als
 * src/lib/catalogus.ts).
 */

export const TEKSTBLOK_CATEGORIEEN = [
  "aanhef",
  "voorwaarden",
  "standaardtekst",
  "email",
] as const;

export type TekstblokCategorie = (typeof TEKSTBLOK_CATEGORIEEN)[number];

export const TEKSTBLOK_CATEGORIE_LABELS: Record<TekstblokCategorie, string> = {
  aanhef: "Aanhef",
  voorwaarden: "Voorwaarden",
  standaardtekst: "Standaardtekst",
  email: "E-mail",
};
