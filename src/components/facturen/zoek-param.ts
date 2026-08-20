/**
 * De ene afspraak tussen "link naar een factuur" en "de facturenlijst".
 *
 * Facturen hebben geen detailroute op id: wie naar één factuur wil linken,
 * stuurt de bezoeker naar de lijst met het factuurnummer als zoekterm. Het
 * dossier (Bestanden-tab) en het debiteurenoverzicht bouwden die URL allebei
 * met de hand — en de facturenpagina las het queryparam helemaal niet, dus die
 * links kwamen uit op een ongefilterde lijst (review v13, bevinding 6).
 *
 * Vandaar één plek voor de naam van het param, de bouwer en de lezer.
 */

/** Naam van het queryparam. Verander hem hier, of nergens. */
export const ZOEK_PARAM = "zoek";

/** Link naar de facturenlijst, voorgefilterd op dit factuurnummer. */
export function factuurZoekHref(factuurnummer: string): string {
  return `/facturen?${ZOEK_PARAM}=${encodeURIComponent(factuurnummer)}`;
}

/**
 * De zoekterm waarmee de facturenlijst moet openen. Een ontbrekend of leeg
 * param betekent "gewoon de hele lijst", nooit een lege zoekopdracht die alles
 * wegfiltert.
 */
export function zoekTermUitParams(
  params: { get(naam: string): string | null } | null | undefined
): string {
  return params?.get(ZOEK_PARAM)?.trim() ?? "";
}
