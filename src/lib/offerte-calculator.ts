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
        case "bomen":
          regels = calculateBomenOnderhoud(data as BomenOnderhoudData, context);
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
