/**
 * Verplichte factuurgegevens en btw verlegd (HERO-nabouw fase 3,
 * DOCUMENTEN-MODULE.md §4). Pure functies: een factuur gaat pas definitief
 * of de deur uit als alles erop staat. Laat de boekhouder de lijst en de
 * vermeldingen één keer bevestigen.
 */

export const STANDAARD_VERMELDING_VERLEGD_NL = "Btw verlegd.";
export const STANDAARD_VERMELDING_VERLEGD_EU =
  "Intracommunautaire dienst: btw verlegd naar de afnemer (art. 196 Btw-richtlijn).";

export function vermeldingVoor(
  soort: "nl" | "eu",
  instellingen: { btwVerlegdVermeldingNl?: string; btwVerlegdVermeldingEu?: string } | null
): string {
  return soort === "eu"
    ? instellingen?.btwVerlegdVermeldingEu?.trim() || STANDAARD_VERMELDING_VERLEGD_EU
    : instellingen?.btwVerlegdVermeldingNl?.trim() || STANDAARD_VERMELDING_VERLEGD_NL;
}

export interface FactuurVoorControle {
  klant: { naam?: string; adres?: string; postcode?: string; plaats?: string };
  bedrijf: {
    naam?: string;
    adres?: string;
    postcode?: string;
    plaats?: string;
    kvk?: string;
    btw?: string;
  };
  regels: ReadonlyArray<unknown>;
  btwVerlegd?: "nl" | "eu";
  klantBtwNummer?: string;
  isCreditnota?: boolean;
}

const leeg = (s?: string) => !s || s.trim().length === 0;

/** Ontbrekende verplichte gegevens, in woorden voor de gebruiker. */
export function ontbrekendeFactuurgegevens(f: FactuurVoorControle): string[] {
  const uit: string[] = [];
  if (leeg(f.bedrijf.naam)) uit.push("bedrijfsnaam");
  if (leeg(f.bedrijf.adres) || leeg(f.bedrijf.postcode) || leeg(f.bedrijf.plaats)) {
    uit.push("adres van het bedrijf");
  }
  if (leeg(f.bedrijf.kvk)) uit.push("KvK-nummer van het bedrijf");
  if (leeg(f.bedrijf.btw)) uit.push("btw-nummer van het bedrijf");
  if (leeg(f.klant.naam)) uit.push("naam van de klant");
  if (leeg(f.klant.adres) || leeg(f.klant.plaats)) uit.push("adres van de klant");
  if (f.regels.length === 0) uit.push("minimaal één factuurregel");
  if (f.btwVerlegd && leeg(f.klantBtwNummer)) uit.push("btw-nummer van de klant (btw verlegd)");
  return uit;
}

export function factuurgegevensMelding(f: FactuurVoorControle): string | undefined {
  const ontbrekend = ontbrekendeFactuurgegevens(f);
  return ontbrekend.length > 0
    ? `Op de factuur ontbreekt: ${ontbrekend.join(", ")}.`
    : undefined;
}
