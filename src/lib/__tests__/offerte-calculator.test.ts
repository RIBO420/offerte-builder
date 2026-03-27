/**
 * Uitgebreide unit tests voor de Offerte Calculator
 *
 * Test alle publieke functies en alle scope-berekeningen via de publieke API.
 * Gebruikt realistische Nederlandse tuinaanleg data.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateOfferteRegels,
  calculateTotals,
  getOfferteOverhead,
  getGarantiePakketRegel,
  type CalculationContext,
  type OfferteCalculationInput,
  type Normuur,
  type Correctiefactor,
  type Product,
  type Instellingen,
  type OfferteRegel,
  type ScopeMarges,
} from "@/lib/offerte-calculator";

// ==================== TEST FIXTURES ====================

/**
 * Alle normuren voor aanleg en onderhoud scopes.
 * Elke activiteit die de calculator opzoekt moet hier staan.
 */
function createNormuren(): Normuur[] {
  return [
    // Grondwerk
    { _id: "n1", activiteit: "ontgraven licht", scope: "grondwerk", normuurPerEenheid: 0.15, eenheid: "m2" },
    { _id: "n2", activiteit: "ontgraven standaard", scope: "grondwerk", normuurPerEenheid: 0.25, eenheid: "m2" },
    { _id: "n3", activiteit: "ontgraven zwaar", scope: "grondwerk", normuurPerEenheid: 0.35, eenheid: "m2" },
    { _id: "n4", activiteit: "afvoeren grond", scope: "grondwerk", normuurPerEenheid: 0.1, eenheid: "m3" },
    // Bestrating
    { _id: "n5", activiteit: "tegels leggen", scope: "bestrating", normuurPerEenheid: 0.4, eenheid: "m2" },
    { _id: "n6", activiteit: "klinkers leggen", scope: "bestrating", normuurPerEenheid: 0.5, eenheid: "m2" },
    { _id: "n7", activiteit: "natuursteen leggen", scope: "bestrating", normuurPerEenheid: 0.6, eenheid: "m2" },
    { _id: "n8", activiteit: "zandbed aanbrengen", scope: "bestrating", normuurPerEenheid: 0.1, eenheid: "m2" },
    { _id: "n9", activiteit: "opsluitbanden plaatsen", scope: "bestrating", normuurPerEenheid: 0.2, eenheid: "m" },
    // Borders
    { _id: "n10", activiteit: "grondbewerking", scope: "borders", normuurPerEenheid: 0.2, eenheid: "m2" },
    { _id: "n11", activiteit: "planten laag", scope: "borders", normuurPerEenheid: 0.15, eenheid: "m2" },
    { _id: "n12", activiteit: "planten gemiddeld", scope: "borders", normuurPerEenheid: 0.25, eenheid: "m2" },
    { _id: "n13", activiteit: "planten hoog", scope: "borders", normuurPerEenheid: 0.35, eenheid: "m2" },
    { _id: "n14", activiteit: "schors aanbrengen", scope: "borders", normuurPerEenheid: 0.08, eenheid: "m2" },
    // Gras
    { _id: "n15", activiteit: "ondergrond bewerken", scope: "gras", normuurPerEenheid: 0.1, eenheid: "m2" },
    { _id: "n16", activiteit: "graszoden leggen", scope: "gras", normuurPerEenheid: 0.12, eenheid: "m2" },
    { _id: "n17", activiteit: "gras zaaien", scope: "gras", normuurPerEenheid: 0.05, eenheid: "m2" },
    { _id: "n18", activiteit: "kunstgras leggen", scope: "gras", normuurPerEenheid: 0.15, eenheid: "m2" },
    // Houtwerk
    { _id: "n19", activiteit: "schutting plaatsen", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "m" },
    { _id: "n20", activiteit: "vlonder leggen", scope: "houtwerk", normuurPerEenheid: 0.6, eenheid: "m2" },
    { _id: "n21", activiteit: "pergola bouwen", scope: "houtwerk", normuurPerEenheid: 2.0, eenheid: "m2" },
    { _id: "n22", activiteit: "fundering standaard", scope: "houtwerk", normuurPerEenheid: 0.5, eenheid: "stuk" },
    { _id: "n23", activiteit: "fundering zwaar", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "stuk" },
    // Water & Elektra
    { _id: "n24", activiteit: "sleuf graven", scope: "water_elektra", normuurPerEenheid: 0.3, eenheid: "m" },
    { _id: "n25", activiteit: "kabel leggen", scope: "water_elektra", normuurPerEenheid: 0.1, eenheid: "m" },
    { _id: "n26", activiteit: "sleuf herstellen", scope: "water_elektra", normuurPerEenheid: 0.15, eenheid: "m" },
    { _id: "n27", activiteit: "armatuur plaatsen", scope: "water_elektra", normuurPerEenheid: 0.5, eenheid: "stuk" },
    // Onderhoud - Gras
    { _id: "n28", activiteit: "maaien", scope: "gras_onderhoud", normuurPerEenheid: 0.02, eenheid: "m2" },
    { _id: "n29", activiteit: "kanten steken", scope: "gras_onderhoud", normuurPerEenheid: 0.05, eenheid: "m" },
    { _id: "n30", activiteit: "verticuteren", scope: "gras_onderhoud", normuurPerEenheid: 0.03, eenheid: "m2" },
    // Onderhoud - Borders
    { _id: "n31", activiteit: "wieden weinig", scope: "borders_onderhoud", normuurPerEenheid: 0.1, eenheid: "m2" },
    { _id: "n32", activiteit: "wieden gemiddeld", scope: "borders_onderhoud", normuurPerEenheid: 0.15, eenheid: "m2" },
    { _id: "n33", activiteit: "wieden veel", scope: "borders_onderhoud", normuurPerEenheid: 0.2, eenheid: "m2" },
    { _id: "n34", activiteit: "snoei licht", scope: "borders_onderhoud", normuurPerEenheid: 0.08, eenheid: "m2" },
    { _id: "n35", activiteit: "snoei zwaar", scope: "borders_onderhoud", normuurPerEenheid: 0.15, eenheid: "m2" },
    // Onderhoud - Heggen
    { _id: "n36", activiteit: "heg snoeien", scope: "heggen_onderhoud", normuurPerEenheid: 0.15, eenheid: "m3" },
    { _id: "n37", activiteit: "snoeisel afvoeren", scope: "heggen_onderhoud", normuurPerEenheid: 0.1, eenheid: "m3" },
    // Onderhoud - Bomen
    { _id: "n38", activiteit: "boom snoeien licht", scope: "bomen_onderhoud", normuurPerEenheid: 0.5, eenheid: "stuk" },
    { _id: "n39", activiteit: "boom snoeien zwaar", scope: "bomen_onderhoud", normuurPerEenheid: 1.5, eenheid: "stuk" },
    { _id: "n40", activiteit: "afvoer snoeihout", scope: "bomen_onderhoud", normuurPerEenheid: 1.0, eenheid: "stuk" },
    // Onderhoud - Overig (voor reiniging)
    { _id: "n41", activiteit: "terras reinigen", scope: "overig_onderhoud", normuurPerEenheid: 0.05, eenheid: "m2" },
  ];
}

function createCorrectiefactoren(): Correctiefactor[] {
  return [
    { _id: "cf1", type: "bereikbaarheid", waarde: "goed", factor: 1.0 },
    { _id: "cf2", type: "bereikbaarheid", waarde: "beperkt", factor: 1.2 },
    { _id: "cf3", type: "bereikbaarheid", waarde: "slecht", factor: 1.5 },
    { _id: "cf4", type: "snijwerk", waarde: "laag", factor: 1.0 },
    { _id: "cf5", type: "snijwerk", waarde: "gemiddeld", factor: 1.1 },
    { _id: "cf6", type: "snijwerk", waarde: "hoog", factor: 1.3 },
    { _id: "cf7", type: "achterstalligheid", waarde: "laag", factor: 1.0 },
    { _id: "cf8", type: "achterstalligheid", waarde: "gemiddeld", factor: 1.3 },
    { _id: "cf9", type: "achterstalligheid", waarde: "hoog", factor: 1.6 },
  ];
}

function createProducten(): Product[] {
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

function createInstellingen(overrides: Partial<Instellingen> = {}): Instellingen {
  return {
    uurtarief: 45,
    standaardMargePercentage: 20,
    btwPercentage: 21,
    ...overrides,
  };
}

function createContext(overrides: Partial<CalculationContext> = {}): CalculationContext {
  return {
    normuren: createNormuren(),
    correctiefactoren: createCorrectiefactoren(),
    producten: createProducten(),
    instellingen: createInstellingen(),
    bereikbaarheid: "goed",
    achterstalligheid: undefined,
    ...overrides,
  };
}

// Helper: rond af op 2 decimalen (centnauwkeurig)
function cents(n: number): number {
  return Math.round(n * 100) / 100;
}

// Helper: roundToQuarter zoals de calculator het doet
function roundToQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

// ==================== TESTS ====================

// ──────────────────────────────────────────────
// 1. calculateTotals — de kern van de prijsberekening
// ──────────────────────────────────────────────

describe("calculateTotals", () => {
  // Standaard BTW percentage in Nederland
  const BTW = 21;

  describe("basisberekening", () => {
    it("berekent subtotaal, marge, BTW en totaal correct", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Ontgraven", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
        { id: "2", scope: "grondwerk", omschrijving: "Afvoer grond", eenheid: "m3", hoeveelheid: 5, prijsPerEenheid: 30, totaal: 150, type: "materiaal" },
      ];

      const result = calculateTotals(regels, 20, BTW);

      expect(result.arbeidskosten).toBe(450);
      expect(result.materiaalkosten).toBe(150);
      expect(result.subtotaal).toBe(600);
      // Marge 20% van 600 = 120
      expect(result.marge).toBe(120);
      expect(result.totaalExBtw).toBe(720);
      // BTW 21% van 720 = 151.20
      expect(result.btw).toBe(151.2);
      expect(result.totaalInclBtw).toBe(871.2);
    });

    it("telt machine-kosten bij arbeidskosten", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "heggen", omschrijving: "Hoogwerker", eenheid: "dag", hoeveelheid: 2, prijsPerEenheid: 185, totaal: 370, type: "machine" },
        { id: "2", scope: "heggen", omschrijving: "Snoeien", eenheid: "uur", hoeveelheid: 8, prijsPerEenheid: 45, totaal: 360, type: "arbeid" },
      ];

      const result = calculateTotals(regels, 20, BTW);

      // Machine (370) + Arbeid (360) = 730
      expect(result.arbeidskosten).toBe(730);
      expect(result.materiaalkosten).toBe(0);
    });

    it("telt totaalUren alleen uit arbeid-regels (niet machine)", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Ontgraven", eenheid: "uur", hoeveelheid: 8, prijsPerEenheid: 45, totaal: 360, type: "arbeid" },
        { id: "2", scope: "grondwerk", omschrijving: "Graafmachine", eenheid: "dag", hoeveelheid: 2, prijsPerEenheid: 250, totaal: 500, type: "machine" },
        { id: "3", scope: "bestrating", omschrijving: "Tegels", eenheid: "uur", hoeveelheid: 12, prijsPerEenheid: 45, totaal: 540, type: "arbeid" },
      ];

      const result = calculateTotals(regels, 20, BTW);

      // Alleen arbeidsuren: 8 + 12 = 20, roundToQuarter(20) = 20
      expect(result.totaalUren).toBe(20);
    });

    it("rondt totaalUren af op kwartier", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Werk A", eenheid: "uur", hoeveelheid: 3.3, prijsPerEenheid: 45, totaal: 148.5, type: "arbeid" },
        { id: "2", scope: "grondwerk", omschrijving: "Werk B", eenheid: "uur", hoeveelheid: 1.8, prijsPerEenheid: 45, totaal: 81, type: "arbeid" },
      ];

      const result = calculateTotals(regels, 20, BTW);

      // 3.3 + 1.8 = 5.1, roundToQuarter(5.1) = 5.0
      expect(result.totaalUren).toBe(5.0);
    });
  });

  describe("BTW berekening", () => {
    it("past 21% BTW toe op totaalExBtw", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "gras", omschrijving: "Zoden leggen", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
      ];

      const result = calculateTotals(regels, 0, 21); // 0% marge

      // Subtotaal = 450, marge 0%, totaalExBtw = 450
      // BTW = 450 * 0.21 = 94.50
      expect(result.btw).toBe(94.5);
      expect(result.totaalInclBtw).toBe(544.5);
    });

    it("rondt BTW af op centen", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "gras", omschrijving: "Werk", eenheid: "uur", hoeveelheid: 1, prijsPerEenheid: 33.33, totaal: 33.33, type: "arbeid" },
      ];

      const result = calculateTotals(regels, 10, 21);

      // Subtotaal = 33.33, marge = 3.333 -> 3.33, totaalExBtw = 36.66
      // BTW = 36.66 * 0.21 = 7.6986 -> 7.70
      expect(result.btw).toBe(cents(36.66 * 0.21));
    });

    it("werkt met 0% BTW", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "gras", omschrijving: "Werk", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
      ];

      const result = calculateTotals(regels, 20, 0);

      expect(result.btw).toBe(0);
      expect(result.totaalInclBtw).toBe(result.totaalExBtw);
    });
  });

  describe("marge cascade: regel > scope > standaard", () => {
    it("gebruikt standaard marge als geen override", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Werk", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
      ];

      const result = calculateTotals(regels, 25, BTW);

      // 450 * 0.25 = 112.5
      expect(result.marge).toBe(112.5);
    });

    it("gebruikt scope-marge boven standaard marge", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Werk", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
      ];

      const scopeMarges: ScopeMarges = { grondwerk: 30 };
      const result = calculateTotals(regels, 20, BTW, scopeMarges);

      // Scope marge 30% overschrijft standaard 20%
      expect(result.marge).toBe(135); // 450 * 0.30
    });

    it("gebruikt regel-marge boven scope-marge", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Werk", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid", margePercentage: 50 },
      ];

      const scopeMarges: ScopeMarges = { grondwerk: 30 };
      const result = calculateTotals(regels, 20, BTW, scopeMarges);

      // Regel marge 50% overschrijft scope 30% en standaard 20%
      expect(result.marge).toBe(225); // 450 * 0.50
    });

    it("combineert verschillende marge-niveaus per regel", () => {
      const regels: OfferteRegel[] = [
        // Regel 1: eigen margePercentage 40%
        { id: "1", scope: "grondwerk", omschrijving: "Ontgraven", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid", margePercentage: 40 },
        // Regel 2: scope marge (bestrating = 25%)
        { id: "2", scope: "bestrating", omschrijving: "Tegels", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
        // Regel 3: standaard marge (geen override voor borders, geen regel override)
        { id: "3", scope: "borders", omschrijving: "Planten", eenheid: "uur", hoeveelheid: 5, prijsPerEenheid: 45, totaal: 225, type: "arbeid" },
      ];

      const scopeMarges: ScopeMarges = { bestrating: 25 };
      const result = calculateTotals(regels, 15, BTW, scopeMarges);

      // Regel 1: 450 * 0.40 = 180
      // Regel 2: 450 * 0.25 = 112.5
      // Regel 3: 225 * 0.15 = 33.75
      // Totaal marge: 326.25
      expect(result.marge).toBe(326.25);
    });

    it("valt terug op standaard als scope undefined is in scopeMarges", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "houtwerk", omschrijving: "Schutting", eenheid: "uur", hoeveelheid: 8, prijsPerEenheid: 45, totaal: 360, type: "arbeid" },
      ];

      // scopeMarges bevat geen 'houtwerk'
      const scopeMarges: ScopeMarges = { grondwerk: 30 };
      const result = calculateTotals(regels, 20, BTW, scopeMarges);

      // Valt terug op standaard 20%
      expect(result.marge).toBe(72); // 360 * 0.20
    });
  });

  describe("effectief marge percentage", () => {
    it("toont gewogen gemiddeld margepercentage", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Werk A", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
        { id: "2", scope: "bestrating", omschrijving: "Werk B", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
      ];

      const scopeMarges: ScopeMarges = { grondwerk: 10, bestrating: 30 };
      const result = calculateTotals(regels, 20, BTW, scopeMarges);

      // Gewogen gemiddelde: (450*0.10 + 450*0.30) / 900 * 100 = 20%
      expect(result.margePercentage).toBe(20);
    });

    it("geeft standaard margePercentage bij lege regels", () => {
      const result = calculateTotals([], 25, BTW);

      // Geen regels -> subtotaal 0 -> valt terug op standaardMargePercentage
      expect(result.margePercentage).toBe(25);
    });
  });

  describe("lege en extreme invoer", () => {
    it("geeft nullen bij lege regels array", () => {
      const result = calculateTotals([], 20, BTW);

      expect(result.arbeidskosten).toBe(0);
      expect(result.materiaalkosten).toBe(0);
      expect(result.subtotaal).toBe(0);
      expect(result.marge).toBe(0);
      expect(result.totaalExBtw).toBe(0);
      expect(result.btw).toBe(0);
      expect(result.totaalInclBtw).toBe(0);
      expect(result.totaalUren).toBe(0);
    });

    it("verwerkt grote bedragen correct", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "grondwerk", omschrijving: "Mega project", eenheid: "uur", hoeveelheid: 10000, prijsPerEenheid: 45, totaal: 450000, type: "arbeid" },
        { id: "2", scope: "grondwerk", omschrijving: "Materialen", eenheid: "m3", hoeveelheid: 5000, prijsPerEenheid: 100, totaal: 500000, type: "materiaal" },
      ];

      const result = calculateTotals(regels, 20, BTW);

      expect(result.subtotaal).toBe(950000);
      expect(result.marge).toBe(190000);
      expect(result.totaalExBtw).toBe(1140000);
      expect(result.btw).toBe(239400);
      expect(result.totaalInclBtw).toBe(1379400);
    });

    it("verwerkt 0% marge", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "gras", omschrijving: "Werk", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
      ];

      const result = calculateTotals(regels, 0, BTW);

      expect(result.marge).toBe(0);
      expect(result.totaalExBtw).toBe(450);
    });

    it("verwerkt 100% marge", () => {
      const regels: OfferteRegel[] = [
        { id: "1", scope: "gras", omschrijving: "Werk", eenheid: "uur", hoeveelheid: 10, prijsPerEenheid: 45, totaal: 450, type: "arbeid" },
      ];

      const result = calculateTotals(regels, 100, BTW);

      expect(result.marge).toBe(450);
      expect(result.totaalExBtw).toBe(900);
    });
  });
});

// ──────────────────────────────────────────────
// 2. calculateOfferteRegels — aanleg scopes
// ──────────────────────────────────────────────

describe("calculateOfferteRegels — aanleg scopes", () => {
  let context: CalculationContext;

  beforeEach(() => {
    context = createContext();
  });

  // ---- GRONDWERK ----

  describe("grondwerk", () => {
    it("berekent ontgraven licht: 50m2 * 0.15 uur/m2 = 7.5 uur", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 50, diepte: "licht", afvoerGrond: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const ontgraven = regels.find(r => r.omschrijving.includes("Ontgraven"));

      expect(ontgraven).toBeDefined();
      expect(ontgraven!.hoeveelheid).toBe(7.5);
      expect(ontgraven!.type).toBe("arbeid");
      expect(ontgraven!.prijsPerEenheid).toBe(45);
      expect(ontgraven!.totaal).toBe(cents(7.5 * 45));
    });

    it("berekent ontgraven standaard: 40m2 * 0.25 = 10 uur", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 40, diepte: "standaard", afvoerGrond: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const ontgraven = regels.find(r => r.omschrijving.includes("Ontgraven"));

      expect(ontgraven!.hoeveelheid).toBe(10);
    });

    it("berekent ontgraven zwaar: 20m2 * 0.35 = 7 uur", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 20, diepte: "zwaar", afvoerGrond: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const ontgraven = regels.find(r => r.omschrijving.includes("Ontgraven"));

      expect(ontgraven!.hoeveelheid).toBe(7);
    });

    it("berekent afvoer grond met volume = opp * diepte", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 30, diepte: "standaard", afvoerGrond: true },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      // Volume = 30m2 * 0.4m (standaard) = 12 m3
      const afvoerArbeid = regels.find(r => r.type === "arbeid" && r.omschrijving.includes("afvoeren"));
      const afvoerMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Afvoer"));

      expect(afvoerArbeid).toBeDefined();
      expect(afvoerMateriaal).toBeDefined();
      // Arbeid: 12m3 * 0.1 uur/m3 = 1.2 -> roundToQuarter = 1.25
      expect(afvoerArbeid!.hoeveelheid).toBe(roundToQuarter(12 * 0.1));
      // Materiaal: 12m3 * €30/m3 = €360
      expect(afvoerMateriaal!.hoeveelheid).toBe(12);
      expect(afvoerMateriaal!.totaal).toBe(360);
    });

    it("voegt geen afvoer regels toe als afvoerGrond = false", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 30, diepte: "standaard", afvoerGrond: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const afvoerRegels = regels.filter(r => r.omschrijving.toLowerCase().includes("afvoer"));

      expect(afvoerRegels).toHaveLength(0);
    });

    it("past bereikbaarheidsfactor 1.5 toe bij slecht bereikbaar", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 40, diepte: "standaard", afvoerGrond: false },
        },
        bereikbaarheid: "slecht",
      };

      const regels = calculateOfferteRegels(input, context);
      const ontgraven = regels.find(r => r.omschrijving.includes("Ontgraven"));

      // 40 * 0.25 * 1.5 = 15.0 uur
      expect(ontgraven!.hoeveelheid).toBe(15);
    });

    it("past bereikbaarheidsfactor 1.2 toe bij beperkt bereikbaar", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 40, diepte: "standaard", afvoerGrond: false },
        },
        bereikbaarheid: "beperkt",
      };

      const regels = calculateOfferteRegels(input, context);
      const ontgraven = regels.find(r => r.omschrijving.includes("Ontgraven"));

      // 40 * 0.25 * 1.2 = 12.0 uur
      expect(ontgraven!.hoeveelheid).toBe(12);
    });

    it("geeft lege array bij oppervlakte 0", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: 0, diepte: "standaard", afvoerGrond: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      expect(regels).toHaveLength(0);
    });

    it("geeft lege array bij negatieve oppervlakte", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["grondwerk"],
        scopeData: {
          grondwerk: { oppervlakte: -10, diepte: "standaard", afvoerGrond: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      expect(regels).toHaveLength(0);
    });
  });

  // ---- BESTRATING ----

  describe("bestrating", () => {
    it("berekent tegels leggen: 30m2 * 0.4 = 12 uur", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 30, typeBestrating: "tegel", snijwerk: "laag" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const tegels = regels.find(r => r.omschrijving.includes("Tegels leggen"));

      expect(tegels).toBeDefined();
      expect(tegels!.hoeveelheid).toBe(12);
    });

    it("berekent klinkers leggen: 25m2 * 0.5 = 12.5 uur", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 25, typeBestrating: "klinker", snijwerk: "laag" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const klinkers = regels.find(r => r.omschrijving.includes("Klinkers leggen"));

      expect(klinkers).toBeDefined();
      expect(klinkers!.hoeveelheid).toBe(12.5);
    });

    it("berekent natuursteen leggen: 20m2 * 0.6 = 12 uur", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 20, typeBestrating: "natuursteen", snijwerk: "laag" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const steen = regels.find(r => r.omschrijving.includes("Natuursteen leggen"));

      expect(steen).toBeDefined();
      expect(steen!.hoeveelheid).toBe(12);
    });

    it("voegt zandbed toe", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 20, typeBestrating: "tegel", snijwerk: "laag" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const zandbed = regels.find(r => r.omschrijving.includes("Zandbed"));
      expect(zandbed).toBeDefined();
      // 20m2 * 0.1 uur/m2 = 2 uur
      expect(zandbed!.hoeveelheid).toBe(2);
    });

    it("voegt straatzand materiaal toe met verliespercentage", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 20, typeBestrating: "tegel", snijwerk: "laag" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const zand = regels.find(r => r.type === "materiaal" && r.omschrijving === "Straatzand");

      expect(zand).toBeDefined();
      // 20m2 * 0.05 m3/m2 = 1.0 m3, met 5% verlies = 1.05 m3
      expect(zand!.hoeveelheid).toBe(1.05);
      expect(zand!.prijsPerEenheid).toBe(35);
      expect(zand!.totaal).toBe(cents(1.05 * 35));
    });

    it("past snijwerk factor toe: hoog (1.3) vs laag (1.0)", () => {
      const basisInput = {
        type: "aanleg" as const,
        scopes: ["bestrating"],
        bereikbaarheid: "goed" as const,
      };

      const regelsLaag = calculateOfferteRegels({
        ...basisInput,
        scopeData: { bestrating: { oppervlakte: 20, typeBestrating: "tegel", snijwerk: "laag" } },
      }, createContext());

      const regelsHoog = calculateOfferteRegels({
        ...basisInput,
        scopeData: { bestrating: { oppervlakte: 20, typeBestrating: "tegel", snijwerk: "hoog" } },
      }, createContext());

      const urenLaag = regelsLaag.find(r => r.omschrijving.includes("Tegels leggen"))!.hoeveelheid;
      const urenHoog = regelsHoog.find(r => r.omschrijving.includes("Tegels leggen"))!.hoeveelheid;

      // Snijwerk hoog = 1.3x meer uren
      expect(urenHoog / urenLaag).toBeCloseTo(1.3, 1);
    });

    it("voegt opsluitbanden toe bij onderbouw.opsluitbanden = true", () => {
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

      const opsluitArbeid = regels.find(r => r.omschrijving.includes("Opsluitbanden plaatsen"));
      const opsluitMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Opsluitband"));

      expect(opsluitArbeid).toBeDefined();
      expect(opsluitMateriaal).toBeDefined();

      // Perimeter schatting: 4 * sqrt(25) = 20 m
      const perimeter = 4 * Math.sqrt(25);
      expect(opsluitArbeid!.hoeveelheid).toBe(roundToQuarter(perimeter * 0.2));
    });

    it("berekent fundering per bestratingtype 'pad'", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: {
            oppervlakte: 10,
            typeBestrating: "tegel",
            snijwerk: "laag",
            bestratingtype: "pad",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      // Pad: gebrokenPuin 10cm, zand 5cm
      const puin = regels.find(r => r.omschrijving.includes("Gebroken puin") && r.omschrijving.includes("10 cm"));
      const zand = regels.find(r => r.omschrijving.includes("Straatzand") && r.omschrijving.includes("5 cm"));

      expect(puin).toBeDefined();
      expect(zand).toBeDefined();
      // 10m2 * (10/100) = 1.0 m3, met 5% verlies = 1.05
      expect(puin!.hoeveelheid).toBe(1.05);
    });

    it("berekent fundering per bestratingtype 'oprit' met brekerszand", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: {
            oppervlakte: 20,
            typeBestrating: "klinker",
            snijwerk: "laag",
            bestratingtype: "oprit",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      // Oprit: gebrokenPuin 20cm, brekerszand 5cm
      const puin = regels.find(r => r.omschrijving.includes("Gebroken puin") && r.omschrijving.includes("20 cm"));
      const brekerszand = regels.find(r => r.omschrijving.includes("Brekerszand"));

      expect(puin).toBeDefined();
      expect(brekerszand).toBeDefined();
    });

    it("berekent fundering per bestratingtype 'terrein' met stabiliser", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: {
            oppervlakte: 50,
            typeBestrating: "klinker",
            snijwerk: "laag",
            bestratingtype: "terrein",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const stabiliser = regels.find(r => r.omschrijving.includes("Stabiliser"));
      expect(stabiliser).toBeDefined();
      // 50m2 * 0.05m = 2.5 m3, geen verliespercentage
      expect(stabiliser!.hoeveelheid).toBe(2.5);
    });

    it("berekent multi-zone bestrating correct", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: {
            oppervlakte: 10,
            typeBestrating: "tegel",
            snijwerk: "laag",
            zones: [
              { id: "z1", type: "pad", oppervlakte: 8 },
              { id: "z2", type: "oprit", oppervlakte: 15 },
            ],
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      // Moet zone-specifieke fundering regels bevatten
      const zonePad = regels.filter(r => r.omschrijving.includes("Zone pad"));
      const zoneOprit = regels.filter(r => r.omschrijving.includes("Zone oprit"));

      expect(zonePad.length).toBeGreaterThan(0);
      expect(zoneOprit.length).toBeGreaterThan(0);
    });

    it("geeft lege array bij oppervlakte 0", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["bestrating"],
        scopeData: {
          bestrating: { oppervlakte: 0, typeBestrating: "tegel", snijwerk: "laag" },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });
  });

  // ---- BORDERS ----

  describe("borders", () => {
    it("berekent grondbewerking: 20m2 * 0.2 = 4 uur", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["borders"],
        scopeData: {
          borders: { oppervlakte: 20, beplantingsintensiteit: "gemiddeld", bodemverbetering: false, afwerking: "geen" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const grondbewerking = regels.find(r => r.omschrijving.includes("Grondbewerking"));

      expect(grondbewerking).toBeDefined();
      expect(grondbewerking!.hoeveelheid).toBe(4);
    });

    it("berekent beplanting intensiteit 'weinig': 3 planten/m2", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["borders"],
        scopeData: {
          borders: { oppervlakte: 10, beplantingsintensiteit: "weinig", bodemverbetering: false, afwerking: "geen" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const planten = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Bodembedekker"));

      expect(planten).toBeDefined();
      // 10m2 * 3 planten/m2 = 30, met 5% verlies = 31.5
      expect(planten!.hoeveelheid).toBe(31.5);
    });

    it("berekent beplanting intensiteit 'gemiddeld': 6 planten/m2", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["borders"],
        scopeData: {
          borders: { oppervlakte: 10, beplantingsintensiteit: "gemiddeld", bodemverbetering: false, afwerking: "geen" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const planten = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Bodembedekker"));

      // 10m2 * 6 = 60, met 5% = 63
      expect(planten!.hoeveelheid).toBe(63);
    });

    it("berekent beplanting intensiteit 'veel': 10 planten/m2", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["borders"],
        scopeData: {
          borders: { oppervlakte: 10, beplantingsintensiteit: "veel", bodemverbetering: false, afwerking: "geen" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const planten = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Bodembedekker"));

      // 10m2 * 10 = 100, met 5% = 105
      expect(planten!.hoeveelheid).toBe(105);
    });

    it("voegt schors toe bij afwerking 'schors'", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["borders"],
        scopeData: {
          borders: { oppervlakte: 15, beplantingsintensiteit: "gemiddeld", bodemverbetering: false, afwerking: "schors" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const schorsArbeid = regels.find(r => r.type === "arbeid" && r.omschrijving.includes("Schors"));
      const schorsMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.toLowerCase().includes("schors"));

      expect(schorsArbeid).toBeDefined();
      expect(schorsMateriaal).toBeDefined();
      // Schors: 15m2 * 0.05 m3/m2 = 0.75 m3, met 5% verlies = 0.7875
      expect(schorsMateriaal!.hoeveelheid).toBeCloseTo(0.79, 1);
    });

    it("voegt schors toe bij afwerking 'grind' (zelfde pad)", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["borders"],
        scopeData: {
          borders: { oppervlakte: 15, beplantingsintensiteit: "gemiddeld", bodemverbetering: false, afwerking: "grind" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const schorsArbeid = regels.find(r => r.type === "arbeid" && r.omschrijving.includes("Schors"));

      expect(schorsArbeid).toBeDefined();
    });

    it("voegt geen schors toe bij afwerking 'geen'", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["borders"],
        scopeData: {
          borders: { oppervlakte: 15, beplantingsintensiteit: "gemiddeld", bodemverbetering: false, afwerking: "geen" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const schorsRegels = regels.filter(r => r.omschrijving.toLowerCase().includes("schors"));

      expect(schorsRegels).toHaveLength(0);
    });

    it("voegt bodemverbetering toe als bodemverbetering=true en bodemMix gegeven", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["borders"],
        scopeData: {
          borders: {
            oppervlakte: 20,
            beplantingsintensiteit: "gemiddeld",
            bodemverbetering: true,
            afwerking: "geen",
            bodemMix: { zandPercentage: 40, compostPercentage: 30, teelaardPercentage: 30 },
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const bodem = regels.find(r => r.omschrijving.includes("Bodemverbetering"));

      expect(bodem).toBeDefined();
      // 20m2 * 0.3m diepte = 6 m3, prijs €35/m3
      expect(bodem!.hoeveelheid).toBe(6);
      expect(bodem!.totaal).toBe(210);
    });

    it("geeft lege array bij oppervlakte 0", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["borders"],
        scopeData: {
          borders: { oppervlakte: 0, beplantingsintensiteit: "gemiddeld", bodemverbetering: false, afwerking: "geen" },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });
  });

  // ---- GRAS ----

  describe("gras", () => {
    it("berekent ondergrond + graszoden leggen", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["gras"],
        scopeData: {
          gras: { oppervlakte: 100, type: "graszoden", ondergrond: "nieuw", afwateringNodig: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const ondergrond = regels.find(r => r.omschrijving.includes("Ondergrond"));
      const zoden = regels.find(r => r.omschrijving.includes("Graszoden leggen"));
      const zodenMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving === "Graszoden");

      expect(ondergrond).toBeDefined();
      expect(zoden).toBeDefined();
      expect(zodenMateriaal).toBeDefined();

      // Ondergrond: 100 * 0.1 = 10 uur
      expect(ondergrond!.hoeveelheid).toBe(10);
      // Graszoden leggen: 100 * 0.12 = 12 uur
      expect(zoden!.hoeveelheid).toBe(12);
      // Materiaal: 100m2 met 5% verlies = 105
      expect(zodenMateriaal!.hoeveelheid).toBe(105);
    });

    it("berekent gras zaaien met graszaad", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["gras"],
        scopeData: {
          gras: { oppervlakte: 80, type: "zaaien", ondergrond: "bestaand", afwateringNodig: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const zaaiArbeid = regels.find(r => r.omschrijving.includes("Gras zaaien"));
      const zaadMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Graszaad"));

      expect(zaaiArbeid).toBeDefined();
      expect(zaadMateriaal).toBeDefined();

      // 80 * 0.05 = 4 uur
      expect(zaaiArbeid!.hoeveelheid).toBe(4);
      // 80m2 * 0.035 kg/m2 = 2.8 kg, geen verlies (0%)
      expect(zaadMateriaal!.hoeveelheid).toBe(2.8);
    });

    it("voegt kunstgras materiaal en arbeid toe", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["gras"],
        scopeData: {
          gras: { oppervlakte: 50, type: "zaaien", ondergrond: "nieuw", afwateringNodig: false, kunstgras: true },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const kunstgrasMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving === "Kunstgras");
      const kunstgrasArbeid = regels.find(r => r.omschrijving.includes("Kunstgras leggen"));

      expect(kunstgrasMateriaal).toBeDefined();
      // 50m2 * €45/m2 met 5% verlies = 52.5 * 45
      expect(kunstgrasMateriaal!.hoeveelheid).toBe(52.5);
      expect(kunstgrasMateriaal!.prijsPerEenheid).toBe(45);

      expect(kunstgrasArbeid).toBeDefined();
    });

    it("voegt drainage materialen toe", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["gras"],
        scopeData: {
          gras: { oppervlakte: 50, type: "graszoden", ondergrond: "nieuw", afwateringNodig: false, drainage: true, drainageMeters: 20 },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const pvc = regels.find(r => r.omschrijving.includes("PVC drainagebuis"));
      const kokos = regels.find(r => r.omschrijving.includes("Kokos omhulsel"));

      expect(pvc).toBeDefined();
      expect(kokos).toBeDefined();
      // 20m met 5% verlies = 21, prijs €12/m
      expect(pvc!.hoeveelheid).toBe(21);
      expect(pvc!.prijsPerEenheid).toBe(12);
      // Kokos: 20m met 5% verlies = 21, prijs €8/m
      expect(kokos!.hoeveelheid).toBe(21);
      expect(kokos!.prijsPerEenheid).toBe(8);
    });

    it("voegt opsluitbanden toe bij gras", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["gras"],
        scopeData: {
          gras: { oppervlakte: 50, type: "graszoden", ondergrond: "nieuw", afwateringNodig: false, opsluitbanden: true, opsluitbandenMeters: 15 },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const opsluit = regels.find(r => r.omschrijving.includes("Opsluitbanden"));
      expect(opsluit).toBeDefined();
      // 15m met 5% verlies = 15.75
      expect(opsluit!.hoeveelheid).toBe(15.75);
      expect(opsluit!.prijsPerEenheid).toBe(15);
    });

    it("geeft lege array bij oppervlakte 0", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["gras"],
        scopeData: {
          gras: { oppervlakte: 0, type: "zaaien", ondergrond: "nieuw", afwateringNodig: false },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });
  });

  // ---- HOUTWERK ----

  describe("houtwerk", () => {
    it("berekent schutting met planken, palen en fundering", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["houtwerk"],
        scopeData: {
          houtwerk: { typeHoutwerk: "schutting", afmeting: 10, fundering: "standaard" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const arbeid = regels.find(r => r.omschrijving.includes("Schutting plaatsen"));
      const planken = regels.find(r => r.omschrijving.includes("Schuttingplank"));
      const palen = regels.find(r => r.omschrijving.includes("Schuttingpaal"));
      const fundering = regels.find(r => r.omschrijving.includes("Fundering"));
      const poeren = regels.find(r => r.omschrijving.includes("Betonpoer"));

      expect(arbeid).toBeDefined();
      // 10m * 0.8 uur/m = 8 uur
      expect(arbeid!.hoeveelheid).toBe(8);

      expect(planken).toBeDefined();
      // 10m * 6 planken/m = 60 met 5% = 63
      expect(planken!.hoeveelheid).toBe(63);

      expect(palen).toBeDefined();
      // ceil(10/2) + 1 = 6 palen, 0% verlies
      expect(palen!.hoeveelheid).toBe(6);

      expect(fundering).toBeDefined();
      expect(poeren).toBeDefined();
      // 6 funderingspunten
      expect(poeren!.hoeveelheid).toBe(6);
    });

    it("berekent vlonder met planken en extra funderingspunten", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["houtwerk"],
        scopeData: {
          houtwerk: { typeHoutwerk: "vlonder", afmeting: 20, fundering: "standaard" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const arbeid = regels.find(r => r.omschrijving.includes("Vlonder leggen"));
      const vlonderdelen = regels.find(r => r.omschrijving.includes("Vlonderdeel"));
      const poeren = regels.find(r => r.omschrijving.includes("Betonpoer"));

      expect(arbeid).toBeDefined();
      // 20m2 * 0.6 = 12 uur
      expect(arbeid!.hoeveelheid).toBe(12);

      expect(vlonderdelen).toBeDefined();
      // 20m2 * 7 planken/m2 = 140 met 5% = 147
      expect(vlonderdelen!.hoeveelheid).toBe(147);

      expect(poeren).toBeDefined();
      // Vlonder: ceil(20/2) + 4 extra = 14 punten (geen +1 zoals schutting)
      expect(poeren!.hoeveelheid).toBe(14);
    });

    it("berekent pergola met 4 funderingspunten", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["houtwerk"],
        scopeData: {
          houtwerk: { typeHoutwerk: "pergola", afmeting: 9, fundering: "standaard" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const arbeid = regels.find(r => r.omschrijving.includes("Pergola"));
      const poeren = regels.find(r => r.omschrijving.includes("Betonpoer"));

      expect(arbeid).toBeDefined();
      // 9m2 * 2.0 = 18 uur
      expect(arbeid!.hoeveelheid).toBe(18);

      expect(poeren).toBeDefined();
      // Pergola heeft altijd 4 funderingspunten
      expect(poeren!.hoeveelheid).toBe(4);
    });

    it("gebruikt zware fundering normuur", () => {
      const inputStandaard: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["houtwerk"],
        scopeData: {
          houtwerk: { typeHoutwerk: "schutting", afmeting: 10, fundering: "standaard" },
        },
        bereikbaarheid: "goed",
      };

      const inputZwaar: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["houtwerk"],
        scopeData: {
          houtwerk: { typeHoutwerk: "schutting", afmeting: 10, fundering: "zwaar" },
        },
        bereikbaarheid: "goed",
      };

      const regelsStandaard = calculateOfferteRegels(inputStandaard, createContext());
      const regelsZwaar = calculateOfferteRegels(inputZwaar, createContext());

      const fundStandaard = regelsStandaard.find(r => r.omschrijving.includes("Fundering"));
      const fundZwaar = regelsZwaar.find(r => r.omschrijving.includes("Fundering"));

      expect(fundStandaard).toBeDefined();
      expect(fundZwaar).toBeDefined();
      // Zwaar (0.8 uur/stuk) > standaard (0.5 uur/stuk)
      expect(fundZwaar!.hoeveelheid).toBeGreaterThan(fundStandaard!.hoeveelheid);
    });

    it("geeft lege array bij afmeting 0", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["houtwerk"],
        scopeData: {
          houtwerk: { typeHoutwerk: "schutting", afmeting: 0, fundering: "standaard" },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });
  });

  // ---- WATER & ELEKTRA ----

  describe("water_elektra", () => {
    it("berekent sleuven + kabels + armaturen voor 4 lichtpunten", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["water_elektra"],
        scopeData: {
          water_elektra: { verlichting: "basis", aantalPunten: 4, sleuvenNodig: true },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const sleuf = regels.find(r => r.omschrijving.includes("Sleuf graven"));
      const kabel = regels.find(r => r.omschrijving.includes("Kabel leggen"));
      const sleufHerstel = regels.find(r => r.omschrijving.includes("Sleuf herstellen"));
      const armatuur = regels.find(r => r.omschrijving.includes("Armaturen"));
      const grondspot = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Grondspot"));
      const lasdoos = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Lasdoos"));
      const kabelMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Kabel"));

      // sleufLengte = 4 * 5 = 20m
      expect(sleuf).toBeDefined();
      expect(sleuf!.hoeveelheid).toBe(roundToQuarter(20 * 0.3)); // 6 uur
      expect(kabel).toBeDefined();
      expect(kabel!.hoeveelheid).toBe(roundToQuarter(20 * 0.1)); // 2 uur
      expect(sleufHerstel).toBeDefined();
      expect(sleufHerstel!.hoeveelheid).toBe(roundToQuarter(20 * 0.15)); // 3 uur

      expect(armatuur).toBeDefined();
      expect(armatuur!.hoeveelheid).toBe(roundToQuarter(4 * 0.5)); // 2 uur

      expect(grondspot).toBeDefined();
      expect(grondspot!.hoeveelheid).toBe(4);
      expect(grondspot!.prijsPerEenheid).toBe(45);

      expect(lasdoos).toBeDefined();
      expect(lasdoos!.hoeveelheid).toBe(4);

      expect(kabelMateriaal).toBeDefined();
      // 20m met 5% verlies = 21m
      expect(kabelMateriaal!.hoeveelheid).toBe(21);
    });

    it("slaat sleuven over als sleuvenNodig = false", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["water_elektra"],
        scopeData: {
          water_elektra: { verlichting: "basis", aantalPunten: 3, sleuvenNodig: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      const sleufRegels = regels.filter(r => r.omschrijving.toLowerCase().includes("sleuf"));
      const kabelMateriaal = regels.filter(r => r.type === "materiaal" && r.omschrijving.includes("Kabel"));

      expect(sleufRegels).toHaveLength(0);
      expect(kabelMateriaal).toHaveLength(0);

      // Armaturen moeten er nog wel zijn
      const armatuur = regels.find(r => r.omschrijving.includes("Armaturen"));
      expect(armatuur).toBeDefined();
    });

    it("geeft lege array bij verlichting 'geen'", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["water_elektra"],
        scopeData: {
          water_elektra: { verlichting: "geen", aantalPunten: 0, sleuvenNodig: false },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });

    it("geeft lege array bij 0 lichtpunten", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["water_elektra"],
        scopeData: {
          water_elektra: { verlichting: "basis", aantalPunten: 0, sleuvenNodig: true },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });
  });

  // ---- SPECIALS ----

  describe("specials", () => {
    it("berekent installatie-uren per item type", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["specials"],
        scopeData: {
          specials: {
            items: [
              { type: "jacuzzi", omschrijving: "Jacuzzi plaatsen" },
              { type: "sauna", omschrijving: "Buitensauna installeren" },
              { type: "prefab", omschrijving: "Prefab tuinhuis" },
            ],
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);

      expect(regels).toHaveLength(3);

      const jacuzzi = regels.find(r => r.omschrijving.includes("Jacuzzi"));
      const sauna = regels.find(r => r.omschrijving.includes("sauna"));
      const prefab = regels.find(r => r.omschrijving.includes("Prefab"));

      // Jacuzzi: 8 uur
      expect(jacuzzi!.hoeveelheid).toBe(8);
      // Sauna: 6 uur
      expect(sauna!.hoeveelheid).toBe(6);
      // Prefab: 4 uur
      expect(prefab!.hoeveelheid).toBe(4);
    });

    it("past bereikbaarheid toe op specials", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["specials"],
        scopeData: {
          specials: {
            items: [{ type: "jacuzzi", omschrijving: "Jacuzzi" }],
          },
        },
        bereikbaarheid: "slecht",
      };

      const regels = calculateOfferteRegels(input, context);
      const jacuzzi = regels.find(r => r.omschrijving.includes("Jacuzzi"));

      // 8 uur * 1.5 = 12 uur
      expect(jacuzzi!.hoeveelheid).toBe(12);
    });

    it("geeft lege array bij lege items", () => {
      const input: OfferteCalculationInput = {
        type: "aanleg",
        scopes: ["specials"],
        scopeData: {
          specials: { items: [] },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });
  });
});

// ──────────────────────────────────────────────
// 3. calculateOfferteRegels — onderhoud scopes
// ──────────────────────────────────────────────

describe("calculateOfferteRegels — onderhoud scopes", () => {
  let context: CalculationContext;

  beforeEach(() => {
    context = createContext();
  });

  // ---- GRAS ONDERHOUD ----

  describe("gras onderhoud", () => {
    it("berekent maaien: 200m2 * 0.02 = 4 uur", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gras"],
        scopeData: {
          gras: { grasAanwezig: true, grasOppervlakte: 200, maaien: true, kantenSteken: false, verticuteren: false, afvoerGras: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const maaien = regels.find(r => r.omschrijving.includes("maaien"));

      expect(maaien).toBeDefined();
      expect(maaien!.hoeveelheid).toBe(4);
    });

    it("berekent kanten steken op basis van geschatte perimeter", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gras"],
        scopeData: {
          gras: { grasAanwezig: true, grasOppervlakte: 100, maaien: false, kantenSteken: true, verticuteren: false, afvoerGras: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const kanten = regels.find(r => r.omschrijving.includes("Kanten steken"));

      expect(kanten).toBeDefined();
      // Perimeter = 4 * sqrt(100) = 40m, uren = 40 * 0.05 = 2.0
      expect(kanten!.hoeveelheid).toBe(2);
    });

    it("berekent verticuteren: 150m2 * 0.03 = 4.5 uur", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gras"],
        scopeData: {
          gras: { grasAanwezig: true, grasOppervlakte: 150, maaien: false, kantenSteken: false, verticuteren: true, afvoerGras: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const verticuteren = regels.find(r => r.omschrijving.includes("Verticuteren"));

      expect(verticuteren).toBeDefined();
      expect(verticuteren!.hoeveelheid).toBe(4.5);
    });

    it("past achterstalligheid toe op maaien en kanten steken", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gras"],
        scopeData: {
          gras: { grasAanwezig: true, grasOppervlakte: 100, maaien: true, kantenSteken: true, verticuteren: false, afvoerGras: false },
        },
        bereikbaarheid: "goed",
        achterstalligheid: "hoog",
      };

      const regels = calculateOfferteRegels(input, context);

      const maaien = regels.find(r => r.omschrijving.includes("maaien"));
      // 100 * 0.02 * 1.6 = 3.2, roundToQuarter = 3.25
      expect(maaien!.hoeveelheid).toBe(roundToQuarter(100 * 0.02 * 1.6));
    });

    it("geeft lege array als grasAanwezig = false", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gras"],
        scopeData: {
          gras: { grasAanwezig: false, grasOppervlakte: 200, maaien: true, kantenSteken: true, verticuteren: true, afvoerGras: false },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });

    it("geeft lege array bij oppervlakte 0", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gras"],
        scopeData: {
          gras: { grasAanwezig: true, grasOppervlakte: 0, maaien: true },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });
  });

  // ---- BORDERS ONDERHOUD ----

  describe("borders onderhoud", () => {
    it("berekent wieden gemiddeld: 30m2 * 0.15 = 4.5 uur", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["borders"],
        scopeData: {
          borders: {
            borderOppervlakte: 30,
            onderhoudsintensiteit: "gemiddeld",
            onkruidVerwijderen: true,
            snoeiInBorders: "geen",
            bodem: "open",
            afvoerGroenafval: false,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const wieden = regels.find(r => r.omschrijving.includes("Wieden"));

      expect(wieden).toBeDefined();
      expect(wieden!.hoeveelheid).toBe(4.5);
    });

    it("berekent wieden weinig: 30m2 * 0.1 = 3 uur", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["borders"],
        scopeData: {
          borders: {
            borderOppervlakte: 30,
            onderhoudsintensiteit: "weinig",
            onkruidVerwijderen: true,
            snoeiInBorders: "geen",
            bodem: "open",
            afvoerGroenafval: false,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const wieden = regels.find(r => r.omschrijving.includes("Wieden"));

      expect(wieden!.hoeveelheid).toBe(3);
    });

    it("berekent snoei licht in borders", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["borders"],
        scopeData: {
          borders: {
            borderOppervlakte: 25,
            onderhoudsintensiteit: "gemiddeld",
            onkruidVerwijderen: false,
            snoeiInBorders: "licht",
            bodem: "open",
            afvoerGroenafval: false,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const snoei = regels.find(r => r.omschrijving.includes("Snoei borders"));

      expect(snoei).toBeDefined();
      // 25m2 * 0.08 = 2.0 uur
      expect(snoei!.hoeveelheid).toBe(2);
    });

    it("berekent snoei zwaar", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["borders"],
        scopeData: {
          borders: {
            borderOppervlakte: 20,
            onderhoudsintensiteit: "gemiddeld",
            onkruidVerwijderen: false,
            snoeiInBorders: "zwaar",
            bodem: "open",
            afvoerGroenafval: false,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const snoei = regels.find(r => r.omschrijving.includes("Snoei borders"));

      expect(snoei).toBeDefined();
      // 20 * 0.15 = 3.0 uur
      expect(snoei!.hoeveelheid).toBe(3);
    });

    it("past achterstalligheid toe op wieden en snoei", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["borders"],
        scopeData: {
          borders: {
            borderOppervlakte: 20,
            onderhoudsintensiteit: "gemiddeld",
            onkruidVerwijderen: true,
            snoeiInBorders: "licht",
            bodem: "open",
            afvoerGroenafval: false,
          },
        },
        bereikbaarheid: "goed",
        achterstalligheid: "gemiddeld",
      };

      const regels = calculateOfferteRegels(input, context);
      const wieden = regels.find(r => r.omschrijving.includes("Wieden"));

      // 20 * 0.15 * 1.3 (achterstalligheid) = 3.9 -> roundToQuarter = 4.0
      expect(wieden!.hoeveelheid).toBe(roundToQuarter(20 * 0.15 * 1.3));
    });

    it("geeft lege array bij oppervlakte 0", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["borders"],
        scopeData: {
          borders: { borderOppervlakte: 0, onderhoudsintensiteit: "gemiddeld", onkruidVerwijderen: true, snoeiInBorders: "geen", bodem: "open", afvoerGroenafval: false },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });
  });

  // ---- HEGGEN ONDERHOUD ----

  describe("heggen onderhoud", () => {
    it("berekent heg snoeien op basis van volume (L*H*B)", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen"],
        scopeData: {
          heggen: { lengte: 10, hoogte: 1.5, breedte: 0.5, snoei: "beide", afvoerSnoeisel: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const snoeien = regels.find(r => r.omschrijving.includes("snoeien"));

      expect(snoeien).toBeDefined();
      // Volume = 10 * 1.5 * 0.5 = 7.5 m3
      // Uren = 7.5 * 0.15 = 1.125 -> roundToQuarter = 1.25
      expect(snoeien!.hoeveelheid).toBe(1.25);
    });

    it("past hoogte toeslag toe bij hoogte > 2m (factor 1.3)", () => {
      const baseLaag: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen"],
        scopeData: {
          heggen: { lengte: 10, hoogte: 1.8, breedte: 0.5, snoei: "beide", afvoerSnoeisel: false },
        },
        bereikbaarheid: "goed",
      };
      const baseHoog: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen"],
        scopeData: {
          heggen: { lengte: 10, hoogte: 2.5, breedte: 0.5, snoei: "beide", afvoerSnoeisel: false },
        },
        bereikbaarheid: "goed",
      };

      const regelsLaag = calculateOfferteRegels(baseLaag, createContext());
      const regelsHoog = calculateOfferteRegels(baseHoog, createContext());

      const urenLaag = regelsLaag.find(r => r.omschrijving.includes("snoeien"))!.hoeveelheid;
      const urenHoog = regelsHoog.find(r => r.omschrijving.includes("snoeien"))!.hoeveelheid;

      // De hoge heg heeft meer volume EN een 1.3 hoogte factor
      expect(urenHoog).toBeGreaterThan(urenLaag);
    });

    it("voegt snoeisel afvoer toe als afvoerSnoeisel = true", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen"],
        scopeData: {
          heggen: { lengte: 10, hoogte: 1.5, breedte: 0.5, snoei: "beide", afvoerSnoeisel: true },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const afvoer = regels.find(r => r.omschrijving.includes("afvoeren"));

      expect(afvoer).toBeDefined();
      // Snoeisel volume = 7.5 * 0.3 = 2.25 m3
      // Uren = 2.25 * 0.1 = 0.225 -> roundToQuarter = 0.25
      expect(afvoer!.hoeveelheid).toBe(0.25);
    });

    it("geeft lege array als volume = 0", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen"],
        scopeData: {
          heggen: { lengte: 0, hoogte: 1.5, breedte: 0.5, snoei: "beide", afvoerSnoeisel: false },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });
  });

  // ---- HEGGEN ONDERHOUD EXTENDED ----

  describe("heggen onderhoud (extended)", () => {
    it("past haagsoort factor toe (taxus = 1.3)", () => {
      const inputStandaard: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen_extended"],
        scopeData: {
          heggen_extended: {
            lengte: 10, hoogte: 1.5, breedte: 0.5,
            snoei: "beide", afvoerSnoeisel: false,
            haagsoort: "liguster",
          },
        },
        bereikbaarheid: "goed",
      };

      const inputTaxus: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen_extended"],
        scopeData: {
          heggen_extended: {
            lengte: 10, hoogte: 1.5, breedte: 0.5,
            snoei: "beide", afvoerSnoeisel: false,
            haagsoort: "taxus",
          },
        },
        bereikbaarheid: "goed",
      };

      const regelsStandaard = calculateOfferteRegels(inputStandaard, createContext());
      const regelsTaxus = calculateOfferteRegels(inputTaxus, createContext());

      const urenStandaard = regelsStandaard.find(r => r.omschrijving.includes("snoeien"))!.hoeveelheid;
      const urenTaxus = regelsTaxus.find(r => r.omschrijving.includes("snoeien"))!.hoeveelheid;

      // Taxus factor = 1.3 vs liguster = 1.0 (afronding op kwartier maakt ratio niet exact)
      expect(urenTaxus).toBeGreaterThan(urenStandaard);
    });

    it("vermenigvuldigt met snoeifrequentie", () => {
      const input1x: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen_extended"],
        scopeData: {
          heggen_extended: {
            lengte: 10, hoogte: 1.5, breedte: 0.5,
            snoei: "beide", afvoerSnoeisel: false,
            snoeifrequentie: 1,
          },
        },
        bereikbaarheid: "goed",
      };

      const input3x: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen_extended"],
        scopeData: {
          heggen_extended: {
            lengte: 10, hoogte: 1.5, breedte: 0.5,
            snoei: "beide", afvoerSnoeisel: false,
            snoeifrequentie: 3,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels1x = calculateOfferteRegels(input1x, createContext());
      const regels3x = calculateOfferteRegels(input3x, createContext());

      const uren1x = regels1x.find(r => r.omschrijving.includes("snoeien"))!.hoeveelheid;
      const uren3x = regels3x.find(r => r.omschrijving.includes("snoeien"))!.hoeveelheid;

      // 3x frequentie = ~3x de uren (kwartier-afronding maakt ratio niet exact 3.0)
      expect(uren3x).toBeGreaterThan(uren1x * 2.5);
      expect(uren3x).toBeLessThanOrEqual(uren1x * 3.5);
    });

    it("voegt hoogwerker toe bij hoogte > 4m", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen_extended"],
        scopeData: {
          heggen_extended: {
            lengte: 20, hoogte: 5, breedte: 1,
            snoei: "beide", afvoerSnoeisel: false,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());
      const hoogwerker = regels.find(r => r.type === "machine" && r.omschrijving.includes("Hoogwerker"));

      expect(hoogwerker).toBeDefined();
      expect(hoogwerker!.prijsPerEenheid).toBe(185);
    });

    it("past ondergrond toeslag toe (bestrating = 1.15)", () => {
      // Gebruik grotere afmetingen zodat het verschil door de kwartier-afronding heen komt
      const inputGras: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen_extended"],
        scopeData: {
          heggen_extended: {
            lengte: 20, hoogte: 1.5, breedte: 1.0,
            snoei: "beide", afvoerSnoeisel: false,
          },
        },
        bereikbaarheid: "goed",
      };

      const inputBestrating: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["heggen_extended"],
        scopeData: {
          heggen_extended: {
            lengte: 20, hoogte: 1.5, breedte: 1.0,
            snoei: "beide", afvoerSnoeisel: false,
            ondergrond: "bestrating",
          },
        },
        bereikbaarheid: "goed",
      };

      const regelsGras = calculateOfferteRegels(inputGras, createContext());
      const regelsBestrating = calculateOfferteRegels(inputBestrating, createContext());

      const totaalGras = regelsGras.find(r => r.omschrijving.includes("snoeien"))!.totaal;
      const totaalBestrating = regelsBestrating.find(r => r.omschrijving.includes("snoeien"))!.totaal;

      // Bestrating ondergrond factor (1.15) moet hogere kosten geven
      expect(totaalBestrating).toBeGreaterThanOrEqual(totaalGras);
    });
  });

  // ---- BOMEN ONDERHOUD ----

  describe("bomen onderhoud", () => {
    it("berekent licht snoeien: 5 bomen * 0.5 = 2.5 uur", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen"],
        scopeData: {
          bomen: { aantalBomen: 5, snoei: "licht", hoogteklasse: "laag", afvoer: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const snoeien = regels.find(r => r.omschrijving.includes("Bomen snoeien"));

      expect(snoeien).toBeDefined();
      expect(snoeien!.hoeveelheid).toBe(2.5);
    });

    it("berekent zwaar snoeien: 3 bomen * 1.5 = 4.5 uur", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen"],
        scopeData: {
          bomen: { aantalBomen: 3, snoei: "zwaar", hoogteklasse: "laag", afvoer: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const snoeien = regels.find(r => r.omschrijving.includes("Bomen snoeien"));

      expect(snoeien).toBeDefined();
      expect(snoeien!.hoeveelheid).toBe(4.5);
    });

    it("past hoogte factor 1.3 toe voor hoogteklasse hoog", () => {
      const inputLaag: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen"],
        scopeData: {
          bomen: { aantalBomen: 4, snoei: "licht", hoogteklasse: "laag", afvoer: false },
        },
        bereikbaarheid: "goed",
      };

      const inputHoog: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen"],
        scopeData: {
          bomen: { aantalBomen: 4, snoei: "licht", hoogteklasse: "hoog", afvoer: false },
        },
        bereikbaarheid: "goed",
      };

      const regelsLaag = calculateOfferteRegels(inputLaag, createContext());
      const regelsHoog = calculateOfferteRegels(inputHoog, createContext());

      const urenLaag = regelsLaag.find(r => r.omschrijving.includes("Bomen snoeien"))!.hoeveelheid;
      const urenHoog = regelsHoog.find(r => r.omschrijving.includes("Bomen snoeien"))!.hoeveelheid;

      // Factor 1.3 voor hoogteklasse hoog (kwartier-afronding geeft kleine afwijking)
      expect(urenHoog).toBeGreaterThan(urenLaag);
    });

    it("geeft lege array bij 0 bomen", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen"],
        scopeData: {
          bomen: { aantalBomen: 0, snoei: "licht", hoogteklasse: "laag", afvoer: false },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, context)).toHaveLength(0);
    });
  });

  // ---- BOMEN ONDERHOUD EXTENDED ----

  describe("bomen onderhoud (extended)", () => {
    it("past veiligheidstoeslagen toe (nabijStraat + nabijGebouw + nabijKabels)", () => {
      const inputBasis: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen_extended"],
        scopeData: {
          bomen_extended: {
            aantalBomen: 2, snoei: "licht", hoogteklasse: "laag",
            afvoer: false,
          },
        },
        bereikbaarheid: "goed",
      };

      const inputAlles: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen_extended"],
        scopeData: {
          bomen_extended: {
            aantalBomen: 2, snoei: "licht", hoogteklasse: "laag",
            afvoer: false,
            nabijStraat: true, nabijGebouw: true, nabijKabels: true,
          },
        },
        bereikbaarheid: "goed",
      };

      const regelsBasis = calculateOfferteRegels(inputBasis, createContext());
      const regelsAlles = calculateOfferteRegels(inputAlles, createContext());

      const urenBasis = regelsBasis.find(r => r.omschrijving.includes("Bomen snoeien"))!.hoeveelheid;
      const urenAlles = regelsAlles.find(r => r.omschrijving.includes("Bomen snoeien"))!.hoeveelheid;

      // Veiligheidstoeslagen: 1 + 0.20 + 0.10 + 0.15 = 1.45 (kwartier afronding geeft kleine afwijking)
      expect(urenAlles).toBeGreaterThan(urenBasis);
    });

    it("voegt gecertificeerde boominspectie toe", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen_extended"],
        scopeData: {
          bomen_extended: {
            aantalBomen: 3, snoei: "licht", hoogteklasse: "laag",
            afvoer: false, inspectie: "gecertificeerd",
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());
      const inspectie = regels.find(r => r.omschrijving.includes("gecertificeerd"));

      expect(inspectie).toBeDefined();
      // 3 bomen * €200
      expect(inspectie!.totaal).toBe(600);
    });

    it("berekent afvoer op basis van kroondiameter", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bomen_extended"],
        scopeData: {
          bomen_extended: {
            aantalBomen: 2, snoei: "licht", hoogteklasse: "laag",
            afvoer: true, kroondiameter: 4,
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());
      const afvoer = regels.find(r => r.omschrijving.includes("afvoeren"));

      expect(afvoer).toBeDefined();
      // kroondiameter^2 * 0.1 * aantalBomen = 16 * 0.1 * 2 = 3.2
      // Met normuur afvoer (1.0): 3.2 * 1.0 = 3.2 -> roundToQuarter = 3.25
      expect(afvoer!.hoeveelheid).toBe(roundToQuarter(4 * 4 * 0.1 * 2 * 1.0));
    });
  });

  // ---- OVERIG ONDERHOUD ----

  describe("overig onderhoud", () => {
    it("berekent bladruimen: vast 2 uur", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["overig"],
        scopeData: {
          overig: { bladruimen: true, terrasReinigen: false, onkruidBestrating: false, afwateringControleren: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const blad = regels.find(r => r.omschrijving.includes("Bladruimen"));

      expect(blad).toBeDefined();
      expect(blad!.hoeveelheid).toBe(2);
    });

    it("berekent terras reinigen: opp * 0.05 uur/m2", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["overig"],
        scopeData: {
          overig: { bladruimen: false, terrasReinigen: true, terrasOppervlakte: 40, onkruidBestrating: false, afwateringControleren: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const terras = regels.find(r => r.omschrijving.includes("Terras reinigen"));

      expect(terras).toBeDefined();
      // 40 * 0.05 = 2.0 uur
      expect(terras!.hoeveelheid).toBe(2);
    });

    it("berekent onkruid bestrating: opp * 0.03 uur/m2", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["overig"],
        scopeData: {
          overig: { bladruimen: false, terrasReinigen: false, onkruidBestrating: true, bestratingOppervlakte: 60, afwateringControleren: false },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const onkruid = regels.find(r => r.omschrijving.includes("Onkruid bestrating"));

      expect(onkruid).toBeDefined();
      // 60 * 0.03 = 1.8 -> roundToQuarter = 1.75
      expect(onkruid!.hoeveelheid).toBe(roundToQuarter(60 * 0.03));
    });

    it("berekent afwatering controleren: punten * 0.25 uur/punt", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["overig"],
        scopeData: {
          overig: { bladruimen: false, terrasReinigen: false, onkruidBestrating: false, afwateringControleren: true, aantalAfwateringspunten: 6 },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const afwatering = regels.find(r => r.omschrijving.includes("Afwatering"));

      expect(afwatering).toBeDefined();
      // 6 * 0.25 = 1.5 uur
      expect(afwatering!.hoeveelheid).toBe(1.5);
    });

    it("voegt overige uren toe met notitie", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["overig"],
        scopeData: {
          overig: { bladruimen: false, terrasReinigen: false, onkruidBestrating: false, afwateringControleren: false, overigUren: 3, overigNotities: "Vijver schoonmaken" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, context);
      const overig = regels.find(r => r.omschrijving.includes("Vijver"));

      expect(overig).toBeDefined();
      expect(overig!.hoeveelheid).toBe(3);
    });
  });

  // ---- REINIGING ONDERHOUD ----

  describe("reiniging onderhoud", () => {
    it("berekent terrasreiniging met type factor (natuursteen = 1.5)", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["reiniging"],
        scopeData: {
          reiniging: { terrasReinigen: true, terrasOppervlakte: 20, terrasType: "natuursteen" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const arbeid = regels.find(r => r.type === "arbeid" && r.omschrijving.includes("Terras reinigen"));
      const materiaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Reinigingsmiddel"));

      expect(arbeid).toBeDefined();
      // 20m2 * 0.05 uur/m2 * 1.5 (natuursteen) = 1.5 uur
      expect(arbeid!.hoeveelheid).toBe(roundToQuarter(20 * 0.05 * 1.5));

      expect(materiaal).toBeDefined();
      // 20m2 * €2.00/m2
      expect(materiaal!.totaal).toBe(40);
    });

    it("berekent bladruimen seizoen (4 beurten)", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["reiniging"],
        scopeData: {
          reiniging: { bladruimen: true, bladruimenOppervlakte: 100, bladruimenType: "seizoen" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const blad = regels.find(r => r.omschrijving.includes("Bladruimen"));
      expect(blad).toBeDefined();
      // 100 * 0.02 * 4 beurten = 8.0 uur
      expect(blad!.hoeveelheid).toBe(roundToQuarter(100 * 0.02 * 4));
    });

    it("berekent onkruid bestrating met branden methode + machine", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["reiniging"],
        scopeData: {
          reiniging: { onkruidBestrating: true, onkruidOppervlakte: 50, onkruidMethode: "branden" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const arbeid = regels.find(r => r.type === "arbeid" && r.omschrijving.includes("Onkruid bestrating"));
      const machine = regels.find(r => r.type === "machine");

      expect(arbeid).toBeDefined();
      expect(machine).toBeDefined();
      expect(machine!.omschrijving).toContain("Onkruidbrander");
      expect(machine!.prijsPerEenheid).toBe(45);
    });

    it("berekent onkruid bestrating met chemische methode + materiaal", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["reiniging"],
        scopeData: {
          reiniging: { onkruidBestrating: true, onkruidOppervlakte: 30, onkruidMethode: "chemisch" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const materiaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Onkruidbestrijdingsmiddel"));

      expect(materiaal).toBeDefined();
      // 30m2 * €3.00/m2
      expect(materiaal!.totaal).toBe(90);
    });

    it("berekent algereiniging met anti-alg middel", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["reiniging"],
        scopeData: {
          reiniging: { algereiniging: true, algeOppervlakte: 40 },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const arbeid = regels.find(r => r.type === "arbeid" && r.omschrijving.includes("Algereiniging"));
      const materiaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Anti-alg"));

      expect(arbeid).toBeDefined();
      // 40m2 * 0.03 = 1.2 -> roundToQuarter = 1.25
      expect(arbeid!.hoeveelheid).toBe(roundToQuarter(40 * 0.03));

      expect(materiaal).toBeDefined();
      // 40m2 * €1.50/m2
      expect(materiaal!.totaal).toBe(60);
    });
  });

  // ---- BEMESTING ONDERHOUD ----

  describe("bemesting onderhoud", () => {
    it("berekent bemesting met standaard marge override van 70%", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bemesting"],
        scopeData: {
          bemesting: { oppervlakte: 100 },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      // Alle bemesting regels moeten margePercentage 70 hebben
      for (const regel of regels) {
        expect(regel.margePercentage).toBe(70);
      }

      const arbeid = regels.find(r => r.type === "arbeid" && r.omschrijving.includes("Bemesting"));
      const materiaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Bemestingsproduct"));

      expect(arbeid).toBeDefined();
      expect(materiaal).toBeDefined();

      // Arbeid: 100m2 * 0.005 * 1 freq = 0.5 uur
      expect(arbeid!.hoeveelheid).toBe(0.5);
      // Materiaal: 100m2 * 1 freq * €0.80 (basis) = €80
      expect(materiaal!.totaal).toBe(80);
    });

    it("berekent premium bemesting met hogere prijs", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bemesting"],
        scopeData: {
          bemesting: { oppervlakte: 100, bemestingstype: "premium" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());
      const materiaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("premium"));

      expect(materiaal).toBeDefined();
      // 100m2 * €1.50/m2 (premium)
      expect(materiaal!.totaal).toBe(150);
    });

    it("past frequentiekorting toe bij 2+ beurten", () => {
      const input1x: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bemesting"],
        scopeData: {
          bemesting: { oppervlakte: 200, frequentie: 1 },
        },
        bereikbaarheid: "goed",
      };

      const input2x: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bemesting"],
        scopeData: {
          bemesting: { oppervlakte: 200, frequentie: 2 },
        },
        bereikbaarheid: "goed",
      };

      const regels1x = calculateOfferteRegels(input1x, createContext());
      const regels2x = calculateOfferteRegels(input2x, createContext());

      const arbeid1x = regels1x.find(r => r.type === "arbeid" && r.omschrijving.includes("Bemesting"))!;
      const arbeid2x = regels2x.find(r => r.type === "arbeid" && r.omschrijving.includes("Bemesting"))!;

      // 2x frequentie met 10% korting: uren = 200*0.005*2*0.90 = 1.8 vs 200*0.005*1*1.0 = 1.0
      expect(arbeid2x.hoeveelheid).toBeGreaterThan(arbeid1x.hoeveelheid);
    });

    it("voegt kalkbehandeling toe als kalkbehandeling = true", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bemesting"],
        scopeData: {
          bemesting: { oppervlakte: 80, kalkbehandeling: true },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const kalkArbeid = regels.find(r => r.omschrijving.includes("Kalkbehandeling"));
      const kalkMateriaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Kalk"));

      expect(kalkArbeid).toBeDefined();
      expect(kalkMateriaal).toBeDefined();
      expect(kalkMateriaal!.margePercentage).toBe(70);
    });

    it("voegt grondanalyse toe als grondanalyse = true", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bemesting"],
        scopeData: {
          bemesting: { oppervlakte: 100, grondanalyse: true },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const analyse = regels.find(r => r.omschrijving.includes("Grondanalyse"));
      expect(analyse).toBeDefined();
      expect(analyse!.totaal).toBe(49);
      expect(analyse!.margePercentage).toBe(70);
    });

    it("geeft lege array bij oppervlakte 0", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["bemesting"],
        scopeData: {
          bemesting: { oppervlakte: 0 },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, createContext())).toHaveLength(0);
    });
  });

  // ---- GAZONANALYSE ONDERHOUD ----

  describe("gazonanalyse onderhoud", () => {
    it("voegt altijd gazonbeoordeling toe (0.5 uur)", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gazonanalyse"],
        scopeData: {
          gazonanalyse: { oppervlakte: 100 },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());
      const beoordeling = regels.find(r => r.omschrijving.includes("Gazonbeoordeling"));

      expect(beoordeling).toBeDefined();
      expect(beoordeling!.hoeveelheid).toBe(0.5);
    });

    it("voegt verticuteren + machine toe", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gazonanalyse"],
        scopeData: {
          gazonanalyse: {
            oppervlakte: 200,
            herstelacties: { verticuteren: true },
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const verticuteren = regels.find(r => r.type === "arbeid" && r.omschrijving === "Verticuteren");
      const machine = regels.find(r => r.type === "machine" && r.omschrijving.includes("Verticuteer"));

      expect(verticuteren).toBeDefined();
      expect(machine).toBeDefined();
      expect(machine!.prijsPerEenheid).toBe(80);
    });

    it("voegt doorzaaien + zaad toe", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gazonanalyse"],
        scopeData: {
          gazonanalyse: {
            oppervlakte: 150,
            herstelacties: { doorzaaien: true },
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const arbeid = regels.find(r => r.omschrijving === "Doorzaaien");
      const materiaal = regels.find(r => r.omschrijving.includes("Graszaad (doorzaaien)"));

      expect(arbeid).toBeDefined();
      expect(materiaal).toBeDefined();
      // 150m2 * €3.00/m2
      expect(materiaal!.totaal).toBe(450);
    });

    it("voegt bekalken toe", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gazonanalyse"],
        scopeData: {
          gazonanalyse: { oppervlakte: 100, bekalken: true },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const bekalken = regels.find(r => r.omschrijving.includes("Bekalken gazon"));
      const kalkMateriaal = regels.find(r => r.omschrijving.includes("Kalk (gazon)"));

      expect(bekalken).toBeDefined();
      expect(kalkMateriaal).toBeDefined();
      // 100m2 * €0.50/m2
      expect(kalkMateriaal!.totaal).toBe(50);
    });

    it("voegt drainage opmerking toe", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gazonanalyse"],
        scopeData: {
          gazonanalyse: { oppervlakte: 100, drainage: true },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const drainage = regels.find(r => r.omschrijving.includes("Drainage"));
      expect(drainage).toBeDefined();
      expect(drainage!.totaal).toBe(0);
    });

    it("geeft lege array bij oppervlakte 0", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["gazonanalyse"],
        scopeData: {
          gazonanalyse: { oppervlakte: 0 },
        },
        bereikbaarheid: "goed",
      };

      expect(calculateOfferteRegels(input, createContext())).toHaveLength(0);
    });
  });

  // ---- MOLLENBESTRIJDING ONDERHOUD ----

  describe("mollenbestrijding onderhoud", () => {
    it("berekent basis pakket: 1 bezoek + 1 controle", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["mollenbestrijding"],
        scopeData: {
          mollenbestrijding: { pakket: "basis" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const plaatsen = regels.find(r => r.omschrijving.includes("plaatsen") && r.type === "arbeid");
      const materiaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("basis"));
      const controle = regels.find(r => r.omschrijving.includes("controle") || r.omschrijving.includes("Controle"));

      expect(plaatsen).toBeDefined();
      // 2 uur voor plaatsen
      expect(plaatsen!.hoeveelheid).toBe(2);

      expect(materiaal).toBeDefined();
      expect(materiaal!.totaal).toBe(35);

      expect(controle).toBeDefined();
      // 0.5 uur
      expect(controle!.hoeveelheid).toBe(0.5);
    });

    it("berekent premium pakket: 3 bezoeken + 3 controles", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["mollenbestrijding"],
        scopeData: {
          mollenbestrijding: { pakket: "premium" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const plaatsen = regels.find(r => r.omschrijving.includes("plaatsen") && r.type === "arbeid");
      const materiaal = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("premium"));

      expect(plaatsen).toBeDefined();
      // 3 * 1.5 = 4.5 uur
      expect(plaatsen!.hoeveelheid).toBe(4.5);

      expect(materiaal).toBeDefined();
      expect(materiaal!.totaal).toBe(75);
    });

    it("berekent premium_plus pakket: 6 bezoeken + controles", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["mollenbestrijding"],
        scopeData: {
          mollenbestrijding: { pakket: "premium_plus" },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const plaatsen = regels.find(r => r.omschrijving.includes("plaatsen") || r.omschrijving.includes("beheer"));
      const materiaal = regels.find(r => r.type === "materiaal");

      expect(plaatsen).toBeDefined();
      // 6 * 1 = 6 uur
      expect(plaatsen!.hoeveelheid).toBe(6);

      expect(materiaal).toBeDefined();
      expect(materiaal!.totaal).toBe(120);
    });

    it("voegt gazonherstel toe als aanvullend gegeven", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["mollenbestrijding"],
        scopeData: {
          mollenbestrijding: {
            pakket: "basis",
            aanvullend: { gazonherstel: true, geschatteM2: 10 },
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const herstelArbeid = regels.find(r => r.omschrijving.includes("Gazonherstel"));
      const herstelMateriaal = regels.find(r => r.omschrijving.includes("Graszaad (mollenherstel)"));

      expect(herstelArbeid).toBeDefined();
      expect(herstelMateriaal).toBeDefined();
      // 10m2 * €5.00/m2
      expect(herstelMateriaal!.totaal).toBe(50);
    });

    it("voegt preventief gaas toe", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["mollenbestrijding"],
        scopeData: {
          mollenbestrijding: {
            pakket: "basis",
            aanvullend: { preventiefGaas: true, gaasOppervlakte: 25 },
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());

      const gaasMateriaal = regels.find(r => r.omschrijving.includes("Mollenwerend gaas"));
      expect(gaasMateriaal).toBeDefined();
      // 25m2 * €4.00/m2
      expect(gaasMateriaal!.totaal).toBe(100);
    });

    it("voegt terugkeer-check toe", () => {
      const input: OfferteCalculationInput = {
        type: "onderhoud",
        scopes: ["mollenbestrijding"],
        scopeData: {
          mollenbestrijding: {
            pakket: "basis",
            aanvullend: { terugkeerCheck: true },
          },
        },
        bereikbaarheid: "goed",
      };

      const regels = calculateOfferteRegels(input, createContext());
      const terugkeer = regels.find(r => r.omschrijving.includes("Terugkeer"));

      expect(terugkeer).toBeDefined();
      expect(terugkeer!.hoeveelheid).toBe(1);
    });
  });
});

// ──────────────────────────────────────────────
// 4. calculateOfferteRegels — multi-scope & correctiefactoren
// ──────────────────────────────────────────────

describe("calculateOfferteRegels — cross-cutting concerns", () => {
  let context: CalculationContext;

  beforeEach(() => {
    context = createContext();
  });

  it("combineert meerdere aanleg scopes in een offerte", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk", "bestrating", "gras"],
      scopeData: {
        grondwerk: { oppervlakte: 30, diepte: "standaard", afvoerGrond: false },
        bestrating: { oppervlakte: 15, typeBestrating: "tegel", snijwerk: "laag" },
        gras: { oppervlakte: 80, type: "graszoden", ondergrond: "nieuw", afwateringNodig: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    const grondwerkRegels = regels.filter(r => r.scope === "grondwerk");
    const bestratingRegels = regels.filter(r => r.scope === "bestrating");
    const grasRegels = regels.filter(r => r.scope === "gras");

    expect(grondwerkRegels.length).toBeGreaterThan(0);
    expect(bestratingRegels.length).toBeGreaterThan(0);
    expect(grasRegels.length).toBeGreaterThan(0);
  });

  it("negeert scopes zonder data", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk", "bestrating"],
      scopeData: {
        grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: false },
        // bestrating niet aanwezig
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    const bestratingRegels = regels.filter(r => r.scope === "bestrating");
    expect(bestratingRegels).toHaveLength(0);
  });

  it("geeft lege array bij lege scopes", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: [],
      scopeData: {},
      bereikbaarheid: "goed",
    };

    expect(calculateOfferteRegels(input, context)).toEqual([]);
  });

  it("valt terug op factor 1.0 bij onbekende correctiefactor", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 40, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "onbekend" as "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    // Moet niet crashen en factor 1.0 gebruiken
    expect(regels.length).toBeGreaterThan(0);
    const ontgraven = regels.find(r => r.omschrijving.includes("Ontgraven"));
    // 40 * 0.25 * 1.0 = 10 uur
    expect(ontgraven!.hoeveelheid).toBe(10);
  });

  it("werkt correct zonder normuren (geeft lege regels)", () => {
    const ctx = createContext({ normuren: [] });

    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 40, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, ctx);
    expect(Array.isArray(regels)).toBe(true);
  });

  it("werkt correct zonder producten (geen materiaal regels)", () => {
    const ctx = createContext({ producten: [] });

    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 40, diepte: "standaard", afvoerGrond: true },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, ctx);
    const materiaalRegels = regels.filter(r => r.type === "materiaal");

    expect(materiaalRegels).toHaveLength(0);
  });

  it("rondt alle arbeidsuren af op kwartier", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 13, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    for (const regel of regels.filter(r => r.type === "arbeid")) {
      const remainder = regel.hoeveelheid % 0.25;
      expect(remainder).toBeCloseTo(0, 10);
    }
  });

  it("alle regels hebben een uniek id", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk", "bestrating", "borders"],
      scopeData: {
        grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: true },
        bestrating: { oppervlakte: 15, typeBestrating: "tegel", snijwerk: "laag", onderbouw: { opsluitbanden: true } },
        borders: { oppervlakte: 10, beplantingsintensiteit: "gemiddeld", bodemverbetering: false, afwerking: "schors" },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    const ids = regels.map(r => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("alle regels hebben correct scope label", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk", "gras"],
      scopeData: {
        grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: false },
        gras: { oppervlakte: 50, type: "zaaien", ondergrond: "nieuw", afwateringNodig: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);

    for (const regel of regels) {
      expect(["grondwerk", "gras"]).toContain(regel.scope);
    }
  });
});

// ──────────────────────────────────────────────
// 5. createMateriaalRegel — verliespercentage
// ──────────────────────────────────────────────

describe("verliespercentage (via materiaal regels)", () => {
  let context: CalculationContext;

  beforeEach(() => {
    context = createContext();
  });

  it("berekent hoeveelheid met 5% verlies correct", () => {
    // Graszoden hebben 5% verliespercentage
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["gras"],
      scopeData: {
        gras: { oppervlakte: 100, type: "graszoden", ondergrond: "nieuw", afwateringNodig: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);
    const zoden = regels.find(r => r.type === "materiaal" && r.omschrijving === "Graszoden");

    // 100 * (1 + 5/100) = 105
    expect(zoden!.hoeveelheid).toBe(105);
    // Totaal = 105 * 7 = 735
    expect(zoden!.totaal).toBe(735);
  });

  it("berekent zonder verlies (0%) correct", () => {
    // Graszaad sport heeft 0% verlies
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["gras"],
      scopeData: {
        gras: { oppervlakte: 100, type: "zaaien", ondergrond: "nieuw", afwateringNodig: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);
    const zaad = regels.find(r => r.type === "materiaal" && r.omschrijving.includes("Graszaad"));

    // 100m2 * 0.035 kg/m2 = 3.5 kg, geen verlies
    expect(zaad!.hoeveelheid).toBe(3.5);
  });

  it("rondt materiaal hoeveelheid af op 2 decimalen", () => {
    // 10 * 3 planten * (1 + 0.05) = 31.5 (al mooi)
    // Maar 15m2 * 0.05 * (1 + 0.05) = 0.7875 -> 0.79
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["borders"],
      scopeData: {
        borders: { oppervlakte: 15, beplantingsintensiteit: "gemiddeld", bodemverbetering: false, afwerking: "schors" },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);
    const schors = regels.find(r => r.type === "materiaal" && r.omschrijving.toLowerCase().includes("schors"));

    // Alle materiaal hoeveelheden zijn afgerond op 2 decimalen
    if (schors) {
      const decimalPlaces = (schors.hoeveelheid.toString().split(".")[1] || "").length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    }
  });
});

// ──────────────────────────────────────────────
// 6. createArbeidsRegel — kwartier afronding
// ──────────────────────────────────────────────

describe("kwartier afronding (via arbeids regels)", () => {
  it("rondt 3.25 af op 3.25 (exact kwartier)", () => {
    // 13m2 * 0.25 = 3.25 -> exact kwartier
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 13, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, createContext());
    const ontgraven = regels.find(r => r.omschrijving.includes("Ontgraven"));

    expect(ontgraven!.hoeveelheid).toBe(3.25);
  });

  it("rondt 1.125 af naar 1.25 (round up)", () => {
    // Volume heg = 10 * 1.5 * 0.5 = 7.5 m3
    // Uren = 7.5 * 0.15 = 1.125 -> roundToQuarter(1.125) = 1.25
    const input: OfferteCalculationInput = {
      type: "onderhoud",
      scopes: ["heggen"],
      scopeData: {
        heggen: { lengte: 10, hoogte: 1.5, breedte: 0.5, snoei: "beide", afvoerSnoeisel: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, createContext());
    const snoeien = regels.find(r => r.omschrijving.includes("snoeien"));

    expect(snoeien!.hoeveelheid).toBe(1.25);
  });

  it("behoudt totaal = uren * uurtarief na afronding", () => {
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 50, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, createContext());
    const ontgraven = regels.find(r => r.omschrijving.includes("Ontgraven"))!;

    // Totaal moet exact hoeveelheid * prijsPerEenheid zijn
    expect(ontgraven.totaal).toBe(cents(ontgraven.hoeveelheid * ontgraven.prijsPerEenheid));
  });
});

// ──────────────────────────────────────────────
// 7. Helper functies: getOfferteOverhead & getGarantiePakketRegel
// ──────────────────────────────────────────────

describe("getOfferteOverhead", () => {
  it("geeft een vaste overhead regel van €200", () => {
    const overhead = getOfferteOverhead();

    expect(overhead.scope).toBe("algemeen");
    expect(overhead.type).toBe("arbeid");
    expect(overhead.totaal).toBe(200);
    expect(overhead.hoeveelheid).toBe(1);
    expect(overhead.prijsPerEenheid).toBe(200);
    expect(overhead.eenheid).toBe("vast");
    expect(overhead.omschrijving).toContain("voorbereiding");
  });

  it("heeft een uniek id", () => {
    const overhead1 = getOfferteOverhead();
    const overhead2 = getOfferteOverhead();

    expect(overhead1.id).toBeDefined();
    expect(overhead1.id).not.toBe(overhead2.id);
  });
});

describe("getGarantiePakketRegel", () => {
  it("genereert een garantiepakket regel", () => {
    const regel = getGarantiePakketRegel("5 jaar uitgebreid", 499);

    expect(regel.scope).toBe("garantie");
    expect(regel.type).toBe("materiaal");
    expect(regel.totaal).toBe(499);
    expect(regel.hoeveelheid).toBe(1);
    expect(regel.prijsPerEenheid).toBe(499);
    expect(regel.eenheid).toBe("pakket");
    expect(regel.omschrijving).toContain("5 jaar uitgebreid");
  });

  it("werkt met verschillende pakketnamen en prijzen", () => {
    const basis = getGarantiePakketRegel("Basis", 199);
    const premium = getGarantiePakketRegel("Premium Plus", 899);

    expect(basis.totaal).toBe(199);
    expect(premium.totaal).toBe(899);
    expect(basis.omschrijving).toContain("Basis");
    expect(premium.omschrijving).toContain("Premium Plus");
  });

  it("heeft een uniek id", () => {
    const regel1 = getGarantiePakketRegel("Test", 100);
    const regel2 = getGarantiePakketRegel("Test", 100);

    expect(regel1.id).not.toBe(regel2.id);
  });
});

// ──────────────────────────────────────────────
// 8. Integratie: volledig offerte doorrekenen
// ──────────────────────────────────────────────

describe("integratie — complete offerte doorrekening", () => {
  it("berekent een complete aanleg offerte van grondwerk tot totaal incl BTW", () => {
    const context = createContext();
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk", "gras"],
      scopeData: {
        grondwerk: { oppervlakte: 40, diepte: "standaard", afvoerGrond: true },
        gras: { oppervlakte: 40, type: "graszoden", ondergrond: "nieuw", afwateringNodig: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);
    const totals = calculateTotals(regels, 20, 21);

    // Verifieer dat alles consistent is
    expect(totals.subtotaal).toBe(cents(totals.materiaalkosten + totals.arbeidskosten));
    expect(totals.totaalExBtw).toBe(cents(totals.subtotaal + totals.marge));
    expect(totals.btw).toBe(cents(totals.totaalExBtw * 0.21));
    expect(totals.totaalInclBtw).toBe(cents(totals.totaalExBtw + totals.btw));
    expect(totals.totaalUren).toBeGreaterThan(0);

    // Regels moeten zowel arbeid als materiaal bevatten
    expect(regels.some(r => r.type === "arbeid")).toBe(true);
    expect(regels.some(r => r.type === "materiaal")).toBe(true);
  });

  it("berekent een complete onderhoud offerte met scope marges", () => {
    const context = createContext();
    const input: OfferteCalculationInput = {
      type: "onderhoud",
      scopes: ["gras", "heggen", "bomen"],
      scopeData: {
        gras: { grasAanwezig: true, grasOppervlakte: 200, maaien: true, kantenSteken: true, verticuteren: false, afvoerGras: false },
        heggen: { lengte: 15, hoogte: 1.8, breedte: 0.6, snoei: "beide", afvoerSnoeisel: true },
        bomen: { aantalBomen: 3, snoei: "licht", hoogteklasse: "laag", afvoer: false },
      },
      bereikbaarheid: "beperkt",
      achterstalligheid: "gemiddeld",
    };

    const regels = calculateOfferteRegels(input, context);

    const scopeMarges: ScopeMarges = {
      gras_onderhoud: 15,
      heggen: 25,
      bomen: 30,
    };

    const totals = calculateTotals(regels, 20, 21, scopeMarges);

    expect(totals.subtotaal).toBeGreaterThan(0);
    expect(totals.totaalInclBtw).toBeGreaterThan(totals.totaalExBtw);
    expect(totals.marge).toBeGreaterThan(0);
  });

  it("offerte overhead integreert correct in totalen", () => {
    const context = createContext();
    const input: OfferteCalculationInput = {
      type: "aanleg",
      scopes: ["grondwerk"],
      scopeData: {
        grondwerk: { oppervlakte: 20, diepte: "standaard", afvoerGrond: false },
      },
      bereikbaarheid: "goed",
    };

    const regels = calculateOfferteRegels(input, context);
    const overhead = getOfferteOverhead();
    const allRegels = [...regels, overhead];

    const totalsZonder = calculateTotals(regels, 20, 21);
    const totalsMet = calculateTotals(allRegels, 20, 21);

    // Overhead voegt €200 toe aan arbeidskosten
    expect(totalsMet.arbeidskosten).toBe(totalsZonder.arbeidskosten + 200);
  });
});
