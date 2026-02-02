import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateOfferteRegels,
  calculateTotals,
  type CalculationContext,
  type OfferteCalculationInput,
  type Normuur,
  type Correctiefactor,
  type Product,
  type Instellingen,
  type OfferteRegel,
  type ScopeMarges,
} from "@/lib/offerte-calculator";

// Mock data factories
function createMockNormuren(): Normuur[] {
  return [
    // Grondwerk
    { _id: "1", activiteit: "ontgraven standaard", scope: "grondwerk", normuurPerEenheid: 0.25, eenheid: "m2" },
    { _id: "2", activiteit: "ontgraven licht", scope: "grondwerk", normuurPerEenheid: 0.15, eenheid: "m2" },
    { _id: "3", activiteit: "ontgraven zwaar", scope: "grondwerk", normuurPerEenheid: 0.35, eenheid: "m2" },
    { _id: "4", activiteit: "afvoeren grond", scope: "grondwerk", normuurPerEenheid: 0.1, eenheid: "m3" },
    // Bestrating
    { _id: "5", activiteit: "tegels leggen", scope: "bestrating", normuurPerEenheid: 0.4, eenheid: "m2" },
    { _id: "6", activiteit: "klinkers leggen", scope: "bestrating", normuurPerEenheid: 0.5, eenheid: "m2" },
    { _id: "7", activiteit: "natuursteen leggen", scope: "bestrating", normuurPerEenheid: 0.6, eenheid: "m2" },
    { _id: "8", activiteit: "zandbed aanbrengen", scope: "bestrating", normuurPerEenheid: 0.1, eenheid: "m2" },
    { _id: "9", activiteit: "opsluitbanden plaatsen", scope: "bestrating", normuurPerEenheid: 0.2, eenheid: "m" },
    // Borders
    { _id: "10", activiteit: "grondbewerking", scope: "borders", normuurPerEenheid: 0.2, eenheid: "m2" },
    { _id: "11", activiteit: "planten laag", scope: "borders", normuurPerEenheid: 0.15, eenheid: "m2" },
    { _id: "12", activiteit: "planten gemiddeld", scope: "borders", normuurPerEenheid: 0.25, eenheid: "m2" },
    { _id: "13", activiteit: "planten hoog", scope: "borders", normuurPerEenheid: 0.35, eenheid: "m2" },
    { _id: "14", activiteit: "schors aanbrengen", scope: "borders", normuurPerEenheid: 0.08, eenheid: "m2" },
    // Gras
    { _id: "15", activiteit: "ondergrond bewerken", scope: "gras", normuurPerEenheid: 0.1, eenheid: "m2" },
    { _id: "16", activiteit: "graszoden leggen", scope: "gras", normuurPerEenheid: 0.12, eenheid: "m2" },
    { _id: "17", activiteit: "gras zaaien", scope: "gras", normuurPerEenheid: 0.05, eenheid: "m2" },
    // Houtwerk
    { _id: "18", activiteit: "schutting plaatsen", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "m" },
    { _id: "19", activiteit: "vlonder leggen", scope: "houtwerk", normuurPerEenheid: 0.6, eenheid: "m2" },
    { _id: "20", activiteit: "pergola bouwen", scope: "houtwerk", normuurPerEenheid: 2.0, eenheid: "m2" },
    { _id: "21", activiteit: "fundering standaard", scope: "houtwerk", normuurPerEenheid: 0.5, eenheid: "stuk" },
    { _id: "22", activiteit: "fundering zwaar", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "stuk" },
    // Water & Elektra
    { _id: "23", activiteit: "sleuf graven", scope: "water_elektra", normuurPerEenheid: 0.3, eenheid: "m" },
    { _id: "24", activiteit: "kabel leggen", scope: "water_elektra", normuurPerEenheid: 0.1, eenheid: "m" },
    { _id: "25", activiteit: "sleuf herstellen", scope: "water_elektra", normuurPerEenheid: 0.15, eenheid: "m" },
    { _id: "26", activiteit: "armatuur plaatsen", scope: "water_elektra", normuurPerEenheid: 0.5, eenheid: "stuk" },
    // Onderhoud - Gras
    { _id: "27", activiteit: "maaien", scope: "gras_onderhoud", normuurPerEenheid: 0.02, eenheid: "m2" },
    { _id: "28", activiteit: "kanten steken", scope: "gras_onderhoud", normuurPerEenheid: 0.05, eenheid: "m" },
    { _id: "29", activiteit: "verticuteren", scope: "gras_onderhoud", normuurPerEenheid: 0.03, eenheid: "m2" },
    // Onderhoud - Borders
    { _id: "30", activiteit: "wieden weinig", scope: "borders_onderhoud", normuurPerEenheid: 0.1, eenheid: "m2" },
    { _id: "31", activiteit: "wieden gemiddeld", scope: "borders_onderhoud", normuurPerEenheid: 0.15, eenheid: "m2" },
    { _id: "32", activiteit: "wieden veel", scope: "borders_onderhoud", normuurPerEenheid: 0.2, eenheid: "m2" },
    { _id: "33", activiteit: "snoei licht", scope: "borders_onderhoud", normuurPerEenheid: 0.08, eenheid: "m2" },
    { _id: "34", activiteit: "snoei zwaar", scope: "borders_onderhoud", normuurPerEenheid: 0.15, eenheid: "m2" },
    // Onderhoud - Heggen
    { _id: "35", activiteit: "heg snoeien", scope: "heggen_onderhoud", normuurPerEenheid: 0.15, eenheid: "m3" },
    { _id: "36", activiteit: "snoeisel afvoeren", scope: "heggen_onderhoud", normuurPerEenheid: 0.1, eenheid: "m3" },
    // Onderhoud - Bomen
    { _id: "37", activiteit: "boom snoeien licht", scope: "bomen_onderhoud", normuurPerEenheid: 0.5, eenheid: "stuk" },
    { _id: "38", activiteit: "boom snoeien zwaar", scope: "bomen_onderhoud", normuurPerEenheid: 1.5, eenheid: "stuk" },
  ];
}

function createMockCorrectiefactoren(): Correctiefactor[] {
  return [
    // Bereikbaarheid
    { _id: "cf1", type: "bereikbaarheid", waarde: "goed", factor: 1.0, omschrijving: "Goed bereikbaar" },
    { _id: "cf2", type: "bereikbaarheid", waarde: "beperkt", factor: 1.2, omschrijving: "Beperkt bereikbaar" },
    { _id: "cf3", type: "bereikbaarheid", waarde: "slecht", factor: 1.5, omschrijving: "Slecht bereikbaar" },
    // Snijwerk
    { _id: "cf4", type: "snijwerk", waarde: "laag", factor: 1.0, omschrijving: "Weinig snijwerk" },
    { _id: "cf5", type: "snijwerk", waarde: "gemiddeld", factor: 1.1, omschrijving: "Gemiddeld snijwerk" },
    { _id: "cf6", type: "snijwerk", waarde: "hoog", factor: 1.3, omschrijving: "Veel snijwerk" },
    // Achterstalligheid
    { _id: "cf7", type: "achterstalligheid", waarde: "laag", factor: 1.0, omschrijving: "Niet achterstallig" },
    { _id: "cf8", type: "achterstalligheid", waarde: "gemiddeld", factor: 1.3, omschrijving: "Gemiddeld achterstallig" },
    { _id: "cf9", type: "achterstalligheid", waarde: "hoog", factor: 1.6, omschrijving: "Zeer achterstallig" },
  ];
}

function createMockProducten(): Product[] {
  return [
    { _id: "p1", productnaam: "Afvoer grond", categorie: "grondwerk", inkoopprijs: 20, verkoopprijs: 30, eenheid: "m3", verliespercentage: 0 },
    { _id: "p2", productnaam: "Straatzand", categorie: "bestrating", inkoopprijs: 25, verkoopprijs: 35, eenheid: "m3", verliespercentage: 5 },
    { _id: "p3", productnaam: "Opsluitband 100x20x6", categorie: "bestrating", inkoopprijs: 3, verkoopprijs: 5, eenheid: "stuk", verliespercentage: 3 },
    { _id: "p4", productnaam: "Bodembedekker pot 9cm", categorie: "borders", inkoopprijs: 1.5, verkoopprijs: 3, eenheid: "stuk", verliespercentage: 5 },
    { _id: "p5", productnaam: "Boomschors 10-40mm", categorie: "borders", inkoopprijs: 40, verkoopprijs: 60, eenheid: "m3", verliespercentage: 5 },
    { _id: "p6", productnaam: "Graszoden", categorie: "gras", inkoopprijs: 4, verkoopprijs: 7, eenheid: "m2", verliespercentage: 5 },
    { _id: "p7", productnaam: "Graszaad sport", categorie: "gras", inkoopprijs: 8, verkoopprijs: 15, eenheid: "kg", verliespercentage: 0 },
    { _id: "p8", productnaam: "Schuttingplank 180x15", categorie: "houtwerk", inkoopprijs: 5, verkoopprijs: 8, eenheid: "stuk", verliespercentage: 5 },
    { _id: "p9", productnaam: "Schuttingpaal 7x7x270", categorie: "houtwerk", inkoopprijs: 15, verkoopprijs: 25, eenheid: "stuk", verliespercentage: 0 },
    { _id: "p10", productnaam: "Vlonderdeel hardhout", categorie: "houtwerk", inkoopprijs: 12, verkoopprijs: 20, eenheid: "m", verliespercentage: 5 },
    { _id: "p11", productnaam: "Betonpoer 30x30x30", categorie: "houtwerk", inkoopprijs: 8, verkoopprijs: 15, eenheid: "stuk", verliespercentage: 0 },
    { _id: "p12", productnaam: "Kabel 3x1,5 grond", categorie: "elektra", inkoopprijs: 2, verkoopprijs: 4, eenheid: "m", verliespercentage: 5 },
    { _id: "p13", productnaam: "Grondspot LED", categorie: "elektra", inkoopprijs: 25, verkoopprijs: 45, eenheid: "stuk", verliespercentage: 0 },
    { _id: "p14", productnaam: "Lasdoos waterdicht", categorie: "elektra", inkoopprijs: 3, verkoopprijs: 6, eenheid: "stuk", verliespercentage: 0 },
  ];
}

function createMockInstellingen(): Instellingen {
  return {
    uurtarief: 45,
    standaardMargePercentage: 20,
    btwPercentage: 21,
  };
}

function createContext(overrides: Partial<CalculationContext> = {}): CalculationContext {
  return {
    normuren: createMockNormuren(),
    correctiefactoren: createMockCorrectiefactoren(),
    producten: createMockProducten(),
    instellingen: createMockInstellingen(),
    bereikbaarheid: "goed",
    achterstalligheid: undefined,
    ...overrides,
  };
}

describe("Offerte Calculator - Normuren Calculations", () => {
  let context: CalculationContext;

  beforeEach(() => {
    context = createContext();
  });

  describe("Grondwerk calculations", () => {
    it("calculates ontgraven standaard correctly", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: {
            oppervlakte: 50,
            diepte: "standaard",
            afvoerGrond: false,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      expect(regels.length).toBeGreaterThan(0);
      const arbeidsRegel = regels.find(r => r.type === "arbeid" && r.omschrijving.includes("Ontgraven"));
      expect(arbeidsRegel).toBeDefined();
      // 50m2 * 0.25 uur/m2 = 12.5 uur, rounded to quarter = 12.5
      expect(arbeidsRegel?.hoeveelheid).toBe(12.5);
    });

    it("calculates ontgraven with afvoer grond correctly", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: {
            oppervlakte: 40,
            diepte: "standaard",
            afvoerGrond: true,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      // Should have ontgraven + afvoeren labor + afvoer material
      const afvoerArbeid = regels.find(r => r.type === "arbeid" && r.omschrijving.includes("afvoeren"));
      const afvoerMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Afvoer"));

      expect(afvoerArbeid).toBeDefined();
      expect(afvoerMateriaal).toBeDefined();
    });

    it("applies bereikbaarheid factor correctly", () => {
      const inputGoed: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 40, diepte: "standaard", afvoerGrond: false },
        },
        bereikbaarheid: "goed",
      };

      const inputSlecht: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 40, diepte: "standaard", afvoerGrond: false },
        },
        bereikbaarheid: "slecht",
      };

      const regelsGoed = calculateOfferteRegels(inputGoed, context);
      const regelsSlecht = calculateOfferteRegels(inputSlecht, context);

      const urenGoed = regelsGoed.find(r => r.type === "arbeid")?.hoeveelheid ?? 0;
      const urenSlecht = regelsSlecht.find(r => r.type === "arbeid")?.hoeveelheid ?? 0;

      // Slecht bereikbaar factor = 1.5
      expect(urenSlecht).toBeGreaterThan(urenGoed);
      expect(urenSlecht / urenGoed).toBeCloseTo(1.5, 1);
    });
  });

  describe("Bestrating calculations", () => {
    it("calculates tegels leggen correctly", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: {
            oppervlakte: 30,
            typeBestrating: "tegel",
            snijwerk: "laag",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const tegelRegel = regels.find(r => r.omschrijving.includes("Tegels leggen"));
      expect(tegelRegel).toBeDefined();
      // 30m2 * 0.4 uur/m2 = 12 uur
      expect(tegelRegel?.hoeveelheid).toBe(12);
    });

    it("applies snijwerk factor correctly", () => {
      const inputLaag: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 20, typeBestrating: "tegel", snijwerk: "laag" },
        },
        bereikbaarheid: "goed",
      };

      const inputHoog: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 20, typeBestrating: "tegel", snijwerk: "hoog" },
        },
        bereikbaarheid: "goed",
      };

      const regelsLaag = calculateOfferteRegels(inputLaag, context);
      const regelsHoog = calculateOfferteRegels(inputHoog, context);

      const tegelsLaag = regelsLaag.find(r => r.omschrijving.includes("Tegels leggen"));
      const tegelsHoog = regelsHoog.find(r => r.omschrijving.includes("Tegels leggen"));

      // Hoog snijwerk factor = 1.3
      expect(tegelsHoog!.hoeveelheid).toBeGreaterThan(tegelsLaag!.hoeveelheid);
    });

    it("includes zandbed and opsluitbanden when configured", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: {
            oppervlakte: 25,
            typeBestrating: "tegel",
            snijwerk: "laag",
            onderbouw: { opsluitbanden: true },
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const zandbedRegel = regels.find(r => r.omschrijving.includes("Zandbed"));
      const opsluitRegel = regels.find(r => r.omschrijving.includes("Opsluitbanden"));

      expect(zandbedRegel).toBeDefined();
      expect(opsluitRegel).toBeDefined();
    });
  });

  describe("Borders calculations", () => {
    it("calculates borders with different intensities", () => {
      const intensities = ["weinig", "gemiddeld", "veel"] as const;
      const expectedPlantsPerM2 = { weinig: 3, gemiddeld: 6, veel: 10 };

      for (const intensiteit of intensities) {
        const input: OfferteCalculationInput = {
          type: "aanleg",
          scopes: ["borders"],
          scopeData: {
            borders: {
              oppervlakte: 20,
              beplantingsintensiteit: intensiteit,
              afwerking: "geen",
            },
          },
          bereikbaarheid: "goed",
        };

        const regels = calculateOfferteRegels(input, context);
        const plantMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Bodembedekker"));

        if (plantMateriaal) {
          // Plants = oppervlakte * plantsPerM2 * (1 + verliespercentage)
          const expectedBase = 20 * expectedPlantsPerM2[intensiteit];
          expect(plantMateriaal.hoeveelheid).toBeGreaterThanOrEqual(expectedBase);
        }
      }
    });

    it("includes schors when afwerking is schors", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["borders"],
        scopeData: {
          borders: {
            oppervlakte: 15,
            beplantingsintensiteit: "gemiddeld",
            afwerking: "schors",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const schorsArbeid = regels.find(r => r.omschrijving.includes("Schors"));
      const schorsMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("schors"));

      expect(schorsArbeid).toBeDefined();
      expect(schorsMateriaal).toBeDefined();
    });
  });

  describe("Gras calculations", () => {
    it("calculates graszoden correctly", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["gras"],
        scopeData: {
          gras: {
            oppervlakte: 100,
            type: "graszoden",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const zodenArbeid = regels.find(r => r.omschrijving.includes("Graszoden leggen"));
      const zodenMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Graszoden"));

      expect(zodenArbeid).toBeDefined();
      expect(zodenMateriaal).toBeDefined();
      // 100m2 * 0.12 uur/m2 = 12 uur
      expect(zodenArbeid?.hoeveelheid).toBe(12);
    });

    it("calculates gras zaaien correctly", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["gras"],
        scopeData: {
          gras: {
            oppervlakte: 80,
            type: "zaaien",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const zaaiArbeid = regels.find(r => r.omschrijving.includes("Gras zaaien"));
      const zaadMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Graszaad"));

      expect(zaaiArbeid).toBeDefined();
      expect(zaadMateriaal).toBeDefined();
    });
  });

  describe("Houtwerk calculations", () => {
    it("calculates schutting correctly", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["houtwerk"],
        scopeData: {
          houtwerk: {
            typeHoutwerk: "schutting",
            afmeting: 10, // 10 meter
            fundering: "standaard",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const schuttingArbeid = regels.find(r => r.omschrijving.includes("Schutting"));
      const plankenMateriaal = regels.find(r => r.omschrijving.includes("Schuttingplank"));
      const palenMateriaal = regels.find(r => r.omschrijving.includes("Schuttingpaal"));

      expect(schuttingArbeid).toBeDefined();
      expect(plankenMateriaal).toBeDefined();
      expect(palenMateriaal).toBeDefined();

      // Planken: 10m * 6 planken/m = 60 planken
      expect(plankenMateriaal!.hoeveelheid).toBeCloseTo(60 * 1.05, 1); // with 5% loss
    });

    it("calculates vlonder correctly", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["houtwerk"],
        scopeData: {
          houtwerk: {
            typeHoutwerk: "vlonder",
            afmeting: 20, // 20 m2
            fundering: "standaard",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const vlonderArbeid = regels.find(r => r.omschrijving.includes("Vlonder"));
      expect(vlonderArbeid).toBeDefined();
      // 20m2 * 0.6 uur/m2 = 12 uur
      expect(vlonderArbeid?.hoeveelheid).toBe(12);
    });
  });

  describe("Water & Elektra calculations", () => {
    it("calculates verlichting with sleuven correctly", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["water_elektra"],
        scopeData: {
          water_elektra: {
            verlichting: "led",
            aantalPunten: 4,
            sleuvenNodig: true,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const sleufArbeid = regels.find(r => r.omschrijving.includes("Sleuf graven"));
      const kabelArbeid = regels.find(r => r.omschrijving.includes("Kabel leggen"));
      const armatuurArbeid = regels.find(r => r.omschrijving.includes("Armaturen"));
      const grondspotMateriaal = regels.find(r => r.omschrijving.includes("Grondspot"));

      expect(sleufArbeid).toBeDefined();
      expect(kabelArbeid).toBeDefined();
      expect(armatuurArbeid).toBeDefined();
      expect(grondspotMateriaal).toBeDefined();
      expect(grondspotMateriaal?.hoeveelheid).toBe(4);
    });
  });
});

describe("Offerte Calculator - Onderhoud Calculations", () => {
  let context: CalculationContext;

  beforeEach(() => {
    context = createContext();
  });

  describe("Gras onderhoud", () => {
    it("calculates maaien correctly", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gras"],
        scopeData: {
          gras: {
            grasAanwezig: true,
            grasOppervlakte: 200,
            maaien: true,
            kantenSteken: false,
            verticuteren: false,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const maaienRegel = regels.find(r => r.omschrijving.includes("maaien"));
      expect(maaienRegel).toBeDefined();
      // 200m2 * 0.02 uur/m2 = 4 uur
      expect(maaienRegel?.hoeveelheid).toBe(4);
    });

    it("applies achterstalligheid factor correctly", () => {
      const inputLaag: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gras"],
        scopeData: {
          gras: { grasAanwezig: true, grasOppervlakte: 100, maaien: true },
        },
        bereikbaarheid: "goed",
        achterstalligheid: "laag",
      };

      const inputHoog: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gras"],
        scopeData: {
          gras: { grasAanwezig: true, grasOppervlakte: 100, maaien: true },
        },
        bereikbaarheid: "goed",
        achterstalligheid: "hoog",
      };

      const regelsLaag = calculateOfferteRegels(inputLaag, context);
      const regelsHoog = calculateOfferteRegels(inputHoog, context);

      const urenLaag = regelsLaag.find(r => r.omschrijving.includes("maaien"))?.hoeveelheid ?? 0;
      const urenHoog = regelsHoog.find(r => r.omschrijving.includes("maaien"))?.hoeveelheid ?? 0;

      // Hoog achterstalligheid factor = 1.6
      expect(urenHoog).toBeGreaterThan(urenLaag);
    });
  });

  describe("Heggen onderhoud", () => {
    it("calculates heg snoeien based on volume", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen"],
        scopeData: {
          heggen: {
            lengte: 10,
            hoogte: 1.5,
            breedte: 0.5,
            afvoerSnoeisel: false,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const snoeienRegel = regels.find(r => r.omschrijving.includes("snoeien"));
      expect(snoeienRegel).toBeDefined();
      // Volume = 10 * 1.5 * 0.5 = 7.5 m3
      // Uren = 7.5 * 0.15 = 1.125 -> rounded to 1.25
      expect(snoeienRegel?.hoeveelheid).toBeCloseTo(1.25, 2);
    });

    it("applies height factor for tall hedges", () => {
      const inputLaag: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen"],
        scopeData: {
          heggen: { lengte: 10, hoogte: 1.5, breedte: 0.5, afvoerSnoeisel: false },
        },
        bereikbaarheid: "goed",
      };

      const inputHoog: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen"],
        scopeData: {
          heggen: { lengte: 10, hoogte: 2.5, breedte: 0.5, afvoerSnoeisel: false },
        },
        bereikbaarheid: "goed",
      };

      const regelsLaag = calculateOfferteRegels(inputLaag, context);
      const regelsHoog = calculateOfferteRegels(inputHoog, context);

      const urenLaag = regelsLaag.find(r => r.omschrijving.includes("snoeien"))?.hoeveelheid ?? 0;
      const urenHoog = regelsHoog.find(r => r.omschrijving.includes("snoeien"))?.hoeveelheid ?? 0;

      // Higher hedge has both more volume AND height factor (1.3)
      expect(urenHoog).toBeGreaterThan(urenLaag);
    });
  });

  describe("Bomen onderhoud", () => {
    it("calculates boom snoeien correctly", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen"],
        scopeData: {
          bomen: {
            aantalBomen: 5,
            snoei: "licht",
            hoogteklasse: "laag",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const bomenRegel = regels.find(r => r.omschrijving.includes("Bomen snoeien"));
      expect(bomenRegel).toBeDefined();
      // 5 bomen * 0.5 uur/boom = 2.5 uur
      expect(bomenRegel?.hoeveelheid).toBe(2.5);
    });

    it("calculates zwaar snoeien with more hours", () => {
      const inputLicht: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen"],
        scopeData: {
          bomen: { aantalBomen: 3, snoei: "licht", hoogteklasse: "laag" },
        },
        bereikbaarheid: "goed",
      };

      const inputZwaar: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen"],
        scopeData: {
          bomen: { aantalBomen: 3, snoei: "zwaar", hoogteklasse: "laag" },
        },
        bereikbaarheid: "goed",
      };

      const regelsLicht = calculateOfferteRegels(inputLicht, context);
      const regelsZwaar = calculateOfferteRegels(inputZwaar, context);

      const urenLicht = regelsLicht.find(r => r.omschrijving.includes("Bomen"))?.hoeveelheid ?? 0;
      const urenZwaar = regelsZwaar.find(r => r.omschrijving.includes("Bomen"))?.hoeveelheid ?? 0;

      expect(urenZwaar).toBeGreaterThan(urenLicht);
    });
  });
});

describe("Offerte Calculator - Price Calculations", () => {
  describe("calculateTotals", () => {
    it("calculates totals correctly with standard margin", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Ontgraven", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
        { id: "2", scope: "grondwerk", omschrijving: "Afvoer grond", eenheid: "m3", hoeveelheid: 5, prijsPerEenheid: 30, totaal: 150, type: "materiaal" },
      ];

      const totals = calculateTotals(regels, 20, 21);

      expect(totals.arbeidskosten).toBe(450);
      expect(totals.materiaalkosten).toBe(150);
      expect(totals.subtotaal).toBe(600);
      expect(totals.marge).toBe(120); // 600 * 0.20
      expect(totals.totaalExBtw).toBe(720); // 600 + 120
      expect(totals.btw).toBeCloseTo(151.2, 2); // 720 * 0.21
      expect(totals.totaalInclBtw).toBeCloseTo(871.2, 2);
    });

    it("calculates totaalUren correctly", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Ontgraven", eenheid: "uur", hoeveelheid: 8, prijsPerEenheid: 45, totaal: 360, type: "arbeid" },
        { id: "2", scope: "bestrating", omschrijving: "Tegels", eenheid: "uur", hoeveelheid: 12, prijsPerEenheid: 45, totaal: 540, type: "arbeid" },
        { id: "3", scope: "bestrating", omschrijving: "Zand", eenheid: "m3", hoeveelheid: 2, prijsPerEenheid: 35, totaal: 70, type: "materiaal" },
      ];

      const totals = calculateTotals(regels, 20, 21);

      expect(totals.totaalUren).toBe(20); // 8 + 12
    });

    it("applies scope-specific margins correctly", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Ontgraven", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
        { id: "2", scope: "bestrating", omschrijving: "Tegels", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
      ];

      const scopeMarges: ScopeMarges = {
        grondwerk: 15,
        bestrating: 25,
      };

      const totals = calculateTotals(regels, 20, 21, scopeMarges);

      // Grondwerk: 450 * 0.15 = 67.5
      // Bestrating: 450 * 0.25 = 112.5
      // Total marge: 180
      expect(totals.marge).toBe(180);
    });

    it("uses regel-level margin override when specified", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Ontgraven", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid", margePercentage: 30 },
        { id: "2", scope: "grondwerk", omschrijving: "Afvoer", eenheid: "m3", hoeveelheid: 5, prijsPerEenheid: 30, totaal: 150, type: "materiaal" },
      ];

      const totals = calculateTotals(regels, 20, 21);

      // Regel 1: 450 * 0.30 = 135 (uses regel override)
      // Regel 2: 150 * 0.20 = 30 (uses standard)
      // Total marge: 165
      expect(totals.marge).toBe(165);
    });

    it("handles zero values correctly", () => {
      const regels: OfferteRegel[] = [];

      const totals = calculateTotals(regels, 20, 21);

      expect(totals.arbeidskosten).toBe(0);
      expect(totals.materiaalkosten).toBe(0);
      expect(totals.subtotaal).toBe(0);
      expect(totals.marge).toBe(0);
      expect(totals.totaalExBtw).toBe(0);
      expect(totals.btw).toBe(0);
      expect(totals.totaalInclBtw).toBe(0);
    });

    it("handles very large values correctly", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Groot project", eenheid: "uur", hoeveelheid: 10000, prijsPerEenheid: 45, totaal: 450000, type: "arbeid" },
      ];

      const totals = calculateTotals(regels, 20, 21);

      expect(totals.arbeidskosten).toBe(450000);
      expect(totals.marge).toBe(90000);
      expect(totals.totaalExBtw).toBe(540000);
      expect(totals.totaalInclBtw).toBeCloseTo(653400, 2);
    });

    it("includes machine costs in arbeidskosten", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Graafmachine", eenheid: "dag", hoeveelheid: 2, prijsPerEenheid: 250, totaal: 500, type: "machine" },
        { id: "2", scope: "grondwerk", omschrijving: "Arbeid", eenheid: "uur", hoeveelheid: 16, prijsPerEenheid: 45, totaal: 720, type: "arbeid" },
      ];

      const totals = calculateTotals(regels, 20, 21);

      // Machine costs are added to arbeidskosten
      expect(totals.arbeidskosten).toBe(1220); // 500 + 720
    });
  });
});

describe("Offerte Calculator - Edge Cases", () => {
  let context: CalculationContext;

  beforeEach(() => {
    context = createContext();
  });

  it("handles zero oppervlakte gracefully", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 0, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    // Should return empty or minimal regels
    expect(regels.length).toBe(0);
  });

  it("handles missing scope data gracefully", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk", "bestrating"],
      scopeData: {
        grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: false },
        // bestrating data is missing
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    // Should only have grondwerk regels
    const grondwerkRegels = regels.filter(r => r.scope === "grondwerk");
    const bestratingRegels = regels.filter(r => r.scope === "bestrating");

    expect(grondwerkRegels.length).toBeGreaterThan(0);
    expect(bestratingRegels.length).toBe(0);
  });

  it("handles empty scopes array", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: [],
      scopeData: {},
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    expect(regels).toEqual([]);
  });

  it("handles unknown correction factor value", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "onbekend" as "goed", // Invalid value
    };

    // Should use default factor of 1.0
    const regels = calculateOfferteRegels(input, context);

    expect(regels.length).toBeGreaterThan(0);
  });

  it("handles missing normuren gracefully", () => {
    const contextWithoutNormuren = createContext({ normuren: [] });

    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, contextWithoutNormuren);

    // Should return empty array or handle gracefully
    expect(Array.isArray(regels)).toBe(true);
  });

  it("handles missing products gracefully", () => {
    const contextWithoutProducts = createContext({ producten: [] });

    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: true },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, contextWithoutProducts);

    // Should have arbeid regels but no materiaal regels
    const arbeidsRegels = regels.filter(r => r.type === "arbeid");
    const materiaalRegels = regels.filter(r => r.type === "materiaal");

    expect(arbeidsRegels.length).toBeGreaterThan(0);
    expect(materiaalRegels.length).toBe(0);
  });

  it("rounds hours to quarter correctly in regels", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 13, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    // Check that all arbeid regels have hours rounded to quarter
    for (const regel of regels.filter(r => r.type === "arbeid")) {
      const remainder = regel.hoeveelheid % 0.25;
      expect(remainder).toBeCloseTo(0, 5);
    }
  });

  it("handles negative values (should treat as zero)", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: -20, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    // Negative values should result in no regels or handle gracefully
    // The calculator checks for > 0, so negative should be treated as invalid
    expect(regels.length).toBe(0);
  });
});

describe("Offerte Calculator - Combined Scopes", () => {
  let context: CalculationContext;

  beforeEach(() => {
    context = createContext();
  });

  it("calculates multiple scopes in single calculation", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk", "bestrating", "borders"],
      scopeData: {
        grondwerk: { oppervlakte: 30, diepte: "standaard", afvoerGrond: false },
        bestrating: { oppervlakte: 20, typeBestrating: "tegel", snijwerk: "laag" },
        borders: { oppervlakte: 10, beplantingsintensiteit: "gemiddeld", afwerking: "geen" },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    // Should have regels from all three scopes
    const grondwerkRegels = regels.filter(r => r.scope === "grondwerk");
    const bestratingRegels = regels.filter(r => r.scope === "bestrating");
    const bordersRegels = regels.filter(r => r.scope === "borders");

    expect(grondwerkRegels.length).toBeGreaterThan(0);
    expect(bestratingRegels.length).toBeGreaterThan(0);
    expect(bordersRegels.length).toBeGreaterThan(0);
  });

  it("applies consistent bereikbaarheid factor across all scopes", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk", "bestrating"],
      scopeData: {
        grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: false },
        bestrating: { oppervlakte: 20, typeBestrating: "tegel", snijwerk: "laag" },
      },
      bereikbaarheid: "beperkt",
    };

    const regels = calculateOfferteRegels(input, context);

    // All arbeid regels should have bereikbaarheid factor applied (1.2)
    // This is implicitly tested by comparing with "goed" bereikbaarheid
    const inputGoed: OfferteCalculationInput = { ...input, bereikbaarheid: "goed" };
    const regelsGoed = calculateOfferteRegels(inputGoed, context);

    const totaalUrenBeperkt = regels.filter(r => r.type === "arbeid").reduce((sum, r) => sum + r.hoeveelheid, 0);
    const totaalUrenGoed = regelsGoed.filter(r => r.type === "arbeid").reduce((sum, r) => sum + r.hoeveelheid, 0);

    expect(totaalUrenBeperkt).toBeGreaterThan(totaalUrenGoed);
  });
});
