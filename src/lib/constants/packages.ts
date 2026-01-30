// Predefined packages for quick offerte creation
// These are hardcoded combinations that can be selected in one click

export interface OffertePackage {
  id: string;
  naam: string;
  omschrijving: string;
  type: "aanleg" | "onderhoud";
  scopes: string[];
  defaultWaarden: Record<string, unknown>;
  icon: string; // Lucide icon name
  geschatteTijd: string; // e.g., "2-3 dagen"
  prijsIndicatie?: string; // e.g., "vanaf €2.500"
}

// ==========================================
// AANLEG PACKAGES
// ==========================================

export const AANLEG_PACKAGES: OffertePackage[] = [
  {
    id: "klein-terras",
    naam: "Klein Terras Pakket",
    omschrijving: "Grondwerk en bestrating voor een compact terras (tot 20m²)",
    type: "aanleg",
    scopes: ["grondwerk", "bestrating"],
    defaultWaarden: {
      grondwerk: {
        oppervlakte: 15,
        diepte: "standaard",
        afvoerGrond: true,
      },
      bestrating: {
        oppervlakte: 15,
        typeBestrating: "tegel",
        snijwerk: "laag",
        onderbouw: {
          type: "zandbed",
          dikteOnderlaag: 5,
          opsluitbanden: true,
        },
      },
    },
    icon: "LayoutGrid",
    geschatteTijd: "2-3 dagen",
    prijsIndicatie: "vanaf €1.500",
  },
  {
    id: "groot-terras",
    naam: "Groot Terras Pakket",
    omschrijving: "Grondwerk en bestrating voor een ruim terras (20-50m²)",
    type: "aanleg",
    scopes: ["grondwerk", "bestrating"],
    defaultWaarden: {
      grondwerk: {
        oppervlakte: 35,
        diepte: "standaard",
        afvoerGrond: true,
      },
      bestrating: {
        oppervlakte: 35,
        typeBestrating: "klinker",
        snijwerk: "gemiddeld",
        onderbouw: {
          type: "zand_fundering",
          dikteOnderlaag: 10,
          opsluitbanden: true,
        },
      },
    },
    icon: "Square",
    geschatteTijd: "4-5 dagen",
    prijsIndicatie: "vanaf €3.500",
  },
  {
    id: "gazon-aanleg",
    naam: "Gazon Aanleg",
    omschrijving: "Nieuw gazon met grondwerk en graszoden of zaai",
    type: "aanleg",
    scopes: ["grondwerk", "gras"],
    defaultWaarden: {
      grondwerk: {
        oppervlakte: 50,
        diepte: "licht",
        afvoerGrond: false,
      },
      gras: {
        oppervlakte: 50,
        type: "graszoden",
        ondergrond: "nieuw",
        afwateringNodig: false,
      },
    },
    icon: "Leaf",
    geschatteTijd: "2-3 dagen",
    prijsIndicatie: "vanaf €2.000",
  },
  {
    id: "border-beplanting",
    naam: "Border & Beplanting",
    omschrijving: "Nieuwe borders met beplanting en afwerking",
    type: "aanleg",
    scopes: ["borders"],
    defaultWaarden: {
      borders: {
        oppervlakte: 20,
        beplantingsintensiteit: "gemiddeld",
        bodemverbetering: true,
        afwerking: "schors",
      },
    },
    icon: "Flower2",
    geschatteTijd: "1-2 dagen",
    prijsIndicatie: "vanaf €1.000",
  },
  {
    id: "schutting-plaatsen",
    naam: "Schutting Plaatsen",
    omschrijving: "Nieuwe schutting met fundering",
    type: "aanleg",
    scopes: ["houtwerk"],
    defaultWaarden: {
      houtwerk: {
        typeHoutwerk: "schutting",
        afmeting: 15,
        fundering: "standaard",
      },
    },
    icon: "Fence",
    geschatteTijd: "1-2 dagen",
    prijsIndicatie: "vanaf €1.200",
  },
  {
    id: "vlonder-terras",
    naam: "Vlonder Terras",
    omschrijving: "Houten vlonder met fundering",
    type: "aanleg",
    scopes: ["houtwerk"],
    defaultWaarden: {
      houtwerk: {
        typeHoutwerk: "vlonder",
        afmeting: 20,
        fundering: "standaard",
      },
    },
    icon: "RectangleHorizontal",
    geschatteTijd: "2-3 dagen",
    prijsIndicatie: "vanaf €2.500",
  },
  {
    id: "tuin-verlichting",
    naam: "Tuin Verlichting",
    omschrijving: "Basis tuinverlichting met kabels en armaturen",
    type: "aanleg",
    scopes: ["water_elektra"],
    defaultWaarden: {
      water_elektra: {
        verlichting: "basis",
        aantalPunten: 4,
        sleuvenNodig: true,
      },
    },
    icon: "Lightbulb",
    geschatteTijd: "1 dag",
    prijsIndicatie: "vanaf €800",
  },
  {
    id: "complete-kleine-tuin",
    naam: "Complete Kleine Tuin",
    omschrijving: "Volledige tuinrenovatie voor kleine tuin: terras, gazon en borders",
    type: "aanleg",
    scopes: ["grondwerk", "bestrating", "borders", "gras"],
    defaultWaarden: {
      grondwerk: {
        oppervlakte: 40,
        diepte: "standaard",
        afvoerGrond: true,
      },
      bestrating: {
        oppervlakte: 15,
        typeBestrating: "tegel",
        snijwerk: "gemiddeld",
        onderbouw: {
          type: "zandbed",
          dikteOnderlaag: 5,
          opsluitbanden: true,
        },
      },
      borders: {
        oppervlakte: 10,
        beplantingsintensiteit: "gemiddeld",
        bodemverbetering: true,
        afwerking: "schors",
      },
      gras: {
        oppervlakte: 15,
        type: "graszoden",
        ondergrond: "nieuw",
        afwateringNodig: false,
      },
    },
    icon: "TreeDeciduous",
    geschatteTijd: "1 week",
    prijsIndicatie: "vanaf €5.000",
  },
  {
    id: "complete-grote-tuin",
    naam: "Complete Grote Tuin",
    omschrijving: "Volledige tuinrenovatie met alle scopes: terras, gazon, borders, schutting en verlichting",
    type: "aanleg",
    scopes: ["grondwerk", "bestrating", "borders", "gras", "houtwerk", "water_elektra"],
    defaultWaarden: {
      grondwerk: {
        oppervlakte: 100,
        diepte: "standaard",
        afvoerGrond: true,
      },
      bestrating: {
        oppervlakte: 40,
        typeBestrating: "klinker",
        snijwerk: "gemiddeld",
        onderbouw: {
          type: "zand_fundering",
          dikteOnderlaag: 10,
          opsluitbanden: true,
        },
      },
      borders: {
        oppervlakte: 25,
        beplantingsintensiteit: "veel",
        bodemverbetering: true,
        afwerking: "schors",
      },
      gras: {
        oppervlakte: 35,
        type: "graszoden",
        ondergrond: "nieuw",
        afwateringNodig: false,
      },
      houtwerk: {
        typeHoutwerk: "schutting",
        afmeting: 20,
        fundering: "standaard",
      },
      water_elektra: {
        verlichting: "uitgebreid",
        aantalPunten: 8,
        sleuvenNodig: true,
      },
    },
    icon: "Trees",
    geschatteTijd: "2 weken",
    prijsIndicatie: "vanaf €15.000",
  },
];

// ==========================================
// ONDERHOUD PACKAGES
// ==========================================

export const ONDERHOUD_PACKAGES: OffertePackage[] = [
  {
    id: "basis-onderhoud",
    naam: "Basis Onderhoud",
    omschrijving: "Gazon maaien en kanten steken",
    type: "onderhoud",
    scopes: ["gras"],
    defaultWaarden: {
      gras: {
        grasAanwezig: true,
        grasOppervlakte: 50,
        maaien: true,
        kantenSteken: true,
        verticuteren: false,
        afvoerGras: true,
      },
    },
    icon: "Scissors",
    geschatteTijd: "2-3 uur",
    prijsIndicatie: "vanaf €150",
  },
  {
    id: "gazon-borders",
    naam: "Gazon & Borders",
    omschrijving: "Gazon maaien plus border onderhoud",
    type: "onderhoud",
    scopes: ["gras", "borders"],
    defaultWaarden: {
      gras: {
        grasAanwezig: true,
        grasOppervlakte: 50,
        maaien: true,
        kantenSteken: true,
        verticuteren: false,
        afvoerGras: true,
      },
      borders: {
        borderOppervlakte: 15,
        onderhoudsintensiteit: "gemiddeld",
        onkruidVerwijderen: true,
        snoeiInBorders: "licht",
        bodem: "bedekt",
        afvoerGroenafval: true,
      },
    },
    icon: "Leaf",
    geschatteTijd: "4-5 uur",
    prijsIndicatie: "vanaf €250",
  },
  {
    id: "heg-snoei",
    naam: "Heg Snoeien",
    omschrijving: "Heggen snoeien en afvoer snoeisel",
    type: "onderhoud",
    scopes: ["heggen"],
    defaultWaarden: {
      heggen: {
        lengte: 10,
        hoogte: 1.8,
        breedte: 0.6,
        snoei: "beide",
        afvoerSnoeisel: true,
      },
    },
    icon: "Shrub",
    geschatteTijd: "2-4 uur",
    prijsIndicatie: "vanaf €200",
  },
  {
    id: "boom-snoei",
    naam: "Boom Snoeien",
    omschrijving: "Bomen snoeien met afvoer",
    type: "onderhoud",
    scopes: ["bomen"],
    defaultWaarden: {
      bomen: {
        aantalBomen: 3,
        snoei: "licht",
        hoogteklasse: "middel",
        afvoer: true,
      },
    },
    icon: "TreeDeciduous",
    geschatteTijd: "3-5 uur",
    prijsIndicatie: "vanaf €300",
  },
  {
    id: "compleet-onderhoud",
    naam: "Compleet Onderhoud",
    omschrijving: "Volledig tuinonderhoud: gazon, borders, heggen en bomen",
    type: "onderhoud",
    scopes: ["gras", "borders", "heggen", "bomen"],
    defaultWaarden: {
      gras: {
        grasAanwezig: true,
        grasOppervlakte: 60,
        maaien: true,
        kantenSteken: true,
        verticuteren: false,
        afvoerGras: true,
      },
      borders: {
        borderOppervlakte: 20,
        onderhoudsintensiteit: "gemiddeld",
        onkruidVerwijderen: true,
        snoeiInBorders: "licht",
        bodem: "bedekt",
        afvoerGroenafval: true,
      },
      heggen: {
        lengte: 15,
        hoogte: 1.8,
        breedte: 0.5,
        snoei: "beide",
        afvoerSnoeisel: true,
      },
      bomen: {
        aantalBomen: 2,
        snoei: "licht",
        hoogteklasse: "laag",
        afvoer: true,
      },
    },
    icon: "Trees",
    geschatteTijd: "1 dag",
    prijsIndicatie: "vanaf €500",
  },
  {
    id: "seizoens-opruiming",
    naam: "Seizoens Opruiming",
    omschrijving: "Bladruimen, terras reinigen en winterklaar maken",
    type: "onderhoud",
    scopes: ["overig"],
    defaultWaarden: {
      overig: {
        bladruimen: true,
        terrasReinigen: true,
        terrasOppervlakte: 25,
        onkruidBestrating: true,
        bestratingOppervlakte: 25,
        afwateringControleren: true,
        aantalAfwateringspunten: 2,
        overigNotities: "",
        overigUren: 0,
      },
    },
    icon: "Wind",
    geschatteTijd: "4-6 uur",
    prijsIndicatie: "vanaf €300",
  },
];

// Helper function to get packages by type
export function getPackagesByType(type: "aanleg" | "onderhoud"): OffertePackage[] {
  return type === "aanleg" ? AANLEG_PACKAGES : ONDERHOUD_PACKAGES;
}

// Helper function to get package by id
export function getPackageById(id: string): OffertePackage | undefined {
  return [...AANLEG_PACKAGES, ...ONDERHOUD_PACKAGES].find((p) => p.id === id);
}
