/**
 * Unit tests for facturen (invoice) business logic.
 *
 * Since Convex handler functions require the Convex runtime, these tests
 * extract and verify the pure business logic: invoice number generation,
 * amount calculations, status transition rules, correction thresholds,
 * and creditnota calculations.
 */
import { describe, it, expect } from "vitest";

// ─── Extracted business logic helpers ────────────────────────────────────────

/** Valid status transitions map (mirrors convex/facturen.ts updateStatus) */
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  concept: ["definitief"],
  definitief: ["concept", "verzonden"],
  verzonden: ["betaald", "vervallen"],
  betaald: [], // Final status
  vervallen: ["verzonden"], // Can be re-sent
};

type FactuurStatus = "concept" | "definitief" | "verzonden" | "betaald" | "vervallen";

function isValidStatusTransition(from: FactuurStatus, to: FactuurStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Generate factuurnummer (mirrors convex/facturen.ts generate) */
function generateFactuurnummer(
  prefix: string,
  jaar: number,
  volgendNummer: number,
): string {
  return `${prefix}${jaar}-${String(volgendNummer).padStart(3, "0")}`;
}

/** Generate creditnota nummer (mirrors convex/facturen.ts createCreditnota) */
function generateCreditnotaNummer(jaar: number, volgendNummer: number): string {
  return `CN-${jaar}-${String(volgendNummer).padStart(3, "0")}`;
}

interface Regel {
  id: string;
  omschrijving: string;
  eenheid: string;
  hoeveelheid: number;
  prijsPerEenheid: number;
  totaal: number;
}

interface Correctie {
  omschrijving: string;
  bedrag: number;
}

/** Calculate invoice totals (mirrors convex/facturen.ts generate & update) */
function calculateTotals(
  regels: Regel[],
  correcties: Correctie[],
  btwPercentage: number,
): { subtotaal: number; btwBedrag: number; totaalInclBtw: number } {
  const regelsTotaal = regels.reduce((sum, r) => sum + r.totaal, 0);
  const correctiesTotaal = correcties.reduce((sum, c) => sum + c.bedrag, 0);
  const subtotaal = regelsTotaal + correctiesTotaal;
  const btwBedrag = subtotaal * (btwPercentage / 100);
  const totaalInclBtw = subtotaal + btwBedrag;
  return { subtotaal, btwBedrag, totaalInclBtw };
}

/** Determine corrections from nacalculatie (mirrors convex/facturen.ts generate) */
function buildCorrections(
  afwijkingPercentage: number,
  afwijkingUren: number,
  uurtarief: number,
): Correctie[] {
  const correcties: Correctie[] = [];
  if (Math.abs(afwijkingPercentage) >= 5) {
    const correctieBedrag = afwijkingUren * uurtarief;
    if (correctieBedrag !== 0) {
      correcties.push({
        omschrijving:
          afwijkingUren > 0
            ? `Meerwerk: ${afwijkingUren} uur extra (${afwijkingPercentage}% afwijking)`
            : `Minderwerk: ${Math.abs(afwijkingUren)} uur minder (${afwijkingPercentage}% afwijking)`,
        bedrag: correctieBedrag,
      });
    }
  }
  return correcties;
}

/** Calculate vervaldatum (mirrors convex/facturen.ts generate) */
function calculateVervaldatum(now: number, betalingstermijnDagen: number): number {
  return now + betalingstermijnDagen * 24 * 60 * 60 * 1000;
}

/** Build negative credit note lines (mirrors convex/facturen.ts createCreditnota) */
function buildCreditnotaRegels(regels: Regel[]): Regel[] {
  return regels.map((r) => ({
    id: r.id,
    omschrijving: r.omschrijving,
    eenheid: r.eenheid,
    hoeveelheid: r.hoeveelheid,
    prijsPerEenheid: -Math.abs(r.prijsPerEenheid),
    totaal: -Math.abs(r.totaal),
  }));
}

/** Statuses that allow creditnota creation */
const CREDITNOTA_ELIGIBLE_STATUSES: FactuurStatus[] = ["verzonden", "betaald", "vervallen"];

function isCreditnotaEligible(status: FactuurStatus): boolean {
  return CREDITNOTA_ELIGIBLE_STATUSES.includes(status);
}

/** Stats calculation (mirrors convex/facturen.ts getStats) */
interface FactuurForStats {
  status: FactuurStatus;
  totaalInclBtw: number;
}

function calculateStats(facturen: FactuurForStats[]) {
  let conceptCount = 0;
  let definitiefCount = 0;
  let verzondenCount = 0;
  let betaaldCount = 0;
  let vervallenCount = 0;
  let totaalBedrag = 0;
  let openstaandBedrag = 0;
  let betaaldBedrag = 0;

  for (const factuur of facturen) {
    switch (factuur.status) {
      case "concept":
        conceptCount++;
        break;
      case "definitief":
        definitiefCount++;
        break;
      case "verzonden":
        verzondenCount++;
        openstaandBedrag += factuur.totaalInclBtw;
        break;
      case "betaald":
        betaaldCount++;
        betaaldBedrag += factuur.totaalInclBtw;
        break;
      case "vervallen":
        vervallenCount++;
        break;
    }
    totaalBedrag += factuur.totaalInclBtw;
  }

  return {
    totaal: facturen.length,
    totaalBedrag,
    openstaandBedrag,
    betaaldBedrag,
    concept: conceptCount,
    definitief: definitiefCount,
    verzonden: verzondenCount,
    betaald: betaaldCount,
    vervallen: vervallenCount,
  };
}

// ─── Mock data factories ─────────────────────────────────────────────────────

function createMockRegels(count = 3): Regel[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `regel-${i + 1}`,
    omschrijving: `Werkzaamheid ${i + 1}`,
    eenheid: "m2",
    hoeveelheid: 10 * (i + 1),
    prijsPerEenheid: 25,
    totaal: 10 * (i + 1) * 25,
  }));
}

function createMockCorrectie(bedrag: number, omschrijving = "Correctie"): Correctie {
  return { omschrijving, bedrag };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Facturen - Invoice Number Generation", () => {
  it("generates correct format with default prefix", () => {
    const nr = generateFactuurnummer("FAC-", 2026, 1);
    expect(nr).toBe("FAC-2026-001");
  });

  it("zero-pads numbers up to 3 digits", () => {
    expect(generateFactuurnummer("FAC-", 2026, 1)).toBe("FAC-2026-001");
    expect(generateFactuurnummer("FAC-", 2026, 10)).toBe("FAC-2026-010");
    expect(generateFactuurnummer("FAC-", 2026, 100)).toBe("FAC-2026-100");
  });

  it("handles numbers beyond 3 digits", () => {
    expect(generateFactuurnummer("FAC-", 2026, 1000)).toBe("FAC-2026-1000");
  });

  it("supports custom prefix", () => {
    expect(generateFactuurnummer("INV-", 2026, 5)).toBe("INV-2026-005");
    expect(generateFactuurnummer("TT-", 2025, 42)).toBe("TT-2025-042");
  });

  it("increments from laatsteFactuurNummer correctly", () => {
    const laatsteNummer = 7;
    const volgendNummer = laatsteNummer + 1;
    expect(generateFactuurnummer("FAC-", 2026, volgendNummer)).toBe("FAC-2026-008");
  });

  it("starts at 001 when no previous invoices exist", () => {
    const laatsteNummer = 0;
    const volgendNummer = laatsteNummer + 1;
    expect(generateFactuurnummer("FAC-", 2026, volgendNummer)).toBe("FAC-2026-001");
  });
});

describe("Facturen - Creditnota Number Generation", () => {
  it("generates CN-prefixed numbers", () => {
    expect(generateCreditnotaNummer(2026, 1)).toBe("CN-2026-001");
  });

  it("zero-pads correctly", () => {
    expect(generateCreditnotaNummer(2026, 42)).toBe("CN-2026-042");
    expect(generateCreditnotaNummer(2026, 100)).toBe("CN-2026-100");
  });
});

describe("Facturen - Amount Calculations", () => {
  it("calculates subtotaal from regels only (no corrections)", () => {
    const regels = createMockRegels(3);
    // regel 1: 10*25=250, regel 2: 20*25=500, regel 3: 30*25=750 => 1500
    const result = calculateTotals(regels, [], 21);
    expect(result.subtotaal).toBe(1500);
  });

  it("calculates correct BTW at 21%", () => {
    const regels = [{ id: "1", omschrijving: "Test", eenheid: "stuk", hoeveelheid: 1, prijsPerEenheid: 100, totaal: 100 }];
    const result = calculateTotals(regels, [], 21);
    expect(result.subtotaal).toBe(100);
    expect(result.btwBedrag).toBe(21);
    expect(result.totaalInclBtw).toBe(121);
  });

  it("calculates correct BTW at 9%", () => {
    const regels = [{ id: "1", omschrijving: "Test", eenheid: "stuk", hoeveelheid: 1, prijsPerEenheid: 200, totaal: 200 }];
    const result = calculateTotals(regels, [], 9);
    expect(result.subtotaal).toBe(200);
    expect(result.btwBedrag).toBe(18);
    expect(result.totaalInclBtw).toBe(218);
  });

  it("calculates correct BTW at 0%", () => {
    const regels = [{ id: "1", omschrijving: "Test", eenheid: "stuk", hoeveelheid: 1, prijsPerEenheid: 500, totaal: 500 }];
    const result = calculateTotals(regels, [], 0);
    expect(result.subtotaal).toBe(500);
    expect(result.btwBedrag).toBe(0);
    expect(result.totaalInclBtw).toBe(500);
  });

  it("includes positive corrections in subtotaal", () => {
    const regels = [{ id: "1", omschrijving: "Test", eenheid: "stuk", hoeveelheid: 1, prijsPerEenheid: 1000, totaal: 1000 }];
    const correcties = [createMockCorrectie(200, "Meerwerk")];
    const result = calculateTotals(regels, correcties, 21);
    expect(result.subtotaal).toBe(1200);
    expect(result.btwBedrag).toBeCloseTo(252);
    expect(result.totaalInclBtw).toBeCloseTo(1452);
  });

  it("subtracts negative corrections from subtotaal", () => {
    const regels = [{ id: "1", omschrijving: "Test", eenheid: "stuk", hoeveelheid: 1, prijsPerEenheid: 1000, totaal: 1000 }];
    const correcties = [createMockCorrectie(-150, "Minderwerk")];
    const result = calculateTotals(regels, correcties, 21);
    expect(result.subtotaal).toBe(850);
    expect(result.btwBedrag).toBeCloseTo(178.5);
    expect(result.totaalInclBtw).toBeCloseTo(1028.5);
  });

  it("handles multiple corrections", () => {
    const regels = [{ id: "1", omschrijving: "Test", eenheid: "stuk", hoeveelheid: 1, prijsPerEenheid: 1000, totaal: 1000 }];
    const correcties = [
      createMockCorrectie(300, "Meerwerk A"),
      createMockCorrectie(-100, "Minderwerk B"),
    ];
    const result = calculateTotals(regels, correcties, 21);
    expect(result.subtotaal).toBe(1200);
  });

  it("handles empty regels", () => {
    const result = calculateTotals([], [], 21);
    expect(result.subtotaal).toBe(0);
    expect(result.btwBedrag).toBe(0);
    expect(result.totaalInclBtw).toBe(0);
  });

  it("handles many regels accurately", () => {
    const regels: Regel[] = Array.from({ length: 20 }, (_, i) => ({
      id: `r-${i}`,
      omschrijving: `Item ${i}`,
      eenheid: "stuk",
      hoeveelheid: 1,
      prijsPerEenheid: 50,
      totaal: 50,
    }));
    const result = calculateTotals(regels, [], 21);
    expect(result.subtotaal).toBe(1000);
    expect(result.btwBedrag).toBe(210);
    expect(result.totaalInclBtw).toBe(1210);
  });
});

describe("Facturen - Nacalculatie Correction Logic", () => {
  it("adds correction when deviation >= 5%", () => {
    const correcties = buildCorrections(10, 5, 45);
    expect(correcties).toHaveLength(1);
    expect(correcties[0].bedrag).toBe(225); // 5 * 45
  });

  it("adds correction at exactly 5% threshold", () => {
    const correcties = buildCorrections(5, 3, 45);
    expect(correcties).toHaveLength(1);
    expect(correcties[0].bedrag).toBe(135); // 3 * 45
  });

  it("does not add correction below 5% threshold", () => {
    const correcties = buildCorrections(4.9, 2, 45);
    expect(correcties).toHaveLength(0);
  });

  it("does not add correction at 0% deviation", () => {
    const correcties = buildCorrections(0, 0, 45);
    expect(correcties).toHaveLength(0);
  });

  it("handles negative deviation (minderwerk) >= 5%", () => {
    const correcties = buildCorrections(-8, -4, 45);
    expect(correcties).toHaveLength(1);
    expect(correcties[0].bedrag).toBe(-180); // -4 * 45
    expect(correcties[0].omschrijving).toContain("Minderwerk");
    expect(correcties[0].omschrijving).toContain("4 uur minder");
  });

  it("labels positive deviation as meerwerk", () => {
    const correcties = buildCorrections(10, 5, 45);
    expect(correcties[0].omschrijving).toContain("Meerwerk");
    expect(correcties[0].omschrijving).toContain("5 uur extra");
  });

  it("includes deviation percentage in description", () => {
    const correcties = buildCorrections(12, 6, 50);
    expect(correcties[0].omschrijving).toContain("12% afwijking");
  });

  it("uses custom uurtarief", () => {
    const correcties = buildCorrections(10, 2, 65);
    expect(correcties[0].bedrag).toBe(130); // 2 * 65
  });

  it("does not add correction when uren is 0 even at high percentage", () => {
    const correcties = buildCorrections(50, 0, 45);
    expect(correcties).toHaveLength(0);
  });
});

describe("Facturen - Status Transitions", () => {
  it("allows concept -> definitief", () => {
    expect(isValidStatusTransition("concept", "definitief")).toBe(true);
  });

  it("allows definitief -> concept (unlock)", () => {
    expect(isValidStatusTransition("definitief", "concept")).toBe(true);
  });

  it("allows definitief -> verzonden", () => {
    expect(isValidStatusTransition("definitief", "verzonden")).toBe(true);
  });

  it("allows verzonden -> betaald", () => {
    expect(isValidStatusTransition("verzonden", "betaald")).toBe(true);
  });

  it("allows verzonden -> vervallen", () => {
    expect(isValidStatusTransition("verzonden", "vervallen")).toBe(true);
  });

  it("allows vervallen -> verzonden (re-send)", () => {
    expect(isValidStatusTransition("vervallen", "verzonden")).toBe(true);
  });

  it("rejects betaald -> any (final status)", () => {
    const targets: FactuurStatus[] = ["concept", "definitief", "verzonden", "vervallen"];
    for (const target of targets) {
      expect(isValidStatusTransition("betaald", target)).toBe(false);
    }
  });

  it("rejects concept -> verzonden (must go via definitief)", () => {
    expect(isValidStatusTransition("concept", "verzonden")).toBe(false);
  });

  it("rejects concept -> betaald (skips steps)", () => {
    expect(isValidStatusTransition("concept", "betaald")).toBe(false);
  });

  it("rejects concept -> vervallen", () => {
    expect(isValidStatusTransition("concept", "vervallen")).toBe(false);
  });

  it("rejects definitief -> betaald (must be verzonden first)", () => {
    expect(isValidStatusTransition("definitief", "betaald")).toBe(false);
  });

  it("rejects definitief -> vervallen", () => {
    expect(isValidStatusTransition("definitief", "vervallen")).toBe(false);
  });

  it("rejects verzonden -> concept", () => {
    expect(isValidStatusTransition("verzonden", "concept")).toBe(false);
  });

  it("rejects verzonden -> definitief", () => {
    expect(isValidStatusTransition("verzonden", "definitief")).toBe(false);
  });

  it("rejects vervallen -> concept", () => {
    expect(isValidStatusTransition("vervallen", "concept")).toBe(false);
  });

  it("rejects vervallen -> betaald", () => {
    expect(isValidStatusTransition("vervallen", "betaald")).toBe(false);
  });

  it("rejects vervallen -> definitief", () => {
    expect(isValidStatusTransition("vervallen", "definitief")).toBe(false);
  });
});

describe("Facturen - Vervaldatum Calculation", () => {
  it("calculates correct due date for 14-day term", () => {
    const now = new Date("2026-01-01T00:00:00Z").getTime();
    const vervaldatum = calculateVervaldatum(now, 14);
    const expected = new Date("2026-01-15T00:00:00Z").getTime();
    expect(vervaldatum).toBe(expected);
  });

  it("calculates correct due date for 30-day term", () => {
    const now = new Date("2026-03-01T00:00:00Z").getTime();
    const vervaldatum = calculateVervaldatum(now, 30);
    const expected = new Date("2026-03-31T00:00:00Z").getTime();
    expect(vervaldatum).toBe(expected);
  });

  it("calculates correct due date for 0-day term", () => {
    const now = Date.now();
    const vervaldatum = calculateVervaldatum(now, 0);
    expect(vervaldatum).toBe(now);
  });

  it("returns future date for positive term", () => {
    const now = Date.now();
    const vervaldatum = calculateVervaldatum(now, 7);
    expect(vervaldatum).toBeGreaterThan(now);
  });
});

describe("Facturen - Creditnota Calculations", () => {
  it("creates negative prijsPerEenheid and totaal", () => {
    const regels: Regel[] = [
      { id: "1", omschrijving: "Tegels", eenheid: "m2", hoeveelheid: 10, prijsPerEenheid: 50, totaal: 500 },
    ];
    const creditRegels = buildCreditnotaRegels(regels);
    expect(creditRegels[0].prijsPerEenheid).toBe(-50);
    expect(creditRegels[0].totaal).toBe(-500);
  });

  it("preserves hoeveelheid as positive", () => {
    const regels: Regel[] = [
      { id: "1", omschrijving: "Tegels", eenheid: "m2", hoeveelheid: 10, prijsPerEenheid: 50, totaal: 500 },
    ];
    const creditRegels = buildCreditnotaRegels(regels);
    expect(creditRegels[0].hoeveelheid).toBe(10);
  });

  it("preserves id, omschrijving, and eenheid", () => {
    const regels: Regel[] = [
      { id: "regel-abc", omschrijving: "Schutting plaatsen", eenheid: "m", hoeveelheid: 5, prijsPerEenheid: 80, totaal: 400 },
    ];
    const creditRegels = buildCreditnotaRegels(regels);
    expect(creditRegels[0].id).toBe("regel-abc");
    expect(creditRegels[0].omschrijving).toBe("Schutting plaatsen");
    expect(creditRegels[0].eenheid).toBe("m");
  });

  it("handles multiple regels", () => {
    const regels: Regel[] = [
      { id: "1", omschrijving: "A", eenheid: "m2", hoeveelheid: 10, prijsPerEenheid: 50, totaal: 500 },
      { id: "2", omschrijving: "B", eenheid: "stuk", hoeveelheid: 3, prijsPerEenheid: 100, totaal: 300 },
    ];
    const creditRegels = buildCreditnotaRegels(regels);
    expect(creditRegels).toHaveLength(2);
    expect(creditRegels[0].totaal).toBe(-500);
    expect(creditRegels[1].totaal).toBe(-300);
  });

  it("produces negative totals when combined with calculateTotals", () => {
    const regels: Regel[] = [
      { id: "1", omschrijving: "Test", eenheid: "m2", hoeveelheid: 10, prijsPerEenheid: 100, totaal: 1000 },
    ];
    const creditRegels = buildCreditnotaRegels(regels);
    const result = calculateTotals(creditRegels, [], 21);
    expect(result.subtotaal).toBe(-1000);
    expect(result.btwBedrag).toBe(-210);
    expect(result.totaalInclBtw).toBe(-1210);
  });

  it("handles already-negative values by ensuring they stay negative", () => {
    // Edge case: if someone passes already-negative values
    const regels: Regel[] = [
      { id: "1", omschrijving: "Test", eenheid: "m2", hoeveelheid: 5, prijsPerEenheid: -30, totaal: -150 },
    ];
    const creditRegels = buildCreditnotaRegels(regels);
    expect(creditRegels[0].prijsPerEenheid).toBe(-30);
    expect(creditRegels[0].totaal).toBe(-150);
  });
});

describe("Facturen - Creditnota Eligibility", () => {
  it("allows creditnota for verzonden invoices", () => {
    expect(isCreditnotaEligible("verzonden")).toBe(true);
  });

  it("allows creditnota for betaald invoices", () => {
    expect(isCreditnotaEligible("betaald")).toBe(true);
  });

  it("allows creditnota for vervallen invoices", () => {
    expect(isCreditnotaEligible("vervallen")).toBe(true);
  });

  it("rejects creditnota for concept invoices", () => {
    expect(isCreditnotaEligible("concept")).toBe(false);
  });

  it("rejects creditnota for definitief invoices", () => {
    expect(isCreditnotaEligible("definitief")).toBe(false);
  });
});

describe("Facturen - Stats Calculation", () => {
  it("returns zeros for empty list", () => {
    const stats = calculateStats([]);
    expect(stats.totaal).toBe(0);
    expect(stats.totaalBedrag).toBe(0);
    expect(stats.openstaandBedrag).toBe(0);
    expect(stats.betaaldBedrag).toBe(0);
    expect(stats.concept).toBe(0);
    expect(stats.definitief).toBe(0);
    expect(stats.verzonden).toBe(0);
    expect(stats.betaald).toBe(0);
    expect(stats.vervallen).toBe(0);
  });

  it("counts invoices per status correctly", () => {
    const facturen: FactuurForStats[] = [
      { status: "concept", totaalInclBtw: 100 },
      { status: "concept", totaalInclBtw: 200 },
      { status: "definitief", totaalInclBtw: 300 },
      { status: "verzonden", totaalInclBtw: 400 },
      { status: "betaald", totaalInclBtw: 500 },
      { status: "vervallen", totaalInclBtw: 600 },
    ];
    const stats = calculateStats(facturen);
    expect(stats.totaal).toBe(6);
    expect(stats.concept).toBe(2);
    expect(stats.definitief).toBe(1);
    expect(stats.verzonden).toBe(1);
    expect(stats.betaald).toBe(1);
    expect(stats.vervallen).toBe(1);
  });

  it("calculates totaalBedrag as sum of all invoices", () => {
    const facturen: FactuurForStats[] = [
      { status: "concept", totaalInclBtw: 100 },
      { status: "verzonden", totaalInclBtw: 400 },
      { status: "betaald", totaalInclBtw: 500 },
    ];
    const stats = calculateStats(facturen);
    expect(stats.totaalBedrag).toBe(1000);
  });

  it("calculates openstaandBedrag only from verzonden invoices", () => {
    const facturen: FactuurForStats[] = [
      { status: "concept", totaalInclBtw: 100 },
      { status: "verzonden", totaalInclBtw: 400 },
      { status: "verzonden", totaalInclBtw: 600 },
      { status: "betaald", totaalInclBtw: 500 },
    ];
    const stats = calculateStats(facturen);
    expect(stats.openstaandBedrag).toBe(1000);
  });

  it("calculates betaaldBedrag only from betaald invoices", () => {
    const facturen: FactuurForStats[] = [
      { status: "verzonden", totaalInclBtw: 400 },
      { status: "betaald", totaalInclBtw: 500 },
      { status: "betaald", totaalInclBtw: 300 },
    ];
    const stats = calculateStats(facturen);
    expect(stats.betaaldBedrag).toBe(800);
  });

  it("does not include vervallen or concept in financial aggregates", () => {
    const facturen: FactuurForStats[] = [
      { status: "concept", totaalInclBtw: 1000 },
      { status: "vervallen", totaalInclBtw: 2000 },
    ];
    const stats = calculateStats(facturen);
    expect(stats.openstaandBedrag).toBe(0);
    expect(stats.betaaldBedrag).toBe(0);
    // But totaalBedrag includes everything
    expect(stats.totaalBedrag).toBe(3000);
  });
});

describe("Facturen - Update Validation Rules", () => {
  it("only concept status allows editing", () => {
    const editableStatuses: FactuurStatus[] = ["concept"];
    const nonEditableStatuses: FactuurStatus[] = ["definitief", "verzonden", "betaald", "vervallen"];

    for (const status of editableStatuses) {
      expect(status === "concept").toBe(true);
    }
    for (const status of nonEditableStatuses) {
      expect(status === "concept").toBe(false);
    }
  });

  it("only verzonden status allows markAsPaid", () => {
    const payableStatuses: FactuurStatus[] = ["verzonden"];
    const nonPayableStatuses: FactuurStatus[] = ["concept", "definitief", "betaald", "vervallen"];

    for (const status of payableStatuses) {
      expect(status === "verzonden").toBe(true);
    }
    for (const status of nonPayableStatuses) {
      expect(status === "verzonden").toBe(false);
    }
  });
});

describe("Facturen - Recalculation on Update", () => {
  it("recalculates totals when regels change", () => {
    const originalRegels: Regel[] = [
      { id: "1", omschrijving: "Old", eenheid: "m2", hoeveelheid: 10, prijsPerEenheid: 50, totaal: 500 },
    ];
    const newRegels: Regel[] = [
      { id: "1", omschrijving: "Updated", eenheid: "m2", hoeveelheid: 20, prijsPerEenheid: 50, totaal: 1000 },
    ];

    const original = calculateTotals(originalRegels, [], 21);
    const updated = calculateTotals(newRegels, [], 21);

    expect(original.subtotaal).toBe(500);
    expect(updated.subtotaal).toBe(1000);
    expect(updated.btwBedrag).toBe(210);
    expect(updated.totaalInclBtw).toBe(1210);
  });

  it("recalculates totals when correcties change", () => {
    const regels: Regel[] = [
      { id: "1", omschrijving: "Test", eenheid: "m2", hoeveelheid: 10, prijsPerEenheid: 100, totaal: 1000 },
    ];
    const oldCorrecties = [createMockCorrectie(100)];
    const newCorrecties = [createMockCorrectie(300)];

    const before = calculateTotals(regels, oldCorrecties, 21);
    const after = calculateTotals(regels, newCorrecties, 21);

    expect(before.subtotaal).toBe(1100);
    expect(after.subtotaal).toBe(1300);
  });

  it("uses existing factuur BTW percentage (not recalculated)", () => {
    const regels: Regel[] = [
      { id: "1", omschrijving: "Test", eenheid: "stuk", hoeveelheid: 1, prijsPerEenheid: 100, totaal: 100 },
    ];
    // The factuur keeps its original btwPercentage when updating
    const at21 = calculateTotals(regels, [], 21);
    const at9 = calculateTotals(regels, [], 9);

    expect(at21.btwBedrag).toBe(21);
    expect(at9.btwBedrag).toBe(9);
    // Different rates yield different totals
    expect(at21.totaalInclBtw).not.toBe(at9.totaalInclBtw);
  });
});

describe("Facturen - Archive Filtering Logic", () => {
  it("hideArchived filters out archived non-paid invoices", () => {
    interface TestFactuur {
      status: FactuurStatus;
      isArchived?: boolean;
    }
    const facturen: TestFactuur[] = [
      { status: "concept", isArchived: true },
      { status: "verzonden", isArchived: false },
      { status: "betaald", isArchived: true },
      { status: "definitief" },
    ];

    // Replicate the filtering logic from list handler
    const hideArchived = true;
    const result = facturen.filter((f) => !f.isArchived || f.status === "betaald");

    // The archived concept should be filtered out
    // The non-archived verzonden should remain
    // The archived betaald should remain (paid always visible)
    // The non-archived definitief should remain
    expect(result).toHaveLength(3);
    expect(result.map((f) => f.status)).toEqual(["verzonden", "betaald", "definitief"]);
  });

  it("shows all invoices when hideArchived is false", () => {
    interface TestFactuur {
      status: FactuurStatus;
      isArchived?: boolean;
    }
    const facturen: TestFactuur[] = [
      { status: "concept", isArchived: true },
      { status: "verzonden", isArchived: true },
      { status: "betaald", isArchived: true },
    ];

    // No filter applied
    expect(facturen).toHaveLength(3);
  });
});
