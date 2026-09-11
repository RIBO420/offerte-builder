/**
 * Client-side zoeken in de klantenlijst.
 *
 * De klantenpagina heeft de volledige lijst al in de browser staan. Zoeken ging
 * eerder toch via een Convex-zoekquery: 300 ms debounce plus een round-trip
 * naar de cloud voor data die er al was. Bovendien keek die query alleen naar
 * `naam` en gaf hij maximaal tien resultaten terug, dus zoeken op plaats of
 * e-mail werkte niet en bij meer dan tien treffers zag je de rest nooit.
 */

export type ZoekbareKlant = {
  naam?: string;
  voornaam?: string;
  achternaam?: string;
  contactpersoon?: string;
  email?: string;
  telefoon?: string;
  telefoon2?: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
  uitvoerAdres?: {
    adres?: string;
    postcode?: string;
    plaats?: string;
  };
  kvkNummer?: string;
};

/**
 * Alle doorzoekbare velden van één klant als één kleine letterreeks.
 *
 * Telefoonnummers krijgen er een variant zonder scheidingstekens bij, zodat
 * "0612345678" ook "06-12 34 56 78" vindt. Postcodes idem: "6041MA" vindt
 * "6041 MA".
 */
export function zoekbareTekst(klant: ZoekbareKlant): string {
  const velden = [
    klant.naam,
    klant.voornaam,
    klant.achternaam,
    klant.contactpersoon,
    klant.email,
    klant.telefoon,
    klant.telefoon2,
    klant.adres,
    klant.postcode,
    klant.plaats,
    // Het uitvoeradres hoort er net zo goed bij: kantoor zoekt de klant
    // geregeld op de straat waar het werk ligt, niet op het factuuradres.
    klant.uitvoerAdres?.adres,
    klant.uitvoerAdres?.postcode,
    klant.uitvoerAdres?.plaats,
    klant.kvkNummer,
  ].filter((v): v is string => Boolean(v));

  const kaal = [
    klant.telefoon,
    klant.telefoon2,
    klant.postcode,
    klant.uitvoerAdres?.postcode,
  ]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.replace(/[\s\-.()]/g, ""));

  return [...velden, ...kaal].join(" ").toLowerCase();
}

/** Losse woorden uit de zoekbalk; lege invoer geeft een lege lijst. */
export function zoektermen(invoer: string): string[] {
  return invoer.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Alle termen moeten voorkomen, in willekeurige volgorde en over alle velden
 * heen: "jan roermond" vindt Jan uit Roermond, ook al staan naam en plaats in
 * verschillende velden.
 */
export function klantMatcht(hooiberg: string, termen: string[]): boolean {
  return termen.every((term) => hooiberg.includes(term));
}
