/**
 * De werkbank — pure logica achter het offerte-werkblad.
 *
 * Het werkblad verving de 5-stapswizard (masterplan offerte-entree, fase B):
 * de offerte bestaat meteen als concept en je werkt in één levend document.
 * Alles wat hier staat is bewust vrij van React en van Convex-ctx, zodat het
 * los te testen is (`src/__tests__/unit/werkbank.test.ts`).
 *
 * TT-004 blijft onaangetast: `type` kent exact twee waarden. De scopes
 * hieronder zijn UI-groepen bínnen zo'n type, geen extra typen.
 */

import type { OfferteRegel } from "./offerte-calculator";
import {
  LEGE_CATALOGUS_SELECTIE,
  type CatalogusSelectie,
  type OfferteBouwsteenRegel,
} from "./bouwsteen-offerte";

export type WerkbankType = "aanleg" | "onderhoud";

export type AanlegScope =
  | "grondwerk"
  | "bestrating"
  | "parkeerplaats"
  | "beregening"
  | "borders"
  | "gras"
  | "houtwerk"
  | "water_elektra"
  | "specials";

export type OnderhoudScope =
  | "gras"
  | "borders"
  | "heggen"
  | "bomen"
  | "overig"
  | "reiniging"
  | "bemesting"
  | "gazonanalyse"
  | "mollenbestrijding";

export type WerkbankScopeId = AanlegScope | OnderhoudScope;

export interface WerkbankScope {
  id: WerkbankScopeId;
  naam: string;
  /** Eén regel: wat zit er in deze scope? */
  beschrijving: string;
  /**
   * Lettertoets in het palet. Uniek bínnen één palet; waar de entree-tegel
   * dezelfde betekenis heeft, is diens letter overgenomen (S bestrating,
   * P parkeerplaats, B beregening) zodat de vingers kloppen.
   *
   * **`g` is verboden.** Dat is de prefix van de globale spring-sneltoetsen
   * ("g d" dashboard, "g o" offertes, …) in `ShortcutsProvider`: een palet-`g`
   * zou een scope toevoegen én een navigatiereeks openen, waarna de volgende
   * letter je van het werkblad af stuurt. Reiniging (entree-tegel G) heet in
   * het palet daarom R.
   */
  toets: string;
  /** Onderdelen die automatisch meelopen — badge in het palet. */
  verplicht?: string[];
}

export const AANLEG_SCOPES: WerkbankScope[] = [
  {
    id: "grondwerk",
    naam: "Grondwerk",
    beschrijving: "Ontgraven, afvoer, machine-uren",
    toets: "w",
  },
  {
    id: "bestrating",
    naam: "Bestrating",
    beschrijving: "Tegels, klinkers of natuursteen met onderbouw",
    toets: "s",
    verplicht: ["onderbouw"],
  },
  {
    id: "parkeerplaats",
    naam: "Parkeerplaats",
    beschrijving: "Verharding op verkeersbelasting, kolken, belijning",
    toets: "p",
    verplicht: ["fundering"],
  },
  {
    id: "beregening",
    naam: "Beregening",
    beschrijving: "Zones, leidingwerk en regelkast",
    toets: "b",
    verplicht: ["zones"],
  },
  {
    id: "borders",
    naam: "Borders & beplanting",
    beschrijving: "Grondbewerking, planten, afwerking",
    toets: "o",
  },
  {
    id: "gras",
    naam: "Gras / gazon",
    beschrijving: "Zaaien, graszoden of kunstgras",
    toets: "z",
  },
  {
    id: "houtwerk",
    naam: "Houtwerk",
    beschrijving: "Schutting, vlonder of pergola met fundering",
    toets: "h",
    verplicht: ["fundering"],
  },
  {
    id: "water_elektra",
    naam: "Water & elektra",
    beschrijving: "Verlichting, sleuven, bekabeling",
    toets: "e",
    verplicht: ["sleuven", "herstel"],
  },
  {
    id: "specials",
    naam: "Specials",
    beschrijving: "Jacuzzi, sauna, prefab elementen",
    toets: "x",
  },
];

export const ONDERHOUD_SCOPES: WerkbankScope[] = [
  {
    id: "gras",
    naam: "Gras onderhoud",
    beschrijving: "Maaien, kanten steken, verticuteren",
    toets: "z",
  },
  {
    id: "borders",
    naam: "Borders onderhoud",
    beschrijving: "Wieden, snoei, bodemonderhoud",
    toets: "o",
    verplicht: ["intensiteit"],
  },
  {
    id: "heggen",
    naam: "Heggen",
    beschrijving: "Snoei op volume (lengte × hoogte × breedte)",
    toets: "h",
    verplicht: ["lengte", "hoogte", "breedte"],
  },
  {
    id: "bomen",
    naam: "Bomen",
    beschrijving: "Snoei per hoogteklasse",
    toets: "b",
  },
  {
    id: "overig",
    naam: "Overige werkzaamheden",
    beschrijving: "Bladruimen, terras, onkruid op bestrating",
    toets: "w",
  },
  {
    id: "reiniging",
    naam: "Reiniging",
    beschrijving: "Terras, bestrating en gevels",
    toets: "r",
  },
  {
    id: "bemesting",
    naam: "Bemesting",
    beschrijving: "Gazon, borders en bomen",
    toets: "m",
  },
  {
    id: "gazonanalyse",
    naam: "Gazonanalyse",
    beschrijving: "Beoordeling, herstelplan, advies",
    toets: "n",
  },
  {
    id: "mollenbestrijding",
    naam: "Mollenbestrijding",
    beschrijving: "Pakketten en preventie",
    toets: "l",
  },
];

/**
 * Combinatie-knop in het aanleg-palet. Houdt de betekenis van de
 * entree-tegel "Tuinrenovatie" (toets R) vast: één klik zet de drie
 * opknap-scopes klaar.
 */
export const RENOVATIE_COMBI = {
  naam: "Renovatiepakket",
  beschrijving: "Grondwerk, borders en gazon in één keer",
  toets: "r",
  scopes: ["grondwerk", "borders", "gras"] as AanlegScope[],
};

export function scopesVoorType(type: WerkbankType): WerkbankScope[] {
  return type === "aanleg" ? AANLEG_SCOPES : ONDERHOUD_SCOPES;
}

export function scopeVanId(
  type: WerkbankType,
  id: string
): WerkbankScope | undefined {
  return scopesVoorType(type).find((s) => s.id === id);
}

export function scopeVoorToets(
  type: WerkbankType,
  toets: string
): WerkbankScope | undefined {
  const letter = toets.toLowerCase();
  return scopesVoorType(type).find((s) => s.toets === letter);
}

/**
 * `?scope=…&scope=…` uit de URL: houdt alleen scopes die bij dit type horen,
 * ontdubbelt en behoudt de volgorde van het palet (zodat het document altijd
 * dezelfde leesrichting heeft, ongeacht de volgorde in de querystring).
 */
export function geldigeScopes(
  type: WerkbankType,
  waarden: readonly string[]
): WerkbankScopeId[] {
  const geldig = new Set(scopesVoorType(type).map((s) => s.id as string));
  const gekozen = new Set(waarden.filter((w) => geldig.has(w)));
  return scopesVoorType(type)
    .filter((s) => gekozen.has(s.id))
    .map((s) => s.id);
}

/** Scopes altijd in paletvolgorde: het document leest van boven naar beneden. */
export function sorteerScopes(
  type: WerkbankType,
  scopes: readonly string[]
): WerkbankScopeId[] {
  return geldigeScopes(type, scopes);
}

// ─── Volledigheid per scope ──────────────────────────────────────────────────

type Waarden = Record<string, unknown>;

function getal(bron: unknown, veld: string): number {
  if (!bron || typeof bron !== "object") return 0;
  const waarde = (bron as Waarden)[veld];
  return typeof waarde === "number" && Number.isFinite(waarde) ? waarde : 0;
}

function tekst(bron: unknown, veld: string): string {
  if (!bron || typeof bron !== "object") return "";
  const waarde = (bron as Waarden)[veld];
  return typeof waarde === "string" ? waarde : "";
}

function vlag(bron: unknown, veld: string): boolean {
  if (!bron || typeof bron !== "object") return false;
  return (bron as Waarden)[veld] === true;
}

/**
 * Heeft deze scope genoeg gegevens om regels te kunnen berekenen?
 *
 * Bewust defensief: scopeData komt óók terug uit Convex (`v.any()`), waar de
 * vorm van een oudere offerte kan afwijken. Een ontbrekend veld is "nog niet
 * ingevuld", nooit een crash.
 */
export function isScopeCompleet(
  type: WerkbankType,
  scope: WerkbankScopeId,
  scopeData: Record<string, unknown>
): boolean {
  const data = scopeData?.[scope];
  if (type === "aanleg") {
    switch (scope as AanlegScope) {
      case "grondwerk":
        return getal(data, "oppervlakte") > 0;
      case "bestrating":
        return (
          getal(data, "oppervlakte") > 0 &&
          getal((data as Waarden)?.onderbouw, "dikteOnderlaag") > 0
        );
      case "parkeerplaats":
        return (
          getal(data, "oppervlakte") > 0 &&
          (tekst(data, "afwatering") !== "kolken" ||
            getal(data, "aantalKolken") > 0)
        );
      case "beregening":
        return getal(data, "oppervlakte") > 0 && getal(data, "aantalZones") > 0;
      case "borders":
        return getal(data, "oppervlakte") > 0;
      case "gras":
        return getal(data, "oppervlakte") > 0;
      case "houtwerk":
        return getal(data, "afmeting") > 0;
      case "water_elektra":
        return (
          tekst(data, "verlichting") !== "geen" || getal(data, "aantalPunten") > 0
        );
      case "specials":
        return Array.isArray((data as Waarden)?.items)
          ? ((data as Waarden).items as unknown[]).length > 0
          : false;
      default:
        return false;
    }
  }

  switch (scope as OnderhoudScope) {
    case "gras":
      return !vlag(data, "grasAanwezig") || getal(data, "grasOppervlakte") > 0;
    case "borders":
      return (
        getal(data, "borderOppervlakte") > 0 &&
        tekst(data, "onderhoudsintensiteit").length > 0
      );
    case "heggen":
      return (
        getal(data, "lengte") > 0 &&
        getal(data, "hoogte") > 0 &&
        getal(data, "breedte") > 0
      );
    case "bomen":
      return getal(data, "aantalBomen") > 0;
    // Deze werkzaamheden hebben geen verplichte maatvoering: aanvinken volstaat.
    case "overig":
    case "reiniging":
    case "bemesting":
    case "gazonanalyse":
    case "mollenbestrijding":
      return true;
    default:
      return false;
  }
}

/**
 * Alleen de gekozen scopes meegeven aan Convex. Wat je uitvinkt hoort niet
 * als spookdata op de offerte te blijven staan.
 */
export function scopeDataVoorOfferte(
  scopes: readonly string[],
  scopeData: Record<string, unknown>
): Record<string, unknown> {
  const uit: Record<string, unknown> = {};
  scopes.forEach((scope) => {
    if (scopeData?.[scope] !== undefined) uit[scope] = scopeData[scope];
  });
  return uit;
}

// ─── Garantie ────────────────────────────────────────────────────────────────

export interface GarantieOptie {
  id: string;
  naam: string;
  jaren: number;
  prijs: number;
  /** -1 = onbeperkt. */
  callbacks: number;
}

/**
 * Garantie was een hele wizardstap met drie pricing-cards, en de keuze werd
 * daarna wéggegooid. Nu: één inline rij, "geen garantie" is de default (0
 * klikken), en de keuze landt als échte offerteregel — anders staat er weer
 * een knop die niets doet.
 *
 * De bedragen komen ongewijzigd uit de oude selector en zijn nog steeds
 * hardcoded; kantoor moet ze op termijn in de instellingen kunnen zetten.
 */
export const GARANTIE_OPTIES: GarantieOptie[] = [
  { id: "garantie-basis", naam: "Basis", jaren: 5, prijs: 299, callbacks: 1 },
  { id: "garantie-premium", naam: "Premium", jaren: 7, prijs: 599, callbacks: 3 },
  {
    id: "garantie-premium-plus",
    naam: "Premium Plus",
    jaren: 10,
    prijs: 999,
    callbacks: -1,
  },
];

export function garantieOptie(id: string | null): GarantieOptie | undefined {
  if (!id) return undefined;
  return GARANTIE_OPTIES.find((g) => g.id === id);
}

/** Vaste id: bij herberekenen mag er nooit een tweede garantieregel bijkomen. */
export const GARANTIE_REGEL_ID = "werkbank-garantie";

export function garantieRegel(id: string | null): OfferteRegel | null {
  const optie = garantieOptie(id);
  if (!optie) return null;
  return {
    id: GARANTIE_REGEL_ID,
    scope: "garantie",
    omschrijving: `Garantiepakket ${optie.naam} — ${optie.jaren} jaar`,
    eenheid: "stuk",
    hoeveelheid: 1,
    prijsPerEenheid: optie.prijs,
    totaal: optie.prijs,
    type: "materiaal",
    // Marge 0: de klant ziet exact het bedrag dat in het palet stond.
    margePercentage: 0,
  };
}

/**
 * Welke garantie staat er op een bestaande offerte?
 *
 * De keuze wordt niet apart bewaard: hij ís de regel. `offertes.scopeData`
 * heeft een strikte validator per scope, dus daar hoort geen los veld thuis —
 * en een keuze die alleen in een veldje leeft is precies de fout die de
 * samenwerking-slider maakte.
 */
export function garantieUitRegels(
  regels: readonly OfferteRegel[]
): string | null {
  const regel = regels.find(
    (r) => r.id === GARANTIE_REGEL_ID || r.scope === "garantie"
  );
  if (!regel) return null;
  const opPrijs = GARANTIE_OPTIES.find(
    (o) => o.prijs === regel.prijsPerEenheid
  );
  if (opPrijs) return opPrijs.id;
  // Langste naam eerst: "Premium Plus" bevat "Premium".
  const opNaam = [...GARANTIE_OPTIES]
    .sort((a, b) => b.naam.length - a.naam.length)
    .find((o) => regel.omschrijving.includes(o.naam));
  return opNaam?.id ?? null;
}

/**
 * Contractselectie terugbouwen uit de bouwsteen-regels die op de offerte
 * staan — zo overleeft de keuze een herlaadactie zonder eigen opslagveld.
 */
export function catalogusUitBouwsteenRegels(
  regels: readonly OfferteBouwsteenRegel[] | undefined
): CatalogusSelectie {
  if (!regels || regels.length === 0) return LEGE_CATALOGUS_SELECTIE;

  const metZand = regels.find((r) => r.zandKeuze);
  return {
    // Het pakket is een startknop, geen bewaarde staat: na herladen tonen we
    // de losse regels zoals ze zijn.
    pakket: null,
    regels: Object.fromEntries(
      regels.map((regel) => [
        regel.bouwsteenId as string,
        {
          aan: true,
          frequentiePerJaar: regel.frequentiePerJaar,
          prijsPerBeurt: regel.prijsPerBeurtHandmatig
            ? regel.prijsPerBeurt
            : null,
        },
      ])
    ),
    zandKeuze: metZand?.zandKeuze?.keuze ?? LEGE_CATALOGUS_SELECTIE.zandKeuze,
    zandPrijzen: {
      voegzand: metZand?.zandKeuze?.prijsVoegzand ?? null,
      straatzand: metZand?.zandKeuze?.prijsStraatzand ?? null,
    },
  };
}

// ─── Dubbele werkzaamheden (onderhoud) ───────────────────────────────────────

/**
 * Onderhoud kent twee lagen die hetzelfde kunnen zeggen: de normuren-engine
 * (scope-formulier, "Gras maaien") en de contractcatalogus (bouwsteen,
 * "Gazon maaien", frequentie × prijs per beurt). De wizard zette ze allebei
 * op de offerte — de klant betaalde het maaien dus twee keer.
 *
 * Regel: staat de werkzaamheid als bouwsteen in het contract, dan wint het
 * contract (daar hangt de prijs-op-offertedatum aan) en vervalt de losse
 * arbeidsregel.
 */
const ACTIVITEIT_SLEUTELS: Array<{ sleutel: string; woorden: string[] }> = [
  { sleutel: "maaien", woorden: ["maaien"] },
  { sleutel: "kanten", woorden: ["kanten steken", "kanten afsteken"] },
  { sleutel: "verticuteren", woorden: ["verticuteren"] },
  { sleutel: "bladruimen", woorden: ["bladruimen", "blad ruimen", "bladafvoer"] },
  {
    sleutel: "onkruid_bestrating",
    woorden: ["onkruid bestrating", "onkruid op bestrating", "onkruidbeheersing"],
  },
  {
    sleutel: "terras_reinigen",
    woorden: ["terras reinigen", "terrasreiniging", "reinigen terras"],
  },
  { sleutel: "heggen", woorden: ["heg snoeien", "heggen snoeien", "heg knippen"] },
  { sleutel: "bemesten", woorden: ["bemesten", "bemesting"] },
];

function normaliseer(omschrijving: string): string {
  return omschrijving
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function activiteitSleutel(omschrijving: string): string | null {
  const tekst = normaliseer(omschrijving);
  const treffer = ACTIVITEIT_SLEUTELS.find((a) =>
    a.woorden.some((woord) => tekst.includes(woord))
  );
  return treffer ? treffer.sleutel : null;
}

export interface OntdubbelResultaat {
  regels: OfferteRegel[];
  /** Omschrijvingen die zijn vervallen — het werkblad meldt dit zichtbaar. */
  vervallen: string[];
}

export function ontdubbelOnderhoudRegels(
  berekendeRegels: readonly OfferteRegel[],
  bouwsteenRegels: readonly OfferteRegel[]
): OntdubbelResultaat {
  const uitContract = new Set(
    bouwsteenRegels
      .map((r) => activiteitSleutel(r.omschrijving))
      .filter((s): s is string => s !== null)
  );
  if (uitContract.size === 0) {
    return { regels: [...berekendeRegels], vervallen: [] };
  }

  const vervallen: string[] = [];
  const regels = berekendeRegels.filter((regel) => {
    const sleutel = activiteitSleutel(regel.omschrijving);
    if (sleutel && uitContract.has(sleutel)) {
      vervallen.push(regel.omschrijving);
      return false;
    }
    return true;
  });

  return { regels, vervallen };
}

// ─── De regels van het werkblad ──────────────────────────────────────────────

export interface WerkbankRegelsInvoer {
  type: WerkbankType;
  berekendeRegels: readonly OfferteRegel[];
  bouwsteenRegels?: readonly OfferteRegel[];
  garantieId?: string | null;
}

/**
 * De volledige regelset van het werkblad: normuren-engine, daarna de
 * contract-bouwstenen (onderhoud), en de garantie als laatste regel.
 */
export function werkbankRegels({
  type,
  berekendeRegels,
  bouwsteenRegels = [],
  garantieId = null,
}: WerkbankRegelsInvoer): OntdubbelResultaat {
  const basis =
    type === "onderhoud"
      ? ontdubbelOnderhoudRegels(berekendeRegels, bouwsteenRegels)
      : { regels: [...berekendeRegels], vervallen: [] };

  const regels = [...basis.regels, ...bouwsteenRegels];
  const garantie = garantieRegel(garantieId);
  if (garantie) regels.push(garantie);

  return { regels, vervallen: basis.vervallen };
}

// ─── Voortgang & afronden ────────────────────────────────────────────────────

export interface WerkbankVoortgang {
  scopesTotaal: number;
  scopesCompleet: number;
  /** Scopes die nog gegevens missen — het palet markeert ze. */
  onvolledig: WerkbankScopeId[];
  klantCompleet: boolean;
  heeftRegels: boolean;
  /** Mag de offerte de conceptfase verlaten? */
  kanDefinitief: boolean;
}

export interface WerkbankKlant {
  naam?: string;
  adres?: string;
  postcode?: string;
  plaats?: string;
}

/**
 * Dezelfde vier velden als de harde guard in `convex/lib/offerteKlant.ts`.
 * Hier alleen om de knop te kunnen uitleggen — de backend blijft de waarheid.
 */
export function isKlantCompleetVoorWerkbank(
  klant: WerkbankKlant | null | undefined
): boolean {
  if (!klant) return false;
  return (["naam", "adres", "postcode", "plaats"] as const).every(
    (veld) => typeof klant[veld] === "string" && klant[veld]!.trim().length > 0
  );
}

export function werkbankVoortgang(params: {
  type: WerkbankType;
  scopes: readonly WerkbankScopeId[];
  scopeData: Record<string, unknown>;
  klant: WerkbankKlant | null | undefined;
  aantalRegels: number;
}): WerkbankVoortgang {
  const onvolledig = params.scopes.filter(
    (scope) => !isScopeCompleet(params.type, scope, params.scopeData)
  );
  const klantCompleet = isKlantCompleetVoorWerkbank(params.klant);
  const heeftRegels = params.aantalRegels > 0;

  return {
    scopesTotaal: params.scopes.length,
    scopesCompleet: params.scopes.length - onvolledig.length,
    onvolledig: [...onvolledig],
    klantCompleet,
    heeftRegels,
    kanDefinitief: klantCompleet && heeftRegels,
  };
}
