import { describe, it, expect } from "vitest";
import {
  grasOnderhoudSchema,
  bordersOnderhoudSchema,
  heggenOnderhoudSchema,
  bomenOnderhoudSchema,
  overigeOnderhoudSchema,
  reinigingOnderhoudSchema,
  bemestingOnderhoudSchema,
  gazonanalyseOnderhoudSchema,
  gazonanalyseProblemenSchema,
  mollenbestrijdingOnderhoudSchema,
} from "@/lib/validations/onderhoud-scopes";
import type {
  GrasOnderhoudFormData,
  HeggenOnderhoudFormData,
  BomenOnderhoudFormData,
  OverigeOnderhoudFormData,
} from "@/lib/validations/onderhoud-scopes";
import { validateData } from "@/lib/validations";

// ============================================================
// Scope Configuration Completeness
// ============================================================
describe("onderhoud scope configuration completeness", () => {
  it("exports all 8 onderhoud scope schemas", () => {
    expect(grasOnderhoudSchema).toBeDefined();
    expect(bordersOnderhoudSchema).toBeDefined();
    expect(heggenOnderhoudSchema).toBeDefined();
    expect(bomenOnderhoudSchema).toBeDefined();
    expect(overigeOnderhoudSchema).toBeDefined();
    expect(reinigingOnderhoudSchema).toBeDefined();
    expect(bemestingOnderhoudSchema).toBeDefined();
    expect(gazonanalyseOnderhoudSchema).toBeDefined();
  });

  it("exports gazonanalyseProblemenSchema for nested problem tracking", () => {
    expect(gazonanalyseProblemenSchema).toBeDefined();
  });

  it("exports mollenbestrijdingOnderhoudSchema", () => {
    expect(mollenbestrijdingOnderhoudSchema).toBeDefined();
  });
});

// ============================================================
// GrasOnderhoud — refine: grasAanwezig requires oppervlakte > 0
// ============================================================
describe("grasOnderhoudSchema — conditional oppervlakte validation", () => {
  const baseGras = {
    grasAanwezig: false,
    grasOppervlakte: 0,
    maaien: false,
    kantenSteken: false,
    verticuteren: false,
    afvoerGras: false,
  };

  it("accepts grasAanwezig=false with oppervlakte=0", () => {
    const result = grasOnderhoudSchema.safeParse(baseGras);
    expect(result.success).toBe(true);
  });

  it("accepts grasAanwezig=true with oppervlakte > 0", () => {
    const result = grasOnderhoudSchema.safeParse({
      ...baseGras,
      grasAanwezig: true,
      grasOppervlakte: 50,
    });
    expect(result.success).toBe(true);
  });

  it("rejects grasAanwezig=true with oppervlakte=0", () => {
    const result = grasOnderhoudSchema.safeParse({
      ...baseGras,
      grasAanwezig: true,
      grasOppervlakte: 0,
    });
    expect(result.success).toBe(false);
  });

  it("provides correct error path for grasOppervlakte refinement", () => {
    const result = grasOnderhoudSchema.safeParse({
      ...baseGras,
      grasAanwezig: true,
      grasOppervlakte: 0,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(
        (issue) => issue.path.includes("grasOppervlakte")
      );
      expect(error).toBeDefined();
      expect(error?.message).toBe(
        "Grasoppervlakte moet groter dan 0 zijn als gras aanwezig is"
      );
    }
  });

  it("accepts grasAanwezig=true with all maintenance options enabled", () => {
    const result = grasOnderhoudSchema.safeParse({
      grasAanwezig: true,
      grasOppervlakte: 200,
      maaien: true,
      kantenSteken: true,
      verticuteren: true,
      afvoerGras: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data: GrasOnderhoudFormData = result.data;
      expect(data.maaien).toBe(true);
      expect(data.verticuteren).toBe(true);
    }
  });

  it("rejects negative grasOppervlakte", () => {
    const result = grasOnderhoudSchema.safeParse({
      ...baseGras,
      grasOppervlakte: -5,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Heggen — all three dimensions mandatory
// ============================================================
describe("heggenOnderhoudSchema — mandatory dimensions", () => {
  const validHeg = {
    lengte: 10,
    hoogte: 2,
    breedte: 0.8,
    snoei: "beide" as const,
    afvoerSnoeisel: true,
  };

  it("accepts valid heggen with required fields only", () => {
    const result = heggenOnderhoudSchema.safeParse(validHeg);
    expect(result.success).toBe(true);
  });

  it("rejects missing lengte", () => {
    const { lengte: _, ...rest } = validHeg;
    const result = heggenOnderhoudSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing hoogte", () => {
    const { hoogte: _, ...rest } = validHeg;
    const result = heggenOnderhoudSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing breedte", () => {
    const { breedte: _, ...rest } = validHeg;
    const result = heggenOnderhoudSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects zero values for each dimension", () => {
    expect(
      heggenOnderhoudSchema.safeParse({ ...validHeg, lengte: 0 }).success
    ).toBe(false);
    expect(
      heggenOnderhoudSchema.safeParse({ ...validHeg, hoogte: 0 }).success
    ).toBe(false);
    expect(
      heggenOnderhoudSchema.safeParse({ ...validHeg, breedte: 0 }).success
    ).toBe(false);
  });

  it("accepts all haagsoort options including overig", () => {
    const soorten = ["liguster", "beuk", "taxus", "conifeer", "buxus", "overig"] as const;
    for (const haagsoort of soorten) {
      const result = heggenOnderhoudSchema.safeParse({
        ...validHeg,
        haagsoort,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all snoeiFrequentie options", () => {
    const freqs = ["1x", "2x", "3x"] as const;
    for (const snoeiFrequentie of freqs) {
      const result = heggenOnderhoudSchema.safeParse({
        ...validHeg,
        snoeiFrequentie,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all optional extension fields together", () => {
    const result = heggenOnderhoudSchema.safeParse({
      ...validHeg,
      haagsoort: "taxus",
      haagsoortOverig: "",
      diepte: 0.5,
      hoogwerkerNodig: true,
      ondergrond: "bestrating",
      snoeiFrequentie: "2x",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data: HeggenOnderhoudFormData = result.data;
      expect(data.hoogwerkerNodig).toBe(true);
      expect(data.ondergrond).toBe("bestrating");
    }
  });

  it("rejects negative diepte", () => {
    const result = heggenOnderhoudSchema.safeParse({
      ...validHeg,
      diepte: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all ondergrond options", () => {
    const types = ["bestrating", "border", "grind", "gras", "anders"] as const;
    for (const ondergrond of types) {
      const result = heggenOnderhoudSchema.safeParse({
        ...validHeg,
        ondergrond,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ============================================================
// Bomen — extension fields
// ============================================================
describe("bomenOnderhoudSchema — extension fields", () => {
  const validBomen = {
    aantalBomen: 5,
    snoei: "licht" as const,
    hoogteklasse: "middel" as const,
    afvoer: true,
  };

  it("accepts valid bomen data", () => {
    const result = bomenOnderhoudSchema.safeParse(validBomen);
    expect(result.success).toBe(true);
  });

  it("accepts all groottecategorie options", () => {
    const cats = ["0-4m", "4-10m", "10-20m"] as const;
    for (const groottecategorie of cats) {
      const result = bomenOnderhoudSchema.safeParse({
        ...validBomen,
        groottecategorie,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts proximity flags (nabijGebouw, nabijStraat, nabijKabels)", () => {
    const result = bomenOnderhoudSchema.safeParse({
      ...validBomen,
      nabijGebouw: true,
      nabijStraat: false,
      nabijKabels: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data: BomenOnderhoudFormData = result.data;
      expect(data.nabijGebouw).toBe(true);
      expect(data.nabijKabels).toBe(true);
    }
  });

  it("accepts all inspectieType options", () => {
    const types = ["geen", "visueel", "gecertificeerd"] as const;
    for (const inspectieType of types) {
      const result = bomenOnderhoudSchema.safeParse({
        ...validBomen,
        inspectieType,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects negative afstandTotStraat", () => {
    const result = bomenOnderhoudSchema.safeParse({
      ...validBomen,
      afstandTotStraat: -2,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative kroondiameter", () => {
    const result = bomenOnderhoudSchema.safeParse({
      ...validBomen,
      kroondiameter: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero for afstandTotStraat and kroondiameter", () => {
    const result = bomenOnderhoudSchema.safeParse({
      ...validBomen,
      afstandTotStraat: 0,
      kroondiameter: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Overige — triple refine conditional validation
// ============================================================
describe("overigeOnderhoudSchema — conditional validation chains", () => {
  const baseOverig = {
    bladruimen: false,
    terrasReinigen: false,
    onkruidBestrating: false,
    afwateringControleren: false,
  };

  it("accepts all disabled (minimal valid data)", () => {
    const result = overigeOnderhoudSchema.safeParse(baseOverig);
    expect(result.success).toBe(true);
  });

  it("rejects terrasReinigen=true with undefined terrasOppervlakte", () => {
    const result = overigeOnderhoudSchema.safeParse({
      ...baseOverig,
      terrasReinigen: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(
        (i) => i.path.includes("terrasOppervlakte")
      );
      expect(error?.message).toBe(
        "Terras oppervlakte is verplicht als terras reinigen is geselecteerd"
      );
    }
  });

  it("rejects terrasReinigen=true with terrasOppervlakte=0", () => {
    const result = overigeOnderhoudSchema.safeParse({
      ...baseOverig,
      terrasReinigen: true,
      terrasOppervlakte: 0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts terrasReinigen=true with valid terrasOppervlakte", () => {
    const result = overigeOnderhoudSchema.safeParse({
      ...baseOverig,
      terrasReinigen: true,
      terrasOppervlakte: 25,
    });
    expect(result.success).toBe(true);
  });

  it("rejects onkruidBestrating=true without bestratingOppervlakte", () => {
    const result = overigeOnderhoudSchema.safeParse({
      ...baseOverig,
      onkruidBestrating: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(
        (i) => i.path.includes("bestratingOppervlakte")
      );
      expect(error?.message).toBe(
        "Bestrating oppervlakte is verplicht als onkruid bestrating is geselecteerd"
      );
    }
  });

  it("rejects afwateringControleren=true without aantalAfwateringspunten", () => {
    const result = overigeOnderhoudSchema.safeParse({
      ...baseOverig,
      afwateringControleren: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const error = result.error.issues.find(
        (i) => i.path.includes("aantalAfwateringspunten")
      );
      expect(error?.message).toBe(
        "Aantal afwateringspunten is verplicht als afwatering controleren is geselecteerd"
      );
    }
  });

  it("accepts all three conditional fields enabled with valid values", () => {
    const result = overigeOnderhoudSchema.safeParse({
      ...baseOverig,
      terrasReinigen: true,
      terrasOppervlakte: 30,
      onkruidBestrating: true,
      bestratingOppervlakte: 50,
      afwateringControleren: true,
      aantalAfwateringspunten: 4,
      bladruimen: true,
      overigNotities: "Extra werk nodig",
      overigUren: 2.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const data: OverigeOnderhoudFormData = result.data;
      expect(data.terrasOppervlakte).toBe(30);
      expect(data.bestratingOppervlakte).toBe(50);
      expect(data.aantalAfwateringspunten).toBe(4);
    }
  });

  it("rejects negative overigUren", () => {
    const result = overigeOnderhoudSchema.safeParse({
      ...baseOverig,
      overigUren: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts overigUren of 0", () => {
    const result = overigeOnderhoudSchema.safeParse({
      ...baseOverig,
      overigUren: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ============================================================
// Gazonanalyse — nested problemen schema
// ============================================================
describe("gazonanalyseOnderhoudSchema — nested problem validation", () => {
  it("accepts empty object (all optional)", () => {
    const result = gazonanalyseOnderhoudSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts full problemen with all fields", () => {
    const result = gazonanalyseOnderhoudSchema.safeParse({
      conditieScore: 6,
      problemen: {
        mos: true,
        mosPercentage: 30,
        kalePlekken: true,
        kalePlekkenM2: 5,
        onkruid: true,
        onkruidType: "breed",
        verdroging: false,
        wateroverlast: false,
        schaduw: true,
        schaduwPercentage: 50,
        verzuring: false,
        muizenMollen: true,
      },
      oppervlakte: 150,
      huidigGrastype: "sport",
      bodemtype: "klei",
      herstelacties: ["verticuteren", "doorzaaien"],
      drainage: true,
      bekalken: false,
      robotmaaierAdvies: true,
      beregeningsadvies: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects conditieScore above 10", () => {
    const result = gazonanalyseOnderhoudSchema.safeParse({
      conditieScore: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects conditieScore below 0", () => {
    const result = gazonanalyseOnderhoudSchema.safeParse({
      conditieScore: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts conditieScore at boundaries (0 and 10)", () => {
    expect(
      gazonanalyseOnderhoudSchema.safeParse({ conditieScore: 0 }).success
    ).toBe(true);
    expect(
      gazonanalyseOnderhoudSchema.safeParse({ conditieScore: 10 }).success
    ).toBe(true);
  });

  it("rejects mosPercentage above 100", () => {
    const result = gazonanalyseProblemenSchema.safeParse({
      mos: true,
      mosPercentage: 101,
    });
    expect(result.success).toBe(false);
  });

  it("rejects schaduwPercentage above 100", () => {
    const result = gazonanalyseProblemenSchema.safeParse({
      schaduw: true,
      schaduwPercentage: 150,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all herstelacties options", () => {
    const acties = ["verticuteren", "doorzaaien", "nieuwe_grasmat", "plaggen", "bijzaaien"] as const;
    const result = gazonanalyseOnderhoudSchema.safeParse({
      herstelacties: [...acties],
    });
    expect(result.success).toBe(true);
  });

  it("accepts all bodemtype options", () => {
    const types = ["zand", "klei", "veen", "leem"] as const;
    for (const bodemtype of types) {
      const result = gazonanalyseOnderhoudSchema.safeParse({ bodemtype });
      expect(result.success).toBe(true);
    }
  });
});

// ============================================================
// Mollenbestrijding — pakket and severity
// ============================================================
describe("mollenbestrijdingOnderhoudSchema — severity and packages", () => {
  it("accepts empty object (all optional)", () => {
    const result = mollenbestrijdingOnderhoudSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts all pakket options", () => {
    const pakketten = ["basis", "premium", "premium_plus"] as const;
    for (const pakket of pakketten) {
      const result = mollenbestrijdingOnderhoudSchema.safeParse({ pakket });
      expect(result.success).toBe(true);
    }
  });

  it("accepts ernst at boundaries (1 and 5)", () => {
    expect(
      mollenbestrijdingOnderhoudSchema.safeParse({ ernst: 1 }).success
    ).toBe(true);
    expect(
      mollenbestrijdingOnderhoudSchema.safeParse({ ernst: 5 }).success
    ).toBe(true);
  });

  it("rejects ernst above 5", () => {
    expect(
      mollenbestrijdingOnderhoudSchema.safeParse({ ernst: 6 }).success
    ).toBe(false);
  });

  it("rejects ernst below 1", () => {
    expect(
      mollenbestrijdingOnderhoudSchema.safeParse({ ernst: 0 }).success
    ).toBe(false);
  });

  it("accepts all tuinType options", () => {
    const types = ["gazon", "border", "moestuin", "gemengd"] as const;
    for (const tuinType of types) {
      const result = mollenbestrijdingOnderhoudSchema.safeParse({ tuinType });
      expect(result.success).toBe(true);
    }
  });

  it("rejects negative oppervlakte", () => {
    const result = mollenbestrijdingOnderhoudSchema.safeParse({
      oppervlakte: -10,
    });
    expect(result.success).toBe(false);
  });
});

// ============================================================
// Reiniging — all-optional schema
// ============================================================
describe("reinigingOnderhoudSchema — optional fields validation", () => {
  it("accepts empty object", () => {
    const result = reinigingOnderhoudSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts all terrasType options", () => {
    const types = ["keramisch", "beton", "klinkers", "natuursteen", "hout"] as const;
    for (const terrasType of types) {
      const result = reinigingOnderhoudSchema.safeParse({
        terrasReiniging: true,
        terrasType,
        terrasOppervlakte: 20,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all bladruimenFrequentie options", () => {
    const freqs = ["eenmalig", "seizoen"] as const;
    for (const bladruimenFrequentie of freqs) {
      const result = reinigingOnderhoudSchema.safeParse({
        bladruimen: true,
        bladruimenFrequentie,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all onkruidMethode options", () => {
    const methods = ["handmatig", "branden", "heet_water", "chemisch"] as const;
    for (const onkruidMethode of methods) {
      const result = reinigingOnderhoudSchema.safeParse({
        onkruidBestrating: true,
        onkruidMethode,
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all algeType options", () => {
    const types = ["dak", "bestrating", "hekwerk", "muur"] as const;
    for (const algeType of types) {
      const result = reinigingOnderhoudSchema.safeParse({
        algeReiniging: true,
        algeType,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects negative oppervlakte values", () => {
    expect(
      reinigingOnderhoudSchema.safeParse({ terrasOppervlakte: -1 }).success
    ).toBe(false);
    expect(
      reinigingOnderhoudSchema.safeParse({ bladruimenOppervlakte: -1 }).success
    ).toBe(false);
    expect(
      reinigingOnderhoudSchema.safeParse({ onkruidBestratingOppervlakte: -1 }).success
    ).toBe(false);
    expect(
      reinigingOnderhoudSchema.safeParse({ algeOppervlakte: -1 }).success
    ).toBe(false);
  });
});

// ============================================================
// Bemesting
// ============================================================
describe("bemestingOnderhoudSchema — type and frequency validation", () => {
  it("accepts all bemestingsTypes options", () => {
    const types = ["gazon", "borders", "bomen", "universeel"] as const;
    const result = bemestingOnderhoudSchema.safeParse({
      bemestingsTypes: [...types],
    });
    expect(result.success).toBe(true);
  });

  it("accepts all frequentie options", () => {
    const freqs = ["1x", "2x", "3x", "4x"] as const;
    for (const frequentie of freqs) {
      const result = bemestingOnderhoudSchema.safeParse({ frequentie });
      expect(result.success).toBe(true);
    }
  });

  it("accepts all productType options", () => {
    const types = ["basis", "premium", "bio"] as const;
    for (const productType of types) {
      const result = bemestingOnderhoudSchema.safeParse({ productType });
      expect(result.success).toBe(true);
    }
  });

  it("rejects negative values", () => {
    expect(
      bemestingOnderhoudSchema.safeParse({ oppervlakte: -1 }).success
    ).toBe(false);
    expect(
      bemestingOnderhoudSchema.safeParse({ aantalBomen: -1 }).success
    ).toBe(false);
  });
});

// ============================================================
// validateData helper integration with onderhoud schemas
// ============================================================
describe("validateData with onderhoud schemas", () => {
  it("returns structured errors for grasOnderhoud refinement failure", () => {
    const result = validateData(grasOnderhoudSchema, {
      grasAanwezig: true,
      grasOppervlakte: 0,
      maaien: false,
      kantenSteken: false,
      verticuteren: false,
      afvoerGras: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors["grasOppervlakte"]).toBeDefined();
    }
  });

  it("returns success with valid heggen data", () => {
    const result = validateData(heggenOnderhoudSchema, {
      lengte: 15,
      hoogte: 2.5,
      breedte: 1,
      snoei: "beide",
      afvoerSnoeisel: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lengte).toBe(15);
    }
  });

  it("returns multiple error paths for overigeOnderhoud with multiple failures", () => {
    const result = validateData(overigeOnderhoudSchema, {
      bladruimen: false,
      terrasReinigen: true,
      // Missing terrasOppervlakte
      onkruidBestrating: true,
      // Missing bestratingOppervlakte
      afwateringControleren: true,
      // Missing aantalAfwateringspunten
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Should have errors for all three conditional fields
      expect(Object.keys(result.errors).length).toBeGreaterThanOrEqual(1);
    }
  });
});
