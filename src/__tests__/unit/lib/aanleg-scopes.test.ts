import { describe, it, expect } from "vitest";
import {
  grondwerkSchema,
  bestratingSchema,
  bordersSchema,
  grasSchema,
  houtwerkSchema,
  waterElektraSchema,
  specialItemSchema,
  specialsSchema,
} from "@/lib/validations/aanleg-scopes";
import type {
  GrondwerkFormData,
  BestratingFormData,
  BordersFormData,
  GrasFormData,
  HoutwerkFormData,
  WaterElektraFormData,
  SpecialsFormData,
} from "@/lib/validations/aanleg-scopes";
import { validateData } from "@/lib/validations";

// ============================================================
// Scope Configuration Completeness
// ============================================================
describe("aanleg scope configuration completeness", () => {
  it("exports all 7 scope schemas", () => {
    expect(grondwerkSchema).toBeDefined();
    expect(bestratingSchema).toBeDefined();
    expect(bordersSchema).toBeDefined();
    expect(grasSchema).toBeDefined();
    expect(houtwerkSchema).toBeDefined();
    expect(waterElektraSchema).toBeDefined();
    expect(specialsSchema).toBeDefined();
  });

  it("exports specialItemSchema for individual special items", () => {
    expect(specialItemSchema).toBeDefined();
  });
});

// ============================================================
// Grondwerk — deep validation
// ============================================================
describe("grondwerkSchema — edge cases", () => {
  it("accepts boundary oppervlakte of 0.1", () => {
    const result = grondwerkSchema.safeParse({
      oppervlakte: 0.1,
      diepte: "licht",
      afvoerGrond: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects oppervlakte just below minimum (0.09)", () => {
    const result = grondwerkSchema.safeParse({
      oppervlakte: 0.09,
      diepte: "licht",
      afvoerGrond: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts large oppervlakte values", () => {
    const result = grondwerkSchema.safeParse({
      oppervlakte: 99999,
      diepte: "zwaar",
      afvoerGrond: true,
    });
    expect(result.success).toBe(true);
  });

  it("type-checks: parsed data has correct shape", () => {
    const result = grondwerkSchema.safeParse({
      oppervlakte: 50,
      diepte: "standaard",
      afvoerGrond: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data: GrondwerkFormData = result.data;
      expect(data.oppervlakte).toBe(50);
      expect(data.diepte).toBe("standaard");
      expect(data.afvoerGrond).toBe(true);
    }
  });

  it("rejects extra unknown fields in strict parse", () => {
    const result = grondwerkSchema.strict().safeParse({
      oppervlakte: 10,
      diepte: "licht",
      afvoerGrond: false,
      extraField: "should fail",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Bestrating — onderbouw nested validation
// ============================================================
describe("bestratingSchema — nested onderbouw validation", () => {
  const validBestrating = {
    oppervlakte: 30,
    typeBestrating: "klinker" as const,
    snijwerk: "gemiddeld" as const,
    onderbouw: {
      type: "zandbed" as const,
      dikteOnderlaag: 15,
      opsluitbanden: true,
    },
  };

  it("accepts valid bestrating with all onderbouw fields", () => {
    const result = bestratingSchema.safeParse(validBestrating);
    expect(result.success).toBe(true);
  });

  it("rejects when onderbouw is entirely missing", () => {
    const { onderbouw: _, ...rest } = validBestrating;
    const result = bestratingSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects when onderbouw.type is missing", () => {
    const result = bestratingSchema.safeParse({
      ...validBestrating,
      onderbouw: { dikteOnderlaag: 15, opsluitbanden: true },
    });
    expect(result.success).toBe(false);
  });

  it("rejects onderbouw.dikteOnderlaag at boundary 0", () => {
    const result = bestratingSchema.safeParse({
      ...validBestrating,
      onderbouw: { type: "zandbed", dikteOnderlaag: 0, opsluitbanden: false },
    });
    expect(result.success).toBe(false);
  });

  it("accepts onderbouw.dikteOnderlaag at boundary 1", () => {
    const result = bestratingSchema.safeParse({
      ...validBestrating,
      onderbouw: { type: "zandbed", dikteOnderlaag: 1, opsluitbanden: false },
    });
    expect(result.success).toBe(true);
  });

  it("accepts onderbouw.dikteOnderlaag at boundary 50", () => {
    const result = bestratingSchema.safeParse({
      ...validBestrating,
      onderbouw: { type: "zware_fundering", dikteOnderlaag: 50, opsluitbanden: true },
    });
    expect(result.success).toBe(true);
  });

  it("rejects onderbouw.dikteOnderlaag at 51 (above max)", () => {
    const result = bestratingSchema.safeParse({
      ...validBestrating,
      onderbouw: { type: "zandbed", dikteOnderlaag: 51, opsluitbanden: false },
    });
    expect(result.success).toBe(false);
  });

  it("validates all three onderbouw type options", () => {
    const types = ["zandbed", "zand_fundering", "zware_fundering"] as const;
    for (const type of types) {
      const result = bestratingSchema.safeParse({
        ...validBestrating,
        onderbouw: { type, dikteOnderlaag: 10, opsluitbanden: false },
      });
      expect(result.success).toBe(true);
    }
  });

  it("type-checks: parsed bestrating has correct nested shape", () => {
    const result = bestratingSchema.safeParse(validBestrating);
    expect(result.success).toBe(true);
    if (result.success) {
      const data: BestratingFormData = result.data;
      expect(data.onderbouw.type).toBe("zandbed");
      expect(data.onderbouw.dikteOnderlaag).toBe(15);
      expect(data.onderbouw.opsluitbanden).toBe(true);
    }
  });
});

// ============================================================
// Gras — optional fields interaction
// ============================================================
describe("grasSchema — optional field combinations", () => {
  const validGras = {
    oppervlakte: 100,
    type: "graszoden" as const,
    ondergrond: "nieuw" as const,
    afwateringNodig: true,
  };

  it("accepts only required fields", () => {
    const result = grasSchema.safeParse(validGras);
    expect(result.success).toBe(true);
  });

  it("accepts all optional fields together", () => {
    const result = grasSchema.safeParse({
      ...validGras,
      kunstgras: true,
      drainage: true,
      drainageMeters: 25,
      opsluitbanden: true,
      opsluitbandenMeters: 10,
      verticuteren: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts drainage without drainageMeters (both optional)", () => {
    const result = grasSchema.safeParse({
      ...validGras,
      drainage: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects drainageMeters below minimum of 1", () => {
    const result = grasSchema.safeParse({
      ...validGras,
      drainage: true,
      drainageMeters: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts drainageMeters at boundary 1", () => {
    const result = grasSchema.safeParse({
      ...validGras,
      drainage: true,
      drainageMeters: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects opsluitbandenMeters below 0.5", () => {
    const result = grasSchema.safeParse({
      ...validGras,
      opsluitbanden: true,
      opsluitbandenMeters: 0.4,
    });
    expect(result.success).toBe(false);
  });

  it("accepts opsluitbandenMeters at boundary 0.5", () => {
    const result = grasSchema.safeParse({
      ...validGras,
      opsluitbanden: true,
      opsluitbandenMeters: 0.5,
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// WaterElektra — refine conditional validation
// ============================================================
describe("waterElektraSchema — conditional sleuven validation", () => {
  it("allows sleuvenNodig=false when no elektra needed", () => {
    const result = waterElektraSchema.safeParse({
      verlichting: "geen",
      aantalPunten: 0,
      sleuvenNodig: false,
    });
    expect(result.success).toBe(true);
  });

  it("allows sleuvenNodig=true when no elektra needed", () => {
    const result = waterElektraSchema.safeParse({
      verlichting: "geen",
      aantalPunten: 0,
      sleuvenNodig: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires sleuvenNodig=true when verlichting is basis", () => {
    const withSleuven = waterElektraSchema.safeParse({
      verlichting: "basis",
      aantalPunten: 0,
      sleuvenNodig: true,
    });
    expect(withSleuven.success).toBe(true);

    const withoutSleuven = waterElektraSchema.safeParse({
      verlichting: "basis",
      aantalPunten: 0,
      sleuvenNodig: false,
    });
    expect(withoutSleuven.success).toBe(false);
  });

  it("requires sleuvenNodig=true when verlichting is uitgebreid", () => {
    const result = waterElektraSchema.safeParse({
      verlichting: "uitgebreid",
      aantalPunten: 0,
      sleuvenNodig: false,
    });
    expect(result.success).toBe(false);
  });

  it("requires sleuvenNodig=true when aantalPunten > 0", () => {
    const result = waterElektraSchema.safeParse({
      verlichting: "geen",
      aantalPunten: 3,
      sleuvenNodig: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts sleuvenNodig=true when aantalPunten > 0", () => {
    const result = waterElektraSchema.safeParse({
      verlichting: "geen",
      aantalPunten: 5,
      sleuvenNodig: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires sleuven when both verlichting and punten are active", () => {
    const result = waterElektraSchema.safeParse({
      verlichting: "uitgebreid",
      aantalPunten: 10,
      sleuvenNodig: false,
    });
    expect(result.success).toBe(false);

    const valid = waterElektraSchema.safeParse({
      verlichting: "uitgebreid",
      aantalPunten: 10,
      sleuvenNodig: true,
    });
    expect(valid.success).toBe(true);
  });

  it("provides correct error path for sleuven refinement failure", () => {
    const result = waterElektraSchema.safeParse({
      verlichting: "basis",
      aantalPunten: 0,
      sleuvenNodig: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const sleuvenError = result.error.issues.find(
        (issue) => issue.path.includes("sleuvenNodig")
      );
      expect(sleuvenError).toBeDefined();
      expect(sleuvenError?.message).toBe(
        "Sleuven zijn verplicht bij elektra werkzaamheden"
      );
    }
  });
});

// ============================================================
// Specials — array validation
// ============================================================
describe("specialsSchema — array item validation", () => {
  it("accepts multiple items of different types", () => {
    const result = specialsSchema.safeParse({
      items: [
        { type: "jacuzzi", omschrijving: "Inbouw jacuzzi" },
        { type: "sauna", omschrijving: "Barrel sauna" },
        { type: "prefab", omschrijving: "Prefab tuinhuis" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty items array", () => {
    const result = specialsSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects when any item has empty omschrijving", () => {
    const result = specialsSchema.safeParse({
      items: [
        { type: "jacuzzi", omschrijving: "Valid" },
        { type: "sauna", omschrijving: "" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects items with missing type", () => {
    const result = specialsSchema.safeParse({
      items: [{ omschrijving: "Some item" }],
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// validateData helper integration with aanleg schemas
// ============================================================
describe("validateData with aanleg schemas", () => {
  it("returns success with valid grondwerk data", () => {
    const result = validateData(grondwerkSchema, {
      oppervlakte: 25,
      diepte: "standaard",
      afvoerGrond: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.oppervlakte).toBe(25);
    }
  });

  it("returns errors record with invalid grondwerk data", () => {
    const result = validateData(grondwerkSchema, {
      oppervlakte: 0,
      diepte: "invalid",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeDefined();
      expect(typeof result.errors).toBe("object");
      // Should have error for oppervlakte (min 0.1)
      expect(result.errors["oppervlakte"]).toBeDefined();
    }
  });

  it("returns error paths with dot notation for nested bestrating errors", () => {
    const result = validateData(bestratingSchema, {
      oppervlakte: 30,
      typeBestrating: "klinker",
      snijwerk: "gemiddeld",
      onderbouw: {
        type: "zandbed",
        dikteOnderlaag: 0, // Invalid: min 1
        opsluitbanden: true,
      },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors["onderbouw.dikteOnderlaag"]).toBeDefined();
    }
  });
});

// ============================================================
// Houtwerk — fundering validation
// ============================================================
describe("houtwerkSchema — fundering is mandatory", () => {
  it("accepts schutting with standaard fundering", () => {
    const result = houtwerkSchema.safeParse({
      typeHoutwerk: "schutting",
      afmeting: 12,
      fundering: "standaard",
    });
    expect(result.success).toBe(true);
  });

  it("accepts vlonder with zwaar fundering", () => {
    const result = houtwerkSchema.safeParse({
      typeHoutwerk: "vlonder",
      afmeting: 8,
      fundering: "zwaar",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing fundering", () => {
    const result = houtwerkSchema.safeParse({
      typeHoutwerk: "pergola",
      afmeting: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid fundering value", () => {
    const result = houtwerkSchema.safeParse({
      typeHoutwerk: "pergola",
      afmeting: 5,
      fundering: "licht",
    });
    expect(result.success).toBe(false);
  });

  it("rejects fractional afmeting below 0.1", () => {
    const result = houtwerkSchema.safeParse({
      typeHoutwerk: "schutting",
      afmeting: 0.05,
      fundering: "standaard",
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Borders — complete field validation
// ============================================================
describe("bordersSchema — field completeness", () => {
  it("requires all four fields", () => {
    // Missing afwerking
    const result = bordersSchema.safeParse({
      oppervlakte: 15,
      beplantingsintensiteit: "gemiddeld",
      bodemverbetering: true,
    });
    expect(result.success).toBe(false);
  });

  it("validates all afwerking options", () => {
    const options = ["geen", "schors", "grind"] as const;
    for (const afwerking of options) {
      const result = bordersSchema.safeParse({
        oppervlakte: 15,
        beplantingsintensiteit: "gemiddeld",
        bodemverbetering: true,
        afwerking,
      });
      expect(result.success).toBe(true);
    }
  });

  it("type-checks: parsed data matches BordersFormData", () => {
    const result = bordersSchema.safeParse({
      oppervlakte: 20,
      beplantingsintensiteit: "veel",
      bodemverbetering: false,
      afwerking: "schors",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data: BordersFormData = result.data;
      expect(data.beplantingsintensiteit).toBe("veel");
      expect(data.afwerking).toBe("schors");
    }
  });
});
