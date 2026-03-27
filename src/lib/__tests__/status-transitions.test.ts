import { describe, it, expect } from "vitest";
import {
  validTransitions,
  isValidTransition,
  getValidNextStatuses,
  isOfferteStatus,
  OFFERTE_STATUSES,
  type OfferteStatus,
} from "@/lib/status-transitions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Every (from, to) pair that MUST be accepted. */
const VALID_PAIRS: [OfferteStatus, OfferteStatus][] = [
  ["concept", "voorcalculatie"],
  ["voorcalculatie", "concept"],
  ["voorcalculatie", "verzonden"],
  ["verzonden", "voorcalculatie"],
  ["verzonden", "geaccepteerd"],
  ["verzonden", "afgewezen"],
  ["geaccepteerd", "verzonden"],
  ["afgewezen", "verzonden"],
];

/** A selection of (from, to) pairs that MUST be rejected. */
const INVALID_PAIRS: [OfferteStatus, OfferteStatus][] = [
  // Skip-ahead transitions
  ["concept", "verzonden"],
  ["concept", "geaccepteerd"],
  ["concept", "afgewezen"],
  ["voorcalculatie", "geaccepteerd"],
  ["voorcalculatie", "afgewezen"],
  // Terminal → non-adjacent backwards
  ["geaccepteerd", "concept"],
  ["geaccepteerd", "voorcalculatie"],
  ["afgewezen", "concept"],
  ["afgewezen", "voorcalculatie"],
  ["afgewezen", "geaccepteerd"],
  ["geaccepteerd", "afgewezen"],
  // Self-transitions (no status should transition to itself)
  ["concept", "concept"],
  ["voorcalculatie", "voorcalculatie"],
  ["verzonden", "verzonden"],
  ["geaccepteerd", "geaccepteerd"],
  ["afgewezen", "afgewezen"],
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Offerte Status Transitions", () => {
  // -----------------------------------------------------------------------
  // validTransitions map
  // -----------------------------------------------------------------------
  describe("validTransitions map", () => {
    it("has an entry for every known status", () => {
      for (const status of OFFERTE_STATUSES) {
        expect(validTransitions).toHaveProperty(status);
        expect(Array.isArray(validTransitions[status])).toBe(true);
      }
    });

    it("only references known statuses as targets", () => {
      for (const targets of Object.values(validTransitions)) {
        for (const target of targets) {
          expect(OFFERTE_STATUSES).toContain(target);
        }
      }
    });

    it("does not contain duplicate targets", () => {
      for (const [status, targets] of Object.entries(validTransitions)) {
        const unique = new Set(targets);
        expect(unique.size).toBe(
          targets.length,
          // hint if it fails:
        );
      }
    });

    it("matches the expected transition counts", () => {
      expect(validTransitions.concept).toHaveLength(1);
      expect(validTransitions.voorcalculatie).toHaveLength(2);
      expect(validTransitions.verzonden).toHaveLength(3);
      expect(validTransitions.geaccepteerd).toHaveLength(1);
      expect(validTransitions.afgewezen).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // isValidTransition
  // -----------------------------------------------------------------------
  describe("isValidTransition", () => {
    describe("valid transitions", () => {
      it.each(VALID_PAIRS)(
        "%s -> %s should be valid",
        (from, to) => {
          expect(isValidTransition(from, to)).toBe(true);
        },
      );
    });

    describe("invalid transitions", () => {
      it.each(INVALID_PAIRS)(
        "%s -> %s should be invalid",
        (from, to) => {
          expect(isValidTransition(from, to)).toBe(false);
        },
      );
    });

    describe("specific workflow paths", () => {
      it("allows the full happy-path: concept -> voorcalculatie -> verzonden -> geaccepteerd", () => {
        expect(isValidTransition("concept", "voorcalculatie")).toBe(true);
        expect(isValidTransition("voorcalculatie", "verzonden")).toBe(true);
        expect(isValidTransition("verzonden", "geaccepteerd")).toBe(true);
      });

      it("allows the rejection path: concept -> voorcalculatie -> verzonden -> afgewezen", () => {
        expect(isValidTransition("concept", "voorcalculatie")).toBe(true);
        expect(isValidTransition("voorcalculatie", "verzonden")).toBe(true);
        expect(isValidTransition("verzonden", "afgewezen")).toBe(true);
      });

      it("allows rolling back from verzonden to voorcalculatie", () => {
        expect(isValidTransition("verzonden", "voorcalculatie")).toBe(true);
      });

      it("allows rolling back from voorcalculatie to concept", () => {
        expect(isValidTransition("voorcalculatie", "concept")).toBe(true);
      });

      it("allows re-sending after acceptance (geaccepteerd -> verzonden)", () => {
        expect(isValidTransition("geaccepteerd", "verzonden")).toBe(true);
      });

      it("allows re-sending after rejection (afgewezen -> verzonden)", () => {
        expect(isValidTransition("afgewezen", "verzonden")).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("returns false for null from-status", () => {
        expect(isValidTransition(null, "concept")).toBe(false);
      });

      it("returns false for null to-status", () => {
        expect(isValidTransition("concept", null)).toBe(false);
      });

      it("returns false for undefined from-status", () => {
        expect(isValidTransition(undefined, "concept")).toBe(false);
      });

      it("returns false for undefined to-status", () => {
        expect(isValidTransition("concept", undefined)).toBe(false);
      });

      it("returns false when both are null", () => {
        expect(isValidTransition(null, null)).toBe(false);
      });

      it("returns false when both are undefined", () => {
        expect(isValidTransition(undefined, undefined)).toBe(false);
      });

      it("returns false for empty string from-status", () => {
        expect(isValidTransition("", "concept")).toBe(false);
      });

      it("returns false for empty string to-status", () => {
        expect(isValidTransition("concept", "")).toBe(false);
      });

      it("returns false for unknown from-status", () => {
        expect(isValidTransition("onbekend", "concept")).toBe(false);
      });

      it("returns false for unknown to-status", () => {
        expect(isValidTransition("concept", "onbekend")).toBe(false);
      });

      it("is case-sensitive (rejects uppercase variants)", () => {
        expect(isValidTransition("Concept", "voorcalculatie")).toBe(false);
        expect(isValidTransition("concept", "Voorcalculatie")).toBe(false);
        expect(isValidTransition("CONCEPT", "VOORCALCULATIE")).toBe(false);
      });

      it("returns false for the deprecated 'definitief' status", () => {
        expect(isValidTransition("definitief", "verzonden")).toBe(false);
        expect(isValidTransition("concept", "definitief")).toBe(false);
      });
    });
  });

  // -----------------------------------------------------------------------
  // getValidNextStatuses
  // -----------------------------------------------------------------------
  describe("getValidNextStatuses", () => {
    it("returns ['voorcalculatie'] for concept", () => {
      expect(getValidNextStatuses("concept")).toEqual(["voorcalculatie"]);
    });

    it("returns ['concept', 'verzonden'] for voorcalculatie", () => {
      expect(getValidNextStatuses("voorcalculatie")).toEqual(["concept", "verzonden"]);
    });

    it("returns ['voorcalculatie', 'geaccepteerd', 'afgewezen'] for verzonden", () => {
      expect(getValidNextStatuses("verzonden")).toEqual([
        "voorcalculatie",
        "geaccepteerd",
        "afgewezen",
      ]);
    });

    it("returns ['verzonden'] for geaccepteerd", () => {
      expect(getValidNextStatuses("geaccepteerd")).toEqual(["verzonden"]);
    });

    it("returns ['verzonden'] for afgewezen", () => {
      expect(getValidNextStatuses("afgewezen")).toEqual(["verzonden"]);
    });

    it("returns empty array for unknown status", () => {
      expect(getValidNextStatuses("onbekend")).toEqual([]);
    });

    it("returns empty array for empty string", () => {
      expect(getValidNextStatuses("")).toEqual([]);
    });

    it("returns empty array for null", () => {
      expect(getValidNextStatuses(null)).toEqual([]);
    });

    it("returns empty array for undefined", () => {
      expect(getValidNextStatuses(undefined)).toEqual([]);
    });

    it("returns empty array for deprecated 'definitief' status", () => {
      expect(getValidNextStatuses("definitief")).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // isOfferteStatus
  // -----------------------------------------------------------------------
  describe("isOfferteStatus", () => {
    it.each(OFFERTE_STATUSES)("recognizes '%s' as a valid status", (status) => {
      expect(isOfferteStatus(status)).toBe(true);
    });

    it("rejects the deprecated 'definitief' status", () => {
      expect(isOfferteStatus("definitief")).toBe(false);
    });

    it("rejects unknown strings", () => {
      expect(isOfferteStatus("onbekend")).toBe(false);
      expect(isOfferteStatus("pending")).toBe(false);
    });

    it("rejects empty string", () => {
      expect(isOfferteStatus("")).toBe(false);
    });

    it("rejects null", () => {
      expect(isOfferteStatus(null)).toBe(false);
    });

    it("rejects undefined", () => {
      expect(isOfferteStatus(undefined)).toBe(false);
    });

    it("rejects numbers", () => {
      expect(isOfferteStatus(0)).toBe(false);
      expect(isOfferteStatus(42)).toBe(false);
    });

    it("rejects booleans", () => {
      expect(isOfferteStatus(true)).toBe(false);
      expect(isOfferteStatus(false)).toBe(false);
    });

    it("rejects objects", () => {
      expect(isOfferteStatus({})).toBe(false);
      expect(isOfferteStatus({ status: "concept" })).toBe(false);
    });

    it("is case-sensitive", () => {
      expect(isOfferteStatus("Concept")).toBe(false);
      expect(isOfferteStatus("VERZONDEN")).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // OFFERTE_STATUSES constant
  // -----------------------------------------------------------------------
  describe("OFFERTE_STATUSES", () => {
    it("contains exactly 5 statuses", () => {
      expect(OFFERTE_STATUSES).toHaveLength(5);
    });

    it("contains all expected statuses in workflow order", () => {
      expect(OFFERTE_STATUSES).toEqual([
        "concept",
        "voorcalculatie",
        "verzonden",
        "geaccepteerd",
        "afgewezen",
      ]);
    });

    it("does not include deprecated 'definitief'", () => {
      expect(OFFERTE_STATUSES).not.toContain("definitief");
    });
  });

  // -----------------------------------------------------------------------
  // State machine integrity
  // -----------------------------------------------------------------------
  describe("state machine integrity", () => {
    it("concept is the only entry point (no status transitions TO concept except from voorcalculatie)", () => {
      const statusesThatCanReachConcept = OFFERTE_STATUSES.filter((s) =>
        validTransitions[s].includes("concept"),
      );
      expect(statusesThatCanReachConcept).toEqual(["voorcalculatie"]);
    });

    it("geaccepteerd and afgewezen are reachable only from verzonden", () => {
      const canReachGeaccepteerd = OFFERTE_STATUSES.filter((s) =>
        validTransitions[s].includes("geaccepteerd"),
      );
      const canReachAfgewezen = OFFERTE_STATUSES.filter((s) =>
        validTransitions[s].includes("afgewezen"),
      );
      expect(canReachGeaccepteerd).toEqual(["verzonden"]);
      expect(canReachAfgewezen).toEqual(["verzonden"]);
    });

    it("every status has at least one outgoing transition (no dead ends)", () => {
      for (const status of OFFERTE_STATUSES) {
        expect(validTransitions[status].length).toBeGreaterThan(0);
      }
    });

    it("every status except concept is reachable from at least one other status", () => {
      for (const status of OFFERTE_STATUSES) {
        if (status === "concept") continue; // concept is the initial state
        const reachableFrom = OFFERTE_STATUSES.filter((s) =>
          validTransitions[s].includes(status),
        );
        expect(reachableFrom.length).toBeGreaterThan(0);
      }
    });

    it("no self-transitions exist", () => {
      for (const status of OFFERTE_STATUSES) {
        expect(validTransitions[status]).not.toContain(status);
      }
    });
  });
});
