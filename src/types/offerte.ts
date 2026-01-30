// Offerte types voor de Offerte Builder

export type OfferteType = "aanleg" | "onderhoud";

export type OfferteStatus =
  | "concept"
  | "definitief"
  | "verzonden"
  | "geaccepteerd"
  | "afgewezen";

export type Bereikbaarheid = "goed" | "beperkt" | "slecht";
export type Achterstalligheid = "laag" | "gemiddeld" | "hoog";
export type Complexiteit = "laag" | "gemiddeld" | "hoog";
export type Intensiteit = "weinig" | "gemiddeld" | "veel";
export type Snijwerk = "laag" | "gemiddeld" | "hoog";

// Aanleg Scopes
export type AanlegScope =
  | "grondwerk"
  | "bestrating"
  | "borders"
  | "gras"
  | "houtwerk"
  | "water_elektra"
  | "specials";

// Klant gegevens
export interface Klant {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  email?: string;
  telefoon?: string;
}

// Algemene parameters
export interface AlgemeenParams {
  bereikbaarheid: Bereikbaarheid;
  achterstalligheid?: Achterstalligheid;
}

// Offerte regel/post
export interface OfferteRegel {
  id: string;
  scope: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  totaal: number;
  type: "materiaal" | "arbeid" | "machine";
  margePercentage?: number; // Override marge per regel (optioneel)
}

// Totalen
export interface OfferteTotalen {
  materiaalkosten: number;
  arbeidskosten: number;
  totaalUren: number;
  subtotaal: number;
  marge: number;
  margePercentage: number;
  totaalExBtw: number;
  btw: number;
  totaalInclBtw: number;
}

// Grondwerk scope data
export interface GrondwerkData {
  oppervlakte: number;
  diepte: "licht" | "standaard" | "zwaar";
  afvoerGrond: boolean;
}

// Bestrating scope data
export interface BestratingData {
  oppervlakte: number;
  typeBestrating: "tegel" | "klinker" | "natuursteen";
  snijwerk: Snijwerk;
  // Verplichte onderbouw
  onderbouw: {
    type: "zandbed" | "zand_fundering" | "zware_fundering";
    dikteOnderlaag: number; // cm
    opsluitbanden: boolean;
  };
}

// Borders scope data
export interface BordersData {
  oppervlakte: number;
  beplantingsintensiteit: Intensiteit;
  bodemverbetering: boolean;
  afwerking: "geen" | "schors" | "grind";
}

// Gras scope data
export interface GrasData {
  oppervlakte: number;
  type: "zaaien" | "graszoden";
  ondergrond: "bestaand" | "nieuw";
  afwateringNodig: boolean;
}

// Houtwerk scope data
export interface HoutwerkData {
  typeHoutwerk: "schutting" | "vlonder" | "pergola";
  afmeting: number; // lengte in meters of m²
  // Verplichte fundering
  fundering: "standaard" | "zwaar";
}

// Water/Elektra scope data
export interface WaterElektraData {
  verlichting: "geen" | "basis" | "uitgebreid";
  aantalPunten: number;
  // Verplicht als elektra
  sleuvenNodig: boolean;
}

// Specials scope data
export interface SpecialsData {
  items: Array<{
    type: "jacuzzi" | "sauna" | "prefab";
    omschrijving: string;
  }>;
}

// Onderhoud scope data
export interface GrasOnderhoudData {
  grasAanwezig: boolean;
  grasOppervlakte: number;
  maaien: boolean;
  kantenSteken: boolean;
  verticuteren: boolean;
  afvoerGras: boolean;
}

export interface BordersOnderhoudData {
  borderOppervlakte: number;
  onderhoudsintensiteit: Intensiteit; // VERPLICHT
  onkruidVerwijderen: boolean;
  snoeiInBorders: "geen" | "licht" | "zwaar";
  bodem: "open" | "bedekt";
  afvoerGroenafval: boolean;
}

export interface HeggenOnderhoudData {
  // ALLE DRIE VERPLICHT voor volume berekening
  lengte: number;
  hoogte: number;
  breedte: number;
  snoei: "zijkanten" | "bovenkant" | "beide";
  afvoerSnoeisel: boolean;
}

export interface BomenOnderhoudData {
  aantalBomen: number;
  snoei: "licht" | "zwaar";
  hoogteklasse: "laag" | "middel" | "hoog";
  afvoer: boolean;
}

export interface OverigeOnderhoudData {
  bladruimen: boolean;
  terrasReinigen: boolean;
  terrasOppervlakte?: number;
  onkruidBestrating: boolean;
  bestratingOppervlakte?: number;
  afwateringControleren: boolean;
  aantalAfwateringspunten?: number;
  overigNotities?: string;
  overigUren?: number;
}

// Correctiefactoren
export interface Correctiefactoren {
  bereikbaarheid: Record<Bereikbaarheid, number>;
  complexiteit: Record<Complexiteit, number>;
  intensiteit: Record<Intensiteit, number>;
  snijwerk: Record<Snijwerk, number>;
  achterstalligheid: Record<Achterstalligheid, number>;
}

export const DEFAULT_CORRECTIEFACTOREN: Correctiefactoren = {
  bereikbaarheid: {
    goed: 1.0,
    beperkt: 1.2,
    slecht: 1.5,
  },
  complexiteit: {
    laag: 1.0,
    gemiddeld: 1.15,
    hoog: 1.3,
  },
  intensiteit: {
    weinig: 0.8,
    gemiddeld: 1.0,
    veel: 1.3,
  },
  snijwerk: {
    laag: 1.0,
    gemiddeld: 1.2,
    hoog: 1.4,
  },
  achterstalligheid: {
    laag: 1.0,
    gemiddeld: 1.3,
    hoog: 1.6,
  },
};

// Bedrijfsgegevens
export interface Bedrijfsgegevens {
  naam: string;
  adres: string;
  postcode: string;
  plaats: string;
  kvk?: string;
  btw?: string;
  iban?: string;
  email?: string;
  telefoon?: string;
  logo?: string;
}

// Scope marges - per scope een marge percentage
export interface ScopeMarges {
  // Aanleg scopes
  grondwerk?: number;
  bestrating?: number;
  borders?: number;
  gras?: number;
  houtwerk?: number;
  water_elektra?: number;
  specials?: number;
  // Onderhoud scopes
  gras_onderhoud?: number;
  borders_onderhoud?: number;
  heggen?: number;
  bomen?: number;
  overig?: number;
}

// Instellingen
export interface Instellingen {
  uurtarief: number;
  standaardMargePercentage: number;
  scopeMarges?: ScopeMarges; // Per-scope marge percentages (optioneel)
  btwPercentage: number;
  bedrijfsgegevens: Bedrijfsgegevens;
  offerteNummerPrefix: string;
  laatsteOfferteNummer: number;
}

// Product uit prijsboek
export interface Product {
  productnaam: string;
  categorie: string;
  inkoopprijs: number;
  verkoopprijs: number;
  eenheid: string;
  leverancier?: string;
  verliespercentage: number;
  isActief: boolean;
}

// Normuur
export interface Normuur {
  activiteit: string;
  scope: string;
  normuurPerEenheid: number;
  eenheid: string;
  omschrijving?: string;
}
