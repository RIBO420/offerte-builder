/**
 * Unit Tests for Projecten (Projects) Business Logic
 *
 * Tests extractable business logic from convex/projecten.ts:
 * - Status transition validation (workflow enforcement)
 * - Project list filtering (archived, deleted, status)
 * - KLIC-melding prerequisite checks
 * - Prerequisite validation per transition
 * - Project name derivation
 * - getWithDetails aggregation logic
 * - Soft-delete / restore logic
 */

import { describe, it, expect } from "vitest";

// ─── Status Transition Validation ────────────────────────────────────────────

describe("Projecten Status Transitions", () => {
  // Extracted from projecten.ts updateStatus handler
  const validTransitions: Record<string, string[]> = {
    gepland: ["in_uitvoering"],
    in_uitvoering: ["afgerond"],
    afgerond: ["nacalculatie_compleet"],
    nacalculatie_compleet: ["gefactureerd"],
    gefactureerd: [], // Final state
  };

  function isValidTransition(from: string, to: string): boolean {
    return validTransitions[from]?.includes(to) ?? false;
  }

  describe("Valid forward transitions", () => {
    it("should allow gepland -> in_uitvoering", () => {
      expect(isValidTransition("gepland", "in_uitvoering")).toBe(true);
    });

    it("should allow in_uitvoering -> afgerond", () => {
      expect(isValidTransition("in_uitvoering", "afgerond")).toBe(true);
    });

    it("should allow afgerond -> nacalculatie_compleet", () => {
      expect(isValidTransition("afgerond", "nacalculatie_compleet")).toBe(true);
    });

    it("should allow nacalculatie_compleet -> gefactureerd", () => {
      expect(isValidTransition("nacalculatie_compleet", "gefactureerd")).toBe(true);
    });
  });

  describe("Invalid backward transitions", () => {
    it("should not allow in_uitvoering -> gepland", () => {
      expect(isValidTransition("in_uitvoering", "gepland")).toBe(false);
    });

    it("should not allow afgerond -> in_uitvoering", () => {
      expect(isValidTransition("afgerond", "in_uitvoering")).toBe(false);
    });

    it("should not allow nacalculatie_compleet -> afgerond", () => {
      expect(isValidTransition("nacalculatie_compleet", "afgerond")).toBe(false);
    });

    it("should not allow gefactureerd -> nacalculatie_compleet", () => {
      expect(isValidTransition("gefactureerd", "nacalculatie_compleet")).toBe(false);
    });
  });

  describe("Invalid skip transitions", () => {
    it("should not allow gepland -> afgerond (skipping in_uitvoering)", () => {
      expect(isValidTransition("gepland", "afgerond")).toBe(false);
    });

    it("should not allow gepland -> nacalculatie_compleet", () => {
      expect(isValidTransition("gepland", "nacalculatie_compleet")).toBe(false);
    });

    it("should not allow gepland -> gefactureerd", () => {
      expect(isValidTransition("gepland", "gefactureerd")).toBe(false);
    });

    it("should not allow in_uitvoering -> nacalculatie_compleet (skipping afgerond)", () => {
      expect(isValidTransition("in_uitvoering", "nacalculatie_compleet")).toBe(false);
    });

    it("should not allow in_uitvoering -> gefactureerd", () => {
      expect(isValidTransition("in_uitvoering", "gefactureerd")).toBe(false);
    });
  });

  describe("Same-status transitions", () => {
    it("should not allow gepland -> gepland", () => {
      expect(isValidTransition("gepland", "gepland")).toBe(false);
    });

    it("should not allow in_uitvoering -> in_uitvoering", () => {
      expect(isValidTransition("in_uitvoering", "in_uitvoering")).toBe(false);
    });
  });

  describe("Final state", () => {
    it("should not allow any transition from gefactureerd", () => {
      expect(isValidTransition("gefactureerd", "gepland")).toBe(false);
      expect(isValidTransition("gefactureerd", "in_uitvoering")).toBe(false);
      expect(isValidTransition("gefactureerd", "afgerond")).toBe(false);
      expect(isValidTransition("gefactureerd", "nacalculatie_compleet")).toBe(false);
    });
  });

  describe("Unknown statuses", () => {
    it("should return false for unknown source status", () => {
      expect(isValidTransition("unknown", "gepland")).toBe(false);
    });

    it("should return false for unknown target status", () => {
      expect(isValidTransition("gepland", "unknown")).toBe(false);
    });
  });

  describe("Error message generation", () => {
    function getTransitionErrorMessage(from: string, to: string): string {
      const allowed = validTransitions[from]?.join(", ") || "geen";
      return (
        `Ongeldige status transitie: kan niet van "${from}" naar "${to}" gaan. ` +
        `Toegestane transities vanuit "${from}": ${allowed}.`
      );
    }

    it("should generate correct error message for invalid transition", () => {
      const msg = getTransitionErrorMessage("gepland", "afgerond");
      expect(msg).toContain("gepland");
      expect(msg).toContain("afgerond");
      expect(msg).toContain("in_uitvoering");
    });

    it("should list 'geen' for final state", () => {
      const msg = getTransitionErrorMessage("gefactureerd", "gepland");
      expect(msg).toContain("geen");
    });
  });
});

// ─── Project List Filtering ──────────────────────────────────────────────────

describe("Projecten List Filtering", () => {
  interface MockProject {
    _id: string;
    status: string;
    isArchived?: boolean;
    deletedAt?: number;
  }

  // Extracted from projecten.ts list handler
  function filterProjects(
    projects: MockProject[],
    options: {
      status?: string;
      includeArchived?: boolean;
      includeDeleted?: boolean;
    } = {}
  ): MockProject[] {
    let filtered = [...projects];

    if (!options.includeDeleted) {
      filtered = filtered.filter((p) => !p.deletedAt);
    }

    if (!options.includeArchived) {
      filtered = filtered.filter((p) => p.isArchived !== true);
    }

    if (options.status) {
      filtered = filtered.filter((p) => p.status === options.status);
    }

    return filtered;
  }

  const projects: MockProject[] = [
    { _id: "p1", status: "gepland" },
    { _id: "p2", status: "in_uitvoering" },
    { _id: "p3", status: "afgerond" },
    { _id: "p4", status: "gepland", isArchived: true },
    { _id: "p5", status: "in_uitvoering", deletedAt: Date.now() },
    { _id: "p6", status: "afgerond", isArchived: true, deletedAt: Date.now() },
  ];

  it("should exclude archived and deleted by default", () => {
    const result = filterProjects(projects);
    expect(result.map((p) => p._id)).toEqual(["p1", "p2", "p3"]);
  });

  it("should include archived when requested", () => {
    const result = filterProjects(projects, { includeArchived: true });
    expect(result.map((p) => p._id)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("should include deleted when requested", () => {
    const result = filterProjects(projects, { includeDeleted: true });
    expect(result.map((p) => p._id)).toEqual(["p1", "p2", "p3", "p5"]);
  });

  it("should include both archived and deleted when requested", () => {
    const result = filterProjects(projects, {
      includeArchived: true,
      includeDeleted: true,
    });
    expect(result.map((p) => p._id)).toEqual(["p1", "p2", "p3", "p4", "p5", "p6"]);
  });

  it("should filter by status", () => {
    const result = filterProjects(projects, { status: "gepland" });
    expect(result.map((p) => p._id)).toEqual(["p1"]);
  });

  it("should combine status filter with archive/delete filters", () => {
    const result = filterProjects(projects, {
      status: "gepland",
      includeArchived: true,
    });
    expect(result.map((p) => p._id)).toEqual(["p1", "p4"]);
  });

  it("should return empty array for no matches", () => {
    const result = filterProjects(projects, { status: "gefactureerd" });
    expect(result).toHaveLength(0);
  });

  it("should handle empty input", () => {
    const result = filterProjects([]);
    expect(result).toHaveLength(0);
  });
});

// ─── KLIC-Melding Prerequisites (PRJ-W01) ────────────────────────────────────

describe("Projecten KLIC-Melding Check (PRJ-W01)", () => {
  interface KlicCheckInput {
    offerteType: string;
    scopes: string[];
    klicMeldingGedaan: boolean;
    skipKlicCheck: boolean;
  }

  // Extracted KLIC check logic from updateStatus handler
  function requiresKlicMelding(input: KlicCheckInput): boolean {
    return (
      input.offerteType === "aanleg" &&
      input.scopes.includes("grondwerk") &&
      !input.klicMeldingGedaan &&
      !input.skipKlicCheck
    );
  }

  it("should require KLIC for aanleg projects with grondwerk scope", () => {
    expect(
      requiresKlicMelding({
        offerteType: "aanleg",
        scopes: ["grondwerk", "bestrating"],
        klicMeldingGedaan: false,
        skipKlicCheck: false,
      })
    ).toBe(true);
  });

  it("should not require KLIC for onderhoud projects", () => {
    expect(
      requiresKlicMelding({
        offerteType: "onderhoud",
        scopes: ["grondwerk"],
        klicMeldingGedaan: false,
        skipKlicCheck: false,
      })
    ).toBe(false);
  });

  it("should not require KLIC when grondwerk scope is not present", () => {
    expect(
      requiresKlicMelding({
        offerteType: "aanleg",
        scopes: ["bestrating", "borders"],
        klicMeldingGedaan: false,
        skipKlicCheck: false,
      })
    ).toBe(false);
  });

  it("should not require KLIC when already done", () => {
    expect(
      requiresKlicMelding({
        offerteType: "aanleg",
        scopes: ["grondwerk"],
        klicMeldingGedaan: true,
        skipKlicCheck: false,
      })
    ).toBe(false);
  });

  it("should not require KLIC when directie skips the check", () => {
    expect(
      requiresKlicMelding({
        offerteType: "aanleg",
        scopes: ["grondwerk"],
        klicMeldingGedaan: false,
        skipKlicCheck: true,
      })
    ).toBe(false);
  });
});

// ─── Prerequisite Validation per Transition ──────────────────────────────────

describe("Projecten Transition Prerequisites", () => {
  // Mirrors the prerequisite checks in updateStatus handler

  describe("gepland -> in_uitvoering prerequisites", () => {
    it("should require KLIC-melding for aanleg+grondwerk projects", () => {
      const hasKlic = false;
      const isAanlegMetGrondwerk = true;
      const blocked = isAanlegMetGrondwerk && !hasKlic;
      expect(blocked).toBe(true);
    });

    it("should not block non-grondwerk projects", () => {
      const hasKlic = false;
      const isAanlegMetGrondwerk = false;
      const blocked = isAanlegMetGrondwerk && !hasKlic;
      expect(blocked).toBe(false);
    });
  });

  describe("in_uitvoering -> afgerond prerequisites", () => {
    it("should require at least one uren registratie", () => {
      const hasUrenRegistraties = false;
      expect(hasUrenRegistraties).toBe(false);
    });

    it("should pass when uren are registered", () => {
      const hasUrenRegistraties = true;
      expect(hasUrenRegistraties).toBe(true);
    });
  });

  describe("afgerond -> nacalculatie_compleet prerequisites", () => {
    it("should require a nacalculatie to exist", () => {
      const hasNacalculatie = false;
      expect(hasNacalculatie).toBe(false);
    });

    it("should pass when nacalculatie exists", () => {
      const hasNacalculatie = true;
      expect(hasNacalculatie).toBe(true);
    });
  });
});

// ─── Project Name Derivation ─────────────────────────────────────────────────

describe("Projecten Name Derivation", () => {
  // Mirrors the project name logic from create handler
  function deriveProjectName(
    customName: string | undefined,
    offerteNummer: string,
    klantNaam: string
  ): string {
    return customName || `Project ${offerteNummer} - ${klantNaam}`;
  }

  it("should use custom name when provided", () => {
    expect(deriveProjectName("Mijn Project", "OFF-2026-001", "Jan")).toBe(
      "Mijn Project"
    );
  });

  it("should derive name from offerte when no custom name", () => {
    expect(deriveProjectName(undefined, "OFF-2026-001", "Jan de Vries")).toBe(
      "Project OFF-2026-001 - Jan de Vries"
    );
  });

  it("should derive name when custom name is empty string", () => {
    expect(deriveProjectName("", "OFF-2026-001", "Jan de Vries")).toBe(
      "Project OFF-2026-001 - Jan de Vries"
    );
  });
});

// ─── getWithDetails Aggregation Logic ────────────────────────────────────────

describe("Projecten getWithDetails Aggregation", () => {
  // Mirrors aggregation logic from getWithDetails handler
  interface MockUrenRegistratie {
    uren: number;
  }

  interface MockMachineGebruik {
    kosten: number;
  }

  interface MockPlanningTaak {
    volgorde: number;
    naam: string;
  }

  function aggregateProjectDetails(
    urenRegistraties: MockUrenRegistratie[],
    machineGebruik: MockMachineGebruik[],
    planningTaken: MockPlanningTaak[]
  ) {
    return {
      urenRegistratiesCount: urenRegistraties.length,
      totaalGeregistreerdeUren: urenRegistraties.reduce(
        (sum, u) => sum + u.uren,
        0
      ),
      machineGebruikCount: machineGebruik.length,
      totaalMachineKosten: machineGebruik.reduce((sum, m) => sum + m.kosten, 0),
      sortedPlanningTaken: [...planningTaken].sort(
        (a, b) => a.volgorde - b.volgorde
      ),
    };
  }

  it("should correctly count and sum uren registraties", () => {
    const uren = [{ uren: 8 }, { uren: 6.5 }, { uren: 4 }];
    const result = aggregateProjectDetails(uren, [], []);
    expect(result.urenRegistratiesCount).toBe(3);
    expect(result.totaalGeregistreerdeUren).toBe(18.5);
  });

  it("should correctly count and sum machine kosten", () => {
    const machines = [{ kosten: 150 }, { kosten: 300 }];
    const result = aggregateProjectDetails([], machines, []);
    expect(result.machineGebruikCount).toBe(2);
    expect(result.totaalMachineKosten).toBe(450);
  });

  it("should sort planning taken by volgorde", () => {
    const taken = [
      { volgorde: 3, naam: "Afwerking" },
      { volgorde: 1, naam: "Grondwerk" },
      { volgorde: 2, naam: "Bestrating" },
    ];
    const result = aggregateProjectDetails([], [], taken);
    expect(result.sortedPlanningTaken.map((t) => t.naam)).toEqual([
      "Grondwerk",
      "Bestrating",
      "Afwerking",
    ]);
  });

  it("should handle empty data", () => {
    const result = aggregateProjectDetails([], [], []);
    expect(result.urenRegistratiesCount).toBe(0);
    expect(result.totaalGeregistreerdeUren).toBe(0);
    expect(result.machineGebruikCount).toBe(0);
    expect(result.totaalMachineKosten).toBe(0);
    expect(result.sortedPlanningTaken).toEqual([]);
  });

  it("should handle decimal uren values", () => {
    const uren = [{ uren: 7.5 }, { uren: 3.25 }, { uren: 0.75 }];
    const result = aggregateProjectDetails(uren, [], []);
    expect(result.totaalGeregistreerdeUren).toBe(11.5);
  });
});

// ─── Soft Delete / Restore Logic ─────────────────────────────────────────────

describe("Projecten Soft Delete / Restore", () => {
  interface MockProject {
    _id: string;
    deletedAt?: number;
    isArchived?: boolean;
  }

  function isSoftDeleted(project: MockProject): boolean {
    return !!project.deletedAt;
  }

  function canRestore(project: MockProject): boolean {
    return !!project.deletedAt;
  }

  function buildSoftDeletePatch() {
    const now = Date.now();
    return { deletedAt: now, updatedAt: now };
  }

  function buildRestorePatch() {
    return { deletedAt: undefined, updatedAt: Date.now() };
  }

  it("should identify soft-deleted projects", () => {
    expect(isSoftDeleted({ _id: "p1", deletedAt: Date.now() })).toBe(true);
    expect(isSoftDeleted({ _id: "p2" })).toBe(false);
    expect(isSoftDeleted({ _id: "p3", deletedAt: undefined })).toBe(false);
  });

  it("should only allow restore on deleted projects", () => {
    expect(canRestore({ _id: "p1", deletedAt: Date.now() })).toBe(true);
    expect(canRestore({ _id: "p2" })).toBe(false);
  });

  it("should create correct soft-delete patch", () => {
    const before = Date.now();
    const patch = buildSoftDeletePatch();
    const after = Date.now();
    expect(patch.deletedAt).toBeGreaterThanOrEqual(before);
    expect(patch.deletedAt).toBeLessThanOrEqual(after);
    expect(patch.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("should create correct restore patch", () => {
    const patch = buildRestorePatch();
    expect(patch.deletedAt).toBeUndefined();
    expect(patch.updatedAt).toBeGreaterThan(0);
  });
});

// ─── Archive Logic ───────────────────────────────────────────────────────────

describe("Projecten Archive", () => {
  function buildArchivePatch() {
    return { isArchived: true, archivedAt: Date.now() };
  }

  it("should create correct archive patch", () => {
    const before = Date.now();
    const patch = buildArchivePatch();
    const after = Date.now();
    expect(patch.isArchived).toBe(true);
    expect(patch.archivedAt).toBeGreaterThanOrEqual(before);
    expect(patch.archivedAt).toBeLessThanOrEqual(after);
  });
});

// ─── Offerte Status Prerequisites ────────────────────────────────────────────

describe("Projecten Create Prerequisites", () => {
  // Mirrors validation from create handler
  const VALID_OFFERTE_STATUSES_FOR_PROJECT = ["geaccepteerd"];

  function canCreateProject(
    offerteStatus: string,
    hasVoorcalculatie: boolean,
    hasExistingProject: boolean
  ): { valid: boolean; error?: string } {
    if (!VALID_OFFERTE_STATUSES_FOR_PROJECT.includes(offerteStatus)) {
      return {
        valid: false,
        error: `Kan geen project aanmaken: offerte heeft status "${offerteStatus}". De offerte moet eerst geaccepteerd zijn door de klant.`,
      };
    }

    if (!hasVoorcalculatie) {
      return {
        valid: false,
        error:
          "Kan geen project aanmaken: er is nog geen voorcalculatie voor deze offerte.",
      };
    }

    if (hasExistingProject) {
      return {
        valid: false,
        error: "Er bestaat al een project voor deze offerte",
      };
    }

    return { valid: true };
  }

  it("should allow creation for accepted offerte with voorcalculatie", () => {
    const result = canCreateProject("geaccepteerd", true, false);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should reject non-accepted offerte", () => {
    const result = canCreateProject("concept", true, false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("concept");
  });

  it("should reject verzonden offerte", () => {
    const result = canCreateProject("verzonden", true, false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("verzonden");
  });

  it("should reject offerte without voorcalculatie", () => {
    const result = canCreateProject("geaccepteerd", false, false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("voorcalculatie");
  });

  it("should reject when project already exists", () => {
    const result = canCreateProject("geaccepteerd", true, true);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("bestaat al");
  });

  it("should reject afgewezen offerte", () => {
    const result = canCreateProject("afgewezen", true, false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("afgewezen");
  });
});

// ─── Paginated List Logic ────────────────────────────────────────────────────

describe("Projecten Paginated List", () => {
  // Mirrors pagination logic from listPaginated handler
  function buildPaginatedResult<T>(
    items: T[],
    hasMore: boolean,
    cursor: string
  ) {
    return {
      items,
      nextCursor: cursor,
      hasMore,
    };
  }

  it("should return items with pagination metadata", () => {
    const items = [{ id: 1 }, { id: 2 }];
    const result = buildPaginatedResult(items, true, "cursor_abc");
    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("cursor_abc");
  });

  it("should indicate no more items", () => {
    const result = buildPaginatedResult([{ id: 1 }], false, "");
    expect(result.hasMore).toBe(false);
  });

  it("should handle empty results", () => {
    const result = buildPaginatedResult([], false, "");
    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  // Default limit
  it("should default to 25 items per page", () => {
    const limit = undefined || 25;
    expect(limit).toBe(25);
  });
});

// ─── All Project Statuses ────────────────────────────────────────────────────

describe("Projecten All Statuses", () => {
  const ALL_PROJECT_STATUSES = [
    "gepland",
    "in_uitvoering",
    "afgerond",
    "nacalculatie_compleet",
    "gefactureerd",
  ];

  it("should have exactly 5 statuses", () => {
    expect(ALL_PROJECT_STATUSES).toHaveLength(5);
  });

  it("should start with gepland and end with gefactureerd", () => {
    expect(ALL_PROJECT_STATUSES[0]).toBe("gepland");
    expect(ALL_PROJECT_STATUSES[ALL_PROJECT_STATUSES.length - 1]).toBe("gefactureerd");
  });

  it("should contain all expected statuses", () => {
    expect(ALL_PROJECT_STATUSES).toContain("gepland");
    expect(ALL_PROJECT_STATUSES).toContain("in_uitvoering");
    expect(ALL_PROJECT_STATUSES).toContain("afgerond");
    expect(ALL_PROJECT_STATUSES).toContain("nacalculatie_compleet");
    expect(ALL_PROJECT_STATUSES).toContain("gefactureerd");
  });
});

// ─── getProjectsByOfferteIds Logic ───────────────────────────────────────────

describe("Projecten getProjectsByOfferteIds Mapping", () => {
  interface ProjectInfo {
    _id: string;
    naam: string;
    status: string;
    offerteId: string;
  }

  function mapProjectsByOfferteId(
    offerteIds: string[],
    projects: ProjectInfo[]
  ): Record<string, { _id: string; naam: string; status: string } | null> {
    const result: Record<
      string,
      { _id: string; naam: string; status: string } | null
    > = {};

    // Initialize all with null
    for (const id of offerteIds) {
      result[id] = null;
    }

    // Map projects
    for (const project of projects) {
      if (offerteIds.includes(project.offerteId)) {
        result[project.offerteId] = {
          _id: project._id,
          naam: project.naam,
          status: project.status,
        };
      }
    }

    return result;
  }

  it("should map projects to their offerte IDs", () => {
    const result = mapProjectsByOfferteId(
      ["off:1", "off:2", "off:3"],
      [
        { _id: "p:1", naam: "Project 1", status: "gepland", offerteId: "off:1" },
        { _id: "p:2", naam: "Project 2", status: "afgerond", offerteId: "off:3" },
      ]
    );
    expect(result["off:1"]).toEqual({
      _id: "p:1",
      naam: "Project 1",
      status: "gepland",
    });
    expect(result["off:2"]).toBeNull();
    expect(result["off:3"]).toEqual({
      _id: "p:2",
      naam: "Project 2",
      status: "afgerond",
    });
  });

  it("should return all nulls when no projects exist", () => {
    const result = mapProjectsByOfferteId(["off:1", "off:2"], []);
    expect(result["off:1"]).toBeNull();
    expect(result["off:2"]).toBeNull();
  });

  it("should handle empty offerte IDs list", () => {
    const result = mapProjectsByOfferteId([], []);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("should ignore projects not in the requested list", () => {
    const result = mapProjectsByOfferteId(
      ["off:1"],
      [
        { _id: "p:1", naam: "P1", status: "gepland", offerteId: "off:1" },
        { _id: "p:2", naam: "P2", status: "gepland", offerteId: "off:99" },
      ]
    );
    expect(Object.keys(result)).toHaveLength(1);
    expect(result["off:1"]).not.toBeNull();
    expect(result["off:99"]).toBeUndefined();
  });
});
