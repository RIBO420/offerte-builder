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
 * Functies, en de vraag die ze beantwoorden:
 *   - `samengesteldeNaam` — welke weergavenaam hoort bij deze velden?
 *   - `splitsNaam` — hoe valt een bestaande naam uiteen in voor en achter?
 *   - `sorteerNaam` — waar staat deze klant in een alfabetische lijst?
 *   - `lijktBedrijfsnaam` — is dit überhaupt een persoonsnaam?
 *   - `naamPatchVoor` — wat moet er bij een bewerking op naam en naamdelen
 *     veranderen? (kantoorformulier én portaal, één regel)
 *   - `naamDelenVoorNieuweKlant` — welke naamdelen hoort een nieuw
 *     klantrecord te krijgen? (lead-promotie, offerte, migratie)
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


/**
 * De naamdelen die een NIEUW klantrecord krijgt bij alleen een weergavenaam.
 *
 * Een klant die uit een lead of een offerte ontstaat, kreeg tot sep 2026
 * alleen een `naam` — daardoor stond hij in de lijst onder de voornaam en gaf
 * het dossier lege naamvelden, terwijl handmatig aangemaakte klanten wél
 * gesplitst zijn. Dit is dezelfde regel als de migratie `splitsKlantNaam`
 * (die hem via `bepaalNaamSplitsing` gebruikt), zodat er één waarheid is:
 *
 * - een ander klanttype dan `particulier` is een organisatie → niet splitsen;
 * - minder dan twee woorden ("Vries") → niets te splitsen;
 * - een bedrijfsachtige naam ("Dreessen Advocaten BV") → niet splitsen;
 * - anders `splitsNaam`, waarbij een lege voornaam ("van der Berg") het veld
 *   niet schrijft in plaats van er een lege string in te zetten.
 *
 * Bij twijfel dus géén naamdelen: een lege achternaam is te herstellen, een
 * verkeerd geknipte bedrijfsnaam kost kantoor handwerk.
 */
export function naamDelenVoorNieuweKlant(
  naam: string,
  klantType?: KlantType
): { voornaam?: string; achternaam?: string } {
  if (klantType !== undefined && klantType !== "particulier") return {};
  if (woorden(naam).length < 2) return {};
  if (lijktBedrijfsnaam(naam)) return {};

  const { voornaam, achternaam } = splitsNaam(naam);
  return { voornaam: voornaam || undefined, achternaam };
}

/** De velden zoals ze in de database staan voordat er bewerkt wordt. */
export type NaamBestaand = {
  naam: string;
  voornaam?: string;
  achternaam?: string;
};

/**
 * Wat een bewerking meestuurt. SLEUTEL-AANWEZIGHEID telt, niet de waarde:
 * een ontbrekende sleutel is "niet meegestuurd", een sleutel met `undefined`
 * is "leeggemaakt" (zo komt een lege invoer uit de sanitizers terug). Dat is
 * dezelfde conventie als de patch die eruit komt.
 */
export type NaamInvoer = {
  naam?: string;
  voornaam?: string;
  achternaam?: string;
};

/**
 * De naamvelden van een bewerking, in één regel voor kantoor én portaal.
 *
 * Twee gevallen, en ze sluiten elkaar uit:
 *
 * 1. **Naamdelen meegestuurd** (een van beide is genoeg): `naam` wordt eruit
 *    afgeleid, zodat lijst, pdf, portaal en mobiel dezelfde weergavenaam
 *    zien. Allebei leeggemaakt → de velden verdwijnen en `naam` blijft staan
 *    zoals hij was; dezelfde wisconventie als bij `email`/`telefoon`.
 * 2. **Alleen `naam` meegestuurd** terwijl er naamdelen opgeslagen staan.
 *    Volgt de nieuwe naam niet meer uit die delen, dan zijn ze achterhaald en
 *    gaan ze mee weg. Laten staan zou `sorteerNaam` en de zoekindex op een
 *    achternaam laten draaien die nergens meer op het scherm staat — een
 *    klant die je onder de oude naam blijft terugvinden, en onder de nieuwe
 *    niet. Volgt de naam er wél uit (bewerkformulier dat de samengestelde
 *    naam ongewijzigd terugstuurt), dan blijft alles staan.
 *
 * De functie is puur en sanitiseert niet: de aanroeper trimt en begrenst
 * eerst (kantoor via `schoonNaamdeel`, portaal via dezelfde naam-trim), zodat
 * de foutmeldingen bij het formulier blijven horen.
 */
export function naamPatchVoor(
  bestaand: NaamBestaand,
  invoer: NaamInvoer
): NaamInvoer {
  const patch: NaamInvoer = {};

  const naamGegeven = "naam" in invoer;
  if (naamGegeven) patch.naam = invoer.naam;

  const voornaamGegeven = "voornaam" in invoer;
  const achternaamGegeven = "achternaam" in invoer;

  if (voornaamGegeven || achternaamGegeven) {
    const voornaam = voornaamGegeven ? invoer.voornaam : bestaand.voornaam;
    const achternaam = achternaamGegeven ? invoer.achternaam : bestaand.achternaam;

    if (voornaamGegeven) patch.voornaam = voornaam;
    if (achternaamGegeven) patch.achternaam = achternaam;

    if (voornaam || achternaam) {
      const basisNaam =
        typeof patch.naam === "string" ? patch.naam : bestaand.naam;
      patch.naam = samengesteldeNaam({ voornaam, achternaam, naam: basisNaam });
    }
    return patch;
  }

  if (typeof patch.naam === "string") {
    const opgeslagenDelen = samengesteldeNaam(bestaand);
    if (
      (bestaand.voornaam || bestaand.achternaam) &&
      opgeslagenDelen !== patch.naam
    ) {
      patch.voornaam = undefined;
      patch.achternaam = undefined;
    }
  }

  return patch;
}
