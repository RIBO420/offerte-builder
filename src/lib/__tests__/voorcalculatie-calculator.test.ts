/**
 * Voorcalculatie: projectduur en weergave.
 *
 * De urenberekening die hier ooit getest werd is verdwenen — die leefde als
 * tweede engine naast het werkblad en gaf een ander getal. De normbron en de
 * kruiscontrole tussen beide paden staan nu in
 * `src/__tests__/unit/normuren.test.ts`.
 */

import { describe, it, expect } from "vitest";
import {
  calculateProjectDuration,
  calculateProjectDurationWithBuffer,
  formatUren,
  formatDagen,
  getScopeLabel,
  scopeLabels,
} from "@/lib/voorcalculatie-calculator";

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

  it("schrijft delen van een uur decimaal met een Nederlandse komma", () => {
    // Was "1:30 uur" — dat leest als een kloktijd terwijl het een duur is,
    // en het week af van het werkblad, dat decimaal telt.
    expect(formatUren(1.5)).toBe("1,50 uur");
    expect(formatUren(2.25)).toBe("2,25 uur");
    expect(formatUren(3.75)).toBe("3,75 uur");
  });

  it("toont het getal uit de eindschouw met een komma", () => {
    expect(formatUren(11.25)).toBe("11,25 uur");
    expect(formatUren(12.5)).toBe("12,50 uur");
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
  it("contains all 14 expected scope keys", () => {
    const expectedKeys = [
      "grondwerk", "bestrating", "parkeerplaats", "beregening", "borders", "gras",
      "houtwerk", "water_elektra", "specials",
      "gras_onderhoud", "borders_onderhoud", "heggen", "bomen", "overig",
    ];

    for (const key of expectedKeys) {
      expect(scopeLabels).toHaveProperty(key);
    }
    expect(Object.keys(scopeLabels)).toHaveLength(expectedKeys.length);
  });
});
