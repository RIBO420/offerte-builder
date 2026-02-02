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

// Mock data factories
function createMockVoorcalculatie(overrides: Partial<VoorcalculatieData> = {}): VoorcalculatieData {
  return {
    normUrenTotaal: 40,
    geschatteDagen: 3,
    normUrenPerScope: {
      grondwerk: 10,
      bestrating: 15,
      borders: 10,
      gras: 5,
    },
    teamGrootte: 2,
    effectieveUrenPerDag: 7,
    ...overrides,
  };
}

function createMockUrenRegistraties(
  total: number,
  scopes: Record<string, number>
): UrenRegistratie[] {
  const registraties: UrenRegistratie[] = [];
  let medewerkerIndex = 0;
  const medewerkers = ["Jan", "Piet", "Klaas"];
  const dates = ["2024-01-15", "2024-01-16", "2024-01-17"];

  for (const [scope, uren] of Object.entries(scopes)) {
    registraties.push({
      datum: dates[registraties.length % dates.length],
      medewerker: medewerkers[medewerkerIndex % medewerkers.length],
      uren,
      scope,
      notities: `Werk aan ${scope}`,
    });
    medewerkerIndex++;
  }

  return registraties;
}

describe("Nacalculatie Calculator - getDeviationStatus", () => {
  it("returns 'good' for deviations <= 5%", () => {
    expect(getDeviationStatus(0)).toBe("good");
    expect(getDeviationStatus(2.5)).toBe("good");
    expect(getDeviationStatus(5)).toBe("good");
    expect(getDeviationStatus(-3)).toBe("good");
    expect(getDeviationStatus(-5)).toBe("good");
  });

  it("returns 'warning' for deviations between 5% and 15%", () => {
    expect(getDeviationStatus(6)).toBe("warning");
    expect(getDeviationStatus(10)).toBe("warning");
    expect(getDeviationStatus(15)).toBe("warning");
    expect(getDeviationStatus(-8)).toBe("warning");
    expect(getDeviationStatus(-15)).toBe("warning");
  });

  it("returns 'critical' for deviations > 15%", () => {
    expect(getDeviationStatus(16)).toBe("critical");
    expect(getDeviationStatus(25)).toBe("critical");
    expect(getDeviationStatus(50)).toBe("critical");
    expect(getDeviationStatus(-20)).toBe("critical");
    expect(getDeviationStatus(-100)).toBe("critical");
  });
});

describe("Nacalculatie Calculator - getDeviationColor", () => {
  it("returns green colors for 'good' status", () => {
    const colors = getDeviationColor("good");

    expect(colors.text).toContain("green");
    expect(colors.bg).toContain("green");
    expect(colors.border).toContain("green");
  });

  it("returns yellow colors for 'warning' status", () => {
    const colors = getDeviationColor("warning");

    expect(colors.text).toContain("yellow");
    expect(colors.bg).toContain("yellow");
    expect(colors.border).toContain("yellow");
  });

  it("returns red colors for 'critical' status", () => {
    const colors = getDeviationColor("critical");

    expect(colors.text).toContain("red");
    expect(colors.bg).toContain("red");
    expect(colors.border).toContain("red");
  });
});

describe("Nacalculatie Calculator - calculateNacalculatie", () => {
  describe("Basic calculations", () => {
    it("calculates werkelijke uren totaal correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 8 },
          { datum: "2024-01-15", medewerker: "Piet", uren: 8 },
          { datum: "2024-01-16", medewerker: "Jan", uren: 8 },
          { datum: "2024-01-16", medewerker: "Piet", uren: 8 },
          { datum: "2024-01-17", medewerker: "Jan", uren: 6 },
          { datum: "2024-01-17", medewerker: "Piet", uren: 4 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeUren).toBe(42);
    });

    it("calculates werkelijke dagen correctly (unique dates)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie(),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 8 },
          { datum: "2024-01-15", medewerker: "Piet", uren: 8 },
          { datum: "2024-01-16", medewerker: "Jan", uren: 8 },
          { datum: "2024-01-17", medewerker: "Jan", uren: 8 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeDagen).toBe(3);
    });

    it("counts unique medewerkers correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie(),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 8 },
          { datum: "2024-01-15", medewerker: "Piet", uren: 8 },
          { datum: "2024-01-16", medewerker: "Jan", uren: 8 },
          { datum: "2024-01-16", medewerker: "Klaas", uren: 8 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.aantalMedewerkers).toBe(3);
    });
  });

  describe("Deviation calculations", () => {
    it("calculates positive deviation (over budget) correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 24 },
          { datum: "2024-01-16", medewerker: "Jan", uren: 24 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // 48 - 40 = 8 uur over
      expect(result.afwijkingUren).toBe(8);
      // 8 / 40 * 100 = 20%
      expect(result.afwijkingPercentage).toBe(20);
      expect(result.status).toBe("critical");
    });

    it("calculates negative deviation (under budget) correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 16 },
          { datum: "2024-01-16", medewerker: "Jan", uren: 16 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // 32 - 40 = -8 uur under
      expect(result.afwijkingUren).toBe(-8);
      // -8 / 40 * 100 = -20%
      expect(result.afwijkingPercentage).toBe(-20);
    });

    it("calculates dagen deviation correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({ geschatteDagen: 3 }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 8 },
          { datum: "2024-01-16", medewerker: "Jan", uren: 8 },
          { datum: "2024-01-17", medewerker: "Jan", uren: 8 },
          { datum: "2024-01-18", medewerker: "Jan", uren: 8 },
          { datum: "2024-01-19", medewerker: "Jan", uren: 8 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // 5 dagen - 3 dagen = 2 dagen over
      expect(result.afwijkingDagen).toBe(2);
    });
  });

  describe("Per-scope calculations", () => {
    it("calculates werkelijke uren per scope correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({
          normUrenPerScope: { grondwerk: 10, bestrating: 15 },
        }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 8, scope: "grondwerk" },
          { datum: "2024-01-15", medewerker: "Piet", uren: 4, scope: "grondwerk" },
          { datum: "2024-01-16", medewerker: "Jan", uren: 10, scope: "bestrating" },
          { datum: "2024-01-16", medewerker: "Piet", uren: 8, scope: "bestrating" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeUrenPerScope.grondwerk).toBe(12);
      expect(result.werkelijkeUrenPerScope.bestrating).toBe(18);
    });

    it("calculates afwijkingen per scope correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({
          normUrenPerScope: { grondwerk: 10, bestrating: 15 },
        }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 12, scope: "grondwerk" },
          { datum: "2024-01-16", medewerker: "Jan", uren: 12, scope: "bestrating" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // Grondwerk: 12 - 10 = +2 uren (+20%)
      const grondwerkAfwijking = result.afwijkingenPerScope.find(a => a.scope === "grondwerk");
      expect(grondwerkAfwijking?.afwijkingUren).toBe(2);
      expect(grondwerkAfwijking?.afwijkingPercentage).toBe(20);

      // Bestrating: 12 - 15 = -3 uren (-20%)
      const bestratingAfwijking = result.afwijkingenPerScope.find(a => a.scope === "bestrating");
      expect(bestratingAfwijking?.afwijkingUren).toBe(-3);
      expect(bestratingAfwijking?.afwijkingPercentage).toBe(-20);
    });

    it("sorts afwijkingen by absolute deviation (largest first)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({
          normUrenPerScope: {
            grondwerk: 10, // 20% afwijking
            bestrating: 15, // 33% afwijking
            borders: 8, // 25% afwijking
          },
        }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 12, scope: "grondwerk" },
          { datum: "2024-01-15", medewerker: "Jan", uren: 20, scope: "bestrating" },
          { datum: "2024-01-15", medewerker: "Jan", uren: 10, scope: "borders" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // Should be sorted by absolute percentage: bestrating (33%), borders (25%), grondwerk (20%)
      expect(result.afwijkingenPerScope[0].scope).toBe("bestrating");
    });

    it("handles scopes with no geplande uren (werkelijk only)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({
          normUrenPerScope: { grondwerk: 10 },
        }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 8, scope: "grondwerk" },
          { datum: "2024-01-15", medewerker: "Jan", uren: 4, scope: "extra_werk" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // extra_werk has 100% deviation (no planned hours)
      const extraWerkAfwijking = result.afwijkingenPerScope.find(a => a.scope === "extra_werk");
      expect(extraWerkAfwijking?.geplandeUren).toBe(0);
      expect(extraWerkAfwijking?.werkelijkeUren).toBe(4);
      expect(extraWerkAfwijking?.afwijkingPercentage).toBe(100);
    });

    it("handles scopes with no werkelijke uren (geplande only)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({
          normUrenPerScope: { grondwerk: 10, bestrating: 15 },
        }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 10, scope: "grondwerk" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // bestrating has -100% deviation (no actual hours)
      const bestratingAfwijking = result.afwijkingenPerScope.find(a => a.scope === "bestrating");
      expect(bestratingAfwijking?.werkelijkeUren).toBe(0);
      expect(bestratingAfwijking?.afwijkingUren).toBe(-15);
    });
  });

  describe("Machine costs calculations", () => {
    it("calculates werkelijke machine kosten correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie(),
        urenRegistraties: [],
        machineGebruik: [
          { datum: "2024-01-15", uren: 4, kosten: 200 },
          { datum: "2024-01-16", uren: 6, kosten: 300 },
        ],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeMachineKosten).toBe(500);
    });

    it("calculates geplande machine kosten from offerte regels", () => {
      const offerteRegels: OfferteRegel[] = [
        { scope: "grondwerk", type: "machine", totaal: 350 },
        { scope: "bestrating", type: "machine", totaal: 150 },
        { scope: "grondwerk", type: "arbeid", totaal: 500 },
      ];

      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie(),
        urenRegistraties: [],
        machineGebruik: [{ datum: "2024-01-15", uren: 8, kosten: 600 }],
        offerteRegels,
      };

      const result = calculateNacalculatie(input);

      expect(result.geplandeMachineKosten).toBe(500);
      expect(result.afwijkingMachineKosten).toBe(100);
    });

    it("calculates machine costs deviation percentage correctly", () => {
      const offerteRegels: OfferteRegel[] = [
        { scope: "grondwerk", type: "machine", totaal: 400 },
      ];

      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie(),
        urenRegistraties: [],
        machineGebruik: [{ datum: "2024-01-15", uren: 8, kosten: 500 }],
        offerteRegels,
      };

      const result = calculateNacalculatie(input);

      // 500 - 400 = 100, 100/400 * 100 = 25%
      expect(result.afwijkingMachineKostenPercentage).toBe(25);
    });
  });

  describe("Insights generation", () => {
    it("generates success insight for excellent planning (< 5% deviation)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [{ datum: "2024-01-15", medewerker: "Jan", uren: 41 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const successInsight = result.insights.find(i => i.type === "success" && i.title.includes("planning"));
      expect(successInsight).toBeDefined();
    });

    it("generates critical insight for significant overspend (> 15%)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [{ datum: "2024-01-15", medewerker: "Jan", uren: 50 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const criticalInsight = result.insights.find(i => i.type === "critical" && i.title.includes("overschrijding"));
      expect(criticalInsight).toBeDefined();
    });

    it("generates warning insight for under budget (< -15%)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({ normUrenTotaal: 40 }),
        urenRegistraties: [{ datum: "2024-01-15", medewerker: "Jan", uren: 30 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const underBudgetInsight = result.insights.find(i => i.type === "warning" && i.title.includes("budget"));
      expect(underBudgetInsight).toBeDefined();
    });

    it("generates insight for extra days needed (> 2 days over)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({ geschatteDagen: 2, normUrenTotaal: 28 }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 6 },
          { datum: "2024-01-16", medewerker: "Jan", uren: 6 },
          { datum: "2024-01-17", medewerker: "Jan", uren: 6 },
          { datum: "2024-01-18", medewerker: "Jan", uren: 6 },
          { datum: "2024-01-19", medewerker: "Jan", uren: 6 },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      const daysInsight = result.insights.find(i => i.title.includes("dagen"));
      expect(daysInsight).toBeDefined();
    });

    it("generates insights for problematic scopes", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({
          normUrenTotaal: 30,
          normUrenPerScope: { grondwerk: 10, bestrating: 20 },
        }),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 15, scope: "grondwerk" }, // +50%
          { datum: "2024-01-15", medewerker: "Jan", uren: 20, scope: "bestrating" }, // 0%
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // Should have critical scope insight
      const scopeInsight = result.insights.find(i => i.title.includes("scope") || i.scope === "grondwerk");
      expect(scopeInsight).toBeDefined();
    });
  });

  describe("Edge cases", () => {
    it("handles empty urenRegistraties", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie(),
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
        voorcalculatie: createMockVoorcalculatie(),
        urenRegistraties: [{ datum: "2024-01-15", medewerker: "Jan", uren: 8 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeMachineKosten).toBe(0);
    });

    it("handles zero geplande uren (prevents division by zero)", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({ normUrenTotaal: 0 }),
        urenRegistraties: [{ datum: "2024-01-15", medewerker: "Jan", uren: 8 }],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      expect(result.afwijkingPercentage).toBe(0);
      expect(Number.isFinite(result.afwijkingPercentage)).toBe(true);
    });

    it("handles registraties without scope", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie(),
        urenRegistraties: [
          { datum: "2024-01-15", medewerker: "Jan", uren: 8 }, // no scope
          { datum: "2024-01-15", medewerker: "Jan", uren: 4, scope: "grondwerk" },
        ],
        machineGebruik: [],
      };

      const result = calculateNacalculatie(input);

      // Total should include all hours
      expect(result.werkelijkeUren).toBe(12);
      // Per-scope should only include scoped hours
      expect(result.werkelijkeUrenPerScope.grondwerk).toBe(4);
    });

    it("handles very large values correctly", () => {
      const input: NacalculatieInput = {
        voorcalculatie: createMockVoorcalculatie({ normUrenTotaal: 10000 }),
        urenRegistraties: [{ datum: "2024-01-15", medewerker: "Jan", uren: 12000 }],
        machineGebruik: [{ datum: "2024-01-15", uren: 100, kosten: 50000 }],
      };

      const result = calculateNacalculatie(input);

      expect(result.werkelijkeUren).toBe(12000);
      expect(result.afwijkingUren).toBe(2000);
      expect(result.werkelijkeMachineKosten).toBe(50000);
    });
  });
});

describe("Nacalculatie Calculator - Formatting functions", () => {
  describe("formatHoursAsDays", () => {
    it("formats hours only when less than 1 day", () => {
      expect(formatHoursAsDays(4)).toBe("4 uur");
      expect(formatHoursAsDays(7.5)).toBe("7.5 uur");
    });

    it("formats days only when exact multiple of hours per day", () => {
      expect(formatHoursAsDays(8)).toBe("1 dag");
      expect(formatHoursAsDays(16)).toBe("2 dagen");
      expect(formatHoursAsDays(24)).toBe("3 dagen");
    });

    it("formats days and hours combination", () => {
      expect(formatHoursAsDays(10)).toBe("1 dag, 2 uur");
      expect(formatHoursAsDays(20)).toBe("2 dagen, 4 uur");
    });

    it("handles custom hours per day", () => {
      expect(formatHoursAsDays(14, 7)).toBe("2 dagen");
      expect(formatHoursAsDays(10, 7)).toBe("1 dag, 3 uur");
    });

    it("uses singular 'dag' for 1 day", () => {
      expect(formatHoursAsDays(8)).toBe("1 dag");
      expect(formatHoursAsDays(9)).toBe("1 dag, 1 uur");
    });

    it("uses plural 'dagen' for multiple days", () => {
      expect(formatHoursAsDays(16)).toBe("2 dagen");
      expect(formatHoursAsDays(18)).toBe("2 dagen, 2 uur");
    });
  });

  describe("formatDeviation", () => {
    it("formats positive deviations with plus sign", () => {
      expect(formatDeviation(10)).toBe("+10%");
      expect(formatDeviation(25.5)).toBe("+25.5%");
    });

    it("formats negative deviations without plus sign", () => {
      expect(formatDeviation(-10)).toBe("-10%");
      expect(formatDeviation(-15.5)).toBe("-15.5%");
    });

    it("formats zero without sign", () => {
      expect(formatDeviation(0)).toBe("0%");
    });
  });

  describe("getScopeDisplayName", () => {
    it("capitalizes simple scope names", () => {
      expect(getScopeDisplayName("grondwerk")).toBe("Grondwerk");
      expect(getScopeDisplayName("bestrating")).toBe("Bestrating");
      expect(getScopeDisplayName("borders")).toBe("Borders");
    });

    it("handles underscore-separated scopes", () => {
      expect(getScopeDisplayName("water_elektra")).toBe("Water/Elektra");
      expect(getScopeDisplayName("gras_onderhoud")).toBe("Gras/Onderhoud");
    });

    it("handles empty string", () => {
      expect(getScopeDisplayName("")).toBe("");
    });
  });
});

describe("Nacalculatie Calculator - Integration", () => {
  it("calculates complete nacalculatie correctly", () => {
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
      // Day 1
      { datum: "2024-01-15", medewerker: "Jan", uren: 7, scope: "grondwerk" },
      { datum: "2024-01-15", medewerker: "Piet", uren: 7, scope: "grondwerk" },
      // Day 2
      { datum: "2024-01-16", medewerker: "Jan", uren: 7, scope: "bestrating" },
      { datum: "2024-01-16", medewerker: "Piet", uren: 7, scope: "bestrating" },
      // Day 3
      { datum: "2024-01-17", medewerker: "Jan", uren: 7, scope: "bestrating" },
      { datum: "2024-01-17", medewerker: "Piet", uren: 7, scope: "bestrating" },
      // Day 4
      { datum: "2024-01-18", medewerker: "Jan", uren: 5, scope: "borders" },
      { datum: "2024-01-18", medewerker: "Piet", uren: 5, scope: "borders" },
      { datum: "2024-01-18", medewerker: "Klaas", uren: 4, scope: "gras" },
    ];

    const machineGebruik: MachineGebruik[] = [
      { datum: "2024-01-15", uren: 4, kosten: 200 },
    ];

    const offerteRegels: OfferteRegel[] = [
      { scope: "grondwerk", type: "machine", totaal: 180 },
    ];

    const result = calculateNacalculatie({
      voorcalculatie,
      urenRegistraties,
      machineGebruik,
      offerteRegels,
    });

    // Verify totals
    expect(result.geplandeUren).toBe(56);
    expect(result.werkelijkeUren).toBe(56);
    expect(result.geplandeDagen).toBe(4);
    expect(result.werkelijkeDagen).toBe(4);
    expect(result.aantalMedewerkers).toBe(3);
    expect(result.aantalRegistraties).toBe(9);

    // Verify deviations
    expect(result.afwijkingUren).toBe(0);
    expect(result.afwijkingPercentage).toBe(0);
    expect(result.status).toBe("good");

    // Verify machine costs
    expect(result.geplandeMachineKosten).toBe(180);
    expect(result.werkelijkeMachineKosten).toBe(200);
    expect(result.afwijkingMachineKosten).toBeCloseTo(20, 2);

    // Verify per-scope
    expect(result.werkelijkeUrenPerScope.grondwerk).toBe(14);
    expect(result.werkelijkeUrenPerScope.bestrating).toBe(28);
    expect(result.werkelijkeUrenPerScope.borders).toBe(10);
    expect(result.werkelijkeUrenPerScope.gras).toBe(4);

    // Verify insights are generated
    expect(result.insights.length).toBeGreaterThan(0);
  });
});
