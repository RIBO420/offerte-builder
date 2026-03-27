import { describe, it, expect } from "vitest";
import {
  calculateNacalculatie,
  getDeviationStatus,
  getDeviationColor,
  formatHoursAsDays,
  formatDeviation,
  getScopeDisplayName,
  type VoorcalculatieData,
  type UrenRegistratie,
  type MachineGebruik,
  type NacalculatieInput,
  type OfferteRegel,
} from "@/lib/nacalculatie-calculator";

// ---------------------------------------------------------------------------
// Shared test fixtures — realistic Dutch landscaping project values
// ---------------------------------------------------------------------------

function createVoorcalculatie(overrides: Partial<VoorcalculatieData> = {}): VoorcalculatieData {
  return {
    normUrenTotaal: 56,
    geschatteDagen: 4,
    normUrenPerScope: {
      grondwerk: 14,
      bestrating: 24,
      borders: 10,
      gras: 8,
    },
    teamGrootte: 2,
    effectieveUrenPerDag: 7,
    ...overrides,
  };
}

/** Build registraties from a scope->hours map, spreading across days/workers */
function buildRegistraties(
  scopeUren: Record<string, number>,
  opts: { medewerkers?: string[]; startDate?: string } = {}
): UrenRegistratie[] {
  const medewerkers = opts.medewerkers ?? ["Jan van der Berg", "Piet Bakker"];
  const startDate = opts.startDate ?? "2025-03-17";
  const registraties: UrenRegistratie[] = [];
  let dayOffset = 0;

  for (const [scope, uren] of Object.entries(scopeUren)) {
    const perWorker = uren / medewerkers.length;
    for (const medewerker of medewerkers) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + dayOffset);
      registraties.push({
        datum: d.toISOString().split("T")[0],
        medewerker,
        uren: perWorker,
        scope,
        notities: `Werk aan ${scope}`,
      });
    }
    dayOffset++;
  }

  return registraties;
}

// ===========================================================================
// getDeviationStatus — threshold tests
// ===========================================================================

describe("getDeviationStatus", () => {
  describe("good: absolute deviation <= 5%", () => {
    it("returns good for 0%", () => expect(getDeviationStatus(0)).toBe("good"));
    it("returns good for +3%", () => expect(getDeviationStatus(3)).toBe("good"));
    it("returns good for -3%", () => expect(getDeviationStatus(-3)).toBe("good"));
    it("returns good at exact +5% boundary", () => expect(getDeviationStatus(5)).toBe("good"));
    it("returns good at exact -5% boundary", () => expect(getDeviationStatus(-5)).toBe("good"));
  });

  describe("warning: 5% < absolute deviation <= 15%", () => {
    it("returns warning just above 5% threshold (+5.1%)", () => expect(getDeviationStatus(5.1)).toBe("warning"));
    it("returns warning just above 5% threshold (-5.1%)", () => expect(getDeviationStatus(-5.1)).toBe("warning"));
    it("returns warning for +10%", () => expect(getDeviationStatus(10)).toBe("warning"));
    it("returns warning for -10%", () => expect(getDeviationStatus(-10)).toBe("warning"));
    it("returns warning at exact +15% boundary", () => expect(getDeviationStatus(15)).toBe("warning"));
    it("returns warning at exact -15% boundary", () => expect(getDeviationStatus(-15)).toBe("warning"));
  });

  describe("critical: absolute deviation > 15%", () => {
    it("returns critical just above 15% threshold (+15.1%)", () => expect(getDeviationStatus(15.1)).toBe("critical"));
    it("returns critical just above 15% threshold (-15.1%)", () => expect(getDeviationStatus(-15.1)).toBe("critical"));
    it("returns critical for +25%", () => expect(getDeviationStatus(25)).toBe("critical"));
    it("returns critical for -50%", () => expect(getDeviationStatus(-50)).toBe("critical"));
    it("returns critical for +100%", () => expect(getDeviationStatus(100)).toBe("critical"));
  });
});

// ===========================================================================
// getDeviationColor
// ===========================================================================

describe("getDeviationColor", () => {
  it("returns green-based classes for good status", () => {
    const colors = getDeviationColor("good");

    expect(colors.text).toContain("green");
    expect(colors.bg).toContain("green");
    expect(colors.border).toContain("green");
  });

  it("returns yellow-based classes for warning status", () => {
    const colors = getDeviationColor("warning");

    expect(colors.text).toContain("yellow");
    expect(colors.bg).toContain("yellow");
    expect(colors.border).toContain("yellow");
  });

  it("returns red-based classes for critical status", () => {
    const colors = getDeviationColor("critical");

    expect(colors.text).toContain("red");
    expect(colors.bg).toContain("red");
    expect(colors.border).toContain("red");
  });

  it("includes dark mode variants", () => {
    for (const status of ["good", "warning", "critical"] as const) {
      const colors = getDeviationColor(status);
      expect(colors.text).toContain("dark:");
      expect(colors.bg).toContain("dark:");
    }
  });
});

// ===========================================================================
// calculateNacalculatie
// ===========================================================================

describe("calculateNacalculatie", () => {
  // ---- On-budget project -------------------------------------------------

  describe("on-budget project", () => {
    it("shows good status when actual matches planned", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 56 }),
        urenRegistraties: buildRegistraties({
          grondwerk: 14,
          bestrating: 24,
          borders: 10,
          gras: 8,
        }),
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.geplandeUren).toBe(56);
      expect(result.werkelijkeUren).toBe(56);
      expect(result.afwijkingUren).toBe(0);
      expect(result.afwijkingPercentage).toBe(0);
      expect(result.status).toBe("good");
    });

    it("shows good status for small deviation within 5%", () => {
      // 56 planned, 58 actual = 3.6% deviation
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 56 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 29 },
          { datum: "2025-03-18", medewerker: "Piet", uren: 29 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingPercentage).toBeLessThanOrEqual(5);
      expect(result.status).toBe("good");
    });
  });

  // ---- Over-budget project -----------------------------------------------

  describe("over-budget project", () => {
    it("detects significant overspend (> 15%) as critical", () => {
      // 56 planned, 68 actual = +21.4%
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 56 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 34 },
          { datum: "2025-03-18", medewerker: "Piet", uren: 34 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingUren).toBeCloseTo(12, 2);
      expect(result.afwijkingPercentage).toBeGreaterThan(15);
      expect(result.status).toBe("critical");
    });

    it("detects moderate overspend (5-15%) as warning", () => {
      // 56 planned, 62 actual = +10.7%
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 56 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 31 },
          { datum: "2025-03-18", medewerker: "Piet", uren: 31 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingPercentage).toBeGreaterThan(5);
      expect(result.afwijkingPercentage).toBeLessThanOrEqual(15);
      expect(result.status).toBe("warning");
    });
  });

  // ---- Under-budget project ----------------------------------------------

  describe("under-budget project", () => {
    it("shows good status for small under-budget (-3.6%)", () => {
      // 56 planned, 54 actual = -3.6%
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 56 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 27 },
          { datum: "2025-03-18", medewerker: "Piet", uren: 27 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingUren).toBeLessThan(0);
      expect(result.status).toBe("good");
    });

    it("detects large under-budget as critical (> 15% negative)", () => {
      // 56 planned, 40 actual = -28.6%
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 56 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 20 },
          { datum: "2025-03-18", medewerker: "Piet", uren: 20 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingUren).toBeLessThan(0);
      expect(result.afwijkingPercentage).toBeLessThan(-15);
      expect(result.status).toBe("critical");
    });
  });

  // ---- Deviation percentage calculation ----------------------------------

  describe("deviation percentage calculation", () => {
    it("calculates positive percentage correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [{ datum: "2025-03-17", medewerker: "Jan", uren: 48 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // (48 - 40) / 40 * 100 = 20%
      expect(result.afwijkingPercentage).toBe(20);
    });

    it("calculates negative percentage correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [{ datum: "2025-03-17", medewerker: "Jan", uren: 32 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // (32 - 40) / 40 * 100 = -20%
      expect(result.afwijkingPercentage).toBe(-20);
    });

    it("rounds percentage to 1 decimal place", () => {
      // 40 planned, 43 actual = 7.5%
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [{ datum: "2025-03-17", medewerker: "Jan", uren: 43 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingPercentage).toBe(7.5);
    });

    it("returns 0 when geplande uren is 0 (prevents division by zero)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 0 }),
        urenRegistraties: [{ datum: "2025-03-17", medewerker: "Jan", uren: 10 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingPercentage).toBe(0);
      expect(Number.isFinite(result.afwijkingPercentage)).toBe(true);
    });
  });

  // ---- Days deviation ----------------------------------------------------

  describe("days deviation", () => {
    it("calculates werkelijke dagen from unique dates", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ geschatteDagen: 3 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-17", medewerker: "Piet", uren: 7 },
          { datum: "2025-03-18", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-18", medewerker: "Piet", uren: 7 },
          { datum: "2025-03-19", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-19", medewerker: "Piet", uren: 7 },
          { datum: "2025-03-20", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-20", medewerker: "Piet", uren: 7 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeDagen).toBe(4);
      expect(result.afwijkingDagen).toBe(1);
    });

    it("duplicate dates by different workers count as 1 day", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ geschatteDagen: 1 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-17", medewerker: "Piet", uren: 7 },
          { datum: "2025-03-17", medewerker: "Klaas", uren: 7 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeDagen).toBe(1);
      expect(result.afwijkingDagen).toBe(0);
    });
  });

  // ---- Medewerker count --------------------------------------------------

  describe("medewerker counting", () => {
    it("counts unique medewerkers", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-17", medewerker: "Piet", uren: 7 },
          { datum: "2025-03-18", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-18", medewerker: "Klaas", uren: 7 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.aantalMedewerkers).toBe(3);
    });

    it("returns 0 medewerkers for empty registraties", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.aantalMedewerkers).toBe(0);
    });
  });

  // ---- Scope-level breakdown ---------------------------------------------

  describe("scope-level breakdown", () => {
    it("calculates werkelijke uren per scope", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenPerScope: { grondwerk: 14, bestrating: 24 },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 7, scope: "grondwerk" },
          { datum: "2025-03-17", medewerker: "Piet", uren: 9, scope: "grondwerk" },
          { datum: "2025-03-18", medewerker: "Jan", uren: 12, scope: "bestrating" },
          { datum: "2025-03-18", medewerker: "Piet", uren: 14, scope: "bestrating" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeUrenPerScope.grondwerk).toBe(16);
      expect(result.werkelijkeUrenPerScope.bestrating).toBe(26);
    });

    it("calculates afwijking per scope with correct percentages", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenPerScope: { grondwerk: 10, bestrating: 20 },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 12, scope: "grondwerk" },
          { datum: "2025-03-18", medewerker: "Jan", uren: 16, scope: "bestrating" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const grondwerk = result.afwijkingenPerScope.find((a) => a.scope === "grondwerk");
      expect(grondwerk?.geplandeUren).toBe(10);
      expect(grondwerk?.werkelijkeUren).toBe(12);
      expect(grondwerk?.afwijkingUren).toBe(2);
      expect(grondwerk?.afwijkingPercentage).toBe(20);
      expect(grondwerk?.status).toBe("critical");

      const bestrating = result.afwijkingenPerScope.find((a) => a.scope === "bestrating");
      expect(bestrating?.geplandeUren).toBe(20);
      expect(bestrating?.werkelijkeUren).toBe(16);
      expect(bestrating?.afwijkingUren).toBe(-4);
      expect(bestrating?.afwijkingPercentage).toBe(-20);
      expect(bestrating?.status).toBe("critical");
    });

    it("sorts afwijkingen by absolute deviation percentage (largest first)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenPerScope: {
            grondwerk: 10,
            bestrating: 20,
            borders: 10,
          },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 11, scope: "grondwerk" },   // +10%
          { datum: "2025-03-18", medewerker: "Jan", uren: 26, scope: "bestrating" },  // +30%
          { datum: "2025-03-19", medewerker: "Jan", uren: 8, scope: "borders" },      // -20%
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingenPerScope[0].scope).toBe("bestrating"); // 30%
      expect(result.afwijkingenPerScope[1].scope).toBe("borders");    // 20%
      expect(result.afwijkingenPerScope[2].scope).toBe("grondwerk");  // 10%
    });

    it("populates afwijkingenPerScopeMap with uren differences", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenPerScope: { grondwerk: 10 },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 13, scope: "grondwerk" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingenPerScopeMap.grondwerk).toBe(3);
    });

    it("handles scope with only werkelijke uren (no planned)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenPerScope: { grondwerk: 10 },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 10, scope: "grondwerk" },
          { datum: "2025-03-17", medewerker: "Piet", uren: 5, scope: "extra_werk" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const extra = result.afwijkingenPerScope.find((a) => a.scope === "extra_werk");
      expect(extra?.geplandeUren).toBe(0);
      expect(extra?.werkelijkeUren).toBe(5);
      expect(extra?.afwijkingPercentage).toBe(100); // code returns 100 when planned=0 and actual>0
    });

    it("handles scope with only geplande uren (no actual work)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenPerScope: { grondwerk: 10, borders: 8 },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 10, scope: "grondwerk" },
          // No borders registraties
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const borders = result.afwijkingenPerScope.find((a) => a.scope === "borders");
      expect(borders?.werkelijkeUren).toBe(0);
      expect(borders?.afwijkingUren).toBe(-8);
      expect(borders?.afwijkingPercentage).toBe(-100);
    });

    it("handles scope with both zero geplande and zero werkelijke uren", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenPerScope: { grondwerk: 0 },
        }),
        urenRegistraties: [],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const grondwerk = result.afwijkingenPerScope.find((a) => a.scope === "grondwerk");
      expect(grondwerk?.afwijkingPercentage).toBe(0);
    });
  });

  // ---- Machine costs -----------------------------------------------------

  describe("machine costs", () => {
    it("sums werkelijke machine kosten", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [],
        machineGebruik: [
          { datum: "2025-03-17", uren: 4, kosten: 250 },
          { datum: "2025-03-18", uren: 6, kosten: 375 },
          { datum: "2025-03-19", uren: 2, kosten: 125 },
        ],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeMachineKosten).toBe(750);
    });

    it("sums geplande machine kosten from offerteRegels (only type=machine)", () => {
      const offerteRegels: OfferteRegel[] = [
        { scope: "grondwerk", type: "machine", totaal: 400 },
        { scope: "bestrating", type: "machine", totaal: 200 },
        { scope: "grondwerk", type: "arbeid", totaal: 1000 },
        { scope: "borders", type: "materiaal", totaal: 500 },
      ];

      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [],
        machineGebruik: [{ datum: "2025-03-17", uren: 8, kosten: 700 }],
        offerteRegels,
      };

      const result = calculateNacalculatie(input);

      expect(result.geplandeMachineKosten).toBe(600);
      expect(result.afwijkingMachineKosten).toBeCloseTo(100, 2);
    });

    it("calculates machine costs deviation percentage", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [],
        machineGebruik: [{ datum: "2025-03-17", uren: 8, kosten: 500 }],
        offerteRegels: [{ scope: "grondwerk", type: "machine", totaal: 400 }],
      };

      const result = calculateNacalculatie(input);

      // (500 - 400) / 400 * 100 = 25%
      expect(result.afwijkingMachineKostenPercentage).toBe(25);
    });

    it("returns 0 geplandeMachineKosten when no offerteRegels provided", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [],
        machineGebruik: [{ datum: "2025-03-17", uren: 4, kosten: 300 }],
      };

      const result = calculateNacalculatie(input);

      expect(result.geplandeMachineKosten).toBe(0);
      expect(result.afwijkingMachineKostenPercentage).toBe(0);
    });

    it("returns 0 machine deviation percentage when geplandeMachineKosten is 0", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [],
        machineGebruik: [{ datum: "2025-03-17", uren: 4, kosten: 300 }],
        offerteRegels: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingMachineKostenPercentage).toBe(0);
    });
  });

  // ---- Insights generation -----------------------------------------------

  describe("insights generation", () => {
    it("generates success insight for excellent planning (<= 5% deviation)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 40, geschatteDagen: 3 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 14 },
          { datum: "2025-03-18", medewerker: "Jan", uren: 14 },
          { datum: "2025-03-19", medewerker: "Jan", uren: 13 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const successInsight = result.insights.find(
        (i) => i.type === "success" && i.title.includes("planning")
      );
      expect(successInsight).toBeDefined();
      expect(successInsight!.description).toContain("%");
    });

    it("generates critical insight for significant overspend (> +15%)", () => {
      // 40 planned, 50 actual = +25%
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 40, geschatteDagen: 3 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 25 },
          { datum: "2025-03-18", medewerker: "Piet", uren: 25 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const criticalInsight = result.insights.find(
        (i) => i.type === "critical" && i.title.includes("overschrijding")
      );
      expect(criticalInsight).toBeDefined();
    });

    it("generates warning insight for significantly under budget (< -15%)", () => {
      // 40 planned, 30 actual = -25%
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 40, geschatteDagen: 3 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 15 },
          { datum: "2025-03-18", medewerker: "Piet", uren: 15 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const underBudget = result.insights.find(
        (i) => i.type === "warning" && i.title.includes("budget")
      );
      expect(underBudget).toBeDefined();
    });

    it("generates warning insight for high machine cost deviation (> 20%)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [{ datum: "2025-03-17", medewerker: "Jan", uren: 40 }],
        machineGebruik: [{ datum: "2025-03-17", uren: 8, kosten: 750 }],
        offerteRegels: [{ scope: "grondwerk", type: "machine", totaal: 500 }],
      };

      const result = calculateNacalculatie(input);

      const machineInsight = result.insights.find(
        (i) => i.title.includes("machinekosten")
      );
      expect(machineInsight).toBeDefined();
    });

    it("generates info insight for lower machine costs (< -20%)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [{ datum: "2025-03-17", medewerker: "Jan", uren: 40 }],
        machineGebruik: [{ datum: "2025-03-17", uren: 4, kosten: 300 }],
        offerteRegels: [{ scope: "grondwerk", type: "machine", totaal: 500 }],
      };

      const result = calculateNacalculatie(input);

      const machineInsight = result.insights.find(
        (i) => i.title.includes("Lagere machinekosten")
      );
      expect(machineInsight).toBeDefined();
      expect(machineInsight!.type).toBe("info");
    });

    it("generates warning insight when > 2 extra days needed", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ geschatteDagen: 3, normUrenTotaal: 42 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-18", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-19", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-20", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-21", medewerker: "Jan", uren: 7 },
          { datum: "2025-03-22", medewerker: "Jan", uren: 7 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const daysInsight = result.insights.find((i) => i.title.includes("dagen"));
      expect(daysInsight).toBeDefined();
      expect(daysInsight!.type).toBe("warning");
    });

    it("generates success insight when finished > 2 days early", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ geschatteDagen: 6, normUrenTotaal: 84 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 14 },
          { datum: "2025-03-17", medewerker: "Piet", uren: 14 },
          { datum: "2025-03-18", medewerker: "Jan", uren: 14 },
          { datum: "2025-03-18", medewerker: "Piet", uren: 14 },
          { datum: "2025-03-19", medewerker: "Jan", uren: 14 },
          { datum: "2025-03-19", medewerker: "Piet", uren: 14 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // 3 werkelijke dagen vs 6 geplande = -3 afwijking
      const earlyInsight = result.insights.find(
        (i) => i.type === "success" && i.title.includes("Sneller")
      );
      expect(earlyInsight).toBeDefined();
    });

    it("generates insights for problematic (critical) scopes", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenTotaal: 30,
          normUrenPerScope: { grondwerk: 10, bestrating: 20 },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 16, scope: "grondwerk" }, // +60%
          { datum: "2025-03-18", medewerker: "Jan", uren: 20, scope: "bestrating" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const scopeInsight = result.insights.find(
        (i) => i.title.includes("scope") || i.title.includes("Aandachtspunten")
      );
      expect(scopeInsight).toBeDefined();
    });

    it("generates underestimation insights for scopes over 15%", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenTotaal: 30,
          normUrenPerScope: { grondwerk: 10, bestrating: 20 },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 14, scope: "grondwerk" }, // +40%
          { datum: "2025-03-18", medewerker: "Jan", uren: 24, scope: "bestrating" }, // +20%
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const underestimationInsights = result.insights.filter(
        (i) => i.title.includes("Onderschatting")
      );
      expect(underestimationInsights.length).toBeGreaterThan(0);
    });

    it("generates overestimation insights for scopes under -15%", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenTotaal: 50,
          normUrenPerScope: { grondwerk: 20, bestrating: 30 },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 12, scope: "grondwerk" },  // -40%
          { datum: "2025-03-18", medewerker: "Jan", uren: 20, scope: "bestrating" },  // -33.3%
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const overestimationInsights = result.insights.filter(
        (i) => i.title.includes("Overschatting")
      );
      expect(overestimationInsights.length).toBeGreaterThan(0);
    });

    it("limits underestimation/overestimation insights to max 2 each", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenTotaal: 50,
          normUrenPerScope: {
            grondwerk: 10,
            bestrating: 10,
            borders: 10,
            gras: 10,
            houtwerk: 10,
          },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 15, scope: "grondwerk" },   // +50%
          { datum: "2025-03-17", medewerker: "Jan", uren: 14, scope: "bestrating" },  // +40%
          { datum: "2025-03-17", medewerker: "Jan", uren: 13, scope: "borders" },     // +30%
          { datum: "2025-03-17", medewerker: "Jan", uren: 3, scope: "gras" },         // -70%
          { datum: "2025-03-17", medewerker: "Jan", uren: 2, scope: "houtwerk" },     // -80%
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const onderschattingen = result.insights.filter((i) => i.title.includes("Onderschatting"));
      const overschattingen = result.insights.filter((i) => i.title.includes("Overschatting"));

      expect(onderschattingen.length).toBeLessThanOrEqual(2);
      expect(overschattingen.length).toBeLessThanOrEqual(2);
    });

    it("does not generate under-budget or over-budget insight in the 5-15% zone", () => {
      // 40 planned, 44 actual = +10% (warning zone, but not the specific insights)
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 40, geschatteDagen: 3 }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 22 },
          { datum: "2025-03-18", medewerker: "Jan", uren: 22 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const significantOverspend = result.insights.find(
        (i) => i.type === "critical" && i.title.includes("overschrijding")
      );
      const underBudget = result.insights.find(
        (i) => i.type === "warning" && i.title.includes("budget")
      );
      const excellentPlanning = result.insights.find(
        (i) => i.type === "success" && i.title.includes("planning")
      );

      expect(significantOverspend).toBeUndefined();
      expect(underBudget).toBeUndefined();
      expect(excellentPlanning).toBeUndefined();
    });
  });

  // ---- Edge cases --------------------------------------------------------

  describe("edge cases", () => {
    it("handles empty urenRegistraties", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeUren).toBe(0);
      expect(result.werkelijkeDagen).toBe(0);
      expect(result.aantalMedewerkers).toBe(0);
      expect(result.aantalRegistraties).toBe(0);
    });

    it("handles empty machineGebruik", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [{ datum: "2025-03-17", medewerker: "Jan", uren: 14 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeMachineKosten).toBe(0);
    });

    it("handles registraties without scope field", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenPerScope: { grondwerk: 10 },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 7 },          // no scope
          { datum: "2025-03-17", medewerker: "Piet", uren: 5, scope: "grondwerk" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // Total includes all hours
      expect(result.werkelijkeUren).toBe(12);
      // Per-scope only includes scoped hours
      expect(result.werkelijkeUrenPerScope.grondwerk).toBe(5);
      expect(Object.keys(result.werkelijkeUrenPerScope)).toHaveLength(1);
    });

    it("handles very large values without overflow", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({ normUrenTotaal: 10000 }),
        urenRegistraties: [{ datum: "2025-03-17", medewerker: "Jan", uren: 15000 }],
        machineGebruik: [{ datum: "2025-03-17", uren: 200, kosten: 100000 }],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeUren).toBe(15000);
      expect(result.afwijkingUren).toBe(5000);
      expect(result.afwijkingPercentage).toBe(50);
      expect(Number.isFinite(result.afwijkingPercentage)).toBe(true);
    });

    it("counts aantalRegistraties correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 7, scope: "grondwerk" },
          { datum: "2025-03-17", medewerker: "Piet", uren: 7, scope: "grondwerk" },
          { datum: "2025-03-18", medewerker: "Jan", uren: 7, scope: "bestrating" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.aantalRegistraties).toBe(3);
    });

    it("handles single scope project", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie({
          normUrenTotaal: 20,
          normUrenPerScope: { bestrating: 20 },
        }),
        urenRegistraties: [
          { datum: "2025-03-17", medewerker: "Jan", uren: 22, scope: "bestrating" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingenPerScope).toHaveLength(1);
      expect(result.afwijkingenPerScope[0].scope).toBe("bestrating");
    });

    it("returns all expected result properties", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createVoorcalculatie(),
        urenRegistraties: [{ datum: "2025-03-17", medewerker: "Jan", uren: 28 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // Totals
      expect(result).toHaveProperty("geplandeUren");
      expect(result).toHaveProperty("werkelijkeUren");
      expect(result).toHaveProperty("geplandeDagen");
      expect(result).toHaveProperty("werkelijkeDagen");
      expect(result).toHaveProperty("geplandeMachineKosten");
      expect(result).toHaveProperty("werkelijkeMachineKosten");
      // Deviations
      expect(result).toHaveProperty("afwijkingUren");
      expect(result).toHaveProperty("afwijkingPercentage");
      expect(result).toHaveProperty("afwijkingDagen");
      expect(result).toHaveProperty("afwijkingMachineKosten");
      expect(result).toHaveProperty("afwijkingMachineKostenPercentage");
      // Status
      expect(result).toHaveProperty("status");
      // Per scope
      expect(result).toHaveProperty("afwijkingenPerScope");
      expect(result).toHaveProperty("werkelijkeUrenPerScope");
      expect(result).toHaveProperty("afwijkingenPerScopeMap");
      // Insights
      expect(result).toHaveProperty("insights");
      // Metadata
      expect(result).toHaveProperty("aantalRegistraties");
      expect(result).toHaveProperty("aantalMedewerkers");
    });
  });
});

// ===========================================================================
// Formatting functions
// ===========================================================================

describe("formatHoursAsDays", () => {
  it("formats hours only when less than 1 day", () => {
    expect(formatHoursAsDays(4)).toBe("4 uur");
    expect(formatHoursAsDays(7.5)).toBe("7.5 uur");
  });

  it("formats exact days (no remainder)", () => {
    expect(formatHoursAsDays(8)).toBe("1 dag");
    expect(formatHoursAsDays(16)).toBe("2 dagen");
    expect(formatHoursAsDays(24)).toBe("3 dagen");
  });

  it("formats days + hours combination", () => {
    expect(formatHoursAsDays(10)).toBe("1 dag, 2 uur");
    expect(formatHoursAsDays(20)).toBe("2 dagen, 4 uur");
  });

  it("uses singular 'dag' for 1 day", () => {
    expect(formatHoursAsDays(8)).toBe("1 dag");
    expect(formatHoursAsDays(9)).toBe("1 dag, 1 uur");
  });

  it("uses plural 'dagen' for > 1 day", () => {
    expect(formatHoursAsDays(16)).toBe("2 dagen");
    expect(formatHoursAsDays(18)).toBe("2 dagen, 2 uur");
  });

  it("supports custom hoursPerDay", () => {
    expect(formatHoursAsDays(14, 7)).toBe("2 dagen");
    expect(formatHoursAsDays(10, 7)).toBe("1 dag, 3 uur");
  });

  it("handles 0 hours", () => {
    expect(formatHoursAsDays(0)).toBe("0 uur");
  });
});

describe("formatDeviation", () => {
  it("adds + sign for positive deviations", () => {
    expect(formatDeviation(10)).toBe("+10%");
    expect(formatDeviation(0.5)).toBe("+0.5%");
  });

  it("keeps - sign for negative deviations", () => {
    expect(formatDeviation(-10)).toBe("-10%");
    expect(formatDeviation(-0.5)).toBe("-0.5%");
  });

  it("formats zero without sign", () => {
    expect(formatDeviation(0)).toBe("0%");
  });
});

describe("getScopeDisplayName", () => {
  it("capitalizes simple scope names", () => {
    expect(getScopeDisplayName("grondwerk")).toBe("Grondwerk");
    expect(getScopeDisplayName("bestrating")).toBe("Bestrating");
  });

  it("splits underscores into slashes", () => {
    expect(getScopeDisplayName("water_elektra")).toBe("Water/Elektra");
    expect(getScopeDisplayName("gras_onderhoud")).toBe("Gras/Onderhoud");
    expect(getScopeDisplayName("borders_onderhoud")).toBe("Borders/Onderhoud");
  });

  it("handles empty string", () => {
    expect(getScopeDisplayName("")).toBe("");
  });

  it("handles single character", () => {
    expect(getScopeDisplayName("a")).toBe("A");
  });
});

// ===========================================================================
// Integration: full realistic project
// ===========================================================================

describe("integration: realistic tuinaanleg nacalculatie", () => {
  it("calculates a complete on-target 4-day project in Almere", () => {
    const voorcalculatie: VoorcalculatieData = {
      normUrenTotaal: 56,
      geschatteDagen: 4,
      normUrenPerScope: {
        grondwerk: 14,
        bestrating: 24,
        borders: 10,
        gras: 8,
      },
      teamGrootte: 2,
      effectieveUrenPerDag: 7,
    };

    const urenRegistraties: UrenRegistratie[] = [
      // Day 1: grondwerk
      { datum: "2025-03-17", medewerker: "Jan van der Berg", uren: 7, scope: "grondwerk" },
      { datum: "2025-03-17", medewerker: "Piet Bakker", uren: 7, scope: "grondwerk" },
      // Day 2: bestrating
      { datum: "2025-03-18", medewerker: "Jan van der Berg", uren: 7, scope: "bestrating" },
      { datum: "2025-03-18", medewerker: "Piet Bakker", uren: 7, scope: "bestrating" },
      // Day 3: bestrating + borders
      { datum: "2025-03-19", medewerker: "Jan van der Berg", uren: 5, scope: "bestrating" },
      { datum: "2025-03-19", medewerker: "Piet Bakker", uren: 5, scope: "bestrating" },
      { datum: "2025-03-19", medewerker: "Jan van der Berg", uren: 2, scope: "borders" },
      { datum: "2025-03-19", medewerker: "Piet Bakker", uren: 2, scope: "borders" },
      // Day 4: borders + gras
      { datum: "2025-03-20", medewerker: "Jan van der Berg", uren: 3, scope: "borders" },
      { datum: "2025-03-20", medewerker: "Piet Bakker", uren: 3, scope: "borders" },
      { datum: "2025-03-20", medewerker: "Jan van der Berg", uren: 4, scope: "gras" },
      { datum: "2025-03-20", medewerker: "Piet Bakker", uren: 4, scope: "gras" },
    ];

    const machineGebruik: MachineGebruik[] = [
      { datum: "2025-03-17", uren: 4, kosten: 220 },
    ];

    const offerteRegels: OfferteRegel[] = [
      { scope: "grondwerk", type: "machine", totaal: 200 },
    ];

    const result = calculateNacalculatie({
      voorcalculatie,
      urenRegistraties,
      machineGebruik,
      offerteRegels,
    });

    // Totals
    expect(result.geplandeUren).toBe(56);
    expect(result.werkelijkeUren).toBe(56);
    expect(result.geplandeDagen).toBe(4);
    expect(result.werkelijkeDagen).toBe(4);
    expect(result.aantalMedewerkers).toBe(2);
    expect(result.aantalRegistraties).toBe(12);

    // On target
    expect(result.afwijkingUren).toBe(0);
    expect(result.afwijkingPercentage).toBe(0);
    expect(result.afwijkingDagen).toBe(0);
    expect(result.status).toBe("good");

    // Machine costs
    expect(result.geplandeMachineKosten).toBe(200);
    expect(result.werkelijkeMachineKosten).toBe(220);
    expect(result.afwijkingMachineKosten).toBeCloseTo(20, 2);

    // Per scope: grondwerk on target, bestrating on target, borders on target, gras on target
    expect(result.werkelijkeUrenPerScope.grondwerk).toBe(14);
    expect(result.werkelijkeUrenPerScope.bestrating).toBe(24);
    expect(result.werkelijkeUrenPerScope.borders).toBe(10);
    expect(result.werkelijkeUrenPerScope.gras).toBe(8);

    // Insights
    expect(result.insights.length).toBeGreaterThan(0);
    const planningInsight = result.insights.find((i) => i.title.includes("planning"));
    expect(planningInsight?.type).toBe("success");
  });

  it("calculates an over-budget project with scope deviations", () => {
    const voorcalculatie: VoorcalculatieData = {
      normUrenTotaal: 40,
      geschatteDagen: 3,
      normUrenPerScope: {
        grondwerk: 12,
        bestrating: 18,
        borders: 10,
      },
      teamGrootte: 2,
      effectieveUrenPerDag: 7,
    };

    const result = calculateNacalculatie({
      voorcalculatie,
      urenRegistraties: [
        // Grondwerk took much longer (clay soil)
        { datum: "2025-03-17", medewerker: "Jan", uren: 8, scope: "grondwerk" },
        { datum: "2025-03-17", medewerker: "Piet", uren: 8, scope: "grondwerk" },
        { datum: "2025-03-18", medewerker: "Jan", uren: 4, scope: "grondwerk" },
        // Bestrating on schedule
        { datum: "2025-03-18", medewerker: "Piet", uren: 7, scope: "bestrating" },
        { datum: "2025-03-19", medewerker: "Jan", uren: 7, scope: "bestrating" },
        { datum: "2025-03-19", medewerker: "Piet", uren: 5, scope: "bestrating" },
        // Borders on schedule
        { datum: "2025-03-20", medewerker: "Jan", uren: 5, scope: "borders" },
        { datum: "2025-03-20", medewerker: "Piet", uren: 5, scope: "borders" },
      ],
      machineGebruik: [],
    });

    // Over budget
    expect(result.werkelijkeUren).toBe(49);
    expect(result.afwijkingUren).toBeCloseTo(9, 2);
    expect(result.afwijkingPercentage).toBeGreaterThan(15);
    expect(result.status).toBe("critical");

    // Grondwerk is the problem scope
    expect(result.werkelijkeUrenPerScope.grondwerk).toBe(20);
    const grondwerk = result.afwijkingenPerScope.find((a) => a.scope === "grondwerk");
    expect(grondwerk?.afwijkingPercentage).toBeGreaterThan(50);
    expect(grondwerk?.status).toBe("critical");
  });
});
