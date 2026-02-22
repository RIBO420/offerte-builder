/**
 * Offerte Calculator
 *
 * Converts scope data into calculated offerte regels (line items) using:
 * - Normuren (standard hours per activity)
 * - Correctiefactoren (correction factors for bereikbaarheid, achterstalligheid, etc.)
 * - Producten (materials with prices)
 * - Instellingen (settings: hourly rate, margin, VAT)
 */

import type {
  Bereikbaarheid,
  Achterstalligheid,
  GrondwerkData,
  BestratingData,
  BordersData,
  GrasData,
  HoutwerkData,
  WaterElektraData,
  SpecialsData,
  GrasOnderhoudData,
  BordersOnderhoudData,
  HeggenOnderhoudData,
  BomenOnderhoudData,
  OverigeOnderhoudData,
} from "@/types/offerte";
import { v4 as uuidv4 } from "uuid";
import { roundToQuarter } from "@/lib/time-utils";

// ==================== CONSTANTS ====================

// Grondwerk diepte in meters
const DIEPTE_METERS = {
  licht: 0.2,
  standaard: 0.4,
  zwaar: 0.6,
} as const;

// Materiaal hoeveelheden per m2
const ZAND_M3_PER_M2 = 0.05;
const SCHORS_M3_PER_M2 = 0.05;
const GRASZAAD_KG_PER_M2 = 0.035;

// Beplantingsintensiteit: planten per m2
const PLANTEN_PER_M2 = {
  weinig: 3,
  gemiddeld: 6,
  veel: 10,
} as const;

// Houtwerk berekeningen
const SCHUTTINGPLANKEN_PER_METER = 6;
const PAAL_AFSTAND_METERS = 2;
const VLONDERPLANKEN_PER_M2 = 7;
const VLONDER_EXTRA_FUNDERING_PUNTEN = 4;
const PERGOLA_FUNDERING_PUNTEN = 4;

// Specials installatie uren
const INSTALLATIE_UREN = {
  jacuzzi: 8,
  sauna: 6,
  prefab: 4,
  default: 4,
} as const;

// Onderhoud factoren
const SNOEISEL_VOLUME_FACTOR = 0.3;
const HOOGTE_TOESLAG_FACTOR = 1.3;
const HOOGTE_DREMPEL_METERS = 2;

// Verlichting berekeningen
const SLEUF_LENGTE_PER_LICHTPUNT = 5;

// Overig onderhoud uren per eenheid
const BLADRUIMEN_UREN_DEFAULT = 2;
const TERRAS_REINIGEN_UREN_PER_M2 = 0.05;
const ONKRUID_BESTRATING_UREN_PER_M2 = 0.03;
const AFWATERING_UREN_PER_PUNT = 0.25;

// ==================== NIEUWE CONSTANTEN ====================

// Fundering materiaalkosten per m³
const FUNDERING_PRIJZEN = {
  gebrokenPuin: 25,    // €/m³
  straatzand: 18,       // €/m³
  brekerszand: 35,      // €/m³
  stabiliser: 45,       // €/m³ (cement stabilisatie)
} as const;

// Funderingsopbouw per bestratingtype (dikte in cm)
const FUNDERING_PER_TYPE = {
  pad: { gebrokenPuin: 10, zand: 5 },
  oprit: { gebrokenPuin: 20, brekerszand: 5 },
  terrein: { gebrokenPuin: 35, brekerszand: 5, stabiliser: true },
} as const;

// Kunstgras
const KUNSTGRAS_PRIJS_PER_M2 = 45; // € per m²

// Drainage
const DRAINAGE_PVC_PRIJS_PER_M = 12;   // € per meter PVC-buis
const DRAINAGE_KOKOS_PRIJS_PER_M = 8;  // € per meter kokos omhulsel

// Opsluitbanden
const OPSLUITBAND_PRIJS_PER_M = 15; // € per lopende meter

// Bodemverbetering
const BODEMVERBETERING_PRIJS_PER_M3 = 35; // € per m³
const BODEMVERBETERING_DIEPTE = 0.3; // 30 cm diepte

// Offerte overhead
const OFFERTE_OVERHEAD = 200; // € vast bedrag per offerte

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

export interface ScopeMarges {
  grondwerk?: number;
  bestrating?: number;
  borders?: number;
  gras?: number;
  houtwerk?: number;
  water_elektra?: number;
  specials?: number;
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

// ==================== NIEUWE ONDERHOUD SCOPE DATA TYPES ====================

export interface HeggenOnderhoudExtendedData {
  lengte: number;
  hoogte: number;
  breedte: number;
  snoei: "zijkanten" | "bovenkant" | "beide";
  afvoerSnoeisel: boolean;
  haagsoort?: "liguster" | "beuk" | "taxus" | "conifeer" | "buxus";
  hoogwerkerNodig?: boolean;
  snoeifrequentie?: 1 | 2 | 3;
  ondergrond?: "bestrating" | "gras" | "grind" | "border";
}

export interface BomenOnderhoudExtendedData {
  aantalBomen: number;
  snoei: "licht" | "zwaar";
  hoogteklasse: "laag" | "middel" | "hoog" | "zeer_hoog";
  hoogteMeter?: number;
  afvoer: boolean;
  kroondiameter?: number;
  inspectie?: "geen" | "visueel" | "gecertificeerd";
  nabijStraat?: boolean;
  nabijGebouw?: boolean;
  nabijKabels?: boolean;
}

export interface ReinigingOnderhoudData {
  // Terrasreiniging
  terrasReinigen?: boolean;
  terrasOppervlakte?: number;
  terrasType?: "keramisch" | "beton" | "klinkers" | "natuursteen" | "hout";
  // Bladruimen
  bladruimen?: boolean;
  bladruimenOppervlakte?: number;
  bladruimenType?: "eenmalig" | "seizoen";
  // Onkruid bestrating
  onkruidBestrating?: boolean;
  onkruidOppervlakte?: number;
  onkruidMethode?: "handmatig" | "branden" | "heet_water" | "chemisch";
  // Algereiniging
  algereiniging?: boolean;
  algeOppervlakte?: number;
}

export interface BemestingOnderhoudData {
  oppervlakte: number;
  bemestingstype?: "basis" | "premium" | "bio";
  frequentie?: 1 | 2 | 3;
  kalkbehandeling?: boolean;
  grondanalyse?: boolean;
}

export interface GazonanalyseOnderhoudData {
  oppervlakte: number;
  herstelacties?: {
    verticuteren?: boolean;
    doorzaaien?: boolean;
    nieuweGrasmat?: boolean;
    plaggen?: boolean;
    bijzaaienKalePlekken?: boolean;
    kalePlekkOppervlakte?: number;
  };
  bekalken?: boolean;
  drainage?: boolean;
}

export type MollenbestrijdingPakket = "basis" | "premium" | "premium_plus";

export interface MollenbestrijdingOnderhoudData {
  pakket: MollenbestrijdingPakket;
  aanvullend?: {
    gazonherstel?: boolean;
    geschatteM2?: number;
    preventiefGaas?: boolean;
    gaasOppervlakte?: number;
    terugkeerCheck?: boolean;
  };
}

export interface Normuur {
  _id: string;
  activiteit: string;
  scope: string;
  normuurPerEenheid: number;
  eenheid: string;
  omschrijving?: string;
}

export interface Correctiefactor {
  _id: string;
  type: string;
  waarde: string;
  factor: number;
  omschrijving?: string;
}

export interface Product {
  _id: string;
  productnaam: string;
  categorie: string;
  inkoopprijs: number;
  verkoopprijs: number;
  eenheid: string;
  verliespercentage: number;
}

export interface Instellingen {
  uurtarief: number;
  standaardMargePercentage: number;
  btwPercentage: number;
}

export interface CalculationContext {
  normuren: Normuur[];
  correctiefactoren: Correctiefactor[];
  producten: Product[];
  instellingen: Instellingen;
  bereikbaarheid: Bereikbaarheid;
  achterstalligheid?: Achterstalligheid;
}

// Get correction factor value
function getCorrectionFactor(
  correctiefactoren: Correctiefactor[],
  type: string,
  waarde: string
): number {
  const factor = correctiefactoren.find(
    (cf) => cf.type === type && cf.waarde === waarde
  );
  return factor?.factor ?? 1.0;
}

// Find normuur by activity and scope
function findNormuur(
  normuren: Normuur[],
  scope: string,
  activiteit: string
): Normuur | undefined {
  return normuren.find(
    (n) => n.scope === scope && n.activiteit.toLowerCase().includes(activiteit.toLowerCase())
  );
}

// Find product by name (partial match)
function findProduct(
  producten: Product[],
  searchTerm: string
): Product | undefined {
  return producten.find(
    (p) => p.productnaam.toLowerCase().includes(searchTerm.toLowerCase())
  );
}

// Generate unique ID
function generateId(): string {
  return `regel_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Calculate labor hours and apply corrections
function calculateLaborHours(
  baseHours: number,
  bereikbaarheidFactor: number,
  snijwerkFactor: number = 1.0,
  achterstalligheidFactor: number = 1.0
): number {
  return baseHours * bereikbaarheidFactor * snijwerkFactor * achterstalligheidFactor;
}

// Create labor regel
function createArbeidsRegel(
  scope: string,
  omschrijving: string,
  uren: number,
  uurtarief: number
): OfferteRegel {
  const roundedUren = roundToQuarter(uren);
  return {
    id: generateId(),
    scope,
    omschrijving,
    eenheid: "uur",
    hoeveelheid: roundedUren,
    prijsPerEenheid: uurtarief,
    totaal: Math.round(roundedUren * uurtarief * 100) / 100,
    type: "arbeid",
  };
}

// Create material regel
function createMateriaalRegel(
  scope: string,
  omschrijving: string,
  hoeveelheid: number,
  eenheid: string,
  prijsPerEenheid: number,
  verliespercentage: number = 0
): OfferteRegel {
  const hoeveelheidMetVerlies = hoeveelheid * (1 + verliespercentage / 100);
  return {
    id: generateId(),
    scope,
    omschrijving,
    eenheid,
    hoeveelheid: Math.round(hoeveelheidMetVerlies * 100) / 100,
    prijsPerEenheid,
    totaal: Math.round(hoeveelheidMetVerlies * prijsPerEenheid * 100) / 100,
    type: "materiaal",
  };
}

// ==================== AANLEG SCOPE CALCULATIONS ====================

function calculateGrondwerk(
  data: GrondwerkData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  // Ontgraven - diepte is already "licht" | "standaard" | "zwaar"
  if (data.oppervlakte && data.oppervlakte > 0) {
    const diepteType = data.diepte || "standaard";
    const normuur = findNormuur(normuren, "grondwerk", `ontgraven ${diepteType}`);

    if (normuur) {
      const baseHours = data.oppervlakte * normuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("grondwerk", `Ontgraven ${diepteType}`, totalHours, uurtarief));
    }
  }

  // Afvoer grond - use afvoerGrond boolean, estimate volume from oppervlakte and diepte
  if (data.afvoerGrond && data.oppervlakte > 0) {
    // Estimate afvoer volume: oppervlakte * diepte in meters
    const diepteMeters = DIEPTE_METERS[data.diepte || "standaard"];
    const afvoerM3 = data.oppervlakte * diepteMeters;

    const normuur = findNormuur(normuren, "grondwerk", "afvoeren");
    if (normuur) {
      const baseHours = afvoerM3 * normuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("grondwerk", "Grond afvoeren", totalHours, uurtarief));
    }

    // Material cost for disposal
    const afvoerProduct = findProduct(context.producten, "afvoer grond");
    if (afvoerProduct) {
      regels.push(createMateriaalRegel(
        "grondwerk",
        "Afvoer grond (stort)",
        afvoerM3,
        "m³",
        afvoerProduct.verkoopprijs,
        0
      ));
    }
  }

  return regels;
}

function calculateBestrating(
  data: BestratingData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, producten, instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const snijwerkFactor = getCorrectionFactor(correctiefactoren, "snijwerk", data.snijwerk || "laag");
  const uurtarief = instellingen.uurtarief;

  if (!data.oppervlakte || data.oppervlakte <= 0) return regels;

  // Determine labor activity based on type (typeBestrating property)
  const bestratingType = data.typeBestrating || "tegel";
  let activiteitNaam = "tegels leggen";
  if (bestratingType === "klinker") activiteitNaam = "klinkers leggen";
  if (bestratingType === "natuursteen") activiteitNaam = "natuursteen leggen";

  const normuur = findNormuur(normuren, "bestrating", activiteitNaam);
  if (normuur) {
    const baseHours = data.oppervlakte * normuur.normuurPerEenheid;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor, snijwerkFactor);
    const typeLabel = bestratingType === "tegel" ? "Tegels" : bestratingType === "klinker" ? "Klinkers" : "Natuursteen";
    regels.push(createArbeidsRegel("bestrating", `${typeLabel} leggen`, totalHours, uurtarief));
  }

  // Zandbed
  const zandNormuur = findNormuur(normuren, "bestrating", "zandbed");
  if (zandNormuur) {
    const baseHours = data.oppervlakte * zandNormuur.normuurPerEenheid;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("bestrating", "Zandbed aanbrengen", totalHours, uurtarief));
  }

  // Materials - Straatzand
  const straatzand = findProduct(producten, "straatzand");
  if (straatzand) {
    const zandM3 = data.oppervlakte * ZAND_M3_PER_M2;
    regels.push(createMateriaalRegel(
      "bestrating",
      "Straatzand",
      zandM3,
      "m³",
      straatzand.verkoopprijs,
      straatzand.verliespercentage
    ));
  }

  // Opsluitbanden (roughly perimeter = 4 * sqrt(area) as estimate)
  if (data.onderbouw?.opsluitbanden) {
    const perimeter = 4 * Math.sqrt(data.oppervlakte);
    const opsluitNormuur = findNormuur(normuren, "bestrating", "opsluitbanden");
    if (opsluitNormuur) {
      const baseHours = perimeter * opsluitNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("bestrating", "Opsluitbanden plaatsen", totalHours, uurtarief));
    }

    const opsluitProduct = findProduct(producten, "opsluitband");
    if (opsluitProduct) {
      regels.push(createMateriaalRegel(
        "bestrating",
        "Opsluitband 100x20x6",
        perimeter,
        "stuk",
        opsluitProduct.verkoopprijs,
        opsluitProduct.verliespercentage
      ));
    }
  }

  // Funderingsberekening per bestratingtype
  if (data.bestratingtype) {
    const funderingConfig = FUNDERING_PER_TYPE[data.bestratingtype];
    const oppervlakte = data.oppervlakte;

    // Gebroken puin
    if (funderingConfig.gebrokenPuin) {
      const puinM3 = oppervlakte * (funderingConfig.gebrokenPuin / 100);
      regels.push(createMateriaalRegel(
        "bestrating",
        `Gebroken puin (${funderingConfig.gebrokenPuin} cm)`,
        puinM3, "m³",
        FUNDERING_PRIJZEN.gebrokenPuin, 5
      ));
    }

    // Zand of brekerszand
    if ('zand' in funderingConfig) {
      const zandM3 = oppervlakte * (funderingConfig.zand / 100);
      regels.push(createMateriaalRegel(
        "bestrating",
        `Straatzand (${funderingConfig.zand} cm)`,
        zandM3, "m³",
        FUNDERING_PRIJZEN.straatzand, 5
      ));
    }
    if ('brekerszand' in funderingConfig) {
      const brekersM3 = oppervlakte * (funderingConfig.brekerszand / 100);
      regels.push(createMateriaalRegel(
        "bestrating",
        `Brekerszand (${funderingConfig.brekerszand} cm)`,
        brekersM3, "m³",
        FUNDERING_PRIJZEN.brekerszand, 5
      ));
    }
    if ('stabiliser' in funderingConfig && funderingConfig.stabiliser) {
      const stabM3 = oppervlakte * 0.05; // 5cm stabiliser laag
      regels.push(createMateriaalRegel(
        "bestrating",
        "Stabiliser (cement)",
        stabM3, "m³",
        FUNDERING_PRIJZEN.stabiliser, 0
      ));
    }
  }

  // Multi-zone bestrating
  if (data.zones && data.zones.length > 0) {
    for (const zone of data.zones) {
      const zoneFundering = FUNDERING_PER_TYPE[zone.type];
      const zoneOpp = zone.oppervlakte;

      // Gebroken puin per zone
      if (zoneFundering.gebrokenPuin) {
        const puinM3 = zoneOpp * (zoneFundering.gebrokenPuin / 100);
        regels.push(createMateriaalRegel(
          "bestrating",
          `Zone ${zone.type}: Gebroken puin (${zoneFundering.gebrokenPuin} cm)`,
          puinM3, "m³",
          FUNDERING_PRIJZEN.gebrokenPuin, 5
        ));
      }

      // Zand of brekerszand per zone
      if ('zand' in zoneFundering) {
        const zandM3 = zoneOpp * (zoneFundering.zand / 100);
        regels.push(createMateriaalRegel(
          "bestrating",
          `Zone ${zone.type}: Straatzand (${zoneFundering.zand} cm)`,
          zandM3, "m³",
          FUNDERING_PRIJZEN.straatzand, 5
        ));
      }
      if ('brekerszand' in zoneFundering) {
        const brekersM3 = zoneOpp * (zoneFundering.brekerszand / 100);
        regels.push(createMateriaalRegel(
          "bestrating",
          `Zone ${zone.type}: Brekerszand (${zoneFundering.brekerszand} cm)`,
          brekersM3, "m³",
          FUNDERING_PRIJZEN.brekerszand, 5
        ));
      }
      if ('stabiliser' in zoneFundering && zoneFundering.stabiliser) {
        const stabM3 = zoneOpp * 0.05;
        regels.push(createMateriaalRegel(
          "bestrating",
          `Zone ${zone.type}: Stabiliser (cement)`,
          stabM3, "m³",
          FUNDERING_PRIJZEN.stabiliser, 0
        ));
      }
    }
  }

  return regels;
}

function calculateBorders(
  data: BordersData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, producten, instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  if (!data.oppervlakte || data.oppervlakte <= 0) return regels;

  // Grondbewerking
  const grondNormuur = findNormuur(normuren, "borders", "grondbewerking");
  if (grondNormuur) {
    const baseHours = data.oppervlakte * grondNormuur.normuurPerEenheid;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("borders", "Grondbewerking border", totalHours, uurtarief));
  }

  // Planten based on intensity (use beplantingsintensiteit property)
  const intensiteit = data.beplantingsintensiteit || "gemiddeld";
  // Map intensiteit values: weinig->laag, gemiddeld->gemiddeld, veel->hoog
  const intensiteitLevel = intensiteit === "weinig" ? "laag" : intensiteit === "veel" ? "hoog" : "gemiddeld";
  const plantNormuur = findNormuur(normuren, "borders", `planten ${intensiteitLevel}`);
  if (plantNormuur) {
    const baseHours = data.oppervlakte * plantNormuur.normuurPerEenheid;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("borders", `Beplanten (${intensiteit} intensiteit)`, totalHours, uurtarief));
  }

  // Estimate plants per m² based on intensity (weinig/gemiddeld/veel)
  const plantsPerM2 = PLANTEN_PER_M2[intensiteit];
  const bodembekker = findProduct(producten, "bodembedekker");
  if (bodembekker) {
    regels.push(createMateriaalRegel(
      "borders",
      "Bodembedekker (pot 9cm)",
      data.oppervlakte * plantsPerM2,
      "stuk",
      bodembekker.verkoopprijs,
      bodembekker.verliespercentage
    ));
  }

  // Schors (use afwerking property: "geen" | "schors" | "grind")
  if (data.afwerking === "schors" || data.afwerking === "grind") {
    const schorsNormuur = findNormuur(normuren, "borders", "schors");
    if (schorsNormuur) {
      const baseHours = data.oppervlakte * schorsNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("borders", "Schors aanbrengen", totalHours, uurtarief));
    }

    const schorsProduct = findProduct(producten, "boomschors");
    if (schorsProduct) {
      const schorsM3 = data.oppervlakte * SCHORS_M3_PER_M2;
      regels.push(createMateriaalRegel(
        "borders",
        "Boomschors 10-40mm",
        schorsM3,
        "m³",
        schorsProduct.verkoopprijs,
        schorsProduct.verliespercentage
      ));
    }
  }

  // Bodemverbetering
  if (data.bodemverbetering && data.bodemMix && data.oppervlakte > 0) {
    const bodemM3 = data.oppervlakte * BODEMVERBETERING_DIEPTE;
    regels.push(createMateriaalRegel(
      "borders", "Bodemverbetering (nieuwe grondmix)", bodemM3, "m³",
      BODEMVERBETERING_PRIJS_PER_M3, 0
    ));
  }

  return regels;
}

function calculateGras(
  data: GrasData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, producten, instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  if (!data.oppervlakte || data.oppervlakte <= 0) return regels;

  // Ondergrond bewerken
  const ondergrondNormuur = findNormuur(normuren, "gras", "ondergrond");
  if (ondergrondNormuur) {
    const baseHours = data.oppervlakte * ondergrondNormuur.normuurPerEenheid;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("gras", "Ondergrond bewerken", totalHours, uurtarief));
  }

  // Graszoden or inzaaien (use type property: "zaaien" | "graszoden")
  if (data.type === "graszoden") {
    const zodenNormuur = findNormuur(normuren, "gras", "graszoden");
    if (zodenNormuur) {
      const baseHours = data.oppervlakte * zodenNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("gras", "Graszoden leggen", totalHours, uurtarief));
    }

    const zodenProduct = findProduct(producten, "graszoden");
    if (zodenProduct) {
      regels.push(createMateriaalRegel(
        "gras",
        "Graszoden",
        data.oppervlakte,
        "m²",
        zodenProduct.verkoopprijs,
        zodenProduct.verliespercentage
      ));
    }
  } else {
    const zaaiNormuur = findNormuur(normuren, "gras", "zaaien");
    if (zaaiNormuur) {
      const baseHours = data.oppervlakte * zaaiNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("gras", "Gras zaaien", totalHours, uurtarief));
    }

    const zaadProduct = findProduct(producten, "graszaad");
    if (zaadProduct) {
      const zaadKg = data.oppervlakte * GRASZAAD_KG_PER_M2;
      regels.push(createMateriaalRegel(
        "gras",
        "Graszaad",
        zaadKg,
        "kg",
        zaadProduct.verkoopprijs,
        zaadProduct.verliespercentage
      ));
    }
  }

  // Kunstgras optie
  if (data.kunstgras && data.oppervlakte > 0) {
    regels.push(createMateriaalRegel(
      "gras", "Kunstgras", data.oppervlakte, "m²", KUNSTGRAS_PRIJS_PER_M2, 5
    ));
    // Kunstgras leggen arbeid
    const kunstgrasNormuur = findNormuur(normuren, "gras", "kunstgras");
    if (kunstgrasNormuur) {
      const baseHours = data.oppervlakte * kunstgrasNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("gras", "Kunstgras leggen", totalHours, uurtarief));
    }
  }

  // Drainage
  if (data.drainage && data.drainageMeters && data.drainageMeters > 0) {
    regels.push(createMateriaalRegel(
      "gras", "PVC drainagebuis", data.drainageMeters, "m", DRAINAGE_PVC_PRIJS_PER_M, 5
    ));
    regels.push(createMateriaalRegel(
      "gras", "Kokos omhulsel", data.drainageMeters, "m", DRAINAGE_KOKOS_PRIJS_PER_M, 5
    ));
  }

  // Opsluitbanden
  if (data.opsluitbanden && data.opsluitbandenMeters && data.opsluitbandenMeters > 0) {
    regels.push(createMateriaalRegel(
      "gras", "Opsluitbanden", data.opsluitbandenMeters, "m", OPSLUITBAND_PRIJS_PER_M, 5
    ));
  }

  return regels;
}

function calculateHoutwerk(
  data: HoutwerkData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, producten, instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  const typeHoutwerk = data.typeHoutwerk || "schutting";
  const afmeting = data.afmeting || 0;
  if (afmeting <= 0) return regels;

  // Schutting (afmeting is lengte in meters)
  if (typeHoutwerk === "schutting") {
    const schuttingNormuur = findNormuur(normuren, "houtwerk", "schutting");
    if (schuttingNormuur) {
      const baseHours = afmeting * schuttingNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("houtwerk", "Schutting plaatsen", totalHours, uurtarief));
    }

    // Materials
    const plankProduct = findProduct(producten, "schuttingplank");
    if (plankProduct) {
      regels.push(createMateriaalRegel(
        "houtwerk",
        "Schuttingplank 180x15cm",
        afmeting * SCHUTTINGPLANKEN_PER_METER,
        "stuk",
        plankProduct.verkoopprijs,
        plankProduct.verliespercentage
      ));
    }

    const paalProduct = findProduct(producten, "schuttingpaal");
    if (paalProduct) {
      const aantalPalen = Math.ceil(afmeting / PAAL_AFSTAND_METERS) + 1;
      regels.push(createMateriaalRegel(
        "houtwerk",
        "Schuttingpaal 7x7x270cm",
        aantalPalen,
        "stuk",
        paalProduct.verkoopprijs,
        paalProduct.verliespercentage
      ));
    }
  }

  // Vlonder (afmeting is oppervlakte in m²)
  if (typeHoutwerk === "vlonder") {
    const vlonderNormuur = findNormuur(normuren, "houtwerk", "vlonder");
    if (vlonderNormuur) {
      const baseHours = afmeting * vlonderNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("houtwerk", "Vlonder leggen", totalHours, uurtarief));
    }

    const vlonderProduct = findProduct(producten, "vlonderdeel");
    if (vlonderProduct) {
      regels.push(createMateriaalRegel(
        "houtwerk",
        "Vlonderdeel hardhout 21x145mm",
        afmeting * VLONDERPLANKEN_PER_M2,
        "m",
        vlonderProduct.verkoopprijs,
        vlonderProduct.verliespercentage
      ));
    }
  }

  // Pergola
  if (typeHoutwerk === "pergola") {
    const pergolaNormuur = findNormuur(normuren, "houtwerk", "pergola");
    if (pergolaNormuur) {
      const baseHours = afmeting * pergolaNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("houtwerk", "Pergola bouwen", totalHours, uurtarief));
    }
  }

  // Fundering (based on fundering property)
  const funderingType = data.fundering || "standaard";
  // Estimate number of fundering points based on type and size
  const funderingAantal = typeHoutwerk === "schutting" ? Math.ceil(afmeting / PAAL_AFSTAND_METERS) + 1 :
                         typeHoutwerk === "vlonder" ? Math.ceil(afmeting / PAAL_AFSTAND_METERS) + VLONDER_EXTRA_FUNDERING_PUNTEN :
                         typeHoutwerk === "pergola" ? PERGOLA_FUNDERING_PUNTEN : 0;

  if (funderingAantal > 0) {
    const funderingNormuur = findNormuur(normuren, "houtwerk", `fundering ${funderingType}`);
    if (funderingNormuur) {
      const baseHours = funderingAantal * funderingNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("houtwerk", `Fundering plaatsen (${funderingType})`, totalHours, uurtarief));
    }

    const poerProduct = findProduct(producten, "betonpoer");
    if (poerProduct) {
      regels.push(createMateriaalRegel(
        "houtwerk",
        "Betonpoer 30x30x30cm",
        funderingAantal,
        "stuk",
        poerProduct.verkoopprijs,
        poerProduct.verliespercentage
      ));
    }
  }

  return regels;
}

function calculateWaterElektra(
  data: WaterElektraData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, producten, instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  // Use aantalPunten as the number of light points
  const aantalPunten = data.aantalPunten || 0;
  if (data.verlichting === "geen" || aantalPunten <= 0) return regels;

  const sleufLengte = data.sleuvenNodig ? aantalPunten * SLEUF_LENGTE_PER_LICHTPUNT : 0;

  // Sleuven graven (if needed)
  if (sleufLengte > 0) {
    const sleufNormuur = findNormuur(normuren, "water_elektra", "sleuf graven");
    if (sleufNormuur) {
      const baseHours = sleufLengte * sleufNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("water_elektra", "Sleuf graven", totalHours, uurtarief));
    }

    // Kabel leggen
    const kabelNormuur = findNormuur(normuren, "water_elektra", "kabel leggen");
    if (kabelNormuur) {
      const baseHours = sleufLengte * kabelNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("water_elektra", "Kabel leggen", totalHours, uurtarief));
    }

    // Sleuf herstellen
    const herstelNormuur = findNormuur(normuren, "water_elektra", "sleuf herstellen");
    if (herstelNormuur) {
      const baseHours = sleufLengte * herstelNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("water_elektra", "Sleuf herstellen", totalHours, uurtarief));
    }

    // Materials - kabel
    const kabelProduct = findProduct(producten, "kabel");
    if (kabelProduct) {
      regels.push(createMateriaalRegel(
        "water_elektra",
        "Kabel 3x1,5 grond",
        sleufLengte,
        "m",
        kabelProduct.verkoopprijs,
        kabelProduct.verliespercentage
      ));
    }
  }

  // Armaturen (aantalPunten)
  if (aantalPunten > 0) {
    const armatuurNormuur = findNormuur(normuren, "water_elektra", "armatuur");
    if (armatuurNormuur) {
      const baseHours = aantalPunten * armatuurNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("water_elektra", "Armaturen plaatsen", totalHours, uurtarief));
    }

    const grondspotProduct = findProduct(producten, "grondspot");
    if (grondspotProduct) {
      regels.push(createMateriaalRegel(
        "water_elektra",
        "Grondspot LED",
        aantalPunten,
        "stuk",
        grondspotProduct.verkoopprijs,
        grondspotProduct.verliespercentage
      ));
    }

    // Lasdozen
    const lasdoosProduct = findProduct(producten, "lasdoos");
    if (lasdoosProduct) {
      regels.push(createMateriaalRegel(
        "water_elektra",
        "Lasdoos waterdicht",
        aantalPunten,
        "stuk",
        lasdoosProduct.verkoopprijs,
        lasdoosProduct.verliespercentage
      ));
    }
  }

  return regels;
}

function calculateSpecials(
  data: SpecialsData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  // Add special items (jacuzzi, sauna, prefab elements)
  // Each item type has estimated hours for installation
  if (data.items && Array.isArray(data.items)) {
    for (const item of data.items) {
      const estimatedHours = INSTALLATIE_UREN[item.type] ?? INSTALLATIE_UREN.default;
      const totalHours = calculateLaborHours(estimatedHours, bereikbaarheidFactor);
      const description = item.omschrijving || `${item.type} plaatsen`;
      regels.push(createArbeidsRegel("specials", description, totalHours, uurtarief));
    }
  }

  return regels;
}

// ==================== ONDERHOUD SCOPE CALCULATIONS ====================

function calculateGrasOnderhoud(
  data: GrasOnderhoudData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, instellingen, bereikbaarheid, achterstalligheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const achterstalligheidFactor = achterstalligheid
    ? getCorrectionFactor(correctiefactoren, "achterstalligheid", achterstalligheid)
    : 1.0;
  const uurtarief = instellingen.uurtarief;

  // Use grasOppervlakte property
  const oppervlakte = data.grasOppervlakte || 0;
  if (!data.grasAanwezig || oppervlakte <= 0) return regels;

  // Maaien
  if (data.maaien) {
    const normuur = findNormuur(normuren, "gras_onderhoud", "maaien");
    if (normuur) {
      const baseHours = oppervlakte * normuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor, 1.0, achterstalligheidFactor);
      regels.push(createArbeidsRegel("gras", "Gras maaien", totalHours, uurtarief));
    }
  }

  // Kanten steken - estimate perimeter as 4 * sqrt(oppervlakte)
  if (data.kantenSteken) {
    const kantenLengte = 4 * Math.sqrt(oppervlakte);
    const normuur = findNormuur(normuren, "gras_onderhoud", "kanten");
    if (normuur) {
      const baseHours = kantenLengte * normuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor, 1.0, achterstalligheidFactor);
      regels.push(createArbeidsRegel("gras", "Kanten steken", totalHours, uurtarief));
    }
  }

  // Verticuteren
  if (data.verticuteren) {
    const normuur = findNormuur(normuren, "gras_onderhoud", "verticuteren");
    if (normuur) {
      const baseHours = oppervlakte * normuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("gras", "Verticuteren", totalHours, uurtarief));
    }
  }

  return regels;
}

function calculateBordersOnderhoud(
  data: BordersOnderhoudData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, instellingen, bereikbaarheid, achterstalligheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const achterstalligheidFactor = achterstalligheid
    ? getCorrectionFactor(correctiefactoren, "achterstalligheid", achterstalligheid)
    : 1.0;
  const uurtarief = instellingen.uurtarief;

  // Use borderOppervlakte property
  const oppervlakte = data.borderOppervlakte || 0;
  if (oppervlakte <= 0) return regels;

  // Wieden - use onderhoudsintensiteit (verplicht)
  if (data.onkruidVerwijderen) {
    // Map intensiteit: weinig->weinig, gemiddeld->gemiddeld, veel->veel
    const intensiteit = data.onderhoudsintensiteit || "gemiddeld";
    const normuur = findNormuur(normuren, "borders_onderhoud", `wieden ${intensiteit}`);
    if (normuur) {
      const baseHours = oppervlakte * normuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor, 1.0, achterstalligheidFactor);
      regels.push(createArbeidsRegel("borders", `Wieden (${intensiteit})`, totalHours, uurtarief));
    }
  }

  // Snoei - use snoeiInBorders: "geen" | "licht" | "zwaar"
  if (data.snoeiInBorders && data.snoeiInBorders !== "geen") {
    const snoeiType = data.snoeiInBorders; // "licht" or "zwaar"
    const normuur = findNormuur(normuren, "borders_onderhoud", `snoei ${snoeiType}`);
    if (normuur) {
      const baseHours = oppervlakte * normuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor, 1.0, achterstalligheidFactor);
      regels.push(createArbeidsRegel("borders", `Snoei borders (${snoeiType})`, totalHours, uurtarief));
    }
  }

  return regels;
}

function calculateHeggenOnderhoud(
  data: HeggenOnderhoudData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, instellingen, bereikbaarheid, achterstalligheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const achterstalligheidFactor = achterstalligheid
    ? getCorrectionFactor(correctiefactoren, "achterstalligheid", achterstalligheid)
    : 1.0;
  const uurtarief = instellingen.uurtarief;

  // Calculate volume (L × H × B) - all three are verplicht
  const volume = (data.lengte || 0) * (data.hoogte || 0) * (data.breedte || 0);
  if (volume <= 0) return regels;

  // Hoogte toeslag for height > 2m (FR-05 requirement)
  let hoogteFactor = 1.0;
  if (data.hoogte && data.hoogte > HOOGTE_DREMPEL_METERS) {
    hoogteFactor = HOOGTE_TOESLAG_FACTOR;
  }

  // Heg snoeien
  const snoeienNormuur = findNormuur(normuren, "heggen_onderhoud", "heg snoeien");
  if (snoeienNormuur) {
    const baseHours = volume * snoeienNormuur.normuurPerEenheid;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor, hoogteFactor, achterstalligheidFactor);
    regels.push(createArbeidsRegel("heggen", "Heg snoeien", totalHours, uurtarief));
  }

  // Snoeisel afvoeren (use afvoerSnoeisel property)
  if (data.afvoerSnoeisel) {
    const afvoerNormuur = findNormuur(normuren, "heggen_onderhoud", "snoeisel afvoeren");
    if (afvoerNormuur) {
      const snoeiselVolume = volume * SNOEISEL_VOLUME_FACTOR;
      const baseHours = snoeiselVolume * afvoerNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("heggen", "Snoeisel afvoeren", totalHours, uurtarief));
    }
  }

  return regels;
}

function calculateBomenOnderhoud(
  data: BomenOnderhoudData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, instellingen, bereikbaarheid, achterstalligheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const achterstalligheidFactor = achterstalligheid
    ? getCorrectionFactor(correctiefactoren, "achterstalligheid", achterstalligheid)
    : 1.0;
  const uurtarief = instellingen.uurtarief;

  if (!data.aantalBomen || data.aantalBomen <= 0) return regels;

  // Use snoei property which is "licht" | "zwaar"
  const snoeiType = data.snoei || "licht";
  const normuur = findNormuur(normuren, "bomen_onderhoud", `boom snoeien ${snoeiType}`);

  if (normuur) {
    const baseHours = data.aantalBomen * normuur.normuurPerEenheid;
    // Apply height factor for "hoog" hoogteklasse
    const hoogteFactor = data.hoogteklasse === "hoog" ? HOOGTE_TOESLAG_FACTOR : 1.0;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor, hoogteFactor, achterstalligheidFactor);
    regels.push(createArbeidsRegel("bomen", `Bomen snoeien (${snoeiType})`, totalHours, uurtarief));
  }

  return regels;
}

function calculateOverigOnderhoud(
  data: OverigeOnderhoudData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  // Bladruimen
  if (data.bladruimen) {
    const estimatedHours = BLADRUIMEN_UREN_DEFAULT;
    const totalHours = calculateLaborHours(estimatedHours, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("overig", "Bladruimen", totalHours, uurtarief));
  }

  // Terras reinigen
  if (data.terrasReinigen && data.terrasOppervlakte && data.terrasOppervlakte > 0) {
    const baseHours = data.terrasOppervlakte * TERRAS_REINIGEN_UREN_PER_M2;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("overig", "Terras reinigen", totalHours, uurtarief));
  }

  // Onkruid bestrating
  if (data.onkruidBestrating && data.bestratingOppervlakte && data.bestratingOppervlakte > 0) {
    const baseHours = data.bestratingOppervlakte * ONKRUID_BESTRATING_UREN_PER_M2;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("overig", "Onkruid bestrating verwijderen", totalHours, uurtarief));
  }

  // Afwatering controleren
  if (data.afwateringControleren && data.aantalAfwateringspunten && data.aantalAfwateringspunten > 0) {
    const baseHours = data.aantalAfwateringspunten * AFWATERING_UREN_PER_PUNT;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("overig", "Afwatering controleren", totalHours, uurtarief));
  }

  // Overig uren (custom work specified in hours)
  if (data.overigUren && data.overigUren > 0) {
    const totalHours = calculateLaborHours(data.overigUren, bereikbaarheidFactor);
    const description = data.overigNotities || "Overige werkzaamheden";
    regels.push(createArbeidsRegel("overig", description, totalHours, uurtarief));
  }

  return regels;
}

// ==================== UITGEBREIDE EN NIEUWE ONDERHOUD BEREKENINGEN ====================

// Constanten voor nieuwe berekeningen
const HAAGSOORT_FACTOR: Record<string, number> = {
  liguster: 1.0,
  beuk: 1.0,
  taxus: 1.3,
  conifeer: 1.4,
  buxus: 0.8,
};

const HOOGWERKER_PRIJS_PER_DAG = 185;
const HOOGWERKER_DREMPEL_HOOGTE = 4;

const TERRAS_TYPE_FACTOR: Record<string, number> = {
  keramisch: 1.2,
  beton: 1.0,
  klinkers: 1.1,
  natuursteen: 1.5,
  hout: 1.3,
};

const REINIGINGSMIDDEL_PRIJS_PER_M2 = 2.0;
const ANTI_ALG_PRIJS_PER_M2 = 1.5;

const BEMESTING_PRODUCT_PRIJS: Record<string, number> = {
  basis: 0.80,
  premium: 1.50,
  bio: 2.00,
};

const BEMESTING_NORMUUR_PER_M2 = 0.005;
const KALK_PRIJS_PER_M2 = 0.50;
const KALK_NORMUUR_PER_M2 = 0.003;
const GRONDANALYSE_PRIJS = 49;
const BEMESTING_MARGE_OVERRIDE = 70;

const MACHINE_VERTICUTEREN_PER_DAG = 80;
const ZAAD_DOORZAAIEN_PRIJS_PER_M2 = 3.0;
const GRASZODEN_NIEUW_PRIJS_PER_M2 = 12.0;
const ZAAD_BIJZAAIEN_PRIJS_PER_M2 = 5.0;
const BEKALKEN_PRIJS_PER_M2 = 0.50;
const BEKALKEN_NORMUUR_PER_M2 = 0.003;

const MOLLEN_KLEMMEN_BASIS = 35;
const MOLLEN_KLEMMEN_PREMIUM = 75;
const MOLLEN_KLEMMEN_PREMIUM_PLUS = 120;
const MOLHERSTEL_ZAAD_PRIJS_PER_M2 = 5.0;
const MOLLEN_GAAS_PRIJS_PER_M2 = 4.0;

/**
 * Uitgebreide versie van heg-onderhoud berekening.
 * Voegt haagsoort-factor, hoogwerker, frequentie en ondergrond-toeslag toe
 * bovenop de bestaande volume-gebaseerde berekening.
 */
function calculateHeggenOnderhoudExtended(
  data: HeggenOnderhoudExtendedData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, instellingen, bereikbaarheid, achterstalligheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const achterstalligheidFactor = achterstalligheid
    ? getCorrectionFactor(correctiefactoren, "achterstalligheid", achterstalligheid)
    : 1.0;
  const uurtarief = instellingen.uurtarief;

  const volume = (data.lengte || 0) * (data.hoogte || 0) * (data.breedte || 0);
  if (volume <= 0) return regels;

  // Haagsoort factor (standaard 1.0 voor onbekende soort)
  const haagsoortFactor = data.haagsoort ? (HAAGSOORT_FACTOR[data.haagsoort] ?? 1.0) : 1.0;

  // Hoogte toeslag: hoogte > 2m geeft bestaande factor, hoogte > 4m geeft hogere factor
  let hoogteFactor = 1.0;
  if (data.hoogte && data.hoogte > HOOGTE_DREMPEL_METERS) {
    hoogteFactor = HOOGTE_TOESLAG_FACTOR;
  }

  // Ondergrond toeslag
  let ondergrondFactor = 1.0;
  if (data.ondergrond === "bestrating") {
    ondergrondFactor = 1.15;
  } else if (data.ondergrond === "border") {
    ondergrondFactor = 1.05;
  }

  // Frequentie (standaard 1x per jaar)
  const frequentie = data.snoeifrequentie ?? 1;

  // Heg snoeien (arbeid)
  const snoeienNormuur = findNormuur(normuren, "heggen_onderhoud", "heg snoeien");
  if (snoeienNormuur) {
    const baseHours = volume * snoeienNormuur.normuurPerEenheid;
    const totalHoursPerBeurt = calculateLaborHours(
      baseHours,
      bereikbaarheidFactor,
      hoogteFactor * haagsoortFactor * ondergrondFactor,
      achterstalligheidFactor
    );
    const totalHoursJaar = totalHoursPerBeurt * frequentie;
    const frequentieLabel = frequentie > 1 ? ` (${frequentie}x per jaar)` : "";
    regels.push(createArbeidsRegel("heggen", `Heg snoeien${frequentieLabel}`, totalHoursJaar, uurtarief));
  }

  // Snoeisel afvoeren
  if (data.afvoerSnoeisel) {
    const afvoerNormuur = findNormuur(normuren, "heggen_onderhoud", "snoeisel afvoeren");
    if (afvoerNormuur) {
      const snoeiselVolume = volume * SNOEISEL_VOLUME_FACTOR;
      const baseHours = snoeiselVolume * afvoerNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor) * frequentie;
      regels.push(createArbeidsRegel("heggen", "Snoeisel afvoeren", totalHours, uurtarief));
    }
  }

  // Hoogwerker: nodig als hoogte > 4m of expliciet aangevraagd
  const hoogwerkerNodig =
    data.hoogwerkerNodig === true || (data.hoogte !== undefined && data.hoogte > HOOGWERKER_DREMPEL_HOOGTE);
  if (hoogwerkerNodig && data.lengte && data.lengte > 0) {
    const dagenInzet = Math.ceil(data.lengte / 10) * frequentie;
    const hoogwerkerTotaal = dagenInzet * HOOGWERKER_PRIJS_PER_DAG;
    regels.push({
      id: generateId(),
      scope: "heggen",
      omschrijving: `Hoogwerker huur (${dagenInzet} dag${dagenInzet > 1 ? "en" : ""})`,
      eenheid: "dag",
      hoeveelheid: dagenInzet,
      prijsPerEenheid: HOOGWERKER_PRIJS_PER_DAG,
      totaal: Math.round(hoogwerkerTotaal * 100) / 100,
      type: "machine",
    });
  }

  return regels;
}

/**
 * Uitgebreide versie van boom-onderhoud berekening.
 * Voegt uitgebreide hoogtecategorieën, boominspectie, veiligheidstoeslagen
 * en kroondiameter-gebaseerde afvoerberekening toe.
 */
function calculateBomenOnderhoudExtended(
  data: BomenOnderhoudExtendedData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, instellingen, bereikbaarheid, achterstalligheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const achterstalligheidFactor = achterstalligheid
    ? getCorrectionFactor(correctiefactoren, "achterstalligheid", achterstalligheid)
    : 1.0;
  const uurtarief = instellingen.uurtarief;

  if (!data.aantalBomen || data.aantalBomen <= 0) return regels;

  // Uitgebreide hoogtecategorie factor
  let hoogteFactor = 1.0;
  if (data.hoogteklasse === "hoog" || (data.hoogteMeter !== undefined && data.hoogteMeter > 4)) {
    hoogteFactor = 1.5;
  }
  if (data.hoogteklasse === "zeer_hoog" || (data.hoogteMeter !== undefined && data.hoogteMeter > 10)) {
    hoogteFactor = 2.5;
  }

  // Veiligheidstoeslag (cumulatief)
  let veiligheidsFactor = 1.0;
  if (data.nabijStraat) veiligheidsFactor += 0.20;
  if (data.nabijGebouw) veiligheidsFactor += 0.10;
  if (data.nabijKabels) veiligheidsFactor += 0.15;

  // Boom snoeien (arbeid)
  const snoeiType = data.snoei || "licht";
  const normuur = findNormuur(normuren, "bomen_onderhoud", `boom snoeien ${snoeiType}`);
  if (normuur) {
    const baseHours = data.aantalBomen * normuur.normuurPerEenheid;
    const totalHours = calculateLaborHours(
      baseHours,
      bereikbaarheidFactor,
      hoogteFactor * veiligheidsFactor,
      achterstalligheidFactor
    );
    regels.push(createArbeidsRegel("bomen", `Bomen snoeien (${snoeiType})`, totalHours, uurtarief));
  }

  // Boominspectie
  if (data.inspectie && data.inspectie !== "geen") {
    if (data.inspectie === "visueel") {
      const inspectieUren = 0.5 * data.aantalBomen;
      const totalHours = calculateLaborHours(inspectieUren, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("bomen", "Boominspectie (visueel)", totalHours, uurtarief));
    } else if (data.inspectie === "gecertificeerd") {
      const inspectiePrijs = 200 * data.aantalBomen;
      regels.push({
        id: generateId(),
        scope: "bomen",
        omschrijving: "Boominspectie (gecertificeerd)",
        eenheid: "boom",
        hoeveelheid: data.aantalBomen,
        prijsPerEenheid: 200,
        totaal: Math.round(inspectiePrijs * 100) / 100,
        type: "arbeid",
      });
    }
  }

  // Afvoer snoeihout op basis van kroondiameter
  if (data.afvoer) {
    const kroondiameter = data.kroondiameter ?? 3;
    const afvoerUren = kroondiameter * kroondiameter * 0.1 * data.aantalBomen;
    const afvoerNormuur = findNormuur(normuren, "bomen_onderhoud", "afvoer");
    if (afvoerNormuur) {
      const baseHours = afvoerUren * afvoerNormuur.normuurPerEenheid;
      const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("bomen", "Snoeihout afvoeren", totalHours, uurtarief));
    } else {
      // Fallback: gebruik afvoerUren direct als arbeid
      const totalHours = calculateLaborHours(afvoerUren, bereikbaarheidFactor);
      regels.push(createArbeidsRegel("bomen", "Snoeihout afvoeren", totalHours, uurtarief));
    }
  }

  return regels;
}

/**
 * Berekening voor reiniging-onderhoud:
 * terrasreiniging, bladruimen, onkruid bestrating en algereiniging.
 */
function calculateReinigingOnderhoud(
  data: ReinigingOnderhoudData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { normuren, instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  // Terrasreiniging
  if (data.terrasReinigen && data.terrasOppervlakte && data.terrasOppervlakte > 0) {
    const opp = data.terrasOppervlakte;
    const typeFactor = data.terrasType ? (TERRAS_TYPE_FACTOR[data.terrasType] ?? 1.0) : 1.0;

    const terrasNormuur = findNormuur(normuren, "overig_onderhoud", "terras reinigen");
    const normuurWaarde = terrasNormuur ? terrasNormuur.normuurPerEenheid : TERRAS_REINIGEN_UREN_PER_M2;

    const baseHours = opp * normuurWaarde * typeFactor;
    const totalHours = calculateLaborHours(baseHours, bereikbaarheidFactor);
    const typeLabel = data.terrasType ? ` (${data.terrasType})` : "";
    regels.push(createArbeidsRegel("reiniging", `Terras reinigen${typeLabel}`, totalHours, uurtarief));

    // Reinigingsmiddel
    regels.push(createMateriaalRegel(
      "reiniging",
      "Reinigingsmiddel",
      opp,
      "m²",
      REINIGINGSMIDDEL_PRIJS_PER_M2,
      0
    ));
  }

  // Bladruimen
  if (data.bladruimen && data.bladruimenOppervlakte && data.bladruimenOppervlakte > 0) {
    const opp = data.bladruimenOppervlakte;
    const beurten = data.bladruimenType === "seizoen" ? 4 : 1;
    const bladUren = opp * 0.02 * beurten;
    const afvoerUren = opp * 0.005 * beurten;

    const totalBladHours = calculateLaborHours(bladUren, bereikbaarheidFactor);
    const seizoenLabel = data.bladruimenType === "seizoen" ? " (4 beurten)" : " (eenmalig)";
    regels.push(createArbeidsRegel("reiniging", `Bladruimen${seizoenLabel}`, totalBladHours, uurtarief));

    const totalAfvoerHours = calculateLaborHours(afvoerUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("reiniging", "Blad afvoeren", totalAfvoerHours, uurtarief));
  }

  // Onkruid bestrating
  if (data.onkruidBestrating && data.onkruidOppervlakte && data.onkruidOppervlakte > 0) {
    const opp = data.onkruidOppervlakte;
    const methode = data.onkruidMethode ?? "handmatig";

    let onkruidUren = 0;
    let machineKosten = 0;
    let machineOmschrijving = "";
    let materiaalPrijs = 0;

    if (methode === "handmatig") {
      onkruidUren = opp * 0.04;
    } else if (methode === "branden") {
      onkruidUren = opp * 0.02;
      machineKosten = 45;
      machineOmschrijving = "Onkruidbrander huur";
    } else if (methode === "heet_water") {
      onkruidUren = opp * 0.015;
      machineKosten = 65;
      machineOmschrijving = "Heetwater-apparaat huur";
    } else if (methode === "chemisch") {
      onkruidUren = opp * 0.01;
      materiaalPrijs = 3.0;
    }

    const totalOnkruidHours = calculateLaborHours(onkruidUren, bereikbaarheidFactor);
    const methodeLabel = methode === "heet_water" ? "heet water" : methode;
    regels.push(createArbeidsRegel("reiniging", `Onkruid bestrating (${methodeLabel})`, totalOnkruidHours, uurtarief));

    if (machineKosten > 0) {
      regels.push({
        id: generateId(),
        scope: "reiniging",
        omschrijving: machineOmschrijving,
        eenheid: "dag",
        hoeveelheid: 1,
        prijsPerEenheid: machineKosten,
        totaal: machineKosten,
        type: "machine",
      });
    }

    if (materiaalPrijs > 0) {
      regels.push(createMateriaalRegel(
        "reiniging",
        "Onkruidbestrijdingsmiddel",
        opp,
        "m²",
        materiaalPrijs,
        0
      ));
    }
  }

  // Algereiniging
  if (data.algereiniging && data.algeOppervlakte && data.algeOppervlakte > 0) {
    const opp = data.algeOppervlakte;
    const algeUren = opp * 0.03;
    const totalAlgeHours = calculateLaborHours(algeUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("reiniging", "Algereiniging", totalAlgeHours, uurtarief));

    regels.push(createMateriaalRegel(
      "reiniging",
      "Anti-alg middel",
      opp,
      "m²",
      ANTI_ALG_PRIJS_PER_M2,
      0
    ));
  }

  return regels;
}

/**
 * Berekening voor bemesting-onderhoud.
 * Hoge standaard marge van 70% (scopeMargeOverride op elke regel).
 */
function calculateBemestingOnderhoud(
  data: BemestingOnderhoudData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  const opp = data.oppervlakte || 0;
  if (opp <= 0) return regels;

  const bemestingstype = data.bemestingstype ?? "basis";
  const frequentie = data.frequentie ?? 1;
  const kortingFactor = frequentie >= 2 ? 0.90 : 1.0;

  // Arbeid bemesting
  const bemestingUren = opp * BEMESTING_NORMUUR_PER_M2 * frequentie;
  const totalHours = calculateLaborHours(bemestingUren * kortingFactor, bereikbaarheidFactor);
  const freqLabel = frequentie > 1 ? ` (${frequentie}x per jaar)` : "";
  const arbeidsRegel = createArbeidsRegel(
    "bemesting",
    `Bemesting aanbrengen (${bemestingstype})${freqLabel}`,
    totalHours,
    uurtarief
  );
  regels.push({ ...arbeidsRegel, margePercentage: BEMESTING_MARGE_OVERRIDE });

  // Bemestingsproduct (materiaal)
  const productPrijs = BEMESTING_PRODUCT_PRIJS[bemestingstype] ?? BEMESTING_PRODUCT_PRIJS.basis;
  const materiaalRegel = createMateriaalRegel(
    "bemesting",
    `Bemestingsproduct (${bemestingstype})`,
    opp * frequentie,
    "m²",
    productPrijs,
    0
  );
  regels.push({ ...materiaalRegel, margePercentage: BEMESTING_MARGE_OVERRIDE });

  // Kalkbehandeling
  if (data.kalkbehandeling) {
    const kalkUren = opp * KALK_NORMUUR_PER_M2;
    const totalKalkHours = calculateLaborHours(kalkUren, bereikbaarheidFactor);
    const kalkArbeid = createArbeidsRegel("bemesting", "Kalkbehandeling", totalKalkHours, uurtarief);
    regels.push({ ...kalkArbeid, margePercentage: BEMESTING_MARGE_OVERRIDE });

    const kalkMateriaal = createMateriaalRegel(
      "bemesting",
      "Kalk",
      opp,
      "m²",
      KALK_PRIJS_PER_M2,
      0
    );
    regels.push({ ...kalkMateriaal, margePercentage: BEMESTING_MARGE_OVERRIDE });
  }

  // Grondanalyse
  if (data.grondanalyse) {
    regels.push({
      id: generateId(),
      scope: "bemesting",
      omschrijving: "Grondanalyse",
      eenheid: "analyse",
      hoeveelheid: 1,
      prijsPerEenheid: GRONDANALYSE_PRIJS,
      totaal: GRONDANALYSE_PRIJS,
      type: "materiaal",
      margePercentage: BEMESTING_MARGE_OVERRIDE,
    });
  }

  return regels;
}

/**
 * Berekening voor gazonanalyse en gazonherstel.
 */
function calculateGazonanalyseOnderhoud(
  data: GazonanalyseOnderhoudData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  const opp = data.oppervlakte || 0;
  if (opp <= 0) return regels;

  // Vaste beoordeling: 0.5 uur
  regels.push(createArbeidsRegel("gazonanalyse", "Gazonbeoordeling ter plaatse", 0.5, uurtarief));

  const acties = data.herstelacties ?? {};

  // Verticuteren
  if (acties.verticuteren) {
    const verticuterenUren = opp * 0.01;
    const totalHours = calculateLaborHours(verticuterenUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("gazonanalyse", "Verticuteren", totalHours, uurtarief));

    const dagenVerticuteren = Math.max(1, Math.ceil(opp / 500));
    regels.push({
      id: generateId(),
      scope: "gazonanalyse",
      omschrijving: `Verticuteer-machine huur (${dagenVerticuteren} dag${dagenVerticuteren > 1 ? "en" : ""})`,
      eenheid: "dag",
      hoeveelheid: dagenVerticuteren,
      prijsPerEenheid: MACHINE_VERTICUTEREN_PER_DAG,
      totaal: Math.round(dagenVerticuteren * MACHINE_VERTICUTEREN_PER_DAG * 100) / 100,
      type: "machine",
    });
  }

  // Doorzaaien
  if (acties.doorzaaien) {
    const doorzaaienUren = opp * 0.005;
    const totalHours = calculateLaborHours(doorzaaienUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("gazonanalyse", "Doorzaaien", totalHours, uurtarief));
    regels.push(createMateriaalRegel("gazonanalyse", "Graszaad (doorzaaien)", opp, "m²", ZAAD_DOORZAAIEN_PRIJS_PER_M2, 0));
  }

  // Nieuwe grasmat
  if (acties.nieuweGrasmat) {
    const grasmatUren = opp * 0.02;
    const totalHours = calculateLaborHours(grasmatUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("gazonanalyse", "Nieuwe grasmat leggen", totalHours, uurtarief));
    regels.push(createMateriaalRegel("gazonanalyse", "Graszoden", opp, "m²", GRASZODEN_NIEUW_PRIJS_PER_M2, 5));
  }

  // Plaggen
  if (acties.plaggen) {
    const plaggenUren = opp * 0.025;
    const totalHours = calculateLaborHours(plaggenUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("gazonanalyse", "Plaggen (zode verwijderen)", totalHours, uurtarief));
    // Afvoer plagsel (schatting volume)
    const afvoerUren = (opp * 0.05) * 0.1;
    const totalAfvoerHours = calculateLaborHours(afvoerUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("gazonanalyse", "Plagsel afvoeren", totalAfvoerHours, uurtarief));
  }

  // Bijzaaien kale plekken
  if (acties.bijzaaienKalePlekken) {
    const kalePlek = acties.kalePlekkOppervlakte ?? Math.ceil(opp * 0.1);
    const bijzaaienUren = kalePlek * 0.01;
    const totalHours = calculateLaborHours(bijzaaienUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("gazonanalyse", "Bijzaaien kale plekken", totalHours, uurtarief));
    regels.push(createMateriaalRegel("gazonanalyse", "Graszaad (kale plekken)", kalePlek, "m²", ZAAD_BIJZAAIEN_PRIJS_PER_M2, 0));
  }

  // Bekalken
  if (data.bekalken) {
    const bekalkenUren = opp * BEKALKEN_NORMUUR_PER_M2;
    const totalHours = calculateLaborHours(bekalkenUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("gazonanalyse", "Bekalken gazon", totalHours, uurtarief));
    regels.push(createMateriaalRegel("gazonanalyse", "Kalk (gazon)", opp, "m²", BEKALKEN_PRIJS_PER_M2, 0));
  }

  // Drainage: verwijzen naar aanleg calculator
  if (data.drainage) {
    regels.push({
      id: generateId(),
      scope: "gazonanalyse",
      omschrijving: "OPMERKING: Drainage — zie aanleg calculator voor gedetailleerde berekening",
      eenheid: "p.m.",
      hoeveelheid: 1,
      prijsPerEenheid: 0,
      totaal: 0,
      type: "arbeid",
    });
  }

  return regels;
}

/**
 * Berekening voor mollenbestrijding-onderhoud (basis, premium, premium plus).
 */
function calculateMollenbestrijdingOnderhoud(
  data: MollenbestrijdingOnderhoudData,
  context: CalculationContext
): OfferteRegel[] {
  const regels: OfferteRegel[] = [];
  const { instellingen, bereikbaarheid, correctiefactoren } = context;

  const bereikbaarheidFactor = getCorrectionFactor(correctiefactoren, "bereikbaarheid", bereikbaarheid);
  const uurtarief = instellingen.uurtarief;

  const pakket = data.pakket ?? "basis";

  if (pakket === "basis") {
    // 1 bezoek × 2 uur (plaatsen + ophalen)
    const plaatsenUren = calculateLaborHours(2, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("mollenbestrijding", "Klemmen plaatsen & ophalen (1 bezoek)", plaatsenUren, uurtarief));

    // Materiaal: klemmen €35
    regels.push(createMateriaalRegel("mollenbestrijding", "Mollenval klemmen (basis)", 1, "set", MOLLEN_KLEMMEN_BASIS, 0));

    // 1 controle × 0.5 uur
    const controleUren = calculateLaborHours(0.5, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("mollenbestrijding", "Tussentijdse controle (1x)", controleUren, uurtarief));

  } else if (pakket === "premium") {
    // 3 bezoeken × 1.5 uur
    const plaatsenUren = calculateLaborHours(3 * 1.5, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("mollenbestrijding", "Klemmen plaatsen & verplaatsen (3 bezoeken)", plaatsenUren, uurtarief));

    // Materiaal: klemmen + preventie €75
    regels.push(createMateriaalRegel("mollenbestrijding", "Mollenval klemmen + preventie (premium)", 1, "set", MOLLEN_KLEMMEN_PREMIUM, 0));

    // 3 tussentijdse controles × 0.5 uur
    const controleUren = calculateLaborHours(3 * 0.5, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("mollenbestrijding", "Tussentijdse controles (3x)", controleUren, uurtarief));

  } else if (pakket === "premium_plus") {
    // 6 bezoeken × 1 uur (efficiënt door routine)
    const plaatsenUren = calculateLaborHours(6 * 1, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("mollenbestrijding", "Klemmen plaatsen & beheer (6 bezoeken)", plaatsenUren, uurtarief));

    // Materiaal: klemmen + preventie + monitoring €120
    regels.push(createMateriaalRegel("mollenbestrijding", "Mollenval klemmen + preventie + monitoring (premium plus)", 1, "set", MOLLEN_KLEMMEN_PREMIUM_PLUS, 0));

    // Onbeperkte controles geschat: 6 × 0.5 uur
    const controleUren = calculateLaborHours(6 * 0.5, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("mollenbestrijding", "Controles (6x, onbeperkt pakket)", controleUren, uurtarief));
  }

  // Aanvullende opties
  const aanvullend = data.aanvullend ?? {};

  if (aanvullend.gazonherstel && aanvullend.geschatteM2 && aanvullend.geschatteM2 > 0) {
    const herstelUren = aanvullend.geschatteM2 * 0.02;
    const totalHours = calculateLaborHours(herstelUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("mollenbestrijding", "Gazonherstel na mollenschade", totalHours, uurtarief));
    regels.push(createMateriaalRegel(
      "mollenbestrijding",
      "Graszaad (mollenherstel)",
      aanvullend.geschatteM2,
      "m²",
      MOLHERSTEL_ZAAD_PRIJS_PER_M2,
      0
    ));
  }

  if (aanvullend.preventiefGaas && aanvullend.gaasOppervlakte && aanvullend.gaasOppervlakte > 0) {
    const gaasUren = aanvullend.gaasOppervlakte * 0.05;
    const totalHours = calculateLaborHours(gaasUren, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("mollenbestrijding", "Preventiefgaas aanbrengen", totalHours, uurtarief));
    regels.push(createMateriaalRegel(
      "mollenbestrijding",
      "Mollenwerend gaas",
      aanvullend.gaasOppervlakte,
      "m²",
      MOLLEN_GAAS_PRIJS_PER_M2,
      0
    ));
  }

  if (aanvullend.terugkeerCheck) {
    const terugkeerUren = calculateLaborHours(1, bereikbaarheidFactor);
    regels.push(createArbeidsRegel("mollenbestrijding", "Terugkeer-check (1 bezoek)", terugkeerUren, uurtarief));
  }

  return regels;
}

// ==================== MAIN CALCULATION FUNCTION ====================

export interface OfferteCalculationInput {
  type: "aanleg" | "onderhoud";
  scopes: string[];
  scopeData: Record<string, unknown>;
  bereikbaarheid: Bereikbaarheid;
  achterstalligheid?: Achterstalligheid;
}

export function calculateOfferteRegels(
  input: OfferteCalculationInput,
  context: CalculationContext
): OfferteRegel[] {
  const allRegels: OfferteRegel[] = [];

  // Set context factors
  context.bereikbaarheid = input.bereikbaarheid;
  context.achterstalligheid = input.achterstalligheid;

  for (const scope of input.scopes) {
    const data = input.scopeData[scope];
    if (!data) continue;

    let regels: OfferteRegel[] = [];

    if (input.type === "aanleg") {
      switch (scope) {
        case "grondwerk":
          regels = calculateGrondwerk(data as GrondwerkData, context);
          break;
        case "bestrating":
          regels = calculateBestrating(data as BestratingData, context);
          break;
        case "borders":
          regels = calculateBorders(data as BordersData, context);
          break;
        case "gras":
          regels = calculateGras(data as GrasData, context);
          break;
        case "houtwerk":
          regels = calculateHoutwerk(data as HoutwerkData, context);
          break;
        case "water_elektra":
          regels = calculateWaterElektra(data as WaterElektraData, context);
          break;
        case "specials":
          regels = calculateSpecials(data as SpecialsData, context);
          break;
      }
    } else {
      // onderhoud
      switch (scope) {
        case "gras":
          regels = calculateGrasOnderhoud(data as GrasOnderhoudData, context);
          break;
        case "borders":
          regels = calculateBordersOnderhoud(data as BordersOnderhoudData, context);
          break;
        case "heggen":
          regels = calculateHeggenOnderhoud(data as HeggenOnderhoudData, context);
          break;
        case "heggen_extended":
          regels = calculateHeggenOnderhoudExtended(data as HeggenOnderhoudExtendedData, context);
          break;
        case "bomen":
          regels = calculateBomenOnderhoud(data as BomenOnderhoudData, context);
          break;
        case "bomen_extended":
          regels = calculateBomenOnderhoudExtended(data as BomenOnderhoudExtendedData, context);
          break;
        case "reiniging":
          regels = calculateReinigingOnderhoud(data as ReinigingOnderhoudData, context);
          break;
        case "bemesting":
          regels = calculateBemestingOnderhoud(data as BemestingOnderhoudData, context);
          break;
        case "gazonanalyse":
          regels = calculateGazonanalyseOnderhoud(data as GazonanalyseOnderhoudData, context);
          break;
        case "mollenbestrijding":
          regels = calculateMollenbestrijdingOnderhoud(data as MollenbestrijdingOnderhoudData, context);
          break;
        case "overig":
          regels = calculateOverigOnderhoud(data as OverigeOnderhoudData, context);
          break;
      }
    }

    allRegels.push(...regels);
  }

  return allRegels;
}

// Helper functie om effectieve marge te bepalen per regel
function getEffectiveMargePercentage(
  regel: OfferteRegel,
  scopeMarges: ScopeMarges | undefined,
  standaardMargePercentage: number
): number {
  // Prioriteit: 1) regel.margePercentage, 2) scopeMarges[scope], 3) standaardMarge
  if (regel.margePercentage !== undefined && regel.margePercentage !== null) {
    return regel.margePercentage;
  }
  if (scopeMarges) {
    const scopeMarge = scopeMarges[regel.scope as keyof ScopeMarges];
    if (scopeMarge !== undefined && scopeMarge !== null) {
      return scopeMarge;
    }
  }
  return standaardMargePercentage;
}

// Calculate totals from regels with per-scope and per-product margins
export function calculateTotals(
  regels: OfferteRegel[],
  margePercentage: number,
  btwPercentage: number,
  scopeMarges?: ScopeMarges
) {
  let materiaalkosten = 0;
  let arbeidskosten = 0;
  let totaalUren = 0;
  let totaleMarge = 0;

  for (const regel of regels) {
    const effectieveMarge = getEffectiveMargePercentage(regel, scopeMarges, margePercentage);
    const regelMarge = regel.totaal * (effectieveMarge / 100);
    totaleMarge += regelMarge;

    if (regel.type === "materiaal") {
      materiaalkosten += regel.totaal;
    } else if (regel.type === "arbeid") {
      arbeidskosten += regel.totaal;
      totaalUren += regel.hoeveelheid;
    } else if (regel.type === "machine") {
      arbeidskosten += regel.totaal;
    }
  }

  const subtotaal = materiaalkosten + arbeidskosten;
  // Gebruik de berekende totale marge i.p.v. simpele percentage berekening
  const marge = totaleMarge;
  // Bereken effectief gemiddeld marge percentage voor weergave
  const effectiefMargePercentage = subtotaal > 0 ? (marge / subtotaal) * 100 : margePercentage;
  const totaalExBtw = subtotaal + marge;
  const btw = totaalExBtw * (btwPercentage / 100);
  const totaalInclBtw = totaalExBtw + btw;

  return {
    materiaalkosten: Math.round(materiaalkosten * 100) / 100,
    arbeidskosten: Math.round(arbeidskosten * 100) / 100,
    totaalUren: roundToQuarter(totaalUren),
    subtotaal: Math.round(subtotaal * 100) / 100,
    marge: Math.round(marge * 100) / 100,
    margePercentage: Math.round(effectiefMargePercentage * 100) / 100,
    totaalExBtw: Math.round(totaalExBtw * 100) / 100,
    btw: Math.round(btw * 100) / 100,
    totaalInclBtw: Math.round(totaalInclBtw * 100) / 100,
  };
}

// ==================== NIEUWE HELPER FUNCTIES ====================

/**
 * Offerte overhead: vast bedrag per offerte voor voorbereiding & administratie.
 */
export function getOfferteOverhead(): OfferteRegel {
  return {
    id: generateId(),
    scope: "algemeen",
    omschrijving: "Offerte voorbereiding & administratie",
    eenheid: "vast",
    hoeveelheid: 1,
    prijsPerEenheid: OFFERTE_OVERHEAD,
    totaal: OFFERTE_OVERHEAD,
    type: "arbeid",
  };
}

/**
 * Garantiepakket regel: voeg een garantiepakket toe aan de offerte.
 */
export function getGarantiePakketRegel(pakketNaam: string, prijs: number): OfferteRegel {
  return {
    id: generateId(),
    scope: "garantie",
    omschrijving: `Garantiepakket: ${pakketNaam}`,
    eenheid: "pakket",
    hoeveelheid: 1,
    prijsPerEenheid: prijs,
    totaal: prijs,
    type: "materiaal",
  };
}
