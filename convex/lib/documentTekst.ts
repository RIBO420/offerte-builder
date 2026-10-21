/**
 * Vaste teksten op documenten (HERO-nabouw fase 2,
 * docs/hero-nabouw/documenten/DOCUMENTEN-MODULE.md §2).
 *
 * Per documentsoort staat in de tekstbibliotheek één standaard inleiding en
 * één standaard afsluiting. Die teksten zijn platte tekst met placeholders
 * als {{klant.naam}} of {{bedrijf.iban}}: alles wat in de instellingen hoort
 * (IBAN, betaaltermijn, geldigheid) wordt nooit in de tekst getypt.
 *
 * Pure functies, dependency-vrij: server (momentopname bij versturen), client
 * (PDF-voorbeeld, bibliotheekscherm) en unit-tests gebruiken dezelfde motor.
 *
 * Regels:
 * - Een onbekende placeholder (tikfout) wordt bij het opslaan in de
 *   bibliotheek geweigerd.
 * - Een bekende placeholder zonder waarde houdt het versturen tegen
 *   (geen PDF met "IBAN: " of "geldig tot ").
 */

export const DOCUMENT_SOORTEN = [
  "offerte_aanleg",
  "offerte_onderhoud",
  "factuur",
  "factuur_onderhoud",
  "termijnfactuur",
  "eindfactuur",
  "creditnota",
  "orderbevestiging",
  "bestelformulier",
  "leveringsbon",
] as const;
export type DocumentSoort = (typeof DOCUMENT_SOORTEN)[number];

export const DOCUMENT_SOORT_LABELS: Record<DocumentSoort, string> = {
  offerte_aanleg: "Offerte aanleg",
  offerte_onderhoud: "Offerte onderhoud",
  factuur: "Factuur aanleg",
  factuur_onderhoud: "Factuur onderhoud",
  termijnfactuur: "Termijnfactuur",
  eindfactuur: "Eindfactuur",
  creditnota: "Creditfactuur",
  orderbevestiging: "Orderbevestiging",
  bestelformulier: "Bestelformulier",
  leveringsbon: "Leveringsbon",
};

export type PlaceholderGroep =
  | "Bedrijf"
  | "Klant"
  | "Leverancier"
  | "Document"
  | "Offerte"
  | "Factuur"
  | "Medewerker";

export interface PlaceholderDef {
  sleutel: string;
  label: string;
  groep: PlaceholderGroep;
  voorbeeld: string;
  /** Alleen beschikbaar op deze soorten; ontbreekt = op alle soorten */
  soorten?: readonly DocumentSoort[];
}

const OFFERTES: readonly DocumentSoort[] = ["offerte_aanleg", "offerte_onderhoud"];
const FACTUREN: readonly DocumentSoort[] = [
  "factuur",
  "factuur_onderhoud",
  "termijnfactuur",
  "eindfactuur",
  "creditnota",
];

export const PLACEHOLDERS: readonly PlaceholderDef[] = [
  { sleutel: "bedrijf.naam", label: "Bedrijfsnaam", groep: "Bedrijf", voorbeeld: "Top Tuinen" },
  { sleutel: "bedrijf.adres", label: "Adres (volledig)", groep: "Bedrijf", voorbeeld: "Tuinweg 1, 1234 AB Groenstad" },
  { sleutel: "bedrijf.email", label: "E-mail", groep: "Bedrijf", voorbeeld: "info@toptuinen.nl" },
  { sleutel: "bedrijf.telefoon", label: "Telefoon", groep: "Bedrijf", voorbeeld: "06 12345678" },
  { sleutel: "bedrijf.iban", label: "IBAN", groep: "Bedrijf", voorbeeld: "NL00 BANK 0123 4567 89" },
  { sleutel: "bedrijf.kvk", label: "KvK-nummer", groep: "Bedrijf", voorbeeld: "12345678" },
  { sleutel: "bedrijf.btw", label: "Btw-nummer", groep: "Bedrijf", voorbeeld: "NL001234567B01" },
  { sleutel: "bedrijf.betaaltermijn", label: "Betaaltermijn (dagen)", groep: "Bedrijf", voorbeeld: "14" },

  { sleutel: "klant.naam", label: "Naam", groep: "Klant", voorbeeld: "Jan de Vries" },
  { sleutel: "klant.voornaam", label: "Voornaam", groep: "Klant", voorbeeld: "Jan" },
  { sleutel: "klant.achternaam", label: "Achternaam", groep: "Klant", voorbeeld: "de Vries" },
  { sleutel: "klant.adres", label: "Adres (volledig)", groep: "Klant", voorbeeld: "Lindelaan 4, 1234 CD Groenstad" },
  { sleutel: "klant.email", label: "E-mail", groep: "Klant", voorbeeld: "jan@voorbeeld.nl" },
  { sleutel: "klant.btwNummer", label: "Btw-nummer", groep: "Klant", voorbeeld: "BE0123456789" },

  { sleutel: "document.nummer", label: "Documentnummer", groep: "Document", voorbeeld: "01400" },
  { sleutel: "document.datum", label: "Datum", groep: "Document", voorbeeld: "21 oktober 2026" },
  { sleutel: "document.bedrag", label: "Totaalbedrag (incl. btw)", groep: "Document", voorbeeld: "€ 29.805,27" },
  { sleutel: "document.referentie", label: "Verwijzing (offerte of project)", groep: "Document", voorbeeld: "01399" },
  { sleutel: "leverancier.naam", label: "Naam leverancier", groep: "Leverancier", voorbeeld: "Boomkwekerij De Linde", soorten: ["bestelformulier"] },

  { sleutel: "offerte.geldigTot", label: "Geldig tot", groep: "Offerte", voorbeeld: "20 november 2026", soorten: OFFERTES },
  { sleutel: "offerte.termijnschema", label: "Termijnschema", groep: "Offerte", voorbeeld: "- 50% na gunning\n- 30% bij de start\n- 20% bij oplevering", soorten: OFFERTES },

  { sleutel: "factuur.vervaldatum", label: "Vervaldatum", groep: "Factuur", voorbeeld: "4 november 2026", soorten: FACTUREN },
  { sleutel: "factuur.referentie", label: "Verwijzing (offerte of factuur)", groep: "Factuur", voorbeeld: "01399", soorten: FACTUREN },
  { sleutel: "termijn.omschrijving", label: "Termijn", groep: "Factuur", voorbeeld: "Termijn 1: na gunning", soorten: ["termijnfactuur", "eindfactuur"] },
  { sleutel: "termijn.percentage", label: "Termijn (%)", groep: "Factuur", voorbeeld: "50", soorten: ["termijnfactuur", "eindfactuur"] },

  { sleutel: "medewerker.naam", label: "Naam afzender", groep: "Medewerker", voorbeeld: "Mickey Jansen" },
];

const PLACEHOLDER_MAP = new Map(PLACEHOLDERS.map((p) => [p.sleutel, p]));

/**
 * Oude notatie uit de eerste startvulling (migrations/seedTekstblokken):
 * blijft werken, zodat bestaande teksten niet ineens blokkeren.
 */
const ALIASSEN: Record<string, string> = { klant_naam: "klant.naam" };
const canoniek = (sleutel: string): string => ALIASSEN[sleutel] ?? sleutel;

const PLACEHOLDER_REGEX = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Unieke placeholder-sleutels in volgorde van voorkomen. */
export function vindPlaceholders(tekst: string): string[] {
  const gevonden: string[] = [];
  for (const match of tekst.matchAll(PLACEHOLDER_REGEX)) {
    if (!gevonden.includes(match[1])) gevonden.push(match[1]);
  }
  return gevonden;
}

export function placeholdersVoorSoort(
  soort: DocumentSoort | undefined
): PlaceholderDef[] {
  return PLACEHOLDERS.filter(
    (p) => !p.soorten || soort === undefined || p.soorten.includes(soort)
  );
}

/**
 * Placeholders die niet bestaan of niet bij deze soort horen. Leeg = de
 * tekst mag zo in de bibliotheek.
 */
export function onbekendePlaceholders(
  tekst: string,
  soort: DocumentSoort | undefined
): string[] {
  return vindPlaceholders(tekst).filter((sleutel) => {
    const def = PLACEHOLDER_MAP.get(canoniek(sleutel));
    if (!def) return true;
    return soort !== undefined && def.soorten !== undefined && !def.soorten.includes(soort);
  });
}

export type TekstWaarden = Partial<Record<string, string>>;

/**
 * Vult de placeholders in. `ontbrekend` bevat de labels (voor de gebruiker)
 * van bekende placeholders zonder waarde; die blijven in de tekst staan.
 * Onbekende placeholders blijven ook staan en komen in `onbekend`.
 */
export function vulTekst(
  tekst: string,
  waarden: TekstWaarden
): { tekst: string; ontbrekend: string[]; onbekend: string[] } {
  const ontbrekend: string[] = [];
  const onbekend: string[] = [];
  const gevuld = tekst.replace(PLACEHOLDER_REGEX, (match, sleutel: string) => {
    const def = PLACEHOLDER_MAP.get(canoniek(sleutel));
    if (!def) {
      if (!onbekend.includes(sleutel)) onbekend.push(sleutel);
      return match;
    }
    const waarde = waarden[def.sleutel]?.trim();
    if (!waarde) {
      const naam = `${def.groep}: ${def.label}`;
      if (!ontbrekend.includes(naam)) ontbrekend.push(naam);
      return match;
    }
    return waarde;
  });
  return { tekst: gevuld, ontbrekend, onbekend };
}

/** Voorbeeldwaarden voor het bibliotheekscherm. */
export function voorbeeldWaarden(): TekstWaarden {
  return Object.fromEntries(PLACEHOLDERS.map((p) => [p.sleutel, p.voorbeeld]));
}

// ── Waarden opbouwen uit de documentgegevens ─────────────────────────────

export function formatDatumLang(ms: number): string {
  return new Date(ms).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Amsterdam",
  });
}

export function formatEuro(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(bedrag);
}

/** Termijnschema als opsomming: "- 50% na gunning". */
export function formatTermijnschema(
  stappen: ReadonlyArray<{ percentage: number; label: string }>
): string {
  return stappen.map((s) => `- ${s.percentage}% ${s.label}`.trimEnd()).join("\n");
}

const DAG_MS = 24 * 60 * 60 * 1000;

export interface TekstBron {
  bedrijf?: {
    naam?: string;
    adres?: string;
    postcode?: string;
    plaats?: string;
    email?: string;
    telefoon?: string;
    iban?: string;
    kvk?: string;
    btw?: string;
    betaaltermijnDagen?: number;
  };
  klant?: {
    naam?: string;
    voornaam?: string;
    achternaam?: string;
    adres?: string;
    postcode?: string;
    plaats?: string;
    email?: string;
    btwNummer?: string;
  };
  document?: { nummer?: string; datum?: number; bedragInclBtw?: number; referentie?: string };
  leverancier?: { naam?: string };
  offerte?: {
    geldigheidDagen?: number;
    termijnschema?: ReadonlyArray<{ percentage: number; label: string }>;
  };
  factuur?: { vervaldatum?: number; referentie?: string };
  termijn?: { nummer?: number; label?: string; percentage?: number };
  medewerker?: { naam?: string };
}

function volledigAdres(
  adres?: string,
  postcode?: string,
  plaats?: string
): string | undefined {
  const regel2 = [postcode, plaats].filter(Boolean).join(" ");
  const delen = [adres, regel2].filter((d) => d && d.trim());
  return delen.length > 0 ? delen.join(", ") : undefined;
}

export function bouwTekstWaarden(bron: TekstBron): TekstWaarden {
  const { bedrijf, klant, document, offerte, factuur, medewerker, leverancier, termijn } = bron;
  const geldigTot =
    document?.datum !== undefined && offerte?.geldigheidDagen
      ? formatDatumLang(document.datum + offerte.geldigheidDagen * DAG_MS)
      : undefined;
  return {
    "bedrijf.naam": bedrijf?.naam,
    "bedrijf.adres": volledigAdres(bedrijf?.adres, bedrijf?.postcode, bedrijf?.plaats),
    "bedrijf.email": bedrijf?.email,
    "bedrijf.telefoon": bedrijf?.telefoon,
    "bedrijf.iban": bedrijf?.iban,
    "bedrijf.kvk": bedrijf?.kvk,
    "bedrijf.btw": bedrijf?.btw,
    "bedrijf.betaaltermijn":
      bedrijf?.betaaltermijnDagen !== undefined ? String(bedrijf.betaaltermijnDagen) : undefined,
    "klant.naam": klant?.naam,
    "klant.voornaam": klant?.voornaam,
    "klant.achternaam": klant?.achternaam,
    "klant.adres": volledigAdres(klant?.adres, klant?.postcode, klant?.plaats),
    "klant.email": klant?.email,
    "klant.btwNummer": klant?.btwNummer,
    "document.nummer": document?.nummer,
    "document.datum": document?.datum !== undefined ? formatDatumLang(document.datum) : undefined,
    "document.bedrag":
      document?.bedragInclBtw !== undefined ? formatEuro(document.bedragInclBtw) : undefined,
    "document.referentie": document?.referentie,
    "leverancier.naam": leverancier?.naam,
    "offerte.geldigTot": geldigTot,
    "offerte.termijnschema":
      offerte?.termijnschema && offerte.termijnschema.length > 0
        ? formatTermijnschema(offerte.termijnschema)
        : undefined,
    "factuur.vervaldatum":
      factuur?.vervaldatum !== undefined ? formatDatumLang(factuur.vervaldatum) : undefined,
    "factuur.referentie": factuur?.referentie,
    "termijn.omschrijving":
      termijn?.nummer !== undefined && termijn.label
        ? `Termijn ${termijn.nummer}: ${termijn.label}`
        : undefined,
    "termijn.percentage":
      termijn?.percentage !== undefined ? termijn.percentage.toLocaleString("nl-NL") : undefined,
    "medewerker.naam": medewerker?.naam,
  };
}

/** Teksten van een document: inleiding boven de regels, afsluiting eronder. */
export interface DocumentTeksten {
  inleiding?: string;
  afsluiting?: string;
}

/**
 * Vult beide teksten en verzamelt wat ontbreekt. Gebruikt bij de
 * momentopname (versturen) én het PDF-voorbeeld.
 */
export function vulDocumentTeksten(
  teksten: DocumentTeksten,
  waarden: TekstWaarden
): { teksten: DocumentTeksten; ontbrekend: string[]; onbekend: string[] } {
  const ontbrekend: string[] = [];
  const onbekend: string[] = [];
  const uit: DocumentTeksten = {};
  for (const positie of ["inleiding", "afsluiting"] as const) {
    const tekst = teksten[positie];
    if (!tekst) continue;
    const r = vulTekst(tekst, waarden);
    uit[positie] = r.tekst;
    for (const o of r.ontbrekend) if (!ontbrekend.includes(o)) ontbrekend.push(o);
    for (const o of r.onbekend) if (!onbekend.includes(o)) onbekend.push(o);
  }
  return { teksten: uit, ontbrekend, onbekend };
}

/** Foutmelding voor het versturen; undefined = alles is ingevuld. */
export function blokkadeMelding(
  ontbrekend: readonly string[],
  onbekend: readonly string[]
): string | undefined {
  const delen: string[] = [];
  if (ontbrekend.length > 0) {
    delen.push(`Deze gegevens ontbreken in de tekst: ${ontbrekend.join(", ")}.`);
  }
  if (onbekend.length > 0) {
    delen.push(
      `Onbekende velden in de tekst: ${onbekend.map((s) => `{{${s}}}`).join(", ")}.`
    );
  }
  return delen.length > 0 ? delen.join(" ") : undefined;
}
