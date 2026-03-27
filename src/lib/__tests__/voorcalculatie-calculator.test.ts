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

// ---------------------------------------------------------------------------
// Shared test fixtures — realistic Dutch landscaping project values
// ---------------------------------------------------------------------------

function createNormuren(): Normuur[] {
  return [
    // Grondwerk
    { activiteit: "ontgraven standaard", scope: "grondwerk", normuurPerEenheid: 0.25, eenheid: "m2" },
    { activiteit: "afvoeren grond", scope: "grondwerk", normuurPerEenheid: 0.1, eenheid: "m3" },
    // Bestrating
    { activiteit: "tegels leggen", scope: "bestrating", normuurPerEenheid: 0.4, eenheid: "m2" },
    { activiteit: "klinkers leggen", scope: "bestrating", normuurPerEenheid: 0.5, eenheid: "m2" },
    { activiteit: "natuursteen leggen", scope: "bestrating", normuurPerEenheid: 0.6, eenheid: "m2" },
    { activiteit: "zandbed aanbrengen", scope: "bestrating", normuurPerEenheid: 0.1, eenheid: "m2" },
    // Borders
    { activiteit: "grondbewerking", scope: "borders", normuurPerEenheid: 0.2, eenheid: "m2" },
    { activiteit: "planten gemiddeld", scope: "borders", normuurPerEenheid: 0.25, eenheid: "m2" },
    { activiteit: "planten veel", scope: "borders", normuurPerEenheid: 0.35, eenheid: "m2" },
    // Gras
    { activiteit: "graszoden leggen", scope: "gras", normuurPerEenheid: 0.12, eenheid: "m2" },
    { activiteit: "gras zaaien", scope: "gras", normuurPerEenheid: 0.05, eenheid: "m2" },
    // Houtwerk
    { activiteit: "schutting plaatsen", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "m" },
    { activiteit: "vlonder leggen", scope: "houtwerk", normuurPerEenheid: 0.6, eenheid: "m2" },
    { activiteit: "pergola bouwen", scope: "houtwerk", normuurPerEenheid: 1.2, eenheid: "stuk" },
    { activiteit: "fundering standaard slaan", scope: "houtwerk", normuurPerEenheid: 0.5, eenheid: "stuk" },
    { activiteit: "fundering zwaar slaan", scope: "houtwerk", normuurPerEenheid: 0.75, eenheid: "stuk" },
    // Water & Elektra
    { activiteit: "armatuur plaatsen", scope: "water_elektra", normuurPerEenheid: 0.5, eenheid: "stuk" },
    { activiteit: "sleuf graven", scope: "water_elektra", normuurPerEenheid: 0.3, eenheid: "m" },
    // Onderhoud - gras
    { activiteit: "maaien", scope: "gras_onderhoud", normuurPerEenheid: 0.02, eenheid: "m2" },
    // Onderhoud - borders
    { activiteit: "wieden gemiddeld", scope: "borders_onderhoud", normuurPerEenheid: 0.15, eenheid: "m2" },
    { activiteit: "wieden weinig", scope: "borders_onderhoud", normuurPerEenheid: 0.08, eenheid: "m2" },
    // Heggen
    { activiteit: "heg snoeien", scope: "heggen", normuurPerEenheid: 0.15, eenheid: "m3" },
    // Bomen
    { activiteit: "boom snoeien licht", scope: "bomen", normuurPerEenheid: 0.5, eenheid: "stuk" },
    { activiteit: "boom snoeien zwaar", scope: "bomen", normuurPerEenheid: 1.5, eenheid: "stuk" },
  ];
}

function createFactoren(): Correctiefactor[] {
  return [
    // Bereikbaarheid
    { type: "bereikbaarheid", waarde: "goed", factor: 1.0 },
    { type: "bereikbaarheid", waarde: "beperkt", factor: 1.2 },
    { type: "bereikbaarheid", waarde: "slecht", factor: 1.5 },
    // Achterstalligheid
    { type: "achterstalligheid", waarde: "laag", factor: 1.0 },
    { type: "achterstalligheid", waarde: "gemiddeld", factor: 1.3 },
    { type: "achterstalligheid", waarde: "hoog", factor: 1.6 },
    // Diepte
    { type: "diepte", waarde: "licht", factor: 0.7 },
    { type: "diepte", waarde: "standaard", factor: 1.0 },
    { type: "diepte", waarde: "zwaar", factor: 1.4 },
    // Snijwerk
    { type: "snijwerk", waarde: "laag", factor: 1.0 },
    { type: "snijwerk", waarde: "gemiddeld", factor: 1.1 },
    { type: "snijwerk", waarde: "hoog", factor: 1.3 },
    // Intensiteit
    { type: "intensiteit", waarde: "weinig", factor: 0.8 },
    { type: "intensiteit", waarde: "gemiddeld", factor: 1.0 },
    { type: "intensiteit", waarde: "veel", factor: 1.3 },
  ];
}

/** Helper to build minimal OfferteData for a single scope */
function makeSingleScopeOfferte(
  scope: string,
  scopeData: Record<string, unknown>,
  overrides: Partial<OfferteData> = {}
): OfferteData {
  return {
    scopes: [scope],
    scopeData: { [scope]: scopeData },
    algemeenParams: { bereikbaarheid: "goed" },
    regels: [],
    ...overrides,
  };
}

// ===========================================================================
// calculateNormuren — per scope
// ===========================================================================

describe("calculateNormuren", () => {
  // ---- Grondwerk ---------------------------------------------------------

  describe("grondwerk", () => {
    it("calculates ontgraven for a 50 m2 garden at standaard depth", () => {
      const offerte = makeSingleScopeOfferte("grondwerk", {
        oppervlakte: 50,
        diepte: "standaard",
        afvoerGrond: false,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 50 * 0.25 * 1.0 (diepte standaard) = 12.5
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(12.5, 2);
      expect(result.normUrenTotaal).toBeCloseTo(12.5, 2);
    });

    it("applies diepte licht factor (0.7)", () => {
      const offerte = makeSingleScopeOfferte("grondwerk", {
        oppervlakte: 40,
        diepte: "licht",
        afvoerGrond: false,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 40 * 0.25 * 0.7 = 7.0
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(7.0, 2);
    });

    it("applies diepte zwaar factor (1.4)", () => {
      const offerte = makeSingleScopeOfferte("grondwerk", {
        oppervlakte: 40,
        diepte: "zwaar",
        afvoerGrond: false,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 40 * 0.25 * 1.4 = 14.0
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(14.0, 2);
    });

    it("adds afvoer uren when afvoerGrond is true (standaard volume 0.3)", () => {
      const offerte = makeSingleScopeOfferte("grondwerk", {
        oppervlakte: 60,
        diepte: "standaard",
        afvoerGrond: true,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Ontgraven: 60 * 0.25 * 1.0 = 15
      // Afvoer volume: 60 * 0.3 = 18 m3; 18 * 0.1 = 1.8
      // Total: 16.8
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(16.8, 2);
    });

    it("uses licht volume (0.15) for afvoer when diepte is licht", () => {
      const offerte = makeSingleScopeOfferte("grondwerk", {
        oppervlakte: 40,
        diepte: "licht",
        afvoerGrond: true,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Ontgraven: 40 * 0.25 * 0.7 = 7.0
      // Afvoer volume: 40 * 0.15 = 6 m3; 6 * 0.1 = 0.6
      // Total: 7.6
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(7.6, 2);
    });

    it("uses zwaar volume (0.5) for afvoer when diepte is zwaar", () => {
      const offerte = makeSingleScopeOfferte("grondwerk", {
        oppervlakte: 30,
        diepte: "zwaar",
        afvoerGrond: true,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Ontgraven: 30 * 0.25 * 1.4 = 10.5
      // Afvoer volume: 30 * 0.5 = 15 m3; 15 * 0.1 = 1.5
      // Total: 12.0
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(12.0, 2);
    });

    it("returns 0 for zero oppervlakte", () => {
      const offerte = makeSingleScopeOfferte("grondwerk", {
        oppervlakte: 0,
        diepte: "standaard",
        afvoerGrond: true,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());
      expect(result.normUrenPerScope.grondwerk).toBe(0);
    });
  });

  // ---- Bestrating --------------------------------------------------------

  describe("bestrating", () => {
    it("calculates normuren for tegel with laag snijwerk", () => {
      const offerte = makeSingleScopeOfferte("bestrating", {
        oppervlakte: 25,
        typeBestrating: "tegel",
        snijwerk: "laag",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Tegels: 25 * 0.4 * 1.0 = 10
      // Zandbed: 25 * 0.1 = 2.5
      // Total: 12.5
      expect(result.normUrenPerScope.bestrating).toBeCloseTo(12.5, 2);
    });

    it("uses klinker normuur when typeBestrating is klinker", () => {
      const offerte = makeSingleScopeOfferte("bestrating", {
        oppervlakte: 20,
        typeBestrating: "klinker",
        snijwerk: "laag",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Klinkers: 20 * 0.5 * 1.0 = 10
      // Zandbed: 20 * 0.1 = 2
      // Total: 12
      expect(result.normUrenPerScope.bestrating).toBeCloseTo(12.0, 2);
    });

    it("uses natuursteen normuur when typeBestrating is natuursteen", () => {
      const offerte = makeSingleScopeOfferte("bestrating", {
        oppervlakte: 15,
        typeBestrating: "natuursteen",
        snijwerk: "laag",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Natuursteen: 15 * 0.6 * 1.0 = 9
      // Zandbed: 15 * 0.1 = 1.5
      // Total: 10.5
      expect(result.normUrenPerScope.bestrating).toBeCloseTo(10.5, 2);
    });

    it("applies snijwerk gemiddeld factor (1.1)", () => {
      const offerte = makeSingleScopeOfferte("bestrating", {
        oppervlakte: 20,
        typeBestrating: "tegel",
        snijwerk: "gemiddeld",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Tegels: 20 * 0.4 * 1.1 = 8.8
      // Zandbed: 20 * 0.1 = 2
      // Total: 10.8
      expect(result.normUrenPerScope.bestrating).toBeCloseTo(10.8, 2);
    });

    it("applies snijwerk hoog factor (1.3)", () => {
      const offerte = makeSingleScopeOfferte("bestrating", {
        oppervlakte: 20,
        typeBestrating: "tegel",
        snijwerk: "hoog",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Tegels: 20 * 0.4 * 1.3 = 10.4
      // Zandbed: 20 * 0.1 = 2
      // Total: 12.4
      expect(result.normUrenPerScope.bestrating).toBeCloseTo(12.4, 2);
    });

    it("klinker with hoog snijwerk takes more time than tegel with laag snijwerk", () => {
      const normuren = createNormuren();
      const factoren = createFactoren();

      const klinkerHoog = calculateNormuren(
        makeSingleScopeOfferte("bestrating", {
          oppervlakte: 30,
          typeBestrating: "klinker",
          snijwerk: "hoog",
        }),
        normuren,
        factoren
      );

      const tegelLaag = calculateNormuren(
        makeSingleScopeOfferte("bestrating", {
          oppervlakte: 30,
          typeBestrating: "tegel",
          snijwerk: "laag",
        }),
        normuren,
        factoren
      );

      expect(klinkerHoog.normUrenPerScope.bestrating).toBeGreaterThan(
        tegelLaag.normUrenPerScope.bestrating
      );
    });
  });

  // ---- Borders -----------------------------------------------------------

  describe("borders", () => {
    it("calculates normuren for borders with gemiddeld intensity", () => {
      const offerte = makeSingleScopeOfferte("borders", {
        oppervlakte: 20,
        beplantingsintensiteit: "gemiddeld",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Grondbewerking: 20 * 0.2 = 4
      // Planten: 20 * 0.25 * 1.0 = 5
      // Total: 9
      expect(result.normUrenPerScope.borders).toBeCloseTo(9.0, 2);
    });

    it("applies intensiteit veel factor (1.3) and uses matching normuur", () => {
      const offerte = makeSingleScopeOfferte("borders", {
        oppervlakte: 20,
        beplantingsintensiteit: "veel",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Grondbewerking: 20 * 0.2 = 4
      // Planten veel: 20 * 0.35 * 1.3 = 9.1
      // Total: 13.1
      expect(result.normUrenPerScope.borders).toBeCloseTo(13.1, 2);
    });

    it("uses weinig intensiteit factor (0.8)", () => {
      const offerte = makeSingleScopeOfferte("borders", {
        oppervlakte: 20,
        beplantingsintensiteit: "weinig",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Grondbewerking: 20 * 0.2 = 4
      // Planten (no "weinig" normuur match, falls back to "planten"): 20 * 0.25 * 0.8 = 4
      // Total: 8
      expect(result.normUrenPerScope.borders).toBeCloseTo(8.0, 2);
    });
  });

  // ---- Gras --------------------------------------------------------------

  describe("gras", () => {
    it("calculates normuren for graszoden", () => {
      const offerte = makeSingleScopeOfferte("gras", {
        oppervlakte: 100,
        type: "graszoden",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 100 * 0.12 = 12
      expect(result.normUrenPerScope.gras).toBeCloseTo(12.0, 2);
    });

    it("calculates normuren for zaaien (less time per m2)", () => {
      const offerte = makeSingleScopeOfferte("gras", {
        oppervlakte: 100,
        type: "zaaien",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 100 * 0.05 = 5
      expect(result.normUrenPerScope.gras).toBeCloseTo(5.0, 2);
    });

    it("zaaien is faster than graszoden for the same area", () => {
      const normuren = createNormuren();
      const factoren = createFactoren();

      const zoden = calculateNormuren(
        makeSingleScopeOfferte("gras", { oppervlakte: 80, type: "graszoden" }),
        normuren,
        factoren
      );
      const zaaien = calculateNormuren(
        makeSingleScopeOfferte("gras", { oppervlakte: 80, type: "zaaien" }),
        normuren,
        factoren
      );

      expect(zaaien.normUrenPerScope.gras).toBeLessThan(zoden.normUrenPerScope.gras);
    });

    it("uses fallback normuur (0.12) when type matches no activiteit", () => {
      const offerte = makeSingleScopeOfferte("gras", {
        oppervlakte: 50,
        type: "kunstgras",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // No normuur matches "kunstgras" -> fallback 0.12 for graszoden type default
      // But code uses: type === "graszoden" ? 0.12 : 0.05, and "kunstgras" is neither
      // So fallback is 0.05 (else branch)
      expect(result.normUrenPerScope.gras).toBeCloseTo(50 * 0.05, 2);
    });
  });

  // ---- Houtwerk ----------------------------------------------------------

  describe("houtwerk", () => {
    it("calculates normuren for a 12m schutting with standaard fundering", () => {
      const offerte = makeSingleScopeOfferte("houtwerk", {
        afmeting: 12,
        typeHoutwerk: "schutting",
        fundering: "standaard",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Schutting: 12 * 0.8 = 9.6
      // Palen: ceil(12/2) = 6 palen * 0.5 = 3
      // Total: 12.6
      expect(result.normUrenPerScope.houtwerk).toBeCloseTo(12.6, 2);
    });

    it("calculates normuren for vlonder (4 palen for non-schutting)", () => {
      const offerte = makeSingleScopeOfferte("houtwerk", {
        afmeting: 15,
        typeHoutwerk: "vlonder",
        fundering: "standaard",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Vlonder: 15 * 0.6 = 9
      // Palen: 4 (non-schutting) * 0.5 = 2
      // Total: 11
      expect(result.normUrenPerScope.houtwerk).toBeCloseTo(11.0, 2);
    });

    it("uses zwaar fundering normuur when fundering is zwaar", () => {
      const offerte = makeSingleScopeOfferte("houtwerk", {
        afmeting: 10,
        typeHoutwerk: "schutting",
        fundering: "zwaar",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Schutting: 10 * 0.8 = 8
      // Palen: ceil(10/2) = 5 * 0.75 (zwaar fundering) = 3.75
      // Total: 11.75
      expect(result.normUrenPerScope.houtwerk).toBeCloseTo(11.75, 2);
    });

    it("calculates correct palen count for odd-length schutting", () => {
      const offerte = makeSingleScopeOfferte("houtwerk", {
        afmeting: 7,
        typeHoutwerk: "schutting",
        fundering: "standaard",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Schutting: 7 * 0.8 = 5.6
      // Palen: ceil(7/2) = 4 * 0.5 = 2
      // Total: 7.6
      expect(result.normUrenPerScope.houtwerk).toBeCloseTo(7.6, 2);
    });
  });

  // ---- Water & Elektra ---------------------------------------------------

  describe("water_elektra", () => {
    it("calculates normuren for armaturen without sleuven", () => {
      const offerte = makeSingleScopeOfferte("water_elektra", {
        aantalPunten: 8,
        sleuvenNodig: false,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 8 * 0.5 = 4
      expect(result.normUrenPerScope.water_elektra).toBeCloseTo(4.0, 2);
    });

    it("adds sleuf graven uren when sleuvenNodig is true", () => {
      const offerte = makeSingleScopeOfferte("water_elektra", {
        aantalPunten: 6,
        sleuvenNodig: true,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Armatuur: 6 * 0.5 = 3
      // Sleuf: 6 * 3 (meters per punt) * 0.3 = 5.4
      // Total: 8.4
      expect(result.normUrenPerScope.water_elektra).toBeCloseTo(8.4, 2);
    });

    it("returns 0 when aantalPunten is 0", () => {
      const offerte = makeSingleScopeOfferte("water_elektra", {
        aantalPunten: 0,
        sleuvenNodig: true,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());
      expect(result.normUrenPerScope.water_elektra).toBe(0);
    });
  });

  // ---- Specials (unknown scope, fallback to regels) ----------------------

  describe("specials", () => {
    it("falls back to arbeid regels for specials scope", () => {
      const offerte: OfferteData = {
        scopes: ["specials"],
        scopeData: { specials: {} },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [
          { scope: "specials", type: "arbeid", hoeveelheid: 16 },
          { scope: "specials", type: "materiaal", hoeveelheid: 200 },
        ],
      };

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Only arbeid regels are summed: 16
      expect(result.normUrenPerScope.specials).toBe(16);
    });

    it("sums multiple arbeid regels", () => {
      const offerte: OfferteData = {
        scopes: ["specials"],
        scopeData: { specials: {} },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [
          { scope: "specials", type: "arbeid", hoeveelheid: 8 },
          { scope: "specials", type: "arbeid", hoeveelheid: 4 },
        ],
      };

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.normUrenPerScope.specials).toBe(12);
    });

    it("applies global correction factors to fallback arbeid regels", () => {
      const offerte: OfferteData = {
        scopes: ["specials"],
        scopeData: { specials: {} },
        algemeenParams: { bereikbaarheid: "slecht" },
        regels: [{ scope: "specials", type: "arbeid", hoeveelheid: 10 }],
      };

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 10 * 1.5 (bereikbaarheid slecht) = 15
      expect(result.normUrenPerScope.specials).toBe(15);
    });
  });

  // ---- Onderhoud scopes --------------------------------------------------

  describe("gras_onderhoud", () => {
    it("calculates maaien uren when maaien is true", () => {
      const offerte = makeSingleScopeOfferte("gras_onderhoud", {
        grasOppervlakte: 200,
        maaien: true,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 200 * 0.02 = 4
      expect(result.normUrenPerScope.gras_onderhoud).toBeCloseTo(4.0, 2);
    });

    it("returns 0 when maaien is false", () => {
      const offerte = makeSingleScopeOfferte("gras_onderhoud", {
        grasOppervlakte: 200,
        maaien: false,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.normUrenPerScope.gras_onderhoud).toBe(0);
    });
  });

  describe("borders_onderhoud", () => {
    it("calculates wieden uren for borders onderhoud", () => {
      const offerte = makeSingleScopeOfferte("borders_onderhoud", {
        borderOppervlakte: 30,
        onderhoudsintensiteit: "gemiddeld",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 30 * 0.15 = 4.5
      expect(result.normUrenPerScope.borders_onderhoud).toBeCloseTo(4.5, 2);
    });

    it("uses weinig intensiteit normuur when available", () => {
      const offerte = makeSingleScopeOfferte("borders_onderhoud", {
        borderOppervlakte: 30,
        onderhoudsintensiteit: "weinig",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // "weinig" matches "wieden weinig" normuur: 30 * 0.08 = 2.4
      expect(result.normUrenPerScope.borders_onderhoud).toBeCloseTo(2.4, 2);
    });
  });

  describe("heggen", () => {
    it("calculates normuren based on volume (length x height x width)", () => {
      const offerte = makeSingleScopeOfferte("heggen", {
        lengte: 20,
        hoogte: 2.0,
        breedte: 0.8,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Volume: 20 * 2.0 * 0.8 = 32 m3
      // 32 * 0.15 = 4.8
      expect(result.normUrenPerScope.heggen).toBeCloseTo(4.8, 2);
    });

    it("uses default hoogte (1) and breedte (0.5) when missing", () => {
      const offerte = makeSingleScopeOfferte("heggen", {
        lengte: 10,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Volume: 10 * 1 * 0.5 = 5 m3
      // 5 * 0.15 = 0.75
      expect(result.normUrenPerScope.heggen).toBeCloseTo(0.75, 2);
    });
  });

  describe("bomen", () => {
    it("calculates normuren for licht snoei", () => {
      const offerte = makeSingleScopeOfferte("bomen", {
        aantalBomen: 6,
        snoei: "licht",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 6 * 0.5 = 3
      expect(result.normUrenPerScope.bomen).toBeCloseTo(3.0, 2);
    });

    it("calculates normuren for zwaar snoei", () => {
      const offerte = makeSingleScopeOfferte("bomen", {
        aantalBomen: 4,
        snoei: "zwaar",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // 4 * 1.5 = 6
      expect(result.normUrenPerScope.bomen).toBeCloseTo(6.0, 2);
    });

    it("zwaar snoei takes more time per boom than licht", () => {
      const normuren = createNormuren();
      const factoren = createFactoren();

      const licht = calculateNormuren(
        makeSingleScopeOfferte("bomen", { aantalBomen: 5, snoei: "licht" }),
        normuren,
        factoren
      );
      const zwaar = calculateNormuren(
        makeSingleScopeOfferte("bomen", { aantalBomen: 5, snoei: "zwaar" }),
        normuren,
        factoren
      );

      expect(zwaar.normUrenPerScope.bomen).toBeGreaterThan(licht.normUrenPerScope.bomen);
    });
  });

  // ---- Global correction factors -----------------------------------------

  describe("global correction factors", () => {
    it("returns bereikbaarheidFactor 1.0 for goed", () => {
      const offerte = makeSingleScopeOfferte("gras", {
        oppervlakte: 50,
        type: "graszoden",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.bereikbaarheidFactor).toBe(1.0);
    });

    it("returns bereikbaarheidFactor 1.2 for beperkt", () => {
      const offerte = makeSingleScopeOfferte("gras", {
        oppervlakte: 50,
        type: "graszoden",
      }, { algemeenParams: { bereikbaarheid: "beperkt" } });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.bereikbaarheidFactor).toBe(1.2);
      // 50 * 0.12 * 1.2 = 7.2
      expect(result.normUrenPerScope.gras).toBeCloseTo(7.2, 2);
    });

    it("returns bereikbaarheidFactor 1.5 for slecht", () => {
      const offerte = makeSingleScopeOfferte("gras", {
        oppervlakte: 50,
        type: "graszoden",
      }, { algemeenParams: { bereikbaarheid: "slecht" } });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.bereikbaarheidFactor).toBe(1.5);
      // 50 * 0.12 * 1.5 = 9
      expect(result.normUrenPerScope.gras).toBeCloseTo(9.0, 2);
    });

    it("multiplies bereikbaarheid factor across all scopes", () => {
      const normuren = createNormuren();
      const factoren = createFactoren();

      const goedOfferte: OfferteData = {
        scopes: ["grondwerk", "gras"],
        scopeData: {
          grondwerk: { oppervlakte: 30, diepte: "standaard", afvoerGrond: false },
          gras: { oppervlakte: 60, type: "graszoden" },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const slechtOfferte: OfferteData = {
        ...goedOfferte,
        algemeenParams: { bereikbaarheid: "slecht" },
      };

      const goed = calculateNormuren(goedOfferte, normuren, factoren);
      const slecht = calculateNormuren(slechtOfferte, normuren, factoren);

      expect(slecht.normUrenTotaal / goed.normUrenTotaal).toBeCloseTo(1.5, 2);
    });

    it("returns achterstallijkheidFactor 1.0 when achterstalligheid is omitted", () => {
      const offerte = makeSingleScopeOfferte("gras", {
        oppervlakte: 50,
        type: "graszoden",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.achterstallijkheidFactor).toBe(1.0);
    });

    it("applies achterstalligheid gemiddeld factor (1.3)", () => {
      const offerte = makeSingleScopeOfferte("gras", {
        oppervlakte: 50,
        type: "graszoden",
      }, {
        algemeenParams: { bereikbaarheid: "goed", achterstalligheid: "gemiddeld" },
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.achterstallijkheidFactor).toBe(1.3);
      // 50 * 0.12 * 1.0 * 1.3 = 7.8
      expect(result.normUrenPerScope.gras).toBeCloseTo(7.8, 2);
    });

    it("applies achterstalligheid hoog factor (1.6)", () => {
      const offerte = makeSingleScopeOfferte("gras", {
        oppervlakte: 50,
        type: "graszoden",
      }, {
        algemeenParams: { bereikbaarheid: "goed", achterstalligheid: "hoog" },
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.achterstallijkheidFactor).toBe(1.6);
      // 50 * 0.12 * 1.6 = 9.6
      expect(result.normUrenPerScope.gras).toBeCloseTo(9.6, 2);
    });

    it("combines bereikbaarheid beperkt + achterstalligheid hoog", () => {
      const offerte = makeSingleScopeOfferte("gras", {
        oppervlakte: 100,
        type: "graszoden",
      }, {
        algemeenParams: { bereikbaarheid: "beperkt", achterstalligheid: "hoog" },
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.bereikbaarheidFactor).toBe(1.2);
      expect(result.achterstallijkheidFactor).toBe(1.6);
      // 100 * 0.12 * 1.2 * 1.6 = 23.04
      expect(result.normUrenTotaal).toBeCloseTo(23.04, 2);
    });
  });

  // ---- Fallback to arbeid regels -----------------------------------------

  describe("fallback to arbeid regels when scope returns 0", () => {
    it("falls back for unknown scope type", () => {
      const offerte: OfferteData = {
        scopes: ["zwembad_aanleg"],
        scopeData: { zwembad_aanleg: { diepte: 2 } },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [
          { scope: "zwembad_aanleg", type: "arbeid", hoeveelheid: 24 },
          { scope: "zwembad_aanleg", type: "arbeid", hoeveelheid: 8 },
        ],
      };

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.normUrenPerScope.zwembad_aanleg).toBe(32);
    });

    it("does NOT fall back when scope calculation produces > 0", () => {
      const offerte: OfferteData = {
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: false },
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [
          { scope: "grondwerk", type: "arbeid", hoeveelheid: 999 },
        ],
      };

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Should use calculated value (20 * 0.25 = 5), not the 999 from regels
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(5.0, 2);
    });

    it("ignores materiaal and machine regels in fallback", () => {
      const offerte: OfferteData = {
        scopes: ["specials"],
        scopeData: { specials: {} },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [
          { scope: "specials", type: "materiaal", hoeveelheid: 500 },
          { scope: "specials", type: "machine", hoeveelheid: 200 },
        ],
      };

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // No arbeid regels -> 0
      expect(result.normUrenPerScope.specials).toBe(0);
    });
  });

  // ---- Edge cases --------------------------------------------------------

  describe("edge cases", () => {
    it("handles empty scopes array", () => {
      const offerte: OfferteData = {
        scopes: [],
        scopeData: {},
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.normUrenTotaal).toBe(0);
      expect(Object.keys(result.normUrenPerScope)).toHaveLength(0);
    });

    it("handles undefined scopeData gracefully", () => {
      const offerte: OfferteData = {
        scopes: ["grondwerk"],
        scopeData: undefined,
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [],
      };

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.normUrenPerScope.grondwerk).toBe(0);
    });

    it("handles single scope project", () => {
      const offerte = makeSingleScopeOfferte("bestrating", {
        oppervlakte: 30,
        typeBestrating: "tegel",
        snijwerk: "laag",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(Object.keys(result.normUrenPerScope)).toHaveLength(1);
      expect(result.normUrenTotaal).toBe(result.normUrenPerScope.bestrating);
    });

    it("handles all 7 aanleg scopes at once", () => {
      const offerte: OfferteData = {
        scopes: ["grondwerk", "bestrating", "borders", "gras", "houtwerk", "water_elektra", "specials"],
        scopeData: {
          grondwerk: { oppervlakte: 50, diepte: "standaard", afvoerGrond: false },
          bestrating: { oppervlakte: 40, typeBestrating: "klinker", snijwerk: "gemiddeld" },
          borders: { oppervlakte: 25, beplantingsintensiteit: "gemiddeld" },
          gras: { oppervlakte: 80, type: "graszoden" },
          houtwerk: { afmeting: 15, typeHoutwerk: "schutting", fundering: "standaard" },
          water_elektra: { aantalPunten: 8, sleuvenNodig: true },
          specials: {},
        },
        algemeenParams: { bereikbaarheid: "goed" },
        regels: [
          { scope: "specials", type: "arbeid", hoeveelheid: 12 },
        ],
      };

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(Object.keys(result.normUrenPerScope)).toHaveLength(7);

      // Each scope should have > 0 uren
      for (const scope of offerte.scopes) {
        expect(result.normUrenPerScope[scope]).toBeGreaterThan(0);
      }

      // Total should equal sum of all scopes
      const expectedTotal = Object.values(result.normUrenPerScope).reduce((a, b) => a + b, 0);
      expect(result.normUrenTotaal).toBeCloseTo(expectedTotal, 2);
    });

    it("handles zero values in all scope data fields", () => {
      const offerte = makeSingleScopeOfferte("bestrating", {
        oppervlakte: 0,
        typeBestrating: "tegel",
        snijwerk: "laag",
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      expect(result.normUrenPerScope.bestrating).toBe(0);
    });

    it("handles empty normuren array (uses fallback normuur values)", () => {
      const offerte = makeSingleScopeOfferte("grondwerk", {
        oppervlakte: 20,
        diepte: "standaard",
        afvoerGrond: false,
      });

      // No matching normuren — uses fallback constants in the code
      const result = calculateNormuren(offerte, [], createFactoren());

      // Fallback: 20 * 0.25 (hardcoded default) * 1.0 (diepte not found -> 1.0) = 5
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(5.0, 2);
    });

    it("handles empty factoren array (defaults to 1.0)", () => {
      const offerte = makeSingleScopeOfferte("grondwerk", {
        oppervlakte: 20,
        diepte: "standaard",
        afvoerGrond: false,
      });

      const result = calculateNormuren(offerte, createNormuren(), []);

      // bereikbaarheid defaults to 1.0, diepte defaults to 1.0
      // 20 * 0.25 * 1.0 = 5
      expect(result.normUrenPerScope.grondwerk).toBeCloseTo(5.0, 2);
      expect(result.bereikbaarheidFactor).toBe(1.0);
      expect(result.achterstallijkheidFactor).toBe(1.0);
    });

    it("rounds normuren per scope to 2 decimal places", () => {
      const offerte = makeSingleScopeOfferte("heggen", {
        lengte: 7,
        hoogte: 1.3,
        breedte: 0.4,
      });

      const result = calculateNormuren(offerte, createNormuren(), createFactoren());

      // Volume: 7 * 1.3 * 0.4 = 3.64 m3
      // Uren: 3.64 * 0.15 = 0.546 -> rounded to 0.55
      const value = result.normUrenPerScope.heggen;
      const decimals = value.toString().split(".")[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });
});

// ===========================================================================
// calculateProjectDuration
// ===========================================================================

describe("calculateProjectDuration", () => {
  it("calculates for a team of 2 with 7 effective hours/day", () => {
    const result = calculateProjectDuration(56, 2, 7);

    expect(result.geschatteDagen).toBe(4); // 56 / 14 = 4
    expect(result.teamGrootte).toBe(2);
    expect(result.effectieveUrenPerDag).toBe(7);
    expect(result.teamCapaciteitPerDag).toBe(14);
    expect(result.normUrenTotaal).toBe(56);
  });

  it("calculates for a team of 3", () => {
    const result = calculateProjectDuration(63, 3, 7);

    expect(result.geschatteDagen).toBe(3); // 63 / 21 = 3
    expect(result.teamCapaciteitPerDag).toBe(21);
  });

  it("calculates for a team of 4", () => {
    const result = calculateProjectDuration(112, 4, 7);

    expect(result.geschatteDagen).toBe(4); // 112 / 28 = 4
    expect(result.teamCapaciteitPerDag).toBe(28);
  });

  it("rounds up partial days with Math.ceil", () => {
    const result = calculateProjectDuration(50, 2, 7);

    // 50 / 14 = 3.571 -> ceil = 4
    expect(result.geschatteDagen).toBe(4);
  });

  it("returns 1 dag for a very small project", () => {
    const result = calculateProjectDuration(3, 2, 7);

    // 3 / 14 = 0.214 -> ceil = 1
    expect(result.geschatteDagen).toBe(1);
  });

  it("returns 0 dagen for zero uren", () => {
    const result = calculateProjectDuration(0, 2, 7);

    expect(result.geschatteDagen).toBe(0);
  });

  it("uses default 7 effectieveUrenPerDag when omitted", () => {
    const result = calculateProjectDuration(42, 2);

    // 42 / (2 * 7) = 3
    expect(result.geschatteDagen).toBe(3);
    expect(result.effectieveUrenPerDag).toBe(7);
  });

  it("supports custom effectieveUrenPerDag of 8", () => {
    const result = calculateProjectDuration(48, 2, 8);

    // 48 / 16 = 3
    expect(result.geschatteDagen).toBe(3);
    expect(result.effectieveUrenPerDag).toBe(8);
  });

  it("larger team results in fewer days for the same uren", () => {
    const team2 = calculateProjectDuration(84, 2, 7);
    const team3 = calculateProjectDuration(84, 3, 7);
    const team4 = calculateProjectDuration(84, 4, 7);

    expect(team2.geschatteDagen).toBeGreaterThanOrEqual(team3.geschatteDagen);
    expect(team3.geschatteDagen).toBeGreaterThanOrEqual(team4.geschatteDagen);
  });
});

// ===========================================================================
// calculateProjectDurationWithBuffer
// ===========================================================================

describe("calculateProjectDurationWithBuffer", () => {
  it("adds default 10% buffer", () => {
    const result = calculateProjectDurationWithBuffer(70, 2, 7);

    // Base: 70 / 14 = 5 dagen
    // Buffer: ceil(5 * 1.1) = ceil(5.5) = 6
    expect(result.geschatteDagen).toBe(5);
    expect(result.geschatteDagenMetBuffer).toBe(6);
  });

  it("adds 20% buffer", () => {
    const result = calculateProjectDurationWithBuffer(70, 2, 7, 20);

    // Buffer: ceil(5 * 1.2) = 6
    expect(result.geschatteDagenMetBuffer).toBe(6);
  });

  it("adds 50% buffer", () => {
    const result = calculateProjectDurationWithBuffer(56, 2, 7, 50);

    // Base: 4 dagen, Buffer: ceil(4 * 1.5) = 6
    expect(result.geschatteDagen).toBe(4);
    expect(result.geschatteDagenMetBuffer).toBe(6);
  });

  it("handles 0% buffer (no change)", () => {
    const result = calculateProjectDurationWithBuffer(56, 2, 7, 0);

    expect(result.geschatteDagen).toBe(4);
    expect(result.geschatteDagenMetBuffer).toBe(4);
  });

  it("buffer always >= base days", () => {
    const result = calculateProjectDurationWithBuffer(42, 3, 7, 10);

    expect(result.geschatteDagenMetBuffer).toBeGreaterThanOrEqual(result.geschatteDagen);
  });

  it("returns all base fields from calculateProjectDuration", () => {
    const result = calculateProjectDurationWithBuffer(84, 3, 7, 15);

    expect(result).toHaveProperty("geschatteDagen");
    expect(result).toHaveProperty("effectieveUrenPerDag");
    expect(result).toHaveProperty("teamGrootte");
    expect(result).toHaveProperty("normUrenTotaal");
    expect(result).toHaveProperty("teamCapaciteitPerDag");
    expect(result).toHaveProperty("geschatteDagenMetBuffer");
  });

  it("handles zero uren with buffer", () => {
    const result = calculateProjectDurationWithBuffer(0, 2, 7, 10);

    expect(result.geschatteDagen).toBe(0);
    expect(result.geschatteDagenMetBuffer).toBe(0);
  });
});

// ===========================================================================
// Formatting functions
// ===========================================================================

describe("formatUren", () => {
  it("formats whole hours", () => {
    expect(formatUren(0)).toBe("0 uur");
    expect(formatUren(1)).toBe("1 uur");
    expect(formatUren(8)).toBe("8 uur");
    expect(formatUren(24)).toBe("24 uur");
  });

  it("formats fractional hours as hours:minutes", () => {
    expect(formatUren(1.5)).toBe("1:30 uur");
    expect(formatUren(2.25)).toBe("2:15 uur");
    expect(formatUren(3.75)).toBe("3:45 uur");
  });

  it("pads single-digit minutes with leading zero", () => {
    // 0.083... hours = ~5 minutes
    expect(formatUren(7 + 5 / 60)).toBe("7:05 uur");
  });
});

describe("formatDagen", () => {
  it("uses singular 'dag' for 1", () => {
    expect(formatDagen(1)).toBe("1 dag");
  });

  it("uses plural 'dagen' for > 1", () => {
    expect(formatDagen(2)).toBe("2 dagen");
    expect(formatDagen(10)).toBe("10 dagen");
  });

  it("uses plural 'dagen' for 0", () => {
    expect(formatDagen(0)).toBe("0 dagen");
  });
});

describe("getScopeLabel", () => {
  it("returns Dutch labels for all known aanleg scopes", () => {
    expect(getScopeLabel("grondwerk")).toBe("Grondwerk");
    expect(getScopeLabel("bestrating")).toBe("Bestrating");
    expect(getScopeLabel("borders")).toBe("Borders");
    expect(getScopeLabel("gras")).toBe("Gras");
    expect(getScopeLabel("houtwerk")).toBe("Houtwerk");
    expect(getScopeLabel("water_elektra")).toBe("Water & Elektra");
    expect(getScopeLabel("specials")).toBe("Specials");
  });

  it("returns Dutch labels for all known onderhoud scopes", () => {
    expect(getScopeLabel("gras_onderhoud")).toBe("Gras Onderhoud");
    expect(getScopeLabel("borders_onderhoud")).toBe("Borders Onderhoud");
    expect(getScopeLabel("heggen")).toBe("Heggen");
    expect(getScopeLabel("bomen")).toBe("Bomen");
    expect(getScopeLabel("overig")).toBe("Overig");
  });

  it("returns the raw scope key for unknown scopes", () => {
    expect(getScopeLabel("onbekend")).toBe("onbekend");
    expect(getScopeLabel("")).toBe("");
  });
});

describe("scopeLabels", () => {
  it("contains all 12 expected scope keys", () => {
    const expectedKeys = [
      "grondwerk", "bestrating", "borders", "gras",
      "houtwerk", "water_elektra", "specials",
      "gras_onderhoud", "borders_onderhoud", "heggen", "bomen", "overig",
    ];

    for (const key of expectedKeys) {
      expect(scopeLabels).toHaveProperty(key);
    }
    expect(Object.keys(scopeLabels)).toHaveLength(expectedKeys.length);
  });
});

// ===========================================================================
// Integration: realistic full project
// ===========================================================================

describe("integration: realistic tuinaanleg project", () => {
  it("calculates a complete Almere achtertuin renovation", () => {
    const offerte: OfferteData = {
      scopes: ["grondwerk", "bestrating", "borders", "gras", "houtwerk", "water_elektra"],
      scopeData: {
        grondwerk: { oppervlakte: 65, diepte: "standaard", afvoerGrond: true },
        bestrating: { oppervlakte: 35, typeBestrating: "klinker", snijwerk: "gemiddeld" },
        borders: { oppervlakte: 18, beplantingsintensiteit: "veel" },
        gras: { oppervlakte: 90, type: "graszoden" },
        houtwerk: { afmeting: 14, typeHoutwerk: "schutting", fundering: "standaard" },
        water_elektra: { aantalPunten: 5, sleuvenNodig: true },
      },
      algemeenParams: { bereikbaarheid: "beperkt" },
      regels: [],
    };

    const normuren = createNormuren();
    const factoren = createFactoren();

    const voorcalculatie = calculateNormuren(offerte, normuren, factoren);

    // All scopes should have hours
    for (const scope of offerte.scopes) {
      expect(voorcalculatie.normUrenPerScope[scope]).toBeGreaterThan(0);
    }

    // Bereikbaarheid beperkt applied
    expect(voorcalculatie.bereikbaarheidFactor).toBe(1.2);
    expect(voorcalculatie.achterstallijkheidFactor).toBe(1.0);

    // Total should be realistic for a week-long project
    expect(voorcalculatie.normUrenTotaal).toBeGreaterThan(50);
    expect(voorcalculatie.normUrenTotaal).toBeLessThan(200);

    // Duration with team of 2
    const duration = calculateProjectDuration(voorcalculatie.normUrenTotaal, 2, 7);
    expect(duration.geschatteDagen).toBeGreaterThanOrEqual(4);
    expect(duration.geschatteDagen).toBeLessThanOrEqual(12);

    // With 15% buffer for weather
    const withBuffer = calculateProjectDurationWithBuffer(
      voorcalculatie.normUrenTotaal, 2, 7, 15
    );
    expect(withBuffer.geschatteDagenMetBuffer).toBeGreaterThan(duration.geschatteDagen);
  });

  it("calculates a complete onderhoud contract", () => {
    const offerte: OfferteData = {
      scopes: ["gras_onderhoud", "borders_onderhoud", "heggen", "bomen"],
      scopeData: {
        gras_onderhoud: { grasOppervlakte: 250, maaien: true },
        borders_onderhoud: { borderOppervlakte: 40, onderhoudsintensiteit: "gemiddeld" },
        heggen: { lengte: 30, hoogte: 1.5, breedte: 0.6 },
        bomen: { aantalBomen: 5, snoei: "licht" },
      },
      algemeenParams: { bereikbaarheid: "goed", achterstalligheid: "gemiddeld" },
      regels: [],
    };

    const result = calculateNormuren(offerte, createNormuren(), createFactoren());

    expect(result.achterstallijkheidFactor).toBe(1.3);
    expect(Object.keys(result.normUrenPerScope)).toHaveLength(4);
    expect(result.normUrenTotaal).toBeGreaterThan(10);
  });
});
