import { describe, it, expect } from "vitest";
import {
  analyzeNacalculaties,
  getConfidenceColor,
  getConfidenceBadgeVariant,
  formatScopeName,
  calculateSuggestionImpact,
  validateSuggestion,
  getSuggestionPriority,
  getSuggestionTypeColor,
} from "@/lib/leerfeedback-analyzer";
import type {
  NacalculatieDataPoint,
  Normuur,
  ScopeSuggestie,
} from "@/lib/leerfeedback-analyzer";

// ============================================================
// Helper factories
// ============================================================
function makeNacalculatie(
  overrides: Partial<NacalculatieDataPoint> = {}
): NacalculatieDataPoint {
  return {
    projectId: "proj_1",
    projectNaam: "Project 1",
    afwijkingenPerScope: { grondwerk: 5 },
    geplandeUrenPerScope: { grondwerk: 20 },
    ...overrides,
  };
}

function makeNormuur(overrides: Partial<Normuur> = {}): Normuur {
  return {
    _id: "norm_1",
    activiteit: "graven",
    scope: "grondwerk",
    normuurPerEenheid: 0.5,
    eenheid: "m²",
    ...overrides,
  };
}

function makeSuggestie(
  overrides: Partial<ScopeSuggestie> = {}
): ScopeSuggestie {
  return {
    id: "suggestie_grondwerk",
    scope: "grondwerk",
    activiteiten: [
      {
        normuurId: "norm_1",
        activiteit: "graven",
        huidigeWaarde: 0.5,
        gesuggereerdeWaarde: 0.6,
        wijzigingPercentage: 20,
        eenheid: "m²",
      },
    ],
    gemiddeldeAfwijking: 5,
    gemiddeldeAfwijkingPercentage: 25,
    aantalProjecten: 5,
    betrouwbaarheid: "gemiddeld",
    bronProjecten: ["p1", "p2", "p3", "p4", "p5"],
    reden: "Gemiddelde onderschatting van 25% over 5 projecten",
    type: "onderschatting",
    ...overrides,
  };
}

// ============================================================
// analyzeNacalculaties — core analysis
// ============================================================
describe("analyzeNacalculaties", () => {
  it("returns empty result for no input data", () => {
    const result = analyzeNacalculaties([], []);
    expect(result.suggesties).toEqual([]);
    expect(result.totaalAnalyseerdeProjecten).toBe(0);
    expect(result.scopesMetVoldoendeData).toBe(0);
    expect(result.scopesZonderSuggestie).toEqual([]);
  });

  it("requires minimum 3 projects for a suggestion", () => {
    const nacalculaties = [
      makeNacalculatie({ projectId: "p1" }),
      makeNacalculatie({ projectId: "p2" }),
    ];
    const normuren = [makeNormuur()];

    const result = analyzeNacalculaties(nacalculaties, normuren);
    expect(result.suggesties).toHaveLength(0);
    expect(result.scopesZonderSuggestie).toContain("grondwerk");
  });

  it("generates suggestion with 3+ projects and > 10% deviation", () => {
    const nacalculaties = [
      makeNacalculatie({ projectId: "p1", afwijkingenPerScope: { grondwerk: 5 }, geplandeUrenPerScope: { grondwerk: 20 } }),
      makeNacalculatie({ projectId: "p2", afwijkingenPerScope: { grondwerk: 6 }, geplandeUrenPerScope: { grondwerk: 20 } }),
      makeNacalculatie({ projectId: "p3", afwijkingenPerScope: { grondwerk: 4 }, geplandeUrenPerScope: { grondwerk: 20 } }),
    ];
    const normuren = [makeNormuur()];

    const result = analyzeNacalculaties(nacalculaties, normuren);
    expect(result.suggesties.length).toBeGreaterThan(0);
    expect(result.totaalAnalyseerdeProjecten).toBe(3);
    expect(result.scopesMetVoldoendeData).toBe(1);
  });

  it("does not suggest when deviation is below 10% threshold", () => {
    // 1% deviation: 0.2 out of 20 = 1%
    const nacalculaties = [
      makeNacalculatie({ projectId: "p1", afwijkingenPerScope: { grondwerk: 0.2 }, geplandeUrenPerScope: { grondwerk: 20 } }),
      makeNacalculatie({ projectId: "p2", afwijkingenPerScope: { grondwerk: 0.2 }, geplandeUrenPerScope: { grondwerk: 20 } }),
      makeNacalculatie({ projectId: "p3", afwijkingenPerScope: { grondwerk: 0.2 }, geplandeUrenPerScope: { grondwerk: 20 } }),
    ];
    const normuren = [makeNormuur()];

    const result = analyzeNacalculaties(nacalculaties, normuren);
    expect(result.suggesties).toHaveLength(0);
    expect(result.scopesZonderSuggestie).toContain("grondwerk");
  });

  it("classifies positive deviation as onderschatting", () => {
    const nacalculaties = Array.from({ length: 3 }, (_, i) =>
      makeNacalculatie({
        projectId: `p${i}`,
        afwijkingenPerScope: { grondwerk: 10 },
        geplandeUrenPerScope: { grondwerk: 20 },
      })
    );
    const normuren = [makeNormuur()];

    const result = analyzeNacalculaties(nacalculaties, normuren);
    expect(result.suggesties[0].type).toBe("onderschatting");
  });

  it("classifies negative deviation as overschatting", () => {
    const nacalculaties = Array.from({ length: 3 }, (_, i) =>
      makeNacalculatie({
        projectId: `p${i}`,
        afwijkingenPerScope: { grondwerk: -10 },
        geplandeUrenPerScope: { grondwerk: 20 },
      })
    );
    const normuren = [makeNormuur()];

    const result = analyzeNacalculaties(nacalculaties, normuren);
    expect(result.suggesties[0].type).toBe("overschatting");
  });

  it("handles multiple scopes simultaneously", () => {
    const nacalculaties = Array.from({ length: 5 }, (_, i) =>
      makeNacalculatie({
        projectId: `p${i}`,
        afwijkingenPerScope: { grondwerk: 5, bestrating: -8 },
        geplandeUrenPerScope: { grondwerk: 20, bestrating: 30 },
      })
    );
    const normuren = [
      makeNormuur({ scope: "grondwerk" }),
      makeNormuur({ _id: "norm_2", scope: "bestrating", activiteit: "tegelen" }),
    ];

    const result = analyzeNacalculaties(nacalculaties, normuren);
    expect(result.suggesties.length).toBeGreaterThanOrEqual(1);
    expect(result.scopesMetVoldoendeData).toBe(2);
  });

  it("skips scopes with no matching normuren", () => {
    const nacalculaties = Array.from({ length: 3 }, (_, i) =>
      makeNacalculatie({
        projectId: `p${i}`,
        afwijkingenPerScope: { unknown_scope: 10 },
        geplandeUrenPerScope: { unknown_scope: 20 },
      })
    );
    // No normuren for 'unknown_scope'
    const normuren: Normuur[] = [];

    const result = analyzeNacalculaties(nacalculaties, normuren);
    expect(result.suggesties).toHaveLength(0);
    expect(result.scopesZonderSuggestie).toContain("unknown_scope");
  });

  it("sorts suggestions by absolute deviation (highest first)", () => {
    const nacalculaties = Array.from({ length: 5 }, (_, i) =>
      makeNacalculatie({
        projectId: `p${i}`,
        afwijkingenPerScope: { grondwerk: 3, bestrating: -12 },
        geplandeUrenPerScope: { grondwerk: 20, bestrating: 20 },
      })
    );
    const normuren = [
      makeNormuur({ scope: "grondwerk" }),
      makeNormuur({ _id: "norm_2", scope: "bestrating", activiteit: "tegelen" }),
    ];

    const result = analyzeNacalculaties(nacalculaties, normuren);
    if (result.suggesties.length >= 2) {
      expect(
        Math.abs(result.suggesties[0].gemiddeldeAfwijkingPercentage)
      ).toBeGreaterThanOrEqual(
        Math.abs(result.suggesties[1].gemiddeldeAfwijkingPercentage)
      );
    }
  });

  it("calculates adjustment factor correctly for positive deviation", () => {
    // 50% deviation: 10 / 20 = 50%
    const nacalculaties = Array.from({ length: 3 }, (_, i) =>
      makeNacalculatie({
        projectId: `p${i}`,
        afwijkingenPerScope: { grondwerk: 10 },
        geplandeUrenPerScope: { grondwerk: 20 },
      })
    );
    const normuren = [makeNormuur({ normuurPerEenheid: 1.0 })];

    const result = analyzeNacalculaties(nacalculaties, normuren);
    expect(result.suggesties).toHaveLength(1);
    // Adjustment factor = 1 + 50/100 = 1.5, so 1.0 * 1.5 = 1.5
    expect(result.suggesties[0].activiteiten[0].gesuggereerdeWaarde).toBe(1.5);
  });

  it("handles zero planned hours gracefully", () => {
    const nacalculaties = Array.from({ length: 3 }, (_, i) =>
      makeNacalculatie({
        projectId: `p${i}`,
        afwijkingenPerScope: { grondwerk: 5 },
        geplandeUrenPerScope: { grondwerk: 0 },
      })
    );
    const normuren = [makeNormuur()];

    // Should not crash, deviation percentage should be 0
    const result = analyzeNacalculaties(nacalculaties, normuren);
    expect(result.scopesZonderSuggestie).toContain("grondwerk");
  });
});

// ============================================================
// Confidence levels
// ============================================================
describe("getConfidenceColor", () => {
  it("returns green for hoog", () => {
    expect(getConfidenceColor("hoog")).toContain("green");
  });

  it("returns yellow for gemiddeld", () => {
    expect(getConfidenceColor("gemiddeld")).toContain("yellow");
  });

  it("returns orange for laag", () => {
    expect(getConfidenceColor("laag")).toContain("orange");
  });
});

describe("getConfidenceBadgeVariant", () => {
  it("returns default for hoog", () => {
    expect(getConfidenceBadgeVariant("hoog")).toBe("default");
  });

  it("returns secondary for gemiddeld", () => {
    expect(getConfidenceBadgeVariant("gemiddeld")).toBe("secondary");
  });

  it("returns outline for laag", () => {
    expect(getConfidenceBadgeVariant("laag")).toBe("outline");
  });
});

// ============================================================
// formatScopeName
// ============================================================
describe("formatScopeName", () => {
  it("capitalizes single word", () => {
    expect(formatScopeName("grondwerk")).toBe("Grondwerk");
  });

  it("capitalizes and joins underscored words", () => {
    expect(formatScopeName("water_elektra")).toBe("Water Elektra");
  });

  it("handles single character segments", () => {
    expect(formatScopeName("a_b")).toBe("A B");
  });

  it("handles already capitalized input", () => {
    expect(formatScopeName("Grondwerk")).toBe("Grondwerk");
  });
});

// ============================================================
// calculateSuggestionImpact
// ============================================================
describe("calculateSuggestionImpact", () => {
  it("calculates positive hours difference for onderschatting", () => {
    const suggestie = makeSuggestie({
      gemiddeldeAfwijkingPercentage: 25,
      aantalProjecten: 5,
    });
    const result = calculateSuggestionImpact(suggestie, 100);
    expect(result.estimatedHoursDifference).toBeGreaterThan(0);
  });

  it("calculates negative hours difference for overschatting", () => {
    const suggestie = makeSuggestie({
      gemiddeldeAfwijkingPercentage: -25,
      aantalProjecten: 5,
      type: "overschatting",
    });
    const result = calculateSuggestionImpact(suggestie, 100);
    expect(result.estimatedHoursDifference).toBeLessThan(0);
  });

  it("returns 0 cost difference (not implemented)", () => {
    const suggestie = makeSuggestie();
    const result = calculateSuggestionImpact(suggestie, 100);
    expect(result.estimatedCostDifference).toBe(0);
  });

  it("handles zero average project hours", () => {
    const suggestie = makeSuggestie();
    const result = calculateSuggestionImpact(suggestie, 0);
    expect(result.estimatedHoursDifference).toBe(0);
  });
});

// ============================================================
// validateSuggestion
// ============================================================
describe("validateSuggestion", () => {
  it("returns valid=true for a reasonable suggestion", () => {
    const suggestie = makeSuggestie({
      betrouwbaarheid: "hoog",
      gemiddeldeAfwijkingPercentage: 20,
      activiteiten: [
        {
          normuurId: "n1",
          activiteit: "graven",
          huidigeWaarde: 0.5,
          gesuggereerdeWaarde: 0.6,
          wijzigingPercentage: 20,
          eenheid: "m²",
        },
      ],
    });
    const result = validateSuggestion(suggestie);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns for low confidence", () => {
    const suggestie = makeSuggestie({ betrouwbaarheid: "laag", aantalProjecten: 3 });
    const result = validateSuggestion(suggestie);
    expect(result.warnings.some((w) => w.includes("betrouwbaarheid"))).toBe(true);
  });

  it("warns for large adjustment (> 50%)", () => {
    const suggestie = makeSuggestie({
      gemiddeldeAfwijkingPercentage: 55,
      betrouwbaarheid: "hoog",
    });
    const result = validateSuggestion(suggestie);
    expect(result.warnings.some((w) => w.includes("Grote aanpassing"))).toBe(true);
  });

  it("warns when suggested value would be <= 0", () => {
    const suggestie = makeSuggestie({
      betrouwbaarheid: "hoog",
      gemiddeldeAfwijkingPercentage: 15,
      activiteiten: [
        {
          normuurId: "n1",
          activiteit: "graven",
          huidigeWaarde: 0.5,
          gesuggereerdeWaarde: 0,
          wijzigingPercentage: -100,
          eenheid: "m²",
        },
      ],
    });
    const result = validateSuggestion(suggestie);
    expect(result.warnings.some((w) => w.includes("waarde van 0"))).toBe(true);
  });

  it("warns for individual activity change > 100%", () => {
    const suggestie = makeSuggestie({
      betrouwbaarheid: "hoog",
      gemiddeldeAfwijkingPercentage: 15,
      activiteiten: [
        {
          normuurId: "n1",
          activiteit: "graven",
          huidigeWaarde: 0.5,
          gesuggereerdeWaarde: 1.1,
          wijzigingPercentage: 120,
          eenheid: "m²",
        },
      ],
    });
    const result = validateSuggestion(suggestie);
    expect(result.warnings.some((w) => w.includes("Grote wijziging"))).toBe(true);
  });
});

// ============================================================
// getSuggestionPriority
// ============================================================
describe("getSuggestionPriority", () => {
  it("returns hoog for high confidence and > 20% deviation", () => {
    const suggestie = makeSuggestie({
      betrouwbaarheid: "hoog",
      gemiddeldeAfwijkingPercentage: 25,
    });
    expect(getSuggestionPriority(suggestie)).toBe("hoog");
  });

  it("returns gemiddeld for non-low confidence and > 10% deviation", () => {
    const suggestie = makeSuggestie({
      betrouwbaarheid: "gemiddeld",
      gemiddeldeAfwijkingPercentage: 15,
    });
    expect(getSuggestionPriority(suggestie)).toBe("gemiddeld");
  });

  it("returns laag for low confidence", () => {
    const suggestie = makeSuggestie({
      betrouwbaarheid: "laag",
      gemiddeldeAfwijkingPercentage: 25,
    });
    expect(getSuggestionPriority(suggestie)).toBe("laag");
  });

  it("returns gemiddeld for high confidence but <= 20% deviation", () => {
    const suggestie = makeSuggestie({
      betrouwbaarheid: "hoog",
      gemiddeldeAfwijkingPercentage: 15,
    });
    expect(getSuggestionPriority(suggestie)).toBe("gemiddeld");
  });
});

// ============================================================
// getSuggestionTypeColor
// ============================================================
describe("getSuggestionTypeColor", () => {
  it("returns red colors for onderschatting", () => {
    const colors = getSuggestionTypeColor("onderschatting");
    expect(colors.text).toContain("red");
    expect(colors.bg).toContain("red");
  });

  it("returns blue colors for overschatting", () => {
    const colors = getSuggestionTypeColor("overschatting");
    expect(colors.text).toContain("blue");
    expect(colors.bg).toContain("blue");
  });
});
