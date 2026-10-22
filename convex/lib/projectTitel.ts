/**
 * Projecttitel: "Klantnaam – werkzaamheden" (klantbesluit okt 2026).
 *
 * Voorheen kreeg een project de hele aanvraagtekst van de lead als naam
 * ("[Tuinaanleg] Hallo, wij willen graag…") of "Project 2026-042 - Jansen".
 * Een project ontstaat nu bij akkoord op de offerte en heet naar de klant en
 * het werk: "Jansen – Gazon, bestrating en beplanting".
 *
 * Puur (geen Convex-ctx): gedeeld door de acceptatie-keten, projecten.create,
 * de "Nieuw project"-pagina en de hernoem-migratie.
 */

/** Bovengrens voor een projecttitel; langer wordt netjes afgekapt. */
export const PROJECT_TITEL_MAX = 80;

/** Scheiding tussen klant en werkzaamheden (en-streepje met spaties). */
export const PROJECT_TITEL_SCHEIDING = " – ";

/**
 * Leesbare namen voor de vaste scopes. Gelijk aan SCOPE_LABELS in
 * src/lib/rapportage-labels.ts (convex/ importeert niet uit src/); vrije
 * hoofdstukken zijn al leesbaar en gaan ongewijzigd door.
 */
const SCOPE_LABELS: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  parkeerplaats: "Parkeerplaats",
  beregening: "Beregening",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & elektra",
  specials: "Specials",
  gras_onderhoud: "Grasonderhoud",
  borders_onderhoud: "Borderonderhoud",
  heggen_onderhoud: "Heggenonderhoud",
  bomen_onderhoud: "Bomenonderhoud",
  heggen: "Heggen",
  bomen: "Bomen",
  reiniging: "Reiniging",
  bemesting: "Bemesting",
  snoeien: "Snoeiwerk",
  gazonanalyse: "Gazonanalyse",
  schuttingen: "Schuttingen",
  waterpartijen: "Waterpartijen",
  verlichting: "Verlichting",
};

/**
 * Hoofdstukken die geen werkzaamheid zijn (offerte-overhead, restpost) en dus
 * niet in een titel horen.
 */
const GEEN_WERKZAAMHEID = new Set(["algemeen", "overig", "overig_onderhoud", ""]);

const TYPE_LABELS: Record<string, string> = {
  aanleg: "Aanleg",
  onderhoud: "Onderhoud",
};

/** Leesbare naam van een scope of vrij hoofdstuk ("water_elektra" → "Water & elektra"). */
export function leesbaarHoofdstuk(scope: string): string {
  const schoon = scope.trim();
  if (SCOPE_LABELS[schoon]) return SCOPE_LABELS[schoon];
  // Een sleutel als "nieuwe_scope" leesbaar maken; vrije tekst blijft zoals hij is.
  const tekst = /^[a-z0-9_]+$/.test(schoon) ? schoon.replace(/_+/g, " ") : schoon;
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

/** Eerste letter klein, behalve bij een afkorting ("LED-verlichting" blijft). */
function middenInZin(tekst: string): string {
  if (tekst.length > 1 && tekst.charAt(1) !== tekst.charAt(1).toLowerCase()) return tekst;
  return tekst.charAt(0).toLowerCase() + tekst.slice(1);
}

/**
 * Een lijst werkzaamheden als zinsdeel: max 3 genoemd
 * ("Gazon, bestrating en beplanting"); langer → de eerste twee + "e.a."
 * ("Gazon, bestrating e.a."). Dubbelen (hoofdletterongevoelig) vallen weg.
 */
export function werkzaamhedenTekst(namen: ReadonlyArray<string>): string {
  const gezien = new Set<string>();
  const uniek: string[] = [];
  for (const naam of namen) {
    const schoon = naam.trim();
    const sleutel = schoon.toLowerCase();
    if (!schoon || gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    uniek.push(schoon);
  }
  if (uniek.length === 0) return "";
  const [eerste, ...rest] = uniek;
  const kop = eerste.charAt(0).toUpperCase() + eerste.slice(1);
  const staart = rest.map(middenInZin);
  if (uniek.length === 1) return kop;
  if (uniek.length === 2) return `${kop} en ${staart[0]}`;
  if (uniek.length === 3) return `${kop}, ${staart[0]} en ${staart[1]}`;
  return `${kop}, ${staart[0]} e.a.`;
}

export type RegelVoorTitel = { scope: string; optioneel?: boolean };

/** Regels die echt uitgevoerd worden: optionele posten tellen niet mee. */
export function nietOptioneleRegels<R extends { optioneel?: boolean }>(
  regels: ReadonlyArray<R>
): R[] {
  return regels.filter((r) => !r.optioneel);
}

/**
 * De werkzaamheden van een offerte in leesbare vorm: de hoofdstukken/scopes
 * van de niet-optionele regels in offertevolgorde, anders de gekozen scopes,
 * anders het offertetype ("Aanleg"/"Onderhoud").
 */
export function werkzaamhedenUitOfferte(offerte: {
  type: string;
  scopes?: ReadonlyArray<string>;
  regels?: ReadonlyArray<RegelVoorTitel>;
}): string {
  const uitRegels = nietOptioneleRegels(offerte.regels ?? [])
    .map((r) => r.scope)
    .filter((s) => !GEEN_WERKZAAMHEID.has(s.trim().toLowerCase()));
  const bron =
    uitRegels.length > 0
      ? uitRegels
      : (offerte.scopes ?? []).filter((s) => !GEEN_WERKZAAMHEID.has(s.trim().toLowerCase()));
  const tekst = werkzaamhedenTekst(bron.map(leesbaarHoofdstuk));
  return tekst || TYPE_LABELS[offerte.type] || "";
}

/** Kap af op een woordgrens met "…", zonder losse leestekens aan het eind. */
export function kapAf(tekst: string, max: number): string {
  const schoon = tekst.replace(/\s+/g, " ").trim();
  if (schoon.length <= max) return schoon;
  let stuk = schoon.slice(0, Math.max(1, max - 1));
  const spatie = stuk.lastIndexOf(" ");
  if (spatie >= Math.floor(max * 0.5)) stuk = stuk.slice(0, spatie);
  stuk = stuk.replace(/[\s,;:.\-–]+$/u, "");
  return `${stuk}…`;
}

/**
 * "Klantnaam – werkzaamheden", max {@link PROJECT_TITEL_MAX} tekens. De
 * werkzaamheden worden eerst ingekort; is de klantnaam zelf al te lang, dan
 * de hele titel. Zonder klant of werkzaamheden blijft het andere deel over.
 */
export function projectTitel({
  klantNaam,
  werkzaamheden,
  max = PROJECT_TITEL_MAX,
}: {
  klantNaam?: string | null;
  werkzaamheden?: string | null;
  max?: number;
}): string {
  const klant = (klantNaam ?? "").replace(/\s+/g, " ").trim();
  const werk = (werkzaamheden ?? "").replace(/\s+/g, " ").trim();
  if (!klant && !werk) return "Nieuw project";
  if (!klant) return kapAf(werk, max);
  if (!werk) return kapAf(klant, max);

  const volledig = `${klant}${PROJECT_TITEL_SCHEIDING}${werk}`;
  if (volledig.length <= max) return volledig;

  const ruimte = max - klant.length - PROJECT_TITEL_SCHEIDING.length;
  // Minstens een herkenbaar stuk werkzaamheden; anders gaat de klantnaam eraan.
  if (ruimte >= 12) return `${klant}${PROJECT_TITEL_SCHEIDING}${kapAf(werk, ruimte)}`;
  return kapAf(volledig, max);
}

/** Het label tussen [ ] aan het begin van een oude lead-projectnaam ("[Tuinaanleg] …"). */
export function onderwerpUitLeadNaam(naam: string): string | null {
  const match = /^\s*\[([^\]]+)\]/.exec(naam);
  const label = match?.[1]?.trim();
  return label ? label : null;
}
