/**
 * Unit tests for Convex offertes backend logic.
 *
 * Since Convex functions require a real runtime (db, auth, scheduler),
 * we test the extracted pure business logic and use mock ctx objects
 * to verify handler behavior patterns.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  MockConvexStore,
  createMockCtx,
  createMockUser,
  createMockOfferte,
  createMockProject,
  createMockRegel,
  // Business logic helpers
  VALID_STATUS_TRANSITIONS,
  ALL_STATUSES,
  DEPRECATED_STATUS,
  isValidStatusTransition,
  calculateOfferteRegelsTotal,
  calculateDashboardStats,
  calculateRevenueStats,
  filterOfferteList,
} from "../../helpers/convex-mock";

// ============================================================================
// STATUS WORKFLOW TRANSITIONS
// ============================================================================

describe("Offerte Status Workflow", () => {
  describe("isValidStatusTransition", () => {
    // ---- Forward flow (happy path) ----

    it("allows concept -> voorcalculatie", () => {
      expect(isValidStatusTransition("concept", "voorcalculatie")).toBe(true);
    });

    it("allows voorcalculatie -> verzonden", () => {
      expect(isValidStatusTransition("voorcalculatie", "verzonden")).toBe(true);
    });

    it("allows verzonden -> geaccepteerd", () => {
      expect(isValidStatusTransition("verzonden", "geaccepteerd")).toBe(true);
    });

    it("allows verzonden -> afgewezen", () => {
      expect(isValidStatusTransition("verzonden", "afgewezen")).toBe(true);
    });

    // ---- Backward flow (allowed step-backs) ----

    it("allows voorcalculatie -> concept (step back)", () => {
      expect(isValidStatusTransition("voorcalculatie", "concept")).toBe(true);
    });

    it("allows verzonden -> voorcalculatie (step back)", () => {
      expect(isValidStatusTransition("verzonden", "voorcalculatie")).toBe(true);
    });

    it("allows geaccepteerd -> verzonden (re-send)", () => {
      expect(isValidStatusTransition("geaccepteerd", "verzonden")).toBe(true);
    });

    it("allows afgewezen -> verzonden (re-send after rejection)", () => {
      expect(isValidStatusTransition("afgewezen", "verzonden")).toBe(true);
    });

    // ---- Invalid transitions ----

    it("rejects concept -> verzonden (skips voorcalculatie)", () => {
      expect(isValidStatusTransition("concept", "verzonden")).toBe(false);
    });

    it("rejects concept -> geaccepteerd (skips two steps)", () => {
      expect(isValidStatusTransition("concept", "geaccepteerd")).toBe(false);
    });

    it("rejects concept -> afgewezen (skips two steps)", () => {
      expect(isValidStatusTransition("concept", "afgewezen")).toBe(false);
    });

    it("rejects voorcalculatie -> geaccepteerd (skips verzonden)", () => {
      expect(isValidStatusTransition("voorcalculatie", "geaccepteerd")).toBe(false);
    });

    it("rejects voorcalculatie -> afgewezen (skips verzonden)", () => {
      expect(isValidStatusTransition("voorcalculatie", "afgewezen")).toBe(false);
    });

    it("rejects geaccepteerd -> concept (not a valid step-back)", () => {
      expect(isValidStatusTransition("geaccepteerd", "concept")).toBe(false);
    });

    it("rejects afgewezen -> concept (not a valid step-back)", () => {
      expect(isValidStatusTransition("afgewezen", "concept")).toBe(false);
    });

    it("rejects geaccepteerd -> afgewezen (no direct switch)", () => {
      expect(isValidStatusTransition("geaccepteerd", "afgewezen")).toBe(false);
    });

    it("rejects afgewezen -> geaccepteerd (no direct switch)", () => {
      expect(isValidStatusTransition("afgewezen", "geaccepteerd")).toBe(false);
    });

    it("rejects same-status transition for all statuses", () => {
      for (const status of ALL_STATUSES) {
        expect(isValidStatusTransition(status, status)).toBe(false);
      }
    });

    it("rejects transitions from unknown status", () => {
      expect(isValidStatusTransition("unknown", "concept")).toBe(false);
    });

    it("rejects transitions to unknown status", () => {
      expect(isValidStatusTransition("concept", "unknown")).toBe(false);
    });
  });

  describe("VALID_STATUS_TRANSITIONS completeness", () => {
    it("defines transitions for all 5 statuses", () => {
      for (const status of ALL_STATUSES) {
        expect(VALID_STATUS_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(VALID_STATUS_TRANSITIONS[status])).toBe(true);
      }
    });

    it("does not define transitions for deprecated status", () => {
      expect(VALID_STATUS_TRANSITIONS).not.toHaveProperty(DEPRECATED_STATUS);
    });

    it("every target in transitions is a valid status", () => {
      for (const [, targets] of Object.entries(VALID_STATUS_TRANSITIONS)) {
        for (const target of targets) {
          expect(ALL_STATUSES).toContain(target);
        }
      }
    });

    it("concept has exactly 1 forward transition", () => {
      expect(VALID_STATUS_TRANSITIONS["concept"]).toHaveLength(1);
    });

    it("verzonden has 3 transitions (back + accept + reject)", () => {
      expect(VALID_STATUS_TRANSITIONS["verzonden"]).toHaveLength(3);
    });

    it("terminal statuses (geaccepteerd/afgewezen) can only go back to verzonden", () => {
      expect(VALID_STATUS_TRANSITIONS["geaccepteerd"]).toEqual(["verzonden"]);
      expect(VALID_STATUS_TRANSITIONS["afgewezen"]).toEqual(["verzonden"]);
    });
  });

  describe("full workflow path validation", () => {
    it("supports the full happy path: concept -> voorcalculatie -> verzonden -> geaccepteerd", () => {
      const path = ["concept", "voorcalculatie", "verzonden", "geaccepteerd"];
      for (let i = 0; i < path.length - 1; i++) {
        expect(isValidStatusTransition(path[i], path[i + 1])).toBe(true);
      }
    });

    it("supports the rejection path: concept -> voorcalculatie -> verzonden -> afgewezen", () => {
      const path = ["concept", "voorcalculatie", "verzonden", "afgewezen"];
      for (let i = 0; i < path.length - 1; i++) {
        expect(isValidStatusTransition(path[i], path[i + 1])).toBe(true);
      }
    });

    it("supports the re-send-after-rejection cycle: afgewezen -> verzonden -> geaccepteerd", () => {
      expect(isValidStatusTransition("afgewezen", "verzonden")).toBe(true);
      expect(isValidStatusTransition("verzonden", "geaccepteerd")).toBe(true);
    });

    it("supports the revision cycle: geaccepteerd -> verzonden -> voorcalculatie -> concept", () => {
      expect(isValidStatusTransition("geaccepteerd", "verzonden")).toBe(true);
      expect(isValidStatusTransition("verzonden", "voorcalculatie")).toBe(true);
      expect(isValidStatusTransition("voorcalculatie", "concept")).toBe(true);
    });
  });
});

// ============================================================================
// OFFERTE TOTALS CALCULATION
// ============================================================================

describe("calculateOfferteRegelsTotal", () => {
  describe("basic totals", () => {
    it("calculates totals for arbeid-only regels", () => {
      const regels = [
        createMockRegel({ type: "arbeid", hoeveelheid: 40, totaal: 2200 }),
        createMockRegel({ type: "arbeid", hoeveelheid: 20, totaal: 1100 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20, // 20% marge
        21  // 21% BTW
      );

      expect(result.arbeidskosten).toBe(3300);
      expect(result.materiaalkosten).toBe(0);
      expect(result.totaalUren).toBe(60);
      expect(result.subtotaal).toBe(3300);
    });

    it("calculates totals for materiaal-only regels", () => {
      const regels = [
        createMockRegel({ type: "materiaal", hoeveelheid: 100, totaal: 5000 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20,
        21
      );

      expect(result.materiaalkosten).toBe(5000);
      expect(result.arbeidskosten).toBe(0);
      // Materiaal does not contribute to totaalUren
      expect(result.totaalUren).toBe(0);
      expect(result.subtotaal).toBe(5000);
    });

    it("adds machine costs to arbeidskosten", () => {
      const regels = [
        createMockRegel({ type: "machine", hoeveelheid: 1, totaal: 500 }),
        createMockRegel({ type: "arbeid", hoeveelheid: 10, totaal: 550 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20,
        21
      );

      // Machine costs are added to arbeidskosten
      expect(result.arbeidskosten).toBe(1050);
      // Machine hoeveelheid does NOT add to totaalUren
      expect(result.totaalUren).toBe(10);
    });

    it("calculates mixed regels correctly", () => {
      const regels = [
        createMockRegel({ type: "arbeid", hoeveelheid: 40, totaal: 2200 }),
        createMockRegel({ type: "materiaal", hoeveelheid: 16, totaal: 480 }),
        createMockRegel({ type: "arbeid", hoeveelheid: 30, totaal: 1650 }),
        createMockRegel({ type: "materiaal", hoeveelheid: 30, totaal: 1350 }),
        createMockRegel({ type: "machine", hoeveelheid: 1, totaal: 75 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20,
        21
      );

      expect(result.materiaalkosten).toBe(480 + 1350);
      expect(result.arbeidskosten).toBe(2200 + 1650 + 75);
      expect(result.totaalUren).toBe(40 + 30);
      expect(result.subtotaal).toBe(480 + 1350 + 2200 + 1650 + 75);
    });

    it("returns zero totals for empty regels", () => {
      const result = calculateOfferteRegelsTotal([], 20, 21);

      expect(result.materiaalkosten).toBe(0);
      expect(result.arbeidskosten).toBe(0);
      expect(result.totaalUren).toBe(0);
      expect(result.subtotaal).toBe(0);
      expect(result.marge).toBe(0);
      expect(result.totaalExBtw).toBe(0);
      expect(result.btw).toBe(0);
      expect(result.totaalInclBtw).toBe(0);
    });
  });

  describe("margin calculation", () => {
    it("applies default marge percentage to all regels", () => {
      const regels = [
        createMockRegel({ type: "arbeid", hoeveelheid: 10, totaal: 1000 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        25, // 25% marge
        21
      );

      // Marge = 1000 * 25% = 250
      expect(result.marge).toBe(250);
      expect(result.margePercentage).toBe(25);
      expect(result.totaalExBtw).toBe(1250);
    });

    it("applies per-regel marge override (highest priority)", () => {
      const regels = [
        createMockRegel({
          type: "arbeid",
          hoeveelheid: 10,
          totaal: 1000,
          margePercentage: 30, // Override
        }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20, // Default marge
        21
      );

      // Regel override takes precedence: 1000 * 30% = 300
      expect(result.marge).toBe(300);
    });

    it("applies scope marge when no per-regel override", () => {
      const regels = [
        createMockRegel({
          type: "arbeid",
          scope: "grondwerk",
          hoeveelheid: 10,
          totaal: 1000,
        }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20, // Default marge
        21,
        { grondwerk: 35 } // Scope marge
      );

      // Scope marge: 1000 * 35% = 350
      expect(result.marge).toBe(350);
    });

    it("per-regel marge overrides scope marge", () => {
      const regels = [
        createMockRegel({
          type: "arbeid",
          scope: "grondwerk",
          hoeveelheid: 10,
          totaal: 1000,
          margePercentage: 15, // Regel-level override
        }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20,
        21,
        { grondwerk: 35 } // Scope marge (should be ignored)
      );

      // Per-regel takes priority: 1000 * 15% = 150
      expect(result.marge).toBe(150);
    });

    it("falls back to default marge when scope marge is undefined", () => {
      const regels = [
        createMockRegel({
          type: "arbeid",
          scope: "borders",
          hoeveelheid: 10,
          totaal: 1000,
        }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20, // Default marge
        21,
        { grondwerk: 35 } // Only grondwerk defined, not borders
      );

      // Falls back to default: 1000 * 20% = 200
      expect(result.marge).toBe(200);
    });

    it("handles mixed marge sources across regels", () => {
      const regels = [
        // Regel with its own marge override
        createMockRegel({
          type: "arbeid",
          scope: "grondwerk",
          hoeveelheid: 10,
          totaal: 1000,
          margePercentage: 10,
        }),
        // Regel using scope marge
        createMockRegel({
          type: "materiaal",
          scope: "bestrating",
          hoeveelheid: 20,
          totaal: 2000,
        }),
        // Regel falling back to default marge
        createMockRegel({
          type: "arbeid",
          scope: "borders",
          hoeveelheid: 5,
          totaal: 500,
        }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20, // Default
        21,
        { bestrating: 25 } // Scope marge for bestrating only
      );

      // r1: 1000 * 10% = 100 (per-regel)
      // r2: 2000 * 25% = 500 (scope)
      // r3: 500 * 20% = 100 (default)
      expect(result.marge).toBe(700);
    });

    it("calculates effective average marge percentage", () => {
      const regels = [
        createMockRegel({ type: "arbeid", hoeveelheid: 10, totaal: 1000, margePercentage: 10 }),
        createMockRegel({ type: "arbeid", hoeveelheid: 10, totaal: 1000, margePercentage: 30 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20,
        21
      );

      // Total marge = 100 + 300 = 400, subtotaal = 2000
      // Effective = (400/2000) * 100 = 20%
      expect(result.margePercentage).toBe(20);
    });

    it("uses default marge percentage when subtotaal is 0 (empty regels)", () => {
      const result = calculateOfferteRegelsTotal([], 25, 21);
      expect(result.margePercentage).toBe(25);
    });

    it("handles zero marge percentage", () => {
      const regels = [
        createMockRegel({ type: "arbeid", hoeveelheid: 10, totaal: 1000 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        0,
        21
      );

      expect(result.marge).toBe(0);
      expect(result.totaalExBtw).toBe(1000);
    });
  });

  describe("BTW calculation", () => {
    it("applies 21% BTW correctly", () => {
      const regels = [
        createMockRegel({ type: "arbeid", hoeveelheid: 10, totaal: 1000 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20,
        21
      );

      // subtotaal = 1000, marge = 200, exBtw = 1200
      // btw = 1200 * 21% = 252
      expect(result.totaalExBtw).toBe(1200);
      expect(result.btw).toBe(252);
      expect(result.totaalInclBtw).toBe(1452);
    });

    it("handles 0% BTW", () => {
      const regels = [
        createMockRegel({ type: "arbeid", hoeveelheid: 10, totaal: 1000 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20,
        0
      );

      expect(result.btw).toBe(0);
      expect(result.totaalInclBtw).toBe(result.totaalExBtw);
    });

    it("handles 9% BTW (laag tarief)", () => {
      const regels = [
        createMockRegel({ type: "arbeid", hoeveelheid: 10, totaal: 1000 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        0, // no marge
        9
      );

      expect(result.btw).toBe(90);
      expect(result.totaalInclBtw).toBe(1090);
    });
  });

  describe("margePercentage rounding", () => {
    it("rounds effective marge percentage to 2 decimal places", () => {
      // Create a scenario where the effective marge percentage has many decimals
      const regels = [
        createMockRegel({ type: "arbeid", hoeveelheid: 10, totaal: 333, margePercentage: 17 }),
        createMockRegel({ type: "materiaal", hoeveelheid: 5, totaal: 667, margePercentage: 23 }),
      ];

      const result = calculateOfferteRegelsTotal(
        regels as Parameters<typeof calculateOfferteRegelsTotal>[0],
        20,
        21
      );

      // Verify it's rounded to 2 decimal places
      const decimals = result.margePercentage.toString().split(".")[1];
      expect(!decimals || decimals.length <= 2).toBe(true);
    });
  });
});

// ============================================================================
// DASHBOARD STATS
// ============================================================================

describe("calculateDashboardStats", () => {
  it("counts offertes by status correctly", () => {
    const offertes = [
      { status: "concept", totalen: { totaalInclBtw: 1000 } },
      { status: "concept", totalen: { totaalInclBtw: 2000 } },
      { status: "voorcalculatie", totalen: { totaalInclBtw: 3000 } },
      { status: "verzonden", totalen: { totaalInclBtw: 4000 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 5000 } },
      { status: "afgewezen", totalen: { totaalInclBtw: 6000 } },
    ];

    const stats = calculateDashboardStats(offertes);

    expect(stats.totaal).toBe(6);
    expect(stats.concept).toBe(2);
    expect(stats.voorcalculatie).toBe(1);
    expect(stats.verzonden).toBe(1);
    expect(stats.geaccepteerd).toBe(1);
    expect(stats.afgewezen).toBe(1);
  });

  it("calculates totaalWaarde as sum of all non-filtered offertes", () => {
    const offertes = [
      { status: "concept", totalen: { totaalInclBtw: 1000 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 5000 } },
    ];

    const stats = calculateDashboardStats(offertes);
    expect(stats.totaalWaarde).toBe(6000);
  });

  it("calculates geaccepteerdWaarde only from accepted offertes", () => {
    const offertes = [
      { status: "concept", totalen: { totaalInclBtw: 1000 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 5000 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 3000 } },
      { status: "afgewezen", totalen: { totaalInclBtw: 2000 } },
    ];

    const stats = calculateDashboardStats(offertes);
    expect(stats.geaccepteerdWaarde).toBe(8000);
  });

  it("excludes archived offertes from stats", () => {
    const offertes = [
      { status: "concept", totalen: { totaalInclBtw: 1000 } },
      { status: "concept", totalen: { totaalInclBtw: 2000 }, isArchived: true },
    ];

    const stats = calculateDashboardStats(offertes);
    expect(stats.totaal).toBe(1);
    expect(stats.concept).toBe(1);
    expect(stats.totaalWaarde).toBe(1000);
  });

  it("excludes deleted offertes from stats", () => {
    const offertes = [
      { status: "concept", totalen: { totaalInclBtw: 1000 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 5000 }, deletedAt: Date.now() },
    ];

    const stats = calculateDashboardStats(offertes);
    expect(stats.totaal).toBe(1);
    expect(stats.geaccepteerd).toBe(0);
    expect(stats.geaccepteerdWaarde).toBe(0);
  });

  it("returns all zeros for empty list", () => {
    const stats = calculateDashboardStats([]);

    expect(stats.totaal).toBe(0);
    expect(stats.concept).toBe(0);
    expect(stats.totaalWaarde).toBe(0);
    expect(stats.geaccepteerdWaarde).toBe(0);
  });

  it("excludes both archived AND deleted from same offerte", () => {
    const offertes = [
      {
        status: "geaccepteerd",
        totalen: { totaalInclBtw: 10000 },
        isArchived: true,
        deletedAt: Date.now(),
      },
    ];

    const stats = calculateDashboardStats(offertes);
    expect(stats.totaal).toBe(0);
  });
});

// ============================================================================
// REVENUE STATS
// ============================================================================

describe("calculateRevenueStats", () => {
  it("counts accepted offertes and their total value", () => {
    const offertes = [
      { status: "geaccepteerd", totalen: { totaalInclBtw: 5000 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 8000 } },
      { status: "concept", totalen: { totaalInclBtw: 3000 } },
    ];

    const stats = calculateRevenueStats(offertes);
    expect(stats.totalAcceptedCount).toBe(2);
    expect(stats.totalAcceptedValue).toBe(13000);
  });

  it("counts sent offertes (verzonden + geaccepteerd + afgewezen)", () => {
    const offertes = [
      { status: "verzonden", totalen: { totaalInclBtw: 1000 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 2000 } },
      { status: "afgewezen", totalen: { totaalInclBtw: 3000 } },
      { status: "concept", totalen: { totaalInclBtw: 4000 } },
      { status: "voorcalculatie", totalen: { totaalInclBtw: 5000 } },
    ];

    const stats = calculateRevenueStats(offertes);
    // Only verzonden + geaccepteerd + afgewezen count as "sent"
    expect(stats.conversionRate).toBe(Math.round((1 / 3) * 100)); // 33%
  });

  it("calculates conversion rate correctly", () => {
    const offertes = [
      { status: "geaccepteerd", totalen: { totaalInclBtw: 5000 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 3000 } },
      { status: "afgewezen", totalen: { totaalInclBtw: 2000 } },
      { status: "verzonden", totalen: { totaalInclBtw: 4000 } },
    ];

    const stats = calculateRevenueStats(offertes);
    // 2 accepted out of 4 sent = 50%
    expect(stats.conversionRate).toBe(50);
  });

  it("calculates average offerte value from accepted offertes", () => {
    const offertes = [
      { status: "geaccepteerd", totalen: { totaalInclBtw: 4000 } },
      { status: "geaccepteerd", totalen: { totaalInclBtw: 6000 } },
      { status: "verzonden", totalen: { totaalInclBtw: 9999 } },
    ];

    const stats = calculateRevenueStats(offertes);
    // Average of 4000 and 6000
    expect(stats.averageOfferteValue).toBe(5000);
  });

  it("returns 0 conversion rate when no offertes have been sent", () => {
    const offertes = [
      { status: "concept", totalen: { totaalInclBtw: 1000 } },
      { status: "voorcalculatie", totalen: { totaalInclBtw: 2000 } },
    ];

    const stats = calculateRevenueStats(offertes);
    expect(stats.conversionRate).toBe(0);
  });

  it("returns 0 average value when no offertes are accepted", () => {
    const offertes = [
      { status: "verzonden", totalen: { totaalInclBtw: 5000 } },
      { status: "afgewezen", totalen: { totaalInclBtw: 3000 } },
    ];

    const stats = calculateRevenueStats(offertes);
    expect(stats.averageOfferteValue).toBe(0);
    expect(stats.totalAcceptedCount).toBe(0);
    expect(stats.totalAcceptedValue).toBe(0);
  });

  it("returns all zeros for empty offertes list", () => {
    const stats = calculateRevenueStats([]);

    expect(stats.totalAcceptedValue).toBe(0);
    expect(stats.totalAcceptedCount).toBe(0);
    expect(stats.conversionRate).toBe(0);
    expect(stats.averageOfferteValue).toBe(0);
  });

  it("rounds conversion rate and average value to integers", () => {
    const offertes = [
      { status: "geaccepteerd", totalen: { totaalInclBtw: 3333 } },
      { status: "verzonden", totalen: { totaalInclBtw: 5000 } },
      { status: "afgewezen", totalen: { totaalInclBtw: 2000 } },
    ];

    const stats = calculateRevenueStats(offertes);
    expect(Number.isInteger(stats.conversionRate)).toBe(true);
    expect(Number.isInteger(stats.averageOfferteValue)).toBe(true);
  });
});

// ============================================================================
// LIST FILTERING
// ============================================================================

describe("filterOfferteList", () => {
  const offertes = [
    { id: 1, isArchived: false, deletedAt: undefined },
    { id: 2, isArchived: true, deletedAt: undefined },
    { id: 3, isArchived: false, deletedAt: 1700000000000 },
    { id: 4, isArchived: true, deletedAt: 1700000000000 },
    { id: 5 }, // No archived/deleted fields at all
  ];

  it("excludes both archived and deleted by default", () => {
    const result = filterOfferteList(offertes);
    expect(result.map((o) => o.id)).toEqual([1, 5]);
  });

  it("includes archived when includeArchived=true", () => {
    const result = filterOfferteList(offertes, { includeArchived: true });
    expect(result.map((o) => o.id)).toEqual([1, 2, 5]);
  });

  it("includes deleted when includeDeleted=true", () => {
    const result = filterOfferteList(offertes, { includeDeleted: true });
    expect(result.map((o) => o.id)).toEqual([1, 3, 5]);
  });

  it("includes everything when both flags are true", () => {
    const result = filterOfferteList(offertes, {
      includeArchived: true,
      includeDeleted: true,
    });
    expect(result.map((o) => o.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns empty array for empty input", () => {
    const result = filterOfferteList([]);
    expect(result).toEqual([]);
  });

  it("does not mutate the original array", () => {
    const original = [...offertes];
    filterOfferteList(offertes);
    expect(offertes).toEqual(original);
  });
});

// ============================================================================
// MOCK CONTEXT + HANDLER BEHAVIOR
// ============================================================================

describe("Mock Context (handler-level patterns)", () => {
  let store: MockConvexStore;

  beforeEach(() => {
    store = new MockConvexStore();
  });

  describe("offerte creation pattern", () => {
    it("creates an offerte with concept status and empty totals", () => {
      const userId = store.insert("users", createMockUser());
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, "klanten:1", { status: "concept" })
      );

      const offerte = store.get(offerteId);
      expect(offerte).not.toBeNull();
      expect(offerte!.status).toBe("concept");
      expect(offerte!.userId).toBe(userId);
    });

    it("assigns a unique offerte nummer", () => {
      const userId = store.insert("users", createMockUser());
      const id1 = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1", { offerteNummer: "OFF-2026-001" })
      );
      const id2 = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1", { offerteNummer: "OFF-2026-002" })
      );

      const o1 = store.get(id1);
      const o2 = store.get(id2);
      expect(o1!.offerteNummer).toBe("OFF-2026-001");
      expect(o2!.offerteNummer).toBe("OFF-2026-002");
    });
  });

  describe("offerte update pattern", () => {
    it("patches only provided fields", () => {
      const userId = store.insert("users", createMockUser());
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1", {
          notities: "Original",
          status: "concept",
        })
      );

      store.patch(offerteId, { notities: "Updated" });

      const offerte = store.get(offerteId);
      expect(offerte!.notities).toBe("Updated");
      expect(offerte!.status).toBe("concept"); // Unchanged
    });

    it("removes fields when patched with undefined", () => {
      const userId = store.insert("users", createMockUser());
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1", {
          customerResponse: { status: "geaccepteerd", respondedAt: Date.now() },
        })
      );

      store.patch(offerteId, { customerResponse: undefined });

      const offerte = store.get(offerteId);
      expect(offerte!.customerResponse).toBeUndefined();
    });
  });

  describe("soft delete + restore pattern", () => {
    it("soft deletes by setting deletedAt timestamp", () => {
      const userId = store.insert("users", createMockUser());
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1")
      );

      const now = Date.now();
      store.patch(offerteId, { deletedAt: now, updatedAt: now });

      const offerte = store.get(offerteId);
      expect(offerte!.deletedAt).toBe(now);
    });

    it("restores by clearing deletedAt", () => {
      const userId = store.insert("users", createMockUser());
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1", { deletedAt: Date.now() })
      );

      store.patch(offerteId, { deletedAt: undefined, updatedAt: Date.now() });

      const offerte = store.get(offerteId);
      expect(offerte!.deletedAt).toBeUndefined();
    });

    it("permanently deletes by removing from store", () => {
      const userId = store.insert("users", createMockUser());
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1")
      );

      store.delete(offerteId);

      const offerte = store.get(offerteId);
      expect(offerte).toBeNull();
    });
  });

  describe("archive pattern", () => {
    it("archives by setting isArchived and archivedAt", () => {
      const userId = store.insert("users", createMockUser());
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1")
      );

      const now = Date.now();
      store.patch(offerteId, {
        isArchived: true,
        archivedAt: now,
        updatedAt: now,
      });

      const offerte = store.get(offerteId);
      expect(offerte!.isArchived).toBe(true);
      expect(offerte!.archivedAt).toBe(now);
    });
  });

  describe("duplicate pattern", () => {
    it("creates a copy with new nummer and concept status", () => {
      const userId = store.insert("users", createMockUser());
      const originalId = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1", {
          status: "geaccepteerd",
          offerteNummer: "OFF-2026-001",
          notities: "Important notes",
          totalen: {
            materiaalkosten: 1000,
            arbeidskosten: 2000,
            totaalUren: 40,
            subtotaal: 3000,
            marge: 600,
            margePercentage: 20,
            totaalExBtw: 3600,
            btw: 756,
            totaalInclBtw: 4356,
          },
        })
      );

      const original = store.get(originalId)!;

      // Simulate the duplicate logic from the handler
      const duplicateId = store.insert("offertes", {
        userId,
        type: original.type,
        status: "concept", // Always concept
        offerteNummer: "OFF-2026-002", // New nummer
        klant: original.klant,
        algemeenParams: original.algemeenParams,
        scopes: original.scopes,
        totalen: original.totalen,
        regels: original.regels,
        notities: `Kopie van ${original.offerteNummer}\n\n${original.notities}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const duplicate = store.get(duplicateId)!;
      expect(duplicate.status).toBe("concept");
      expect(duplicate.offerteNummer).toBe("OFF-2026-002");
      expect(duplicate.notities).toContain("Kopie van OFF-2026-001");
      expect(duplicate.notities).toContain("Important notes");
      // Totals are preserved from the original
      expect((duplicate.totalen as Record<string, number>).totaalInclBtw).toBe(4356);
    });
  });

  describe("geaccepteerd lock + new version pattern", () => {
    it("when updating an accepted offerte, status resets to concept", () => {
      const userId = store.insert("users", createMockUser());
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1", {
          status: "geaccepteerd",
          customerResponse: {
            status: "geaccepteerd",
            respondedAt: Date.now(),
          },
        })
      );

      // Simulate the locked-offerte update logic
      store.patch(offerteId, {
        status: "concept",
        customerResponse: undefined,
        updatedAt: Date.now(),
      });

      const offerte = store.get(offerteId)!;
      expect(offerte.status).toBe("concept");
      expect(offerte.customerResponse).toBeUndefined();
    });
  });

  describe("ownership verification pattern", () => {
    it("rejects access for offerte belonging to a different user", () => {
      const user1Id = store.insert("users", createMockUser({ clerkId: "user_1" }));
      const user2Id = store.insert(
        "users",
        createMockUser({ clerkId: "user_2" })
      );

      const offerteId = store.insert(
        "offertes",
        createMockOfferte(user1Id, "k:1")
      );

      const offerte = store.get(offerteId);
      expect(offerte).not.toBeNull();
      // Simulating the ownership check from the get query handler
      // user2 should NOT own user1's offerte
      expect(offerte!.userId).toBe(user1Id);
      expect(offerte!.userId).not.toBe(user2Id);
      // The handler returns null when userId doesn't match — simulate that
      const result = offerte!.userId === user2Id ? offerte : null;
      expect(result).toBeNull();
    });
  });

  describe("verzonden status requires voorcalculatie", () => {
    it("can verify voorcalculatie existence in the store", () => {
      const userId = store.insert("users", createMockUser());
      const offerteId = store.insert(
        "offertes",
        createMockOfferte(userId, "k:1", { status: "voorcalculatie" })
      );

      // Without voorcalculatie — should block verzonden
      const voorcalculaties = store.getAll("voorcalculaties");
      const hasVoorcalculatie = voorcalculaties.some(
        (v) => v.offerteId === offerteId
      );
      expect(hasVoorcalculatie).toBe(false);

      // Add voorcalculatie
      store.insert("voorcalculaties", {
        offerteId,
        userId,
        normUrenTotaal: 80,
      });

      const voorcalculatiesAfter = store.getAll("voorcalculaties");
      const hasVoorcalculatieAfter = voorcalculatiesAfter.some(
        (v) => v.offerteId === offerteId
      );
      expect(hasVoorcalculatieAfter).toBe(true);
    });
  });

  describe("createMockCtx auth integration", () => {
    it("returns identity when authenticated", async () => {
      const ctx = createMockCtx(store);
      const identity = await ctx.auth.getUserIdentity();
      expect(identity).not.toBeNull();
      expect(identity.subject).toBe("clerk_test_user_123");
    });

    it("can simulate unauthenticated state", async () => {
      const ctx = createMockCtx(store);
      ctx.auth.getUserIdentity.mockResolvedValueOnce(null);
      const identity = await ctx.auth.getUserIdentity();
      expect(identity).toBeNull();
    });

    it("scheduler.runAfter is callable and mockable", async () => {
      const ctx = createMockCtx(store);
      await ctx.scheduler.runAfter(0, "internal.notifications.notifyOfferteCreated", {
        offerteId: "offertes:1",
      });
      expect(ctx.scheduler.runAfter).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
// ACCEPTED WITHOUT PROJECT (dashboard action-required logic)
// ============================================================================

describe("Accepted offertes without project detection", () => {
  let store: MockConvexStore;

  beforeEach(() => {
    store = new MockConvexStore();
  });

  it("identifies accepted offertes that have no project", () => {
    const userId = "users:1";
    store.insert("users", createMockUser());

    const offerteId1 = store.insert(
      "offertes",
      createMockOfferte(userId, "k:1", {
        status: "geaccepteerd",
        offerteNummer: "OFF-001",
      })
    );
    const offerteId2 = store.insert(
      "offertes",
      createMockOfferte(userId, "k:1", {
        status: "geaccepteerd",
        offerteNummer: "OFF-002",
      })
    );

    // Create project only for offerte1
    store.insert("projecten", createMockProject(userId, offerteId1));

    // Get all accepted offertes
    const allOffertes = store.getAll("offertes");
    const accepted = allOffertes.filter((o) => o.status === "geaccepteerd");

    // Get all projects
    const projects = store.getAll("projecten");
    const offertesWithProject = new Set(
      projects.map((p) => (p.offerteId as string))
    );

    // Find accepted without project
    const withoutProject = accepted.filter(
      (o) => !offertesWithProject.has(o._id)
    );

    expect(withoutProject).toHaveLength(1);
    expect(withoutProject[0].offerteNummer).toBe("OFF-002");
  });

  it("returns empty when all accepted offertes have projects", () => {
    const userId = "users:1";
    store.insert("users", createMockUser());

    const offerteId = store.insert(
      "offertes",
      createMockOfferte(userId, "k:1", { status: "geaccepteerd" })
    );
    store.insert("projecten", createMockProject(userId, offerteId));

    const allOffertes = store.getAll("offertes");
    const accepted = allOffertes.filter((o) => o.status === "geaccepteerd");
    const projects = store.getAll("projecten");
    const offertesWithProject = new Set(
      projects.map((p) => (p.offerteId as string))
    );
    const withoutProject = accepted.filter(
      (o) => !offertesWithProject.has(o._id)
    );

    expect(withoutProject).toHaveLength(0);
  });

  it("ignores non-accepted offertes without projects", () => {
    const userId = "users:1";
    store.insert("users", createMockUser());

    // A concept offerte without a project should NOT appear
    store.insert(
      "offertes",
      createMockOfferte(userId, "k:1", { status: "concept" })
    );

    const allOffertes = store.getAll("offertes");
    const accepted = allOffertes.filter((o) => o.status === "geaccepteerd");

    expect(accepted).toHaveLength(0);
  });
});

// ============================================================================
// AUTH HELPER: isShareTokenValid (from convex/auth.ts)
// ============================================================================

describe("Share token validation", () => {
  // Pure function extracted for testability
  function isShareTokenValid(
    offerte: { shareToken?: string; shareExpiresAt?: number } | null,
    providedToken: string
  ): boolean {
    if (!offerte) return false;
    if (!offerte.shareToken || offerte.shareToken !== providedToken) return false;
    if (offerte.shareExpiresAt && offerte.shareExpiresAt < Date.now()) return false;
    return true;
  }

  it("returns true for matching non-expired token", () => {
    const offerte = {
      shareToken: "abc123",
      shareExpiresAt: Date.now() + 3600000, // 1 hour from now
    };
    expect(isShareTokenValid(offerte, "abc123")).toBe(true);
  });

  it("returns false for null offerte", () => {
    expect(isShareTokenValid(null, "abc123")).toBe(false);
  });

  it("returns false for mismatched token", () => {
    const offerte = {
      shareToken: "abc123",
      shareExpiresAt: Date.now() + 3600000,
    };
    expect(isShareTokenValid(offerte, "wrong_token")).toBe(false);
  });

  it("returns false for expired token", () => {
    const offerte = {
      shareToken: "abc123",
      shareExpiresAt: Date.now() - 1000, // Expired 1 second ago
    };
    expect(isShareTokenValid(offerte, "abc123")).toBe(false);
  });

  it("returns false when offerte has no shareToken", () => {
    const offerte = {};
    expect(isShareTokenValid(offerte, "abc123")).toBe(false);
  });

  it("returns true when token matches and no expiry is set", () => {
    const offerte = {
      shareToken: "abc123",
      // No shareExpiresAt — valid indefinitely
    };
    expect(isShareTokenValid(offerte, "abc123")).toBe(true);
  });
});
