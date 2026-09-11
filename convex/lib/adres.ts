/**
 * De adresregel — de enige plek waar losse adresvelden één leesbare regel
 * worden.
 *
 * ## Waarom dit bestand er is
 *
 * Tot 11 sep 2026 bouwde elk scherm zijn eigen regel, en er waren er twee:
 *
 * - mét postcode (`"Straat 1, 1234 AB Meppel"`) in het klantdossier, de
 *   klantenlijst, de klantkoppeling van de werkbank en `werkitems.ts`;
 * - zónder postcode (`"Straat 1, Meppel"`) op het planbord, de dagkaart en in
 *   `materiaalDelta.ts`.
 *
 * Dezelfde klant kreeg dus een andere regel afhankelijk van het scherm, en na
 * een import met halflege adresvelden toonde de lijst een losse komma. Elke
 * plek die een adres toont of naar Google Maps stuurt, gaat vanaf nu via
 * `adresRegel` / `googleMapsZoekUrl` / `googleMapsRouteUrl`.
 *
 * ## Het formaat dat geldt
 *
 * > **`"Straat 1, 1234 AB Plaats"` — mét postcode; lege delen vallen weg.**
 *
 * Let op: de reistijdcache (`reistijdCache.sleutel`) is op de adresregel
 * gesleuteld. Doordat de dagkaart nu óók de postcode meeneemt, wijken de
 * sleutels eenmalig af van de rijen die er al staan: de eerste dagkaart na
 * deze wijziging krijgt cache-misses en valt terug op de standaard-reistijd,
 * daarna vult de cache zich opnieuw met de nieuwe sleutels. Dat is een
 * bewuste, eenmalige koude start — de alternatieven (twee formaten houden of
 * de cache migreren) kosten meer dan ze opleveren.
 *
 * Dit bestand is puur (geen Convex-context) en wordt zowel vanuit `convex/`
 * als vanuit `src/` geïmporteerd — net als `convex/lib/normuren.ts`.
 */

export type AdresVelden = {
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
};

/** Leeg, whitespace-only en `null`/`undefined` tellen allemaal als "niet er". */
function schoon(waarde?: string | null): string {
  return waarde?.trim() ?? "";
}

/**
 * Straat, postcode en plaats als één leesbare regel:
 * `"Straat 1, 1234 AB Plaats"`. Ontbrekende delen worden overgeslagen —
 * alles leeg geeft `""`, nooit een losse komma of dubbele spatie.
 */
export function adresRegel(velden: AdresVelden): string {
  const postcodePlaats = [schoon(velden.postcode), schoon(velden.plaats)]
    .filter(Boolean)
    .join(" ");
  return [schoon(velden.adres), postcodePlaats].filter(Boolean).join(", ");
}

/** Een al opgebouwde regel mag er ook in (bijv. het eigen adres van een werkitem). */
function regelVan(adres: AdresVelden | string): string {
  return typeof adres === "string" ? adres.trim() : adresRegel(adres);
}

/**
 * Google Maps-zoeklink ("waar ligt dit?"). Geeft `""` bij een leeg adres, zodat
 * een aanroeper nooit per ongeluk een kapotte link met lege query toont.
 */
export function googleMapsZoekUrl(adres: AdresVelden | string): string {
  const regel = regelVan(adres);
  if (!regel) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(regel)}`;
}

/**
 * Google Maps-routelink ("breng me hierheen"). Geeft `""` bij een leeg adres.
 */
export function googleMapsRouteUrl(adres: AdresVelden | string): string {
  const regel = regelVan(adres);
  if (!regel) return "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(regel)}`;
}
