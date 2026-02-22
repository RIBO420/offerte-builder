// Offerte types voor de Offerte Builder

export type OfferteType = "aanleg" | "onderhoud";

export type OfferteStatus =
  | "concept"
  | "voorcalculatie"
  | "verzonden"
  | "geaccepteerd"
  | "afgewezen";

export type Bereikbaarheid = "goed" | "beperkt" | "slecht";
export type Achterstalligheid = "laag" | "gemiddeld" | "hoog";
export type Complexiteit = "laag" | "gemiddeld" | "hoog";
export type Intensiteit = "weinig" | "gemiddeld" | "veel";
export type Snijwerk = "laag" | "gemiddeld" | "hoog";

// Bestratingtype
export type Bestratingtype = "pad" | "oprit" | "terrein";

// Funderingslagen
export interface FunderingslagenData {
  gebrokenPuin: number; // cm dikte
  zand: number; // cm dikte
  brekerszand?: number;
  stabiliser?: boolean;
}

// Bestrating zone
export interface BestratingZone {
  id: string;
  type: Bestratingtype;
  oppervlakte: number;
  materiaal?: string;
}

// Oriëntatie type
export type Orientatie = "noord" | "zuid" | "oost" | "west" | "nvt";

// Bodem mix
export interface BodemMix {
  zandPercentage: number;
  compostPercentage: number;
  teelaardPercentage: number;
}

// Houtwerk configurator
export interface HoutwerkConfigurator {
  breedte?: number;
  hoogte?: number;
  lengte?: number;
  daktype?: string;
  materiaalKeuze?: string;
}

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
  // Bestratingtype: pad, oprit of terrein
  bestratingtype?: Bestratingtype;
  // Funderingslagen met dikte in cm
  funderingslagen?: FunderingslagenData;
  // Zones voor bestrating (meerdere gebieden)
  zones?: BestratingZone[];
}

// Borders scope data
export interface BordersData {
  oppervlakte: number;
  beplantingsintensiteit: Intensiteit;
  bodemverbetering: boolean;
  afwerking: "geen" | "schors" | "grind";
  // Oriëntatie van de border
  orientatie?: Orientatie;
  // Bodem mix percentages
  bodemMix?: BodemMix;
  // Bemestingsschema
  bemestingsschema?: boolean;
}

// Gras scope data
export interface GrasData {
  oppervlakte: number;
  type: "zaaien" | "graszoden";
  ondergrond: "bestaand" | "nieuw";
  afwateringNodig: boolean;
  // Kunstgras optie
  kunstgras?: boolean;
  // Drainage opties
  drainage?: boolean;
  drainageMeters?: number;
  // Opsluitbanden opties
  opsluitbanden?: boolean;
  opsluitbandenMeters?: number;
  // Verticuteren
  verticuteren?: boolean;
}

// Houtwerk scope data
export interface HoutwerkData {
  typeHoutwerk: "schutting" | "vlonder" | "pergola";
  afmeting: number; // lengte in meters of m²
  // Verplichte fundering
  fundering: "standaard" | "zwaar";
  // Leverancier URL (bijv. voor configurator link)
  leverancierUrl?: string;
  // Configurator gegevens
  configurator?: HoutwerkConfigurator;
}

// Water/Elektra scope data
export interface WaterElektraData {
  verlichting: "geen" | "basis" | "uitgebreid";
  aantalPunten: number;
  // Verplicht als elektra
  sleuvenNodig: boolean;
  // Verlichtingsplan nodig
  verlichtingsplan?: boolean;
  // Diepte eis in cm (default 60)
  diepteEis?: number;
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
  // Uitbreidingsvelden
  haagsoort?: "liguster" | "beuk" | "taxus" | "conifeer" | "buxus" | "overig";
  haagsoortOverig?: string;
  diepte?: number;
  hoogwerkerNodig?: boolean;
  ondergrond?: "bestrating" | "border" | "grind" | "gras" | "anders";
  snoeiFrequentie?: "1x" | "2x" | "3x";
}

export interface BomenOnderhoudData {
  aantalBomen: number;
  snoei: "licht" | "zwaar";
  hoogteklasse: "laag" | "middel" | "hoog";
  afvoer: boolean;
  // Uitbreidingsvelden
  groottecategorie?: "0-4m" | "4-10m" | "10-20m";
  nabijGebouw?: boolean;
  nabijStraat?: boolean;
  nabijKabels?: boolean;
  afstandTotStraat?: number;
  inspectieType?: "geen" | "visueel" | "gecertificeerd";
  boomsoort?: string;
  kroondiameter?: number;
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

export interface ReinigingOnderhoudData {
  terrasReiniging?: boolean;
  terrasType?: "keramisch" | "beton" | "klinkers" | "natuursteen" | "hout";
  terrasOppervlakte?: number;
  bladruimen?: boolean;
  bladruimenOppervlakte?: number;
  bladruimenFrequentie?: "eenmalig" | "seizoen";
  bladruimenAfvoer?: boolean;
  onkruidBestrating?: boolean;
  onkruidBestratingOppervlakte?: number;
  onkruidMethode?: "handmatig" | "branden" | "heet_water" | "chemisch";
  hogedrukspuitAkkoord?: boolean;
  algeReiniging?: boolean;
  algeOppervlakte?: number;
  algeType?: "dak" | "bestrating" | "hekwerk" | "muur";
}

export interface BemestingOnderhoudData {
  bemestingsTypes?: Array<"gazon" | "borders" | "bomen" | "universeel">;
  oppervlakte?: number;
  aantalBomen?: number;
  seizoen?: "voorjaar" | "zomer" | "najaar" | "heel_jaar";
  productType?: "basis" | "premium" | "bio";
  frequentie?: "1x" | "2x" | "3x" | "4x";
  kalkbehandeling?: boolean;
  grondanalyse?: boolean;
  onkruidvrijeBemesting?: boolean;
}

export interface GazonanalyseProblemenData {
  mos?: boolean;
  mosPercentage?: number;
  kalePlekken?: boolean;
  kalePlekkenM2?: number;
  onkruid?: boolean;
  onkruidType?: "breed" | "smal" | "klaver";
  verdroging?: boolean;
  wateroverlast?: boolean;
  schaduw?: boolean;
  schaduwPercentage?: number;
  verzuring?: boolean;
  muizenMollen?: boolean;
}

export interface GazonanalyseOnderhoudData {
  conditieScore?: number;
  problemen?: GazonanalyseProblemenData;
  oppervlakte?: number;
  huidigGrastype?: "onbekend" | "sport" | "sier" | "schaduw" | "mix";
  bodemtype?: "zand" | "klei" | "veen" | "leem";
  herstelacties?: Array<"verticuteren" | "doorzaaien" | "nieuwe_grasmat" | "plaggen" | "bijzaaien">;
  drainage?: boolean;
  bekalken?: boolean;
  robotmaaierAdvies?: boolean;
  beregeningsadvies?: boolean;
}

export interface MollenbestrijdingOnderhoudData {
  aantalMolshopen?: number;
  oppervlakte?: number;
  tuinType?: "gazon" | "border" | "moestuin" | "gemengd";
  ernst?: number;
  pakket?: "basis" | "premium" | "premium_plus";
  gazonherstel?: boolean;
  gazonherstelM2?: number;
  preventiefGaas?: boolean;
  preventiefGaasM2?: number;
  terugkeerCheck?: boolean;
}

// Gecombineerd onderhoud scope data type
export interface OnderhoudScopeData {
  tuinOppervlakte?: number;
  gras?: GrasOnderhoudData;
  borders?: BordersOnderhoudData;
  heggen?: HeggenOnderhoudData;
  bomen?: BomenOnderhoudData;
  overig?: OverigeOnderhoudData;
  reiniging?: ReinigingOnderhoudData;
  bemesting?: BemestingOnderhoudData;
  gazonanalyse?: GazonanalyseOnderhoudData;
  mollenbestrijding?: MollenbestrijdingOnderhoudData;
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
  reiniging?: number;
  bemesting?: number;
  gazonanalyse?: number;
  mollenbestrijding?: number;
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
