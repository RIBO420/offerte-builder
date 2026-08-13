/**
 * Bedrijfszoeken via Google Places (TT-006).
 *
 * Pure logica, los van Convex, zodat de tests hem kunnen draaien met een
 * gemockte fetch — er gaan nooit echte (betaalde) Places-calls uit in de
 * testsuite. Zelfde opzet als reistijdLogica.
 *
 * De API-sleutel is dezelfde deployment-brede `GOOGLE_MAPS_API_KEY` die al voor
 * Distance Matrix wordt gebruikt; op die sleutel moet wel de **Places API (New)**
 * aanstaan. Zonder sleutel doet dit niets en blijft handmatig invoeren gewoon
 * werken — het zoeken is een gemak, geen voorwaarde.
 */

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

/** Minimale fetch-signatuur zodat tests een mock kunnen injecteren. */
export type FetchLike = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

export interface PlaatsSuggestie {
  placeId: string;
  /** Vetgedrukte regel: meestal de bedrijfsnaam. */
  hoofdtekst: string;
  /** Grijze regel eronder: het adres. */
  subtekst: string;
}

export interface PlaatsDetails {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  telefoon?: string;
  website?: string;
}

// ============================================
// Autocomplete
// ============================================

interface AutocompleteAntwoord {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      text?: { text?: string };
    };
  }>;
}

/**
 * Zoek bedrijven/adressen op naam. Beperkt tot Nederland en België: Top Tuinen
 * werkt in Zuid-Limburg en net over de grens, dus dat scheelt ruis én calls.
 *
 * Geeft een lege lijst terug bij elke fout (netwerk, quota, verkeerde sleutel).
 * Zoeken dat niet werkt mag het invoerformulier nooit blokkeren.
 */
export async function zoekPlaatsen(
  invoer: string,
  opties: {
    apiKey: string;
    fetchFn: FetchLike;
    /** Houdt de calls van één zoekactie bij elkaar; scheelt fors op de rekening. */
    sessionToken?: string;
  }
): Promise<PlaatsSuggestie[]> {
  const zoekterm = invoer.trim();
  // Onder de drie tekens levert Places vooral ruis op en kost het wel geld.
  if (zoekterm.length < 3) return [];

  try {
    const antwoord = await opties.fetchFn(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": opties.apiKey,
      },
      body: JSON.stringify({
        input: zoekterm,
        languageCode: "nl",
        regionCode: "NL",
        includedRegionCodes: ["nl", "be", "de"],
        ...(opties.sessionToken ? { sessionToken: opties.sessionToken } : {}),
      }),
    });

    if (!antwoord.ok) return [];

    const data = (await antwoord.json()) as AutocompleteAntwoord;
    const suggesties = data.suggestions ?? [];

    return suggesties
      .map((s) => s.placePrediction)
      .filter((p): p is NonNullable<typeof p> => Boolean(p?.placeId))
      .map((p) => ({
        placeId: p.placeId!,
        hoofdtekst:
          p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        subtekst: p.structuredFormat?.secondaryText?.text ?? "",
      }))
      .filter((s) => s.hoofdtekst.length > 0);
  } catch {
    return [];
  }
}

// ============================================
// Details
// ============================================

interface AdresComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface DetailsAntwoord {
  displayName?: { text?: string };
  addressComponents?: AdresComponent[];
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

function zoekComponent(
  componenten: AdresComponent[],
  type: string
): string | undefined {
  return componenten.find((c) => c.types?.includes(type))?.longText;
}

/**
 * Zet Google's adrescomponenten om naar de velden die het klantformulier
 * gebruikt. Bewust component-gebaseerd en niet op `formattedAddress`: die
 * string verschilt per land en is niet betrouwbaar te splitsen.
 */
export function bouwDetailsUitComponenten(
  data: DetailsAntwoord
): PlaatsDetails {
  const componenten = data.addressComponents ?? [];

  const straat = zoekComponent(componenten, "route") ?? "";
  const huisnummer = zoekComponent(componenten, "street_number") ?? "";
  const postcode = zoekComponent(componenten, "postal_code") ?? "";
  // `locality` is de gemeente; bij kleinere kernen levert Google alleen
  // postal_town of het administratieve gebied.
  const plaats =
    zoekComponent(componenten, "locality") ??
    zoekComponent(componenten, "postal_town") ??
    zoekComponent(componenten, "administrative_area_level_2") ??
    "";

  return {
    naam: data.displayName?.text ?? "",
    adres: [straat, huisnummer].filter(Boolean).join(" "),
    postcode,
    plaats,
    telefoon: data.nationalPhoneNumber,
    website: data.websiteUri,
  };
}

/**
 * Haal de volledige gegevens van één gekozen suggestie op.
 * Geeft null terug bij elke fout — de gebruiker vult dan handmatig aan.
 */
export async function haalPlaatsDetails(
  placeId: string,
  opties: {
    apiKey: string;
    fetchFn: FetchLike;
    sessionToken?: string;
  }
): Promise<PlaatsDetails | null> {
  if (!placeId.trim()) return null;

  const velden = [
    "displayName",
    "addressComponents",
    "nationalPhoneNumber",
    "websiteUri",
  ].join(",");

  try {
    const url =
      `${DETAILS_URL}/${encodeURIComponent(placeId)}?languageCode=nl` +
      (opties.sessionToken
        ? `&sessionToken=${encodeURIComponent(opties.sessionToken)}`
        : "");

    const antwoord = await opties.fetchFn(url, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": opties.apiKey,
        "X-Goog-FieldMask": velden,
      },
    });

    if (!antwoord.ok) return null;

    const data = (await antwoord.json()) as DetailsAntwoord;
    return bouwDetailsUitComponenten(data);
  } catch {
    return null;
  }
}
