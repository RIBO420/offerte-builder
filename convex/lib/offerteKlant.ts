/**
 * Klant op een offerte — optioneel bij concept, verplicht daarna.
 *
 * Masterplan offerte-entree (A3): "Vrije offerte = direct een lege offerte".
 * Daarvoor moet een **concept** kunnen bestaan zonder klant. Zodra de offerte
 * de conceptfase verlaat (voorcalculatie, verzonden, geaccepteerd, afgewezen)
 * is een complete klant weer keihard verplicht: vanaf dat moment gaan er PDF's,
 * mails, projecten, werklocaties en facturen op die gegevens draaien.
 *
 * Alles in dit bestand is pure logica zonder Convex-ctx, zodat de guard direct
 * te unit-testen is (src/__tests__/unit/convex/offerte-klant-optioneel.test.ts).
 */

import { ConvexError } from "convex/values";

export type OfferteKlant = {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email?: string;
  telefoon?: string;
};

/** Label in lijsten, tijdlijnen en logregels als er (nog) geen klant is. */
export const GEEN_KLANT_LABEL = "Geen klant gekoppeld";

/** De vier velden die een klant "compleet" maken voor verzending/PDF. */
export const VERPLICHTE_KLANTVELDEN = [
  "naam",
  "adres",
  "postcode",
  "plaats",
] as const;

/** Statussen waarin een offerte nog zonder klant mag bestaan. */
export const STATUS_ZONDER_KLANT_TOEGESTAAN = ["concept"] as const;

/**
 * Naam voor weergave; nooit leeg, nooit een crash op `undefined.naam`.
 */
export function klantNaam(
  klant: OfferteKlant | null | undefined,
  fallback: string = GEEN_KLANT_LABEL
): string {
  const naam = klant?.naam?.trim();
  return naam ? naam : fallback;
}

/**
 * Los veld voor exports/rapportages; standaard een lege string zodat CSV- en
 * PDF-kolommen hun vorm houden.
 */
export function klantVeld(
  klant: OfferteKlant | null | undefined,
  veld: keyof OfferteKlant,
  fallback: string = ""
): string {
  const waarde = klant?.[veld];
  return typeof waarde === "string" && waarde.trim() ? waarde : fallback;
}

/** Is de klant compleet genoeg om de conceptfase te verlaten? */
export function isKlantCompleet(
  klant: OfferteKlant | null | undefined
): klant is OfferteKlant {
  if (!klant) return false;
  return VERPLICHTE_KLANTVELDEN.every(
    (veld) => typeof klant[veld] === "string" && klant[veld].trim().length > 0
  );
}

/** Vraagt deze doelstatus om een complete klant? */
export function statusVereistKlant(status: string): boolean {
  return !(STATUS_ZONDER_KLANT_TOEGESTAAN as readonly string[]).includes(status);
}

const STATUS_ACTIE: Record<string, string> = {
  voorcalculatie: "de voorcalculatie starten",
  definitief: "de offerte definitief maken",
  verzonden: "de offerte versturen",
  geaccepteerd: "de offerte op geaccepteerd zetten",
  afgewezen: "de offerte op afgewezen zetten",
};

/**
 * Nette Nederlandse foutmelding — inclusief welke velden ontbreken.
 */
export function klantOntbreektMelding(
  doelStatus: string,
  klant: OfferteKlant | null | undefined,
  offerteNummer?: string
): string {
  const actie = STATUS_ACTIE[doelStatus] ?? `de status wijzigen naar "${doelStatus}"`;
  const nummer = offerteNummer ? ` ${offerteNummer}` : "";

  if (!klant) {
    return `Koppel eerst een klant aan offerte${nummer} — zonder klantgegevens (naam, adres, postcode en plaats) kun je niet ${actie}.`;
  }

  const ontbrekend = VERPLICHTE_KLANTVELDEN.filter(
    (veld) => !(typeof klant[veld] === "string" && klant[veld].trim())
  );
  const labels: Record<string, string> = {
    naam: "naam",
    adres: "adres",
    postcode: "postcode",
    plaats: "plaats",
  };
  const lijst = ontbrekend.map((veld) => labels[veld]).join(", ");
  return `De klantgegevens van offerte${nummer} zijn onvolledig (${lijst} ontbreekt) — vul die eerst aan voordat je ${actie} kunt.`;
}

/**
 * HARDE GUARD: gooit een `ConvexError` (géén kale `Error` — die bereikt de
 * client niet, zie de toelichting bij AuthError in convex/auth.ts) zodra een
 * offerte zonder complete klant de conceptfase probeert te verlaten.
 */
export function assertKlantVoorStatus(
  offerte: { klant?: OfferteKlant; offerteNummer?: string },
  doelStatus: string
): void {
  if (!statusVereistKlant(doelStatus)) return;
  if (isKlantCompleet(offerte.klant)) return;
  throw new ConvexError(
    klantOntbreektMelding(doelStatus, offerte.klant, offerte.offerteNummer)
  );
}
