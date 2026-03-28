import { describe, it, expect } from "vitest";
import {
  projectKostenSchema,
  projectKostenCreateSchema,
  projectKostenTypeEnum,
} from "@/lib/validations/project-kosten";
import type {
  ProjectKostenType,
  ProjectKostenFormData,
  ProjectKostenCreateFormData,
} from "@/lib/validations/project-kosten";
import { validateData } from "@/lib/validations";

// ============================================================
// ProjectKostenTypeEnum — all cost categories
// ============================================================
describe("projectKostenTypeEnum — cost category completeness", () => {
  const allTypes: ProjectKostenType[] = [
    "materiaal",
    "arbeid",
    "transport",
    "huur",
    "onderaannemer",
    "overig",
  ];

  it("accepts all 6 cost types", () => {
    for (const type of allTypes) {
      const result = projectKostenTypeEnum.safeParse(type);
      expect(result.success).toBe(true);
    }
  });

  it("rejects unknown cost types", () => {
    const invalidTypes = ["machines", "inkoop", "personeel", ""];
    for (const type of invalidTypes) {
      const result = projectKostenTypeEnum.safeParse(type);
      expect(result.success).toBe(false);
    }
  });

  it("is case-sensitive", () => {
    const result = projectKostenTypeEnum.safeParse("Materiaal");
    expect(result.success).toBe(false);
  });
});

// ============================================================
// ProjectKostenSchema — main validation
// ============================================================
describe("projectKostenSchema — cost entry validation", () => {
  const validKosten = {
    projectId: "project_123",
    datum: new Date("2024-06-15"),
    type: "materiaal" as const,
    omschrijving: "Tegels 30x30",
    bedrag: 450.0,
  };

  it("accepts valid project kosten with Date datum", () => {
    const result = projectKostenSchema.safeParse(validKosten);
    expect(result.success).toBe(true);
  });

  it("accepts valid project kosten with string datum", () => {
    const result = projectKostenSchema.safeParse({
      ...validKosten,
      datum: "2024-06-15",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty projectId", () => {
    const result = projectKostenSchema.safeParse({
      ...validKosten,
      projectId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty omschrijving", () => {
    const result = projectKostenSchema.safeParse({
      ...validKosten,
      omschrijving: "",
    });
    expect(result.success).toBe(false);
  });

  // ---- Bedrag edge cases ----
  describe("bedrag validation", () => {
    it("rejects bedrag of 0", () => {
      const result = projectKostenSchema.safeParse({
        ...validKosten,
        bedrag: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative bedrag", () => {
      const result = projectKostenSchema.safeParse({
        ...validKosten,
        bedrag: -100,
      });
      expect(result.success).toBe(false);
    });

    it("accepts minimal bedrag of 0.01", () => {
      const result = projectKostenSchema.safeParse({
        ...validKosten,
        bedrag: 0.01,
      });
      expect(result.success).toBe(true);
    });

    it("accepts large bedrag values", () => {
      const result = projectKostenSchema.safeParse({
        ...validKosten,
        bedrag: 999999.99,
      });
      expect(result.success).toBe(true);
    });

    it("rejects bedrag just below minimum (0.009)", () => {
      const result = projectKostenSchema.safeParse({
        ...validKosten,
        bedrag: 0.009,
      });
      expect(result.success).toBe(false);
    });
  });

  // ---- Optional fields ----
  describe("optional field handling", () => {
    it("accepts all optional fields populated", () => {
      const result = projectKostenSchema.safeParse({
        ...validKosten,
        scopeId: "scope_grondwerk",
        leverancierId: "lev_123",
        inkooporderId: "io_456",
        factuurNummer: "F-2024-001",
        notities: "Snelle levering nodig",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scopeId).toBe("scope_grondwerk");
        expect(result.data.leverancierId).toBe("lev_123");
        expect(result.data.factuurNummer).toBe("F-2024-001");
      }
    });

    it("transforms empty string optional fields to undefined", () => {
      const result = projectKostenSchema.safeParse({
        ...validKosten,
        scopeId: "",
        leverancierId: "  ",
        inkooporderId: "",
        factuurNummer: "   ",
        notities: "",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scopeId).toBeUndefined();
        expect(result.data.leverancierId).toBeUndefined();
        expect(result.data.inkooporderId).toBeUndefined();
        expect(result.data.factuurNummer).toBeUndefined();
        expect(result.data.notities).toBeUndefined();
      }
    });

    it("trims whitespace from optional string fields", () => {
      const result = projectKostenSchema.safeParse({
        ...validKosten,
        scopeId: "  scope_id  ",
        notities: "  Notitie met spaties  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scopeId).toBe("scope_id");
        expect(result.data.notities).toBe("Notitie met spaties");
      }
    });
  });

  // ---- All cost types with valid data ----
  describe("all cost types produce valid entries", () => {
    const types: ProjectKostenType[] = [
      "materiaal",
      "arbeid",
      "transport",
      "huur",
      "onderaannemer",
      "overig",
    ];

    for (const type of types) {
      it(`accepts type '${type}'`, () => {
        const result = projectKostenSchema.safeParse({
          ...validKosten,
          type,
        });
        expect(result.success).toBe(true);
      });
    }
  });
});

// ============================================================
// ProjectKostenCreateSchema — form-specific schema
// ============================================================
describe("projectKostenCreateSchema — form creation", () => {
  const validCreate = {
    projectId: "project_789",
    datum: "2024-06-15",
    type: "arbeid" as const,
    omschrijving: "Tuinman uren",
    bedrag: 320.0,
  };

  it("accepts valid create data with string datum", () => {
    const result = projectKostenCreateSchema.safeParse(validCreate);
    expect(result.success).toBe(true);
  });

  it("rejects empty datum string", () => {
    const result = projectKostenCreateSchema.safeParse({
      ...validCreate,
      datum: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts datum in various string formats", () => {
    const dates = ["2024-06-15", "2024-01-01", "2025-12-31"];
    for (const datum of dates) {
      const result = projectKostenCreateSchema.safeParse({
        ...validCreate,
        datum,
      });
      expect(result.success).toBe(true);
    }
  });

  it("has same bedrag constraints as main schema", () => {
    // Zero bedrag
    expect(
      projectKostenCreateSchema.safeParse({ ...validCreate, bedrag: 0 }).success
    ).toBe(false);

    // Negative bedrag
    expect(
      projectKostenCreateSchema.safeParse({ ...validCreate, bedrag: -50 }).success
    ).toBe(false);

    // Minimum bedrag
    expect(
      projectKostenCreateSchema.safeParse({ ...validCreate, bedrag: 0.01 }).success
    ).toBe(true);
  });

  it("transforms empty optional strings to undefined", () => {
    const result = projectKostenCreateSchema.safeParse({
      ...validCreate,
      scopeId: "",
      leverancierId: "",
      inkooporderId: "",
      factuurNummer: "",
      notities: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scopeId).toBeUndefined();
      expect(result.data.leverancierId).toBeUndefined();
      expect(result.data.inkooporderId).toBeUndefined();
      expect(result.data.factuurNummer).toBeUndefined();
      expect(result.data.notities).toBeUndefined();
    }
  });
});

// ============================================================
// validateData integration — error aggregation
// ============================================================
describe("validateData with project-kosten schemas", () => {
  it("returns success with typed data", () => {
    const result = validateData(projectKostenSchema, {
      projectId: "p_1",
      datum: "2024-06-15",
      type: "materiaal",
      omschrijving: "Grind",
      bedrag: 75.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data: ProjectKostenFormData = result.data;
      expect(data.bedrag).toBe(75.5);
      expect(data.type).toBe("materiaal");
    }
  });

  it("returns structured errors for multiple field failures", () => {
    const result = validateData(projectKostenSchema, {
      projectId: "",
      datum: "2024-06-15",
      type: "invalid_type",
      omschrijving: "",
      bedrag: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors["projectId"]).toBeDefined();
      expect(result.errors["type"]).toBeDefined();
      expect(result.errors["omschrijving"]).toBeDefined();
      expect(result.errors["bedrag"]).toBeDefined();
    }
  });

  it("returns errors as string messages", () => {
    const result = validateData(projectKostenSchema, {
      projectId: "",
      datum: "2024-06-15",
      type: "materiaal",
      omschrijving: "Valid",
      bedrag: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      for (const [, message] of Object.entries(result.errors)) {
        expect(typeof message).toBe("string");
        expect(message.length).toBeGreaterThan(0);
      }
    }
  });
});

// ============================================================
// Cost aggregation simulation tests
// ============================================================
describe("project kosten cost aggregation patterns", () => {
  it("validates a batch of kosten entries for the same project", () => {
    const entries = [
      { projectId: "p_1", datum: "2024-06-15", type: "materiaal" as const, omschrijving: "Tegels", bedrag: 500 },
      { projectId: "p_1", datum: "2024-06-15", type: "arbeid" as const, omschrijving: "Installatie", bedrag: 320 },
      { projectId: "p_1", datum: "2024-06-16", type: "transport" as const, omschrijving: "Vrachtwagen", bedrag: 150 },
      { projectId: "p_1", datum: "2024-06-16", type: "huur" as const, omschrijving: "Minigraver", bedrag: 200 },
      { projectId: "p_1", datum: "2024-06-17", type: "onderaannemer" as const, omschrijving: "Elektricien", bedrag: 480 },
      { projectId: "p_1", datum: "2024-06-17", type: "overig" as const, omschrijving: "Vergunning", bedrag: 85 },
    ];

    const results = entries.map((entry) =>
      projectKostenCreateSchema.safeParse(entry)
    );

    // All should parse successfully
    expect(results.every((r) => r.success)).toBe(true);

    // Calculate total cost from validated entries
    const totalCost = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.success ? r.data.bedrag : 0), 0);
    expect(totalCost).toBe(1735);
  });

  it("validates costs can be categorized by type", () => {
    const entries = [
      { projectId: "p_1", datum: "2024-06-15", type: "materiaal" as const, omschrijving: "A", bedrag: 100 },
      { projectId: "p_1", datum: "2024-06-15", type: "materiaal" as const, omschrijving: "B", bedrag: 200 },
      { projectId: "p_1", datum: "2024-06-15", type: "arbeid" as const, omschrijving: "C", bedrag: 300 },
    ];

    const parsed = entries
      .map((e) => projectKostenCreateSchema.safeParse(e))
      .filter((r) => r.success)
      .map((r) => (r as { success: true; data: ProjectKostenCreateFormData }).data);

    // Group by type
    const grouped = parsed.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + item.bedrag;
      return acc;
    }, {});

    expect(grouped["materiaal"]).toBe(300);
    expect(grouped["arbeid"]).toBe(300);
  });

  it("handles edge case: single cent entries", () => {
    const entries = Array.from({ length: 100 }, (_, i) => ({
      projectId: "p_1",
      datum: "2024-06-15",
      type: "overig" as const,
      omschrijving: `Item ${i}`,
      bedrag: 0.01,
    }));

    const results = entries.map((e) => projectKostenCreateSchema.safeParse(e));
    expect(results.every((r) => r.success)).toBe(true);

    const total = results
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.success ? r.data.bedrag : 0), 0);
    // Floating point: should be close to 1.00
    expect(total).toBeCloseTo(1.0, 10);
  });
});
