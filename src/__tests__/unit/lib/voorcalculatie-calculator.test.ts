import { describe, it, expect } from "vitest";
import {
  calculateNormuren,
  calculateProjectDuration,
  calculateProjectDurationWithBuffer,
  formatUren,
  formatDagen,
  getScopeLabel,
  scopeLabels,
  type OfferteData,
  type Normuur,
  type Correctiefactor,
} from "@/lib/voorcalculatie-calculator";

// Mock data factories
function createMockNormuren(): Normuur[] {
  return [
    // Grondwerk
    { activiteit: "ontgraven standaard", scope: "grondwerk", normuurPerEenheid: 0.25, eenheid: "m2" },
    { activiteit: "afvoeren grond", scope: "grondwerk", normuurPerEenheid: 0.1, eenheid: "m3" },
    // Bestrating
    { activiteit: "tegels leggen", scope: "bestrating", normuurPerEenheid: 0.4, eenheid: "m2" },
    { activiteit: "klinkers leggen", scope: "bestrating", normuurPerEenheid: 0.5, eenheid: "m2" },
    { activiteit: "zandbed aanbrengen", scope: "bestrating", normuurPerEenheid: 0.1, eenheid: "m2" },
    // Borders
    { activiteit: "grondbewerking", scope: "borders", normuurPerEenheid: 0.2, eenheid: "m2" },
    { activiteit: "planten gemiddeld", scope: "borders", normuurPerEenheid: 0.25, eenheid: "m2" },
    // Gras
    { activiteit: "graszoden leggen", scope: "gras", normuurPerEenheid: 0.12, eenheid: "m2" },
    { activiteit: "gras zaaien", scope: "gras", normuurPerEenheid: 0.05, eenheid: "m2" },
    // Houtwerk
    { activiteit: "schutting plaatsen", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "m" },
    { activiteit: "vlonder leggen", scope: "houtwerk", normuurPerEenheid: 0.6, eenheid: "m2" },
    { activiteit: "fundering standaard", scope: "houtwerk", normuurPerEenheid: 0.5, eenheid: "stuk" },
    // Water & Elektra
    { activiteit: "armatuur plaatsen", scope: "water_elektra", normuurPerEenheid: 0.5, eenheid: "stuk" },
    { activiteit: "sleuf graven", scope: "water_elektra", normuurPerEenheid: 0.3, eenheid: "m" },
    // Onderhoud
    { activiteit: "maaien", scope: "gras_onderhoud", normuurPerEenheid: 0.02, eenheid: "m2" },
    { activiteit: "wieden gemiddeld", scope: "borders_onderhoud", normuurPerEenheid: 0.15, eenheid: "m2" },
    { activiteit: "heg snoeien", scope: "heggen", normuurPerEenheid: 0.15, eenheid: "m3" },
    { activiteit: "boom snoeien licht", scope: "bomen", normuurPerEenheid: 0.5, eenheid: "stuk" },
    { activiteit: "boom snoeien zwaar", scope: "bomen", normuurPerEenheid: 1.5, eenheid: "stuk" },
  ];
}

function createMockCorrectiefactoren(): Correctiefactor[] {
  return [
    // Bereikbaarheid
    { type: "bereikbaarheid", waarde: "goed", factor: 1.0 },
    { type: "bereikbaarheid", waarde: "beperkt", factor: 1.2 },
    { type: "bereikbaarheid", waarde: "slecht", factor: 1.5 },
    // Snijwerk
    { type: "snijwerk", waarde: "laag", factor: 1.0 },
    { type: "snijwerk", waarde: "gemiddeld", factor: 1.1 },
    { type: "snijwerk", waarde: "hoog", factor: 1.3 },
    // Achterstalligheid
    { type: "achterstalligheid", waarde: "laag", factor: 1.0 },
    { type: "achterstalligheid", waarde: "gemiddeld", factor: 1.3 },
    { type: "achterstalligheid", waarde: "hoog", factor: 1.6 },
    // Diepte
    { type: "diepte", waarde: "licht", factor: 0.7 },
    { type: "diepte", waarde: "standaard", factor: 1.0 },
    { type: "diepte", waarde: "zwaar", factor: 1.4 },
    // Intensiteit
    { type: "intensiteit", waarde: "weinig", factor: 0.8 },
    { type: "intensiteit", waarde: "gemiddeld", factor: 1.0 },
    { type: "intensiteit", waarde: "veel", factor: 1.3 },
  ];
}

describe("Voorcalculatie Calculator - calculateNormuren", () => {
  describe("Grondwerk scope", () => {
    it("calculates normuren for ontgraven correctly", () => {
      const offerte: OfferteData = {
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 50, diepte: "standaard", afvoerGrond: false },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // 50m2 * 0.25 uur/m2 * 1.0 (diepte) * 1.0 (bereikbaarheid) = 12.5 uur
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(12.5, 1);
      expect(result.normUrenTotaal).toBeCloseTo(12.5, 1);
    });

    it("calculates normuren with afvoer grond correctly", () => {
      const offerte: OfferteData = {
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 40, diepte: "standaard", afvoerGrond: true },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // Ontgraven: 40 * 0.25 * 1.0 = 10 uur
      // Afvoer: 40 * 0.3 (volume) * 0.1 = 1.2 uur
      // Total: ~11.2 uur
      expect(result.normUrenPerScope.grondwerk).toBeGreaterThan(10);
    });

    it("applies diepte factor correctly", () => {
      const offerteLicht: OfferteData = {
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 30, diepte: "licht", afvoerGrond: false },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const offerteZwaar: OfferteData = {
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 30, diepte: "zwaar", afvoerGrond: false },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const normuren = createMockNormuren();
      const factoren = createMockCorrectiefactoren();

      const resultLicht = calculateNormuren(offerteLicht, normuren, factoren);
      const resultZwaar = calculateNormuren(offerteZwaar, normuren, factoren);

      // Zwaar should take more time than licht
      expect(resultZwaar.normUrenPerScope.grondwerk).toBeGreaterThan(
        resultLicht.normUrenPerScope.grondwerk
      );
    });
  });

  describe("Bestrating scope", () => {
    it("calculates normuren for tegels correctly", () => {
      const offerte: OfferteData = {
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 25, typeBestrating: "tegel", snijwerk: "laag" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // Tegels: 25 * 0.4 * 1.0 = 10 uur
      // Zandbed: 25 * 0.1 = 2.5 uur
      // Total: 12.5 uur
      expect(result.normUrenPerScope.bestrating).toBeCloseTo(12.5, 1);
    });

    it("applies snijwerk factor correctly", () => {
      const offerteLaag: OfferteData = {
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 20, typeBestrating: "tegel", snijwerk: "laag" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const offerteHoog: OfferteData = {
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 20, typeBestrating: "tegel", snijwerk: "hoog" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const normuren = createMockNormuren();
      const factoren = createMockCorrectiefactoren();

      const resultLaag = calculateNormuren(offerteLaag, normuren, factoren);
      const resultHoog = calculateNormuren(offerteHoog, normuren, factoren);

      // Hoog snijwerk (1.3) should take more time than laag (1.0)
      expect(resultHoog.normUrenPerScope.bestrating).toBeGreaterThan(
        resultLaag.normUrenPerScope.bestrating
      );
    });
  });

  describe("Borders scope", () => {
    it("calculates normuren for borders correctly", () => {
      const offerte: OfferteData = {
        scopes: ["borders"],
        scopeData: {
          borders: { oppervlakte: 15, beplantingsintensiteit: "gemiddeld" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // Grondbewerking: 15 * 0.2 = 3 uur
      // Planten: 15 * 0.25 * 1.0 = 3.75 uur
      // Total: ~6.75 uur
      expect(result.normUrenPerScope.borders).toBeGreaterThan(6);
    });
  });

  describe("Gras scope", () => {
    it("calculates normuren for graszoden correctly", () => {
      const offerte: OfferteData = {
        scopes: ["gras"],
        scopeData: {
          gras: { oppervlakte: 100, type: "graszoden" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // 100m2 * 0.12 uur/m2 = 12 uur
      expect(result.normUrenPerScope.gras).toBeCloseTo(12, 1);
    });

    it("calculates normuren for zaaien correctly (less time)", () => {
      const offerteZoden: OfferteData = {
        scopes: ["gras"],
        scopeData: {
          gras: { oppervlakte: 80, type: "graszoden" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const offerteZaaien: OfferteData = {
        scopes: ["gras"],
        scopeData: {
          gras: { oppervlakte: 80, type: "zaaien" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const normuren = createMockNormuren();
      const factoren = createMockCorrectiefactoren();

      const resultZoden = calculateNormuren(offerteZoden, normuren, factoren);
      const resultZaaien = calculateNormuren(offerteZaaien, normuren, factoren);

      // Zaaien (0.05) is faster than graszoden (0.12)
      expect(resultZaaien.normUrenPerScope.gras).toBeLessThan(
        resultZoden.normUrenPerScope.gras
      );
    });
  });

  describe("Houtwerk scope", () => {
    it("calculates normuren for schutting correctly", () => {
      const offerte: OfferteData = {
        scopes: ["houtwerk"],
        scopeData: {
          houtwerk: { afmeting: 12, typeHoutwerk: "schutting", fundering: "standaard" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // Schutting: 12m * 0.8 uur/m = 9.6 uur
      // Fundering: ceil(12/2) = 6 palen * 0.5 = 3 uur
      // Total: 12.6 uur
      expect(result.normUrenPerScope.houtwerk).toBeGreaterThan(12);
    });
  });

  describe("Water & Elektra scope", () => {
    it("calculates normuren for verlichting correctly", () => {
      const offerte: OfferteData = {
        scopes: ["water_elektra"],
        scopeData: {
          water_elektra: { aantalPunten: 6, sleuvenNodig: true },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // Armatuur: 6 * 0.5 = 3 uur
      // Sleuf: 6 * 3 (estimated length per point) * 0.3 = 5.4 uur
      // Total: ~8.4 uur
      expect(result.normUrenPerScope.water_elektra).toBeGreaterThan(8);
    });
  });

  describe("Onderhoud scopes", () => {
    it("calculates normuren for gras onderhoud correctly", () => {
      const offerte: OfferteData = {
        scopes: ["gras_onderhoud"],
        scopeData: {
          gras_onderhoud: { grasOppervlakte: 150, maaien: true },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // 150m2 * 0.02 uur/m2 = 3 uur
      expect(result.normUrenPerScope.gras_onderhoud).toBeCloseTo(3, 1);
    });

    it("calculates normuren for heggen correctly (volume based)", () => {
      const offerte: OfferteData = {
        scopes: ["heggen"],
        scopeData: {
          heggen: { lengte: 15, hoogte: 1.8, breedte: 0.6 },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // Volume: 15 * 1.8 * 0.6 = 16.2 m3
      // Uren: 16.2 * 0.15 = 2.43 uur
      expect(result.normUrenPerScope.heggen).toBeCloseTo(2.43, 1);
    });

    it("calculates normuren for bomen correctly", () => {
      const offerte: OfferteData = {
        scopes: ["bomen"],
        scopeData: {
          bomen: { aantalBomen: 8, snoei: "licht" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // 8 bomen * 0.5 uur/boom = 4 uur
      expect(result.normUrenPerScope.bomen).toBeCloseTo(4, 1);
    });
  });

  describe("Global correction factors", () => {
    it("applies bereikbaarheid factor to all scopes", () => {
      const offerteGoed: OfferteData = {
        scopes: ["grondwerk", "bestrating"],
        scopeData: {
          grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: false },
          bestrating: { oppervlakte: 15, typeBestrating: "tegel", snijwerk: "laag" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const offerteSlecht: OfferteData = {
        scopes: ["grondwerk", "bestrating"],
        scopeData: {
          grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: false },
          bestrating: { oppervlakte: 15, typeBestrating: "tegel", snijwerk: "laag" },
        },
        algemeenParams: { bereikbaarheid: "slecht" },
        regels: [],
      };

      const normuren = createMockNormuren();
      const factoren = createMockCorrectiefactoren();

      const resultGoed = calculateNormuren(offerteGoed, normuren, factoren);
      const resultSlecht = calculateNormuren(offerteSlecht, normuren, factoren);

      // Slecht bereikbaar (1.5) should be 50% more than goed (1.0)
      expect(resultSlecht.normUrenTotaal / resultGoed.normUrenTotaal).toBeCloseTo(1.5, 1);
      expect(resultSlecht.bereikbaarheidFactor).toBe(1.5);
      expect(resultGoed.bereikbaarheidFactor).toBe(1.0);
    });

    it("applies achterstalligheid factor correctly", () => {
      const offerteLaag: OfferteData = {
        scopes: ["gras_onderhoud"],
        scopeData: {
          gras_onderhoud: { grasOppervlakte: 100, maaien: true },
        },
        algemeenParams: { bereikbaarheid: "goed", achterstalligheid: "laag" },
        regels: [],
      };

      const offerteHoog: OfferteData = {
        scopes: ["gras_onderhoud"],
        scopeData: {
          gras_onderhoud: { grasOppervlakte: 100, maaien: true },
        },
        algemeenParams: { bereikbaarheid: "goed", achterstalligheid: "hoog" },
        regels: [],
      };

      const normuren = createMockNormuren();
      const factoren = createMockCorrectiefactoren();

      const resultLaag = calculateNormuren(offerteLaag, normuren, factoren);
      const resultHoog = calculateNormuren(offerteHoog, normuren, factoren);

      // Hoog achterstalligheid (1.6) should be 60% more than laag (1.0)
      expect(resultHoog.normUrenTotaal / resultLaag.normUrenTotaal).toBeCloseTo(1.6, 1);
      expect(resultHoog.achterstallijkheidFactor).toBe(1.6);
    });

    it("combines bereikbaarheid and achterstalligheid factors", () => {
      const offerte: OfferteData = {
        scopes: ["gras_onderhoud"],
        scopeData: {
          gras_onderhoud: { grasOppervlakte: 100, maaien: true },
        },
        algemeenParams: { bereikbaarheid: "beperkt", achterstalligheid: "gemiddeld" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // Combined factor: 1.2 * 1.3 = 1.56
      expect(result.bereikbaarheidFactor).toBe(1.2);
      expect(result.achterstallijkheidFactor).toBe(1.3);
      // Base: 100 * 0.02 = 2 uur
      // With factors: 2 * 1.2 * 1.3 = 3.12 uur
      expect(result.normUrenTotaal).toBeCloseTo(3.12, 1);
    });
  });

  describe("Fallback to regels", () => {
    it("uses arbeid regels when no scope data calculation returns 0", () => {
      const offerte: OfferteData = {
        scopes: ["specials"],
        scopeData: {
          specials: {}, // Empty scope data
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [
          { scope: "specials", type: "arbeid", hoeveelheid: 8 },
          { scope: "specials", type: "materiaal", hoeveelheid: 100 },
        ],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // Should use the arbeid regel hours
      expect(result.normUrenPerScope.specials).toBe(8);
    });
  });

  describe("Edge cases", () => {
    it("handles empty scopes array", () => {
      const offerte: OfferteData = {
        scopes: [],
        scopeData: {},
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      expect(result.normUrenTotaal).toBe(0);
      expect(Object.keys(result.normUrenPerScope)).toHaveLength(0);
    });

    it("handles missing scope data", () => {
      const offerte: OfferteData = {
        scopes: ["grondwerk"],
        scopeData: undefined as unknown as Record<string, Record<string, unknown>>,
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // Should handle gracefully
      expect(result.normUrenPerScope.grondwerk).toBe(0);
    });

    it("handles unknown correction factor value (defaults to 1.0)", () => {
      const offerte: OfferteData = {
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 20, diepte: "onbekend", afvoerGrond: false },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      // Should use default factor of 1.0
      // 20 * 0.25 * 1.0 = 5 uur
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(5, 1);
    });

    it("handles zero values in scope data", () => {
      const offerte: OfferteData = {
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 0, diepte: "standaard", afvoerGrond: false },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(
        offerte,
        createMockNormuren(),
        createMockCorrectiefactoren()
      );

      expect(result.normUrenPerScope.grondwerk).toBe(0);
    });
  });
});

describe("Voorcalculatie Calculator - calculateProjectDuration", () => {
  it("calculates project duration correctly for team of 2", () => {
    const result = calculateProjectDuration(56, 2, 7);

    // 56 uur / (2 personen * 7 uur/dag) = 56 / 14 = 4 dagen
    expect(result.geschatteDagen).toBe(4);
    expect(result.teamGrootte).toBe(2);
    expect(result.effectieveUrenPerDag).toBe(7);
    expect(result.teamCapaciteitPerDag).toBe(14);
    expect(result.normUrenTotaal).toBe(56);
  });

  it("calculates project duration correctly for team of 3", () => {
    const result = calculateProjectDuration(63, 3, 7);

    // 63 uur / (3 personen * 7 uur/dag) = 63 / 21 = 3 dagen
    expect(result.geschatteDagen).toBe(3);
    expect(result.teamCapaciteitPerDag).toBe(21);
  });

  it("calculates project duration correctly for team of 4", () => {
    const result = calculateProjectDuration(84, 4, 7);

    // 84 uur / (4 personen * 7 uur/dag) = 84 / 28 = 3 dagen
    expect(result.geschatteDagen).toBe(3);
    expect(result.teamCapaciteitPerDag).toBe(28);
  });

  it("rounds up partial days", () => {
    const result = calculateProjectDuration(50, 2, 7);

    // 50 uur / 14 = 3.57 dagen -> ceil = 4 dagen
    expect(result.geschatteDagen).toBe(4);
  });

  it("handles custom effective hours per day", () => {
    const result = calculateProjectDuration(48, 2, 8);

    // 48 uur / (2 * 8) = 48 / 16 = 3 dagen
    expect(result.geschatteDagen).toBe(3);
    expect(result.effectieveUrenPerDag).toBe(8);
  });

  it("handles very small projects", () => {
    const result = calculateProjectDuration(5, 2, 7);

    // 5 uur / 14 = 0.36 dagen -> ceil = 1 dag
    expect(result.geschatteDagen).toBe(1);
  });

  it("handles zero hours", () => {
    const result = calculateProjectDuration(0, 2, 7);

    expect(result.geschatteDagen).toBe(0);
  });
});

describe("Voorcalculatie Calculator - calculateProjectDurationWithBuffer", () => {
  it("calculates duration with default 10% buffer", () => {
    const result = calculateProjectDurationWithBuffer(70, 2, 7);

    // Base: 70 / 14 = 5 dagen
    // With 10% buffer: ceil(5 * 1.1) = ceil(5.5) = 6 dagen
    expect(result.geschatteDagen).toBe(5);
    expect(result.geschatteDagenMetBuffer).toBe(6);
  });

  it("calculates duration with custom buffer percentage", () => {
    const result = calculateProjectDurationWithBuffer(70, 2, 7, 20);

    // Base: 70 / 14 = 5 dagen
    // With 20% buffer: ceil(5 * 1.2) = ceil(6) = 6 dagen
    expect(result.geschatteDagen).toBe(5);
    expect(result.geschatteDagenMetBuffer).toBe(6);
  });

  it("handles zero buffer", () => {
    const result = calculateProjectDurationWithBuffer(70, 2, 7, 0);

    expect(result.geschatteDagen).toBe(5);
    expect(result.geschatteDagenMetBuffer).toBe(5);
  });

  it("handles large buffer percentage", () => {
    const result = calculateProjectDurationWithBuffer(56, 2, 7, 50);

    // Base: 56 / 14 = 4 dagen
    // With 50% buffer: ceil(4 * 1.5) = ceil(6) = 6 dagen
    expect(result.geschatteDagen).toBe(4);
    expect(result.geschatteDagenMetBuffer).toBe(6);
  });
});

describe("Voorcalculatie Calculator - Formatting functions", () => {
  describe("formatUren", () => {
    it("formats whole hours correctly", () => {
      expect(formatUren(5)).toBe("5 uur");
      expect(formatUren(10)).toBe("10 uur");
    });

    it("formats hours with minutes correctly", () => {
      expect(formatUren(1.5)).toBe("1:30 uur");
      expect(formatUren(2.25)).toBe("2:15 uur");
      expect(formatUren(3.75)).toBe("3:45 uur");
    });

    it("handles zero", () => {
      expect(formatUren(0)).toBe("0 uur");
    });
  });

  describe("formatDagen", () => {
    it("formats single day correctly", () => {
      expect(formatDagen(1)).toBe("1 dag");
    });

    it("formats multiple days correctly", () => {
      expect(formatDagen(2)).toBe("2 dagen");
      expect(formatDagen(5)).toBe("5 dagen");
      expect(formatDagen(10)).toBe("10 dagen");
    });
  });

  describe("getScopeLabel", () => {
    it("returns correct labels for known scopes", () => {
      expect(getScopeLabel("grondwerk")).toBe("Grondwerk");
      expect(getScopeLabel("bestrating")).toBe("Bestrating");
      expect(getScopeLabel("borders")).toBe("Borders");
      expect(getScopeLabel("gras")).toBe("Gras");
      expect(getScopeLabel("houtwerk")).toBe("Houtwerk");
      expect(getScopeLabel("water_elektra")).toBe("Water & Elektra");
      expect(getScopeLabel("specials")).toBe("Specials");
    });

    it("returns correct labels for onderhoud scopes", () => {
      expect(getScopeLabel("gras_onderhoud")).toBe("Gras Onderhoud");
      expect(getScopeLabel("borders_onderhoud")).toBe("Borders Onderhoud");
      expect(getScopeLabel("heggen")).toBe("Heggen");
      expect(getScopeLabel("bomen")).toBe("Bomen");
      expect(getScopeLabel("overig")).toBe("Overig");
    });

    it("returns original scope for unknown scopes", () => {
      expect(getScopeLabel("unknown_scope")).toBe("unknown_scope");
    });
  });

  describe("scopeLabels constant", () => {
    it("contains all expected scopes", () => {
      const expectedScopes = [
        "grondwerk",
        "bestrating",
        "borders",
        "gras",
        "houtwerk",
        "water_elektra",
        "specials",
        "gras_onderhoud",
        "borders_onderhoud",
        "heggen",
        "bomen",
        "overig",
      ];

      for (const scope of expectedScopes) {
        expect(scopeLabels[scope]).toBeDefined();
      }
    });
  });
});

describe("Voorcalculatie Calculator - Integration", () => {
  it("calculates complete project correctly", () => {
    const offerte: OfferteData = {
      scopes: ["grondwerk", "bestrating", "borders", "gras"],
      scopeData: {
        grondwerk: { oppervlakte: 60, diepte: "standaard", afvoerGrond: true },
        bestrating: { oppervlakte: 40, typeBestrating: "klinker", snijwerk: "gemiddeld" },
        borders: { oppervlakte: 20, beplantingsintensiteit: "gemiddeld" },
        gras: { oppervlakte: 80, type: "graszoden" },
      },
      algemeenParams: { bereikbaarheid: "beperkt" },
      regels: [],
    };

    const normuren = createMockNormuren();
    const factoren = createMockCorrectiefactoren();

    const voorcalculatie = calculateNormuren(offerte, normuren, factoren);

    // Verify we have hours for all scopes
    expect(voorcalculatie.normUrenPerScope.grondwerk).toBeGreaterThan(0);
    expect(voorcalculatie.normUrenPerScope.bestrating).toBeGreaterThan(0);
    expect(voorcalculatie.normUrenPerScope.borders).toBeGreaterThan(0);
    expect(voorcalculatie.normUrenPerScope.gras).toBeGreaterThan(0);

    // Verify bereikbaarheid factor is applied
    expect(voorcalculatie.bereikbaarheidFactor).toBe(1.2);

    // Calculate project duration
    const duration = calculateProjectDuration(voorcalculatie.normUrenTotaal, 2, 7);

    expect(duration.geschatteDagen).toBeGreaterThan(0);
    expect(duration.normUrenTotaal).toBe(voorcalculatie.normUrenTotaal);
  });
});
