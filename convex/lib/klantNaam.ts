/**
 * De naamregel van een klant — één plek, gedeeld door Convex en de web-app.
 *
 * ## Waarom dit bestand er is
 *
 * Mickey vult liever voornaam en achternaam apart in en zoekt in de lijst op
 * achternaam ("van der Berg" onder de V). Tegelijk leest de hele app (offerte,
 * pdf, factuur, planbord, portaal, mobiel) `klanten.naam` als dé weergavenaam.
 * Daarom is het model additief: `voornaam` en `achternaam` zijn optioneel en
 * `naam` blijft leidend en verplicht — hij wordt alleen afgeleid zodra een van
 * beide gevuld is.
 *
 * Vier functies, vier vragen:
 *   - `samengesteldeNaam` — welke weergavenaam hoort bij deze velden?
 *   - `splitsNaam` — hoe valt een bestaande naam uiteen in voor en achter?
 *   - `sorteerNaam` — waar staat deze klant in een alfabetische lijst?
 *   - `lijktBedrijfsnaam` — is dit überhaupt een persoonsnaam?
 *
 * Pure functies zonder Convex-afhankelijkheden, zodat `src/` ze net zo goed
 * kan importeren als de backend (zelfde opzet als `convex/lib/normuren.ts`).
 */

/** Klanttypen zoals ze in het schema staan; `undefined` = onbekend/oud record. */
type KlantType = "particulier" | "zakelijk" | "vve" | "gemeente" | "overig";

/**
 * Nederlandse tussenvoegsels. Ze horen bij de ACHTERNAAM (en dus ook vooraan
 * in de sorteersleutel): zo toont de rest van de app namen al, en zo zoekt
 * kantoor ze ook op. Exporteerbaar omdat de migratie (`splitsKlantNaam`) en
 * formulieren dezelfde lijst nodig hebben.
 */
export const TUSSENVOEGSELS: readonly string[] = [
  "van",
  "de",
  "der",
  "den",
  "het",
  "'t",
  "ten",
  "ter",
  "te",
  "op",
  "in",
  "aan",
  "bij",
  "onder",
  "over",
  "'s",
  "d'",
  "l'",
];

const TUSSENVOEGSEL_SET = new Set(TUSSENVOEGSELS);

/**
 * Rechtsvormen en organisatiewoorden, kaal geschreven (zonder punten). Een
 * token als "b.v." wordt hieronder ontdaan van punten voordat het hier langs
 * komt, zodat "B.V.", "B.V" en "BV" allemaal raak zijn.
 */
const BEDRIJFSTOKENS = new Set([
  "bv",
  "vof",
  "nv",
  "vve",
  "stichting",
  "gemeente",
  "holding",
  "advocaten",
  "beheer",
  "&",
]);

/** Losse woorden uit een naam; dubbele spaties en randen verdwijnen. */
export function woorden(naam: string): string[] {
  return naam.trim().split(/\s+/).filter(Boolean);
}

/**
 * De weergavenaam bij een set naamvelden: voornaam + achternaam zodra een van
 * beide gevuld is, anders de naam die er al stond (bedrijfsnaam, VvE-naam, of
 * een particulier die nooit gesplitst is).
 */
export function samengesteldeNaam(klant: {
  voornaam?: string;
  achternaam?: string;
  naam: string;
}): string {
  const delen = [klant.voornaam, klant.achternaam]
    .map((deel) => (deel ?? "").trim())
    .filter(Boolean);

  return delen.length > 0 ? delen.join(" ") : klant.naam.trim();
}

/**
 * Een bestaande naam uit elkaar halen: het eerste woord is de voornaam, al het
 * overige de achternaam — inclusief tussenvoegsels ("Jan van der Berg" →
 * "Jan" + "van der Berg").
 *
 * Twee uitzonderingen leveren een lege voornaam op: één woord ("Vries"), en
 * een naam die mét een tussenvoegsel begint ("van der Berg"), want dan is het
 * eerste woord per definitie geen voornaam.
 */
export function splitsNaam(naam: string): { voornaam: string; achternaam: string } {
  const delen = woorden(naam);

  if (delen.length === 0) return { voornaam: "", achternaam: "" };
  if (delen.length === 1) return { voornaam: "", achternaam: delen[0] };
  if (TUSSENVOEGSEL_SET.has(delen[0].toLowerCase())) {
    return { voornaam: "", achternaam: delen.join(" ") };
  }

  return { voornaam: delen[0], achternaam: delen.slice(1).join(" ") };
}

/**
 * Sorteersleutel voor de klantenlijst: achternaam eerst, dan voornaam, alles
 * in kleine letters. Het tussenvoegsel blijft vooraan staan — "van der Berg"
 * hoort onder de V, precies zoals de naam ook getoond wordt.
 *
 * Bij een niet-particuliere klant is `naam` de bedrijfs- of VvE-naam en zijn
 * voor-/achternaam hooguit de contactpersoon; die lijst hoort dus op de
 * bedrijfsnaam te staan (zie de schema-toelichting bij `klanten.voornaam`).
 */
export function sorteerNaam(klant: {
  naam: string;
  voornaam?: string;
  achternaam?: string;
  klantType?: KlantType;
}): string {
  const persoon = klant.klantType === undefined || klant.klantType === "particulier";
  const achternaam = (klant.achternaam ?? "").trim();

  if (!persoon || !achternaam) return klant.naam.trim().toLowerCase();

  const voornaam = (klant.voornaam ?? "").trim();
  return [achternaam, voornaam].filter(Boolean).join(" ").toLowerCase();
}

/**
 * Ruikt deze naam naar een organisatie in plaats van naar een persoon?
 *
 * Gebruikt om een naam NIET te splitsen: "Smeets Advocaten" is geen Smeets met
 * achternaam Advocaten. Bewust op hele woorden — "Beheerder" en "Stichter" zijn
 * gewoon achternamen — en bewust conservatief: bij twijfel niet splitsen.
 */
export function lijktBedrijfsnaam(naam: string): boolean {
  return woorden(naam).some((woord) => {
    const kaal = woord.toLowerCase().replace(/[.,]/g, "");
    return BEDRIJFSTOKENS.has(kaal);
  });
}
