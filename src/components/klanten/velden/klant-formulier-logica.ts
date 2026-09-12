/**
 * De rekenregels achter de drie klantformulieren — één plek, geen kopieën.
 *
 * ## Waarom dit bestand er is
 *
 * De klantenlijst (`/klanten`), het aanmaakdialoog (`NieuweKlantDialog`) en het
 * dossier (Instellingen → Contactgegevens) vragen exact dezelfde gegevens uit.
 * Ze deden dat tot sep 2026 elk met hun eigen kopie van dezelfde drie regels:
 * hoe `naam` uit de naamdelen volgt, hoe een bestaande naam voorgevuld wordt en
 * wat een afwijkend uitvoeradres naar de backend stuurt. Drie kopieën betekent
 * drie plekken die uit elkaar kunnen lopen — en dat is precies wat er gebeurde
 * (de een trimde wel, de ander niet).
 *
 * Alles hier is puur: geen React, geen Convex. De formuliercomponenten in
 * `./naam-velden`, `./telefoon-velden` en `./uitvoeradres-velden` tonen de
 * velden, dit bestand bepaalt wat eruit komt.
 */

import { samengesteldeNaam, splitsNaam } from "@convex/lib/klantNaam";

/** Klanttypen zoals ze in het schema staan. */
export type KlantType = "particulier" | "zakelijk" | "vve" | "gemeente" | "overig";

/**
 * Particulieren hebben geen contactpersoon, KvK- of BTW-nummer — en geen
 * bedrijfsnaam. Woont hier (niet in `nieuwe-klant-dialog`) zodat de
 * veldcomponenten hem kunnen gebruiken zonder een import-cirkel met het
 * dialoog dat ze zelf weer gebruikt; het dialoog exporteert hem door.
 */
export function isZakelijk(type: KlantType): boolean {
  return type !== "particulier";
}

/* ── Naam ─────────────────────────────────────────────────────────────────── */

/** De drie naamvelden zoals ze in een formulierstaat staan. */
export type NaamWaarden = {
  naam: string;
  voornaam: string;
  achternaam: string;
};

/**
 * De naamvelden zoals ze naar de backend gaan.
 *
 * Bij een particulier is `naam` de afgeleide van voor- en achternaam
 * (`samengesteldeNaam`); bij elk ander type ís `naam` de bedrijfs-/VvE-naam en
 * gaan de naamdelen leeg mee. Die lege strings zijn geen slordigheid maar het
 * wissignaal van `klanten.update`: `undefined` slaat de mutation over, dus
 * alleen zo verdwijnt een achtergebleven achternaam als het type omgezet
 * wordt (de backend leidt `naam` af zodra er een naamdeel staat, en zou de
 * bedrijfsnaam dan stilzwijgend overschrijven).
 *
 * De samenstelling gebruikt bewust een lege basisnaam: heeft de gebruiker
 * beide velden leeggemaakt, dan hoort "Achternaam is verplicht" te verschijnen
 * en niet stilletjes de oude naam terug te komen.
 */
export function naamVelden(form: NaamWaarden & { klantType: KlantType }): NaamWaarden {
  const particulier = !isZakelijk(form.klantType);
  const voornaam = particulier ? form.voornaam.trim() : "";
  const achternaam = particulier ? form.achternaam.trim() : "";

  return {
    naam: particulier
      ? samengesteldeNaam({ voornaam, achternaam, naam: "" })
      : form.naam.trim(),
    voornaam,
    achternaam,
  };
}

/**
 * Waarmee de naamvelden beginnen als je een bestaande klant gaat bewerken.
 *
 * Klanten van vóór de naamsplitsing (sep 2026) hebben alleen `naam`. Die
 * splitsen we hier alvast voor, zodat opslaan de splitsing meteen vastlegt en
 * de klant daarna op achternaam sorteert — zonder dat kantoor zijn eigen
 * klantenbestand opnieuw intypt.
 *
 * Twee keuzes, beide bewust:
 *
 * - **Alles of niets.** Staat er al één naamdeel, dan is dat wat de klant
 *   heeft; we vullen het andere veld niet stiekem aan uit `naam`.
 * - **Alleen bij een particulier.** "De Groene Tuin B.V." is geen voornaam
 *   "De" met achternaam "Groene Tuin B.V."; bij een bedrijf blijven de velden
 *   leeg, ook als je het type daarna omzet.
 */
export function splitsVoorBewerken(
  klant: { naam?: string; voornaam?: string; achternaam?: string },
  klantType: KlantType = "particulier"
): { voornaam: string; achternaam: string } {
  if (isZakelijk(klantType) || klant.voornaam || klant.achternaam) {
    return {
      voornaam: klant.voornaam ?? "",
      achternaam: klant.achternaam ?? "",
    };
  }
  return splitsNaam(klant.naam ?? "");
}

/* ── Uitvoeradres ─────────────────────────────────────────────────────────── */

/** De drie velden van een afwijkend uitvoeradres. */
export type UitvoerAdresWaarden = {
  adres: string;
  postcode: string;
  plaats: string;
};

/**
 * Het wissignaal van `klanten.update`: drie lege velden. Dat is voor
 * `uitvoerAdres` wat `""` voor `email` is — `undefined` laat het veld juist
 * ongemoeid. Bevroren omdat het een constante is; aanroepers krijgen altijd
 * een verse kopie.
 */
export const UITVOERADRES_WISSEN: Readonly<UitvoerAdresWaarden> = Object.freeze({
  adres: "",
  postcode: "",
  plaats: "",
});

/**
 * Hoe de drie velden in de formulierstaat van beide bewerkformulieren heten.
 * De component praat in `adres`/`postcode`/`plaats`, de formulieren in
 * `uitvoerAdres`/`uitvoerPostcode`/`uitvoerPlaats`.
 */
export const UITVOER_FORMULIER_VELD = {
  adres: "uitvoerAdres",
  postcode: "uitvoerPostcode",
  plaats: "uitvoerPlaats",
} as const;

/** De drie velden getrimd; alleen spaties telt als leeg. */
function schoon(waarden: UitvoerAdresWaarden): UitvoerAdresWaarden {
  return {
    adres: waarden.adres.trim(),
    postcode: waarden.postcode.trim(),
    plaats: waarden.plaats.trim(),
  };
}

/**
 * Staat het blok open én staat er ergens iets in? Open maar helemaal leeg
 * leest als "toch niet" en wist net zo goed als dichtklappen.
 */
export function uitvoerAdresIngevuld(
  open: boolean,
  waarden: UitvoerAdresWaarden
): boolean {
  const { adres, postcode, plaats } = schoon(waarden);
  return open && Boolean(adres || postcode || plaats);
}

/**
 * Alle drie ingevuld? Een half uitvoeradres stuurt de ploeg de verkeerde kant
 * op: het is alles of niets.
 */
export function uitvoerAdresCompleet(waarden: UitvoerAdresWaarden): boolean {
  const { adres, postcode, plaats } = schoon(waarden);
  return Boolean(adres && postcode && plaats);
}

/**
 * Het uitvoeradres zoals het naar `klanten.create`/`klanten.update` gaat.
 *
 * Open → de drie velden getrimd. Dicht → bij een bewerking de wispayload
 * (drie lege velden), bij het aanmaken niets: een nieuwe klant hoeft geen leeg
 * veld te wissen dat er nog niet is.
 */
export function uitvoerAdresPayload(
  open: boolean,
  waarden: UitvoerAdresWaarden,
  modus: "aanmaken" | "bijwerken"
): UitvoerAdresWaarden | undefined {
  if (open) return schoon(waarden);
  return modus === "aanmaken" ? undefined : { ...UITVOERADRES_WISSEN };
}
