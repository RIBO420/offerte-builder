import { describe, it, expect } from "vitest";
import { z } from "zod";

import {
  klantSchema,
  PHONE_PATTERN,
  POSTCODE_PATTERN,
} from "@/lib/validations/klant";

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

import {
  inkooporderRegelSchema,
  inkooporderSchema,
  inkooporderCreateSchema,
} from "@/lib/validations/inkooporder";

import {
  leverancierSchema,
  KVK_PATTERN,
  BTW_PATTERN,
  IBAN_PATTERN,
} from "@/lib/validations/leverancier";

import {
  voorraadSchema,
  voorraadAdjustSchema,
  voorraadMutatieSchema,
} from "@/lib/validations/voorraad";

import {
  projectKostenSchema,
  projectKostenCreateSchema,
  projectKostenTypeEnum,
} from "@/lib/validations/project-kosten";

import {
  kwaliteitsControleSchema,
  kwaliteitsControleCreateSchema,
  kwaliteitsStatusEnum,
  kwaliteitsResultaatEnum,
  controlePuntSchema,
  afkeurItemSchema,
} from "@/lib/validations/kwaliteits-controle";

// ============================================================
// Klant Schema
// ============================================================
describe("klantSchema", () => {
  const validKlant = {
    naam: "Jan de Vries",
    adres: "Keizersgracht 100",
    postcode: "1015 AA",
    plaats: "Amsterdam",
    email: "jan@example.nl",
    telefoon: "0612345678",
  };

  describe("valid complete klant", () => {
    it("accepts a fully populated klant", () => {
      const result = klantSchema.safeParse(validKlant);
      expect(result.success).toBe(true);
    });

    it("accepts a minimal klant (only required fields)", () => {
      const result = klantSchema.safeParse({
        naam: "Jan",
        adres: "Straat 1",
        postcode: "1234 AB",
        plaats: "Utrecht",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("missing required fields", () => {
    it("rejects missing naam", () => {
      const result = klantSchema.safeParse({ ...validKlant, naam: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing adres", () => {
      const result = klantSchema.safeParse({ ...validKlant, adres: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing postcode", () => {
      const result = klantSchema.safeParse({ ...validKlant, postcode: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing plaats", () => {
      const result = klantSchema.safeParse({ ...validKlant, plaats: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("postcode validation and normalization", () => {
    it("accepts '1234 AB' (standard format)", () => {
      const result = klantSchema.parse({ ...validKlant, postcode: "1234 AB" });
      expect(result.postcode).toBe("1234 AB");
    });

    it("normalizes '1234AB' to '1234 AB'", () => {
      const result = klantSchema.parse({ ...validKlant, postcode: "1234AB" });
      expect(result.postcode).toBe("1234 AB");
    });

    it("normalizes '1234 ab' to '1234 AB'", () => {
      const result = klantSchema.parse({ ...validKlant, postcode: "1234 ab" });
      expect(result.postcode).toBe("1234 AB");
    });

    it("normalizes '1234ab' to '1234 AB'", () => {
      const result = klantSchema.parse({ ...validKlant, postcode: "1234ab" });
      expect(result.postcode).toBe("1234 AB");
    });

    it("normalizes '9999 ZZ' to '9999 ZZ'", () => {
      const result = klantSchema.parse({ ...validKlant, postcode: "9999 ZZ" });
      expect(result.postcode).toBe("9999 ZZ");
    });

    it("rejects '12345' (too many digits)", () => {
      const result = klantSchema.safeParse({ ...validKlant, postcode: "12345" });
      expect(result.success).toBe(false);
    });

    it("rejects 'ABCD EF' (no digits)", () => {
      const result = klantSchema.safeParse({ ...validKlant, postcode: "ABCD EF" });
      expect(result.success).toBe(false);
    });

    it("rejects '123 AB' (only 3 digits)", () => {
      const result = klantSchema.safeParse({ ...validKlant, postcode: "123 AB" });
      expect(result.success).toBe(false);
    });

    it("rejects empty postcode", () => {
      const result = klantSchema.safeParse({ ...validKlant, postcode: "" });
      expect(result.success).toBe(false);
    });

    it("rejects '1234 A' (only 1 letter)", () => {
      const result = klantSchema.safeParse({ ...validKlant, postcode: "1234 A" });
      expect(result.success).toBe(false);
    });

    it("rejects '1234 ABC' (3 letters)", () => {
      const result = klantSchema.safeParse({ ...validKlant, postcode: "1234 ABC" });
      expect(result.success).toBe(false);
    });
  });

  describe("phone validation and transforms", () => {
    it("accepts '0612345678' (standard mobile)", () => {
      const result = klantSchema.parse({ ...validKlant, telefoon: "0612345678" });
      expect(result.telefoon).toBe("0612345678");
    });

    it("strips formatting from '06 1234 5678'", () => {
      const result = klantSchema.parse({ ...validKlant, telefoon: "06 1234 5678" });
      expect(result.telefoon).toBe("0612345678");
    });

    it("accepts '+31612345678' (international)", () => {
      const result = klantSchema.parse({ ...validKlant, telefoon: "+31612345678" });
      expect(result.telefoon).toBe("+31612345678");
    });

    it("strips dashes from '06-1234-5678'", () => {
      const result = klantSchema.parse({ ...validKlant, telefoon: "06-1234-5678" });
      expect(result.telefoon).toBe("0612345678");
    });

    it("strips parentheses from '(06) 12345678'", () => {
      const result = klantSchema.parse({ ...validKlant, telefoon: "(06) 12345678" });
      expect(result.telefoon).toBe("0612345678");
    });

    it("rejects '123' (too short)", () => {
      const result = klantSchema.safeParse({ ...validKlant, telefoon: "123" });
      expect(result.success).toBe(false);
    });

    it("rejects 'abc' (non-numeric)", () => {
      const result = klantSchema.safeParse({ ...validKlant, telefoon: "abc" });
      expect(result.success).toBe(false);
    });

    it("accepts undefined (optional)", () => {
      const result = klantSchema.safeParse({ ...validKlant, telefoon: undefined });
      expect(result.success).toBe(true);
    });

    it("transforms empty string to undefined", () => {
      const result = klantSchema.parse({ ...validKlant, telefoon: "" });
      expect(result.telefoon).toBeUndefined();
    });

    it("accepts landline number '0201234567'", () => {
      const result = klantSchema.parse({ ...validKlant, telefoon: "0201234567" });
      expect(result.telefoon).toBe("0201234567");
    });
  });

  describe("email validation and transforms", () => {
    it("accepts valid email 'jan@example.nl'", () => {
      const result = klantSchema.parse({ ...validKlant, email: "jan@example.nl" });
      expect(result.email).toBe("jan@example.nl");
    });

    it("lowercases email 'Jan@Example.NL'", () => {
      const result = klantSchema.parse({ ...validKlant, email: "Jan@Example.NL" });
      expect(result.email).toBe("jan@example.nl");
    });

    it("trims whitespace from email", () => {
      const result = klantSchema.parse({ ...validKlant, email: "  jan@example.nl  " });
      expect(result.email).toBe("jan@example.nl");
    });

    it("rejects email without @", () => {
      const result = klantSchema.safeParse({ ...validKlant, email: "janexample.nl" });
      expect(result.success).toBe(false);
    });

    it("rejects email with spaces", () => {
      const result = klantSchema.safeParse({ ...validKlant, email: "jan @example.nl" });
      expect(result.success).toBe(false);
    });

    it("transforms empty string to undefined", () => {
      const result = klantSchema.parse({ ...validKlant, email: "" });
      expect(result.email).toBeUndefined();
    });

    it("accepts undefined (optional)", () => {
      const result = klantSchema.safeParse({ ...validKlant, email: undefined });
      expect(result.success).toBe(true);
    });

    it("accepts email with subdomain 'user@mail.example.co.uk'", () => {
      const result = klantSchema.parse({ ...validKlant, email: "user@mail.example.co.uk" });
      expect(result.email).toBe("user@mail.example.co.uk");
    });
  });

  describe("regex patterns (exported)", () => {
    it("PHONE_PATTERN matches valid Dutch mobile", () => {
      expect(PHONE_PATTERN.test("0612345678")).toBe(true);
    });

    it("PHONE_PATTERN matches international format", () => {
      expect(PHONE_PATTERN.test("+31612345678")).toBe(true);
    });

    it("PHONE_PATTERN rejects starting with 00", () => {
      expect(PHONE_PATTERN.test("0012345678")).toBe(false);
    });

    it("POSTCODE_PATTERN matches '1234 AB'", () => {
      expect(POSTCODE_PATTERN.test("1234 AB")).toBe(true);
    });

    it("POSTCODE_PATTERN matches '1234AB'", () => {
      expect(POSTCODE_PATTERN.test("1234AB")).toBe(true);
    });

    it("POSTCODE_PATTERN rejects '123 AB'", () => {
      expect(POSTCODE_PATTERN.test("123 AB")).toBe(false);
    });
  });
});

// ============================================================
// Aanleg Scopes Schemas
// ============================================================
describe("aanleg-scopes schemas", () => {
  describe("grondwerkSchema", () => {
    it("accepts valid grondwerk data", () => {
      const result = grondwerkSchema.safeParse({
        oppervlakte: 50,
        diepte: "standaard",
        afvoerGrond: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts all diepte options", () => {
      for (const diepte of ["licht", "standaard", "zwaar"] as const) {
        const result = grondwerkSchema.safeParse({
          oppervlakte: 10,
          diepte,
          afvoerGrond: false,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects oppervlakte of 0", () => {
      const result = grondwerkSchema.safeParse({
        oppervlakte: 0,
        diepte: "standaard",
        afvoerGrond: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative oppervlakte", () => {
      const result = grondwerkSchema.safeParse({
        oppervlakte: -5,
        diepte: "standaard",
        afvoerGrond: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid diepte value", () => {
      const result = grondwerkSchema.safeParse({
        oppervlakte: 10,
        diepte: "invalid",
        afvoerGrond: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing afvoerGrond", () => {
      const result = grondwerkSchema.safeParse({
        oppervlakte: 10,
        diepte: "standaard",
      });
      expect(result.success).toBe(false);
    });

    it("rejects string for oppervlakte", () => {
      const result = grondwerkSchema.safeParse({
        oppervlakte: "vijftig",
        diepte: "standaard",
        afvoerGrond: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("bestratingSchema", () => {
    const validBestrating = {
      oppervlakte: 30,
      typeBestrating: "klinker" as const,
      snijwerk: "gemiddeld" as const,
      onderbouw: {
        type: "zandbed" as const,
        dikteOnderlaag: 10,
        opsluitbanden: true,
      },
    };

    it("accepts valid bestrating data", () => {
      const result = bestratingSchema.safeParse(validBestrating);
      expect(result.success).toBe(true);
    });

    it("accepts all typeBestrating options", () => {
      for (const type of ["tegel", "klinker", "natuursteen"] as const) {
        const result = bestratingSchema.safeParse({ ...validBestrating, typeBestrating: type });
        expect(result.success).toBe(true);
      }
    });

    it("accepts all snijwerk options", () => {
      for (const snijwerk of ["laag", "gemiddeld", "hoog"] as const) {
        const result = bestratingSchema.safeParse({ ...validBestrating, snijwerk });
        expect(result.success).toBe(true);
      }
    });

    it("accepts all onderbouw types", () => {
      for (const type of ["zandbed", "zand_fundering", "zware_fundering"] as const) {
        const result = bestratingSchema.safeParse({
          ...validBestrating,
          onderbouw: { ...validBestrating.onderbouw, type },
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects dikteOnderlaag below 1", () => {
      const result = bestratingSchema.safeParse({
        ...validBestrating,
        onderbouw: { ...validBestrating.onderbouw, dikteOnderlaag: 0 },
      });
      expect(result.success).toBe(false);
    });

    it("rejects dikteOnderlaag above 50", () => {
      const result = bestratingSchema.safeParse({
        ...validBestrating,
        onderbouw: { ...validBestrating.onderbouw, dikteOnderlaag: 51 },
      });
      expect(result.success).toBe(false);
    });

    it("accepts dikteOnderlaag at boundaries (1 and 50)", () => {
      expect(
        bestratingSchema.safeParse({
          ...validBestrating,
          onderbouw: { ...validBestrating.onderbouw, dikteOnderlaag: 1 },
        }).success
      ).toBe(true);
      expect(
        bestratingSchema.safeParse({
          ...validBestrating,
          onderbouw: { ...validBestrating.onderbouw, dikteOnderlaag: 50 },
        }).success
      ).toBe(true);
    });

    it("rejects missing onderbouw", () => {
      const result = bestratingSchema.safeParse({
        oppervlakte: 30,
        typeBestrating: "klinker",
        snijwerk: "gemiddeld",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("bordersSchema", () => {
    const validBorders = {
      oppervlakte: 20,
      beplantingsintensiteit: "gemiddeld" as const,
      bodemverbetering: true,
      afwerking: "schors" as const,
    };

    it("accepts valid borders data", () => {
      expect(bordersSchema.safeParse(validBorders).success).toBe(true);
    });

    it("accepts all beplantingsintensiteit options", () => {
      for (const b of ["weinig", "gemiddeld", "veel"] as const) {
        expect(bordersSchema.safeParse({ ...validBorders, beplantingsintensiteit: b }).success).toBe(true);
      }
    });

    it("accepts all afwerking options", () => {
      for (const a of ["geen", "schors", "grind"] as const) {
        expect(bordersSchema.safeParse({ ...validBorders, afwerking: a }).success).toBe(true);
      }
    });

    it("rejects oppervlakte of 0", () => {
      expect(bordersSchema.safeParse({ ...validBorders, oppervlakte: 0 }).success).toBe(false);
    });

    it("rejects missing bodemverbetering", () => {
      const { bodemverbetering: _, ...without } = validBorders;
      expect(bordersSchema.safeParse(without).success).toBe(false);
    });
  });

  describe("grasSchema", () => {
    const validGras = {
      oppervlakte: 100,
      type: "graszoden" as const,
      ondergrond: "nieuw" as const,
      afwateringNodig: false,
    };

    it("accepts valid gras data", () => {
      expect(grasSchema.safeParse(validGras).success).toBe(true);
    });

    it("accepts all type options", () => {
      for (const t of ["zaaien", "graszoden"] as const) {
        expect(grasSchema.safeParse({ ...validGras, type: t }).success).toBe(true);
      }
    });

    it("accepts all ondergrond options", () => {
      for (const o of ["bestaand", "nieuw"] as const) {
        expect(grasSchema.safeParse({ ...validGras, ondergrond: o }).success).toBe(true);
      }
    });

    it("accepts optional fields", () => {
      const result = grasSchema.safeParse({
        ...validGras,
        kunstgras: true,
        drainage: true,
        drainageMeters: 10,
        opsluitbanden: true,
        opsluitbandenMeters: 5.5,
        verticuteren: false,
      });
      expect(result.success).toBe(true);
    });

    it("rejects drainageMeters below 1", () => {
      expect(
        grasSchema.safeParse({ ...validGras, drainageMeters: 0 }).success
      ).toBe(false);
    });

    it("rejects opsluitbandenMeters below 0.5", () => {
      expect(
        grasSchema.safeParse({ ...validGras, opsluitbandenMeters: 0.1 }).success
      ).toBe(false);
    });

    it("rejects oppervlakte of 0", () => {
      expect(grasSchema.safeParse({ ...validGras, oppervlakte: 0 }).success).toBe(false);
    });
  });

  describe("houtwerkSchema", () => {
    const validHoutwerk = {
      typeHoutwerk: "schutting" as const,
      afmeting: 15,
      fundering: "standaard" as const,
    };

    it("accepts valid houtwerk data", () => {
      expect(houtwerkSchema.safeParse(validHoutwerk).success).toBe(true);
    });

    it("accepts all typeHoutwerk options", () => {
      for (const t of ["schutting", "vlonder", "pergola"] as const) {
        expect(houtwerkSchema.safeParse({ ...validHoutwerk, typeHoutwerk: t }).success).toBe(true);
      }
    });

    it("accepts all fundering options", () => {
      for (const f of ["standaard", "zwaar"] as const) {
        expect(houtwerkSchema.safeParse({ ...validHoutwerk, fundering: f }).success).toBe(true);
      }
    });

    it("rejects afmeting of 0", () => {
      expect(houtwerkSchema.safeParse({ ...validHoutwerk, afmeting: 0 }).success).toBe(false);
    });

    it("rejects negative afmeting", () => {
      expect(houtwerkSchema.safeParse({ ...validHoutwerk, afmeting: -3 }).success).toBe(false);
    });
  });

  describe("waterElektraSchema", () => {
    it("accepts valid data with no elektra", () => {
      const result = waterElektraSchema.safeParse({
        verlichting: "geen",
        aantalPunten: 0,
        sleuvenNodig: false,
      });
      expect(result.success).toBe(true);
    });

    it("accepts data with verlichting and sleuven", () => {
      const result = waterElektraSchema.safeParse({
        verlichting: "basis",
        aantalPunten: 4,
        sleuvenNodig: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts all verlichting options", () => {
      for (const v of ["geen", "basis", "uitgebreid"] as const) {
        const sleuvenNodig = v !== "geen";
        expect(
          waterElektraSchema.safeParse({ verlichting: v, aantalPunten: 0, sleuvenNodig }).success
        ).toBe(true);
      }
    });

    it("rejects verlichting != 'geen' without sleuven", () => {
      const result = waterElektraSchema.safeParse({
        verlichting: "basis",
        aantalPunten: 0,
        sleuvenNodig: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects aantalPunten > 0 without sleuven", () => {
      const result = waterElektraSchema.safeParse({
        verlichting: "geen",
        aantalPunten: 3,
        sleuvenNodig: false,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative aantalPunten", () => {
      const result = waterElektraSchema.safeParse({
        verlichting: "geen",
        aantalPunten: -1,
        sleuvenNodig: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("specialsSchema", () => {
    it("accepts valid specials with one item", () => {
      const result = specialsSchema.safeParse({
        items: [{ type: "jacuzzi", omschrijving: "Luxe jacuzzi" }],
      });
      expect(result.success).toBe(true);
    });

    it("accepts all special item types", () => {
      for (const type of ["jacuzzi", "sauna", "prefab"] as const) {
        expect(
          specialItemSchema.safeParse({ type, omschrijving: "Test item" }).success
        ).toBe(true);
      }
    });

    it("accepts multiple items", () => {
      const result = specialsSchema.safeParse({
        items: [
          { type: "jacuzzi", omschrijving: "Jacuzzi buitenbad" },
          { type: "sauna", omschrijving: "Finse sauna" },
          { type: "prefab", omschrijving: "Prefab tuinhuis" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty items array", () => {
      const result = specialsSchema.safeParse({ items: [] });
      expect(result.success).toBe(false);
    });

    it("rejects item with empty omschrijving", () => {
      const result = specialItemSchema.safeParse({ type: "jacuzzi", omschrijving: "" });
      expect(result.success).toBe(false);
    });

    it("rejects item with invalid type", () => {
      const result = specialItemSchema.safeParse({ type: "zwembad", omschrijving: "Test" });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================
// Onderhoud Scopes Schemas
// ============================================================
describe("onderhoud-scopes schemas", () => {
  describe("grasOnderhoudSchema", () => {
    const validGrasOnderhoud = {
      grasAanwezig: true,
      grasOppervlakte: 200,
      maaien: true,
      kantenSteken: true,
      verticuteren: false,
      afvoerGras: true,
    };

    it("accepts valid data", () => {
      expect(grasOnderhoudSchema.safeParse(validGrasOnderhoud).success).toBe(true);
    });

    it("allows oppervlakte 0 when gras not aanwezig", () => {
      const result = grasOnderhoudSchema.safeParse({
        ...validGrasOnderhoud,
        grasAanwezig: false,
        grasOppervlakte: 0,
      });
      expect(result.success).toBe(true);
    });

    it("rejects oppervlakte 0 when gras is aanwezig", () => {
      const result = grasOnderhoudSchema.safeParse({
        ...validGrasOnderhoud,
        grasAanwezig: true,
        grasOppervlakte: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects negative oppervlakte", () => {
      const result = grasOnderhoudSchema.safeParse({
        ...validGrasOnderhoud,
        grasOppervlakte: -10,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing boolean fields", () => {
      const { maaien: _, ...without } = validGrasOnderhoud;
      expect(grasOnderhoudSchema.safeParse(without).success).toBe(false);
    });
  });

  describe("bordersOnderhoudSchema", () => {
    const validBordersOnderhoud = {
      borderOppervlakte: 50,
      onderhoudsintensiteit: "gemiddeld" as const,
      onkruidVerwijderen: true,
      snoeiInBorders: "licht" as const,
      bodem: "bedekt" as const,
      afvoerGroenafval: true,
    };

    it("accepts valid data", () => {
      expect(bordersOnderhoudSchema.safeParse(validBordersOnderhoud).success).toBe(true);
    });

    it("accepts all onderhoudsintensiteit options", () => {
      for (const i of ["weinig", "gemiddeld", "veel"] as const) {
        expect(
          bordersOnderhoudSchema.safeParse({ ...validBordersOnderhoud, onderhoudsintensiteit: i }).success
        ).toBe(true);
      }
    });

    it("accepts all snoeiInBorders options", () => {
      for (const s of ["geen", "licht", "zwaar"] as const) {
        expect(
          bordersOnderhoudSchema.safeParse({ ...validBordersOnderhoud, snoeiInBorders: s }).success
        ).toBe(true);
      }
    });

    it("accepts all bodem options", () => {
      for (const b of ["open", "bedekt"] as const) {
        expect(
          bordersOnderhoudSchema.safeParse({ ...validBordersOnderhoud, bodem: b }).success
        ).toBe(true);
      }
    });

    it("rejects oppervlakte of 0", () => {
      expect(
        bordersOnderhoudSchema.safeParse({ ...validBordersOnderhoud, borderOppervlakte: 0 }).success
      ).toBe(false);
    });
  });

  describe("heggenOnderhoudSchema", () => {
    const validHeggen = {
      lengte: 10,
      hoogte: 2,
      breedte: 0.8,
      snoei: "beide" as const,
      afvoerSnoeisel: true,
    };

    it("accepts valid data (required fields only)", () => {
      expect(heggenOnderhoudSchema.safeParse(validHeggen).success).toBe(true);
    });

    it("accepts all snoei options", () => {
      for (const s of ["zijkanten", "bovenkant", "beide"] as const) {
        expect(heggenOnderhoudSchema.safeParse({ ...validHeggen, snoei: s }).success).toBe(true);
      }
    });

    it("accepts optional extension fields", () => {
      const result = heggenOnderhoudSchema.safeParse({
        ...validHeggen,
        haagsoort: "taxus",
        haagsoortOverig: undefined,
        diepte: 0.5,
        hoogwerkerNodig: true,
        ondergrond: "bestrating",
        snoeiFrequentie: "2x",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all haagsoort options", () => {
      for (const h of ["liguster", "beuk", "taxus", "conifeer", "buxus", "overig"] as const) {
        expect(heggenOnderhoudSchema.safeParse({ ...validHeggen, haagsoort: h }).success).toBe(true);
      }
    });

    it("rejects lengte of 0", () => {
      expect(heggenOnderhoudSchema.safeParse({ ...validHeggen, lengte: 0 }).success).toBe(false);
    });

    it("rejects hoogte of 0", () => {
      expect(heggenOnderhoudSchema.safeParse({ ...validHeggen, hoogte: 0 }).success).toBe(false);
    });

    it("rejects breedte of 0", () => {
      expect(heggenOnderhoudSchema.safeParse({ ...validHeggen, breedte: 0 }).success).toBe(false);
    });

    it("rejects negative diepte", () => {
      expect(heggenOnderhoudSchema.safeParse({ ...validHeggen, diepte: -1 }).success).toBe(false);
    });
  });

  describe("bomenOnderhoudSchema", () => {
    const validBomen = {
      aantalBomen: 5,
      snoei: "licht" as const,
      hoogteklasse: "middel" as const,
      afvoer: true,
    };

    it("accepts valid data", () => {
      expect(bomenOnderhoudSchema.safeParse(validBomen).success).toBe(true);
    });

    it("accepts all snoei options", () => {
      for (const s of ["licht", "zwaar"] as const) {
        expect(bomenOnderhoudSchema.safeParse({ ...validBomen, snoei: s }).success).toBe(true);
      }
    });

    it("accepts all hoogteklasse options", () => {
      for (const h of ["laag", "middel", "hoog"] as const) {
        expect(bomenOnderhoudSchema.safeParse({ ...validBomen, hoogteklasse: h }).success).toBe(true);
      }
    });

    it("accepts optional extension fields", () => {
      const result = bomenOnderhoudSchema.safeParse({
        ...validBomen,
        groottecategorie: "4-10m",
        nabijGebouw: true,
        nabijStraat: false,
        nabijKabels: false,
        afstandTotStraat: 5,
        inspectieType: "visueel",
        boomsoort: "Eik",
        kroondiameter: 4,
      });
      expect(result.success).toBe(true);
    });

    it("rejects aantalBomen of 0", () => {
      expect(bomenOnderhoudSchema.safeParse({ ...validBomen, aantalBomen: 0 }).success).toBe(false);
    });

    it("rejects negative afstandTotStraat", () => {
      expect(
        bomenOnderhoudSchema.safeParse({ ...validBomen, afstandTotStraat: -1 }).success
      ).toBe(false);
    });

    it("rejects negative kroondiameter", () => {
      expect(
        bomenOnderhoudSchema.safeParse({ ...validBomen, kroondiameter: -2 }).success
      ).toBe(false);
    });
  });

  describe("overigeOnderhoudSchema", () => {
    const validOverig = {
      bladruimen: false,
      terrasReinigen: false,
      onkruidBestrating: false,
      afwateringControleren: false,
    };

    it("accepts minimal valid data", () => {
      expect(overigeOnderhoudSchema.safeParse(validOverig).success).toBe(true);
    });

    it("accepts data with terras reinigen and oppervlakte", () => {
      const result = overigeOnderhoudSchema.safeParse({
        ...validOverig,
        terrasReinigen: true,
        terrasOppervlakte: 25,
      });
      expect(result.success).toBe(true);
    });

    it("rejects terrasReinigen=true without terrasOppervlakte", () => {
      const result = overigeOnderhoudSchema.safeParse({
        ...validOverig,
        terrasReinigen: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects terrasReinigen=true with terrasOppervlakte=0", () => {
      const result = overigeOnderhoudSchema.safeParse({
        ...validOverig,
        terrasReinigen: true,
        terrasOppervlakte: 0,
      });
      expect(result.success).toBe(false);
    });

    it("rejects onkruidBestrating=true without bestratingOppervlakte", () => {
      const result = overigeOnderhoudSchema.safeParse({
        ...validOverig,
        onkruidBestrating: true,
      });
      expect(result.success).toBe(false);
    });

    it("rejects afwateringControleren=true without aantalAfwateringspunten", () => {
      const result = overigeOnderhoudSchema.safeParse({
        ...validOverig,
        afwateringControleren: true,
      });
      expect(result.success).toBe(false);
    });

    it("accepts afwateringControleren=true with valid aantalAfwateringspunten", () => {
      const result = overigeOnderhoudSchema.safeParse({
        ...validOverig,
        afwateringControleren: true,
        aantalAfwateringspunten: 3,
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional overigNotities and overigUren", () => {
      const result = overigeOnderhoudSchema.safeParse({
        ...validOverig,
        overigNotities: "Extra werkzaamheden",
        overigUren: 2.5,
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative overigUren", () => {
      const result = overigeOnderhoudSchema.safeParse({
        ...validOverig,
        overigUren: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("reinigingOnderhoudSchema", () => {
    it("accepts empty object (all optional)", () => {
      expect(reinigingOnderhoudSchema.safeParse({}).success).toBe(true);
    });

    it("accepts full valid data", () => {
      const result = reinigingOnderhoudSchema.safeParse({
        terrasReiniging: true,
        terrasType: "keramisch",
        terrasOppervlakte: 30,
        bladruimen: true,
        bladruimenOppervlakte: 100,
        bladruimenFrequentie: "seizoen",
        bladruimenAfvoer: true,
        onkruidBestrating: true,
        onkruidBestratingOppervlakte: 50,
        onkruidMethode: "branden",
        hogedrukspuitAkkoord: true,
        algeReiniging: true,
        algeOppervlakte: 20,
        algeType: "bestrating",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all terrasType options", () => {
      for (const t of ["keramisch", "beton", "klinkers", "natuursteen", "hout"] as const) {
        expect(reinigingOnderhoudSchema.safeParse({ terrasType: t }).success).toBe(true);
      }
    });

    it("accepts all onkruidMethode options", () => {
      for (const m of ["handmatig", "branden", "heet_water", "chemisch"] as const) {
        expect(reinigingOnderhoudSchema.safeParse({ onkruidMethode: m }).success).toBe(true);
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
        reinigingOnderhoudSchema.safeParse({ algeOppervlakte: -1 }).success
      ).toBe(false);
    });
  });

  describe("bemestingOnderhoudSchema", () => {
    it("accepts empty object (all optional)", () => {
      expect(bemestingOnderhoudSchema.safeParse({}).success).toBe(true);
    });

    it("accepts full valid data", () => {
      const result = bemestingOnderhoudSchema.safeParse({
        bemestingsTypes: ["gazon", "borders"],
        oppervlakte: 200,
        aantalBomen: 5,
        seizoen: "voorjaar",
        productType: "bio",
        frequentie: "2x",
        kalkbehandeling: true,
        grondanalyse: true,
        onkruidvrijeBemesting: false,
      });
      expect(result.success).toBe(true);
    });

    it("accepts all seizoen options", () => {
      for (const s of ["voorjaar", "zomer", "najaar", "heel_jaar"] as const) {
        expect(bemestingOnderhoudSchema.safeParse({ seizoen: s }).success).toBe(true);
      }
    });

    it("accepts all productType options", () => {
      for (const p of ["basis", "premium", "bio"] as const) {
        expect(bemestingOnderhoudSchema.safeParse({ productType: p }).success).toBe(true);
      }
    });

    it("rejects negative oppervlakte", () => {
      expect(bemestingOnderhoudSchema.safeParse({ oppervlakte: -1 }).success).toBe(false);
    });

    it("rejects negative aantalBomen", () => {
      expect(bemestingOnderhoudSchema.safeParse({ aantalBomen: -1 }).success).toBe(false);
    });
  });

  describe("gazonanalyseOnderhoudSchema", () => {
    it("accepts empty object (all optional)", () => {
      expect(gazonanalyseOnderhoudSchema.safeParse({}).success).toBe(true);
    });

    it("accepts full valid data", () => {
      const result = gazonanalyseOnderhoudSchema.safeParse({
        conditieScore: 7,
        problemen: {
          mos: true,
          mosPercentage: 30,
          kalePlekken: false,
          onkruid: true,
          onkruidType: "klaver",
          verdroging: false,
          wateroverlast: false,
          schaduw: true,
          schaduwPercentage: 50,
          verzuring: false,
          muizenMollen: false,
        },
        oppervlakte: 150,
        huidigGrastype: "sport",
        bodemtype: "klei",
        herstelacties: ["verticuteren", "doorzaaien"],
        drainage: false,
        bekalken: true,
        robotmaaierAdvies: false,
        beregeningsadvies: true,
      });
      expect(result.success).toBe(true);
    });

    it("rejects conditieScore above 10", () => {
      expect(
        gazonanalyseOnderhoudSchema.safeParse({ conditieScore: 11 }).success
      ).toBe(false);
    });

    it("rejects negative conditieScore", () => {
      expect(
        gazonanalyseOnderhoudSchema.safeParse({ conditieScore: -1 }).success
      ).toBe(false);
    });

    it("rejects mosPercentage above 100", () => {
      expect(
        gazonanalyseProblemenSchema.safeParse({ mosPercentage: 101 }).success
      ).toBe(false);
    });

    it("rejects schaduwPercentage above 100", () => {
      expect(
        gazonanalyseProblemenSchema.safeParse({ schaduwPercentage: 101 }).success
      ).toBe(false);
    });

    it("accepts all huidigGrastype options", () => {
      for (const g of ["onbekend", "sport", "sier", "schaduw", "mix"] as const) {
        expect(gazonanalyseOnderhoudSchema.safeParse({ huidigGrastype: g }).success).toBe(true);
      }
    });

    it("accepts all bodemtype options", () => {
      for (const b of ["zand", "klei", "veen", "leem"] as const) {
        expect(gazonanalyseOnderhoudSchema.safeParse({ bodemtype: b }).success).toBe(true);
      }
    });
  });

  describe("mollenbestrijdingOnderhoudSchema", () => {
    it("accepts empty object (all optional)", () => {
      expect(mollenbestrijdingOnderhoudSchema.safeParse({}).success).toBe(true);
    });

    it("accepts full valid data", () => {
      const result = mollenbestrijdingOnderhoudSchema.safeParse({
        aantalMolshopen: 15,
        oppervlakte: 300,
        tuinType: "gazon",
        ernst: 3,
        pakket: "premium",
        gazonherstel: true,
        gazonherstelM2: 10,
        preventiefGaas: true,
        preventiefGaasM2: 50,
        terugkeerCheck: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts all pakket options", () => {
      for (const p of ["basis", "premium", "premium_plus"] as const) {
        expect(mollenbestrijdingOnderhoudSchema.safeParse({ pakket: p }).success).toBe(true);
      }
    });

    it("rejects ernst above 5", () => {
      expect(mollenbestrijdingOnderhoudSchema.safeParse({ ernst: 6 }).success).toBe(false);
    });

    it("rejects ernst below 1", () => {
      expect(mollenbestrijdingOnderhoudSchema.safeParse({ ernst: 0 }).success).toBe(false);
    });

    it("rejects negative oppervlakte", () => {
      expect(mollenbestrijdingOnderhoudSchema.safeParse({ oppervlakte: -1 }).success).toBe(false);
    });

    it("rejects negative gazonherstelM2", () => {
      expect(mollenbestrijdingOnderhoudSchema.safeParse({ gazonherstelM2: -1 }).success).toBe(false);
    });
  });
});

// ============================================================
// Inkooporder Schema
// ============================================================
describe("inkooporder schemas", () => {
  describe("inkooporderRegelSchema", () => {
    const validRegel = {
      omschrijving: "Tegels 30x30",
      hoeveelheid: 100,
      eenheid: "m2",
      prijsPerEenheid: 12.50,
    };

    it("accepts valid regel", () => {
      expect(inkooporderRegelSchema.safeParse(validRegel).success).toBe(true);
    });

    it("rejects empty omschrijving", () => {
      expect(inkooporderRegelSchema.safeParse({ ...validRegel, omschrijving: "" }).success).toBe(false);
    });

    it("rejects hoeveelheid of 0", () => {
      expect(inkooporderRegelSchema.safeParse({ ...validRegel, hoeveelheid: 0 }).success).toBe(false);
    });

    it("rejects negative hoeveelheid", () => {
      expect(inkooporderRegelSchema.safeParse({ ...validRegel, hoeveelheid: -5 }).success).toBe(false);
    });

    it("rejects prijsPerEenheid of 0", () => {
      expect(inkooporderRegelSchema.safeParse({ ...validRegel, prijsPerEenheid: 0 }).success).toBe(false);
    });

    it("rejects empty eenheid", () => {
      expect(inkooporderRegelSchema.safeParse({ ...validRegel, eenheid: "" }).success).toBe(false);
    });

    it("accepts small hoeveelheid (0.01)", () => {
      expect(inkooporderRegelSchema.safeParse({ ...validRegel, hoeveelheid: 0.01 }).success).toBe(true);
    });
  });

  describe("inkooporderSchema", () => {
    const validInkooporder = {
      leverancierId: "lev_123",
      regels: [
        {
          omschrijving: "Tegels 30x30",
          hoeveelheid: 100,
          eenheid: "m2",
          prijsPerEenheid: 12.50,
        },
      ],
    };

    it("accepts valid inkooporder", () => {
      expect(inkooporderSchema.safeParse(validInkooporder).success).toBe(true);
    });

    it("rejects empty leverancierId", () => {
      expect(
        inkooporderSchema.safeParse({ ...validInkooporder, leverancierId: "" }).success
      ).toBe(false);
    });

    it("rejects empty regels array", () => {
      expect(
        inkooporderSchema.safeParse({ ...validInkooporder, regels: [] }).success
      ).toBe(false);
    });

    it("accepts optional projectId", () => {
      expect(
        inkooporderSchema.safeParse({ ...validInkooporder, projectId: "proj_456" }).success
      ).toBe(true);
    });

    it("transforms empty projectId to undefined", () => {
      const result = inkooporderSchema.parse({ ...validInkooporder, projectId: "" });
      expect(result.projectId).toBeUndefined();
    });

    it("transforms empty notities to undefined", () => {
      const result = inkooporderSchema.parse({ ...validInkooporder, notities: "  " });
      expect(result.notities).toBeUndefined();
    });

    it("trims notities whitespace", () => {
      const result = inkooporderSchema.parse({ ...validInkooporder, notities: "  Test notitie  " });
      expect(result.notities).toBe("Test notitie");
    });

    it("accepts verwachteLevertijd as Date", () => {
      const result = inkooporderSchema.safeParse({
        ...validInkooporder,
        verwachteLevertijd: new Date("2026-04-01"),
      });
      expect(result.success).toBe(true);
    });
  });

  describe("inkooporderCreateSchema", () => {
    it("accepts verwachteLevertijd as string", () => {
      const result = inkooporderCreateSchema.safeParse({
        leverancierId: "lev_123",
        regels: [
          { omschrijving: "Item", hoeveelheid: 1, eenheid: "stuk", prijsPerEenheid: 10 },
        ],
        verwachteLevertijd: "2026-04-01",
      });
      expect(result.success).toBe(true);
    });

    it("transforms empty verwachteLevertijd to undefined", () => {
      const result = inkooporderCreateSchema.parse({
        leverancierId: "lev_123",
        regels: [
          { omschrijving: "Item", hoeveelheid: 1, eenheid: "stuk", prijsPerEenheid: 10 },
        ],
        verwachteLevertijd: "",
      });
      expect(result.verwachteLevertijd).toBeUndefined();
    });
  });
});

// ============================================================
// Leverancier Schema
// ============================================================
describe("leverancierSchema", () => {
  const validLeverancier = {
    naam: "Bouwmaat B.V.",
  };

  describe("required and optional fields", () => {
    it("accepts minimal data (only naam)", () => {
      expect(leverancierSchema.safeParse(validLeverancier).success).toBe(true);
    });

    it("rejects empty naam", () => {
      expect(leverancierSchema.safeParse({ naam: "" }).success).toBe(false);
    });

    it("accepts full data", () => {
      const result = leverancierSchema.safeParse({
        naam: "Bouwmaat B.V.",
        contactpersoon: "Kees Jansen",
        email: "kees@bouwmaat.nl",
        telefoon: "0201234567",
        adres: "Industrieweg 10",
        postcode: "1234 AB",
        plaats: "Amsterdam",
        kvkNummer: "12345678",
        btwNummer: "NL123456789B01",
        iban: "NL91ABNA0417164300",
        betalingstermijn: 30,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("KvK nummer validation", () => {
    it("accepts valid 8-digit KvK", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, kvkNummer: "12345678" });
      expect(result.kvkNummer).toBe("12345678");
    });

    it("strips spaces and dots from KvK", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, kvkNummer: "1234.5678" });
      expect(result.kvkNummer).toBe("12345678");
    });

    it("rejects KvK with wrong length", () => {
      expect(leverancierSchema.safeParse({ ...validLeverancier, kvkNummer: "1234567" }).success).toBe(false);
      expect(leverancierSchema.safeParse({ ...validLeverancier, kvkNummer: "123456789" }).success).toBe(false);
    });

    it("rejects KvK with letters", () => {
      expect(leverancierSchema.safeParse({ ...validLeverancier, kvkNummer: "1234ABCD" }).success).toBe(false);
    });

    it("transforms empty KvK to undefined", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, kvkNummer: "" });
      expect(result.kvkNummer).toBeUndefined();
    });
  });

  describe("BTW nummer validation", () => {
    it("accepts valid BTW format 'NL123456789B01'", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, btwNummer: "NL123456789B01" });
      expect(result.btwNummer).toBe("NL123456789B01");
    });

    it("uppercases BTW nummer", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, btwNummer: "nl123456789b01" });
      expect(result.btwNummer).toBe("NL123456789B01");
    });

    it("rejects invalid BTW format", () => {
      expect(leverancierSchema.safeParse({ ...validLeverancier, btwNummer: "12345" }).success).toBe(false);
      expect(leverancierSchema.safeParse({ ...validLeverancier, btwNummer: "DE123456789B01" }).success).toBe(false);
    });

    it("transforms empty BTW to undefined", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, btwNummer: "" });
      expect(result.btwNummer).toBeUndefined();
    });
  });

  describe("IBAN validation", () => {
    it("accepts valid Dutch IBAN", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, iban: "NL91ABNA0417164300" });
      expect(result.iban).toBe("NL91ABNA0417164300");
    });

    it("uppercases and strips spaces from IBAN", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, iban: "nl91 abna 0417 1643 00" });
      expect(result.iban).toBe("NL91ABNA0417164300");
    });

    it("rejects obviously invalid IBAN", () => {
      expect(leverancierSchema.safeParse({ ...validLeverancier, iban: "ABC" }).success).toBe(false);
    });

    it("transforms empty IBAN to undefined", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, iban: "" });
      expect(result.iban).toBeUndefined();
    });
  });

  describe("postcode validation (optional)", () => {
    it("accepts valid postcode", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, postcode: "1234 AB" });
      expect(result.postcode).toBe("1234 AB");
    });

    it("normalizes lowercase postcode", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, postcode: "1234ab" });
      expect(result.postcode).toBe("1234 AB");
    });

    it("transforms empty postcode to undefined", () => {
      const result = leverancierSchema.parse({ ...validLeverancier, postcode: "" });
      expect(result.postcode).toBeUndefined();
    });

    it("rejects invalid postcode", () => {
      expect(leverancierSchema.safeParse({ ...validLeverancier, postcode: "INVALID" }).success).toBe(false);
    });
  });

  describe("betalingstermijn validation", () => {
    it("accepts valid betalingstermijn", () => {
      expect(leverancierSchema.safeParse({ ...validLeverancier, betalingstermijn: 30 }).success).toBe(true);
    });

    it("accepts 0 betalingstermijn", () => {
      expect(leverancierSchema.safeParse({ ...validLeverancier, betalingstermijn: 0 }).success).toBe(true);
    });

    it("rejects negative betalingstermijn", () => {
      expect(leverancierSchema.safeParse({ ...validLeverancier, betalingstermijn: -1 }).success).toBe(false);
    });
  });

  describe("regex patterns (exported)", () => {
    it("KVK_PATTERN matches 8 digits", () => {
      expect(KVK_PATTERN.test("12345678")).toBe(true);
      expect(KVK_PATTERN.test("1234567")).toBe(false);
      expect(KVK_PATTERN.test("123456789")).toBe(false);
    });

    it("BTW_PATTERN matches Dutch BTW format", () => {
      expect(BTW_PATTERN.test("NL123456789B01")).toBe(true);
      expect(BTW_PATTERN.test("NL123456789B99")).toBe(true);
      expect(BTW_PATTERN.test("DE123456789B01")).toBe(false);
    });

    it("IBAN_PATTERN matches valid structure", () => {
      expect(IBAN_PATTERN.test("NL91ABNA0417164300")).toBe(true);
      expect(IBAN_PATTERN.test("DE89370400440532013000")).toBe(true);
    });
  });
});

// ============================================================
// Voorraad Schemas
// ============================================================
describe("voorraad schemas", () => {
  describe("voorraadSchema", () => {
    const validVoorraad = {
      artikelNaam: "Tegels 30x30 grijs",
      categorie: "Bestratingsmaterialen",
      eenheid: "m2",
      hoeveelheid: 500,
    };

    it("accepts valid voorraad", () => {
      expect(voorraadSchema.safeParse(validVoorraad).success).toBe(true);
    });

    it("accepts full data with optional fields", () => {
      const result = voorraadSchema.safeParse({
        ...validVoorraad,
        artikelCode: "TEG-30-GR",
        minimumVoorraad: 50,
        locatie: "Loods A - Rek 3",
        leverancierId: "lev_123",
        kostprijsPerEenheid: 8.50,
        notities: "Populair artikel",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty artikelNaam", () => {
      expect(voorraadSchema.safeParse({ ...validVoorraad, artikelNaam: "" }).success).toBe(false);
    });

    it("rejects empty categorie", () => {
      expect(voorraadSchema.safeParse({ ...validVoorraad, categorie: "" }).success).toBe(false);
    });

    it("rejects empty eenheid", () => {
      expect(voorraadSchema.safeParse({ ...validVoorraad, eenheid: "" }).success).toBe(false);
    });

    it("rejects negative hoeveelheid", () => {
      expect(voorraadSchema.safeParse({ ...validVoorraad, hoeveelheid: -1 }).success).toBe(false);
    });

    it("accepts hoeveelheid of 0", () => {
      expect(voorraadSchema.safeParse({ ...validVoorraad, hoeveelheid: 0 }).success).toBe(true);
    });

    it("rejects negative minimumVoorraad", () => {
      expect(voorraadSchema.safeParse({ ...validVoorraad, minimumVoorraad: -1 }).success).toBe(false);
    });

    it("rejects negative kostprijsPerEenheid", () => {
      expect(voorraadSchema.safeParse({ ...validVoorraad, kostprijsPerEenheid: -1 }).success).toBe(false);
    });

    it("transforms empty optional strings to undefined", () => {
      const result = voorraadSchema.parse({ ...validVoorraad, artikelCode: "", locatie: "  ", notities: "" });
      expect(result.artikelCode).toBeUndefined();
      expect(result.locatie).toBeUndefined();
      expect(result.notities).toBeUndefined();
    });
  });

  describe("voorraadAdjustSchema", () => {
    const validAdjust = {
      voorraadId: "vr_123",
      type: "toevoegen" as const,
      hoeveelheid: 10,
      reden: "Levering ontvangen",
    };

    it("accepts valid adjustment", () => {
      expect(voorraadAdjustSchema.safeParse(validAdjust).success).toBe(true);
    });

    it("accepts all type options", () => {
      for (const type of ["toevoegen", "verwijderen", "correctie"] as const) {
        expect(voorraadAdjustSchema.safeParse({ ...validAdjust, type }).success).toBe(true);
      }
    });

    it("rejects hoeveelheid of 0", () => {
      expect(voorraadAdjustSchema.safeParse({ ...validAdjust, hoeveelheid: 0 }).success).toBe(false);
    });

    it("rejects empty reden", () => {
      expect(voorraadAdjustSchema.safeParse({ ...validAdjust, reden: "" }).success).toBe(false);
    });

    it("rejects empty voorraadId", () => {
      expect(voorraadAdjustSchema.safeParse({ ...validAdjust, voorraadId: "" }).success).toBe(false);
    });

    it("accepts optional projectId and inkooporderId", () => {
      const result = voorraadAdjustSchema.safeParse({
        ...validAdjust,
        projectId: "proj_456",
        inkooporderId: "io_789",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("voorraadMutatieSchema", () => {
    it("accepts valid mutatie", () => {
      const result = voorraadMutatieSchema.safeParse({
        voorraadId: "vr_123",
        type: "in",
        hoeveelheid: 50,
        reden: "Levering",
        datum: new Date(),
      });
      expect(result.success).toBe(true);
    });

    it("accepts all type options", () => {
      for (const type of ["in", "uit", "correctie"] as const) {
        expect(
          voorraadMutatieSchema.safeParse({
            voorraadId: "vr_123",
            type,
            hoeveelheid: 10,
            reden: "Test",
            datum: new Date(),
          }).success
        ).toBe(true);
      }
    });

    it("rejects missing datum", () => {
      expect(
        voorraadMutatieSchema.safeParse({
          voorraadId: "vr_123",
          type: "in",
          hoeveelheid: 10,
          reden: "Test",
        }).success
      ).toBe(false);
    });

    it("accepts optional gebruikerId, projectId, inkooporderId", () => {
      const result = voorraadMutatieSchema.safeParse({
        voorraadId: "vr_123",
        type: "in",
        hoeveelheid: 10,
        reden: "Test",
        datum: new Date(),
        gebruikerId: "user_1",
        projectId: "proj_1",
        inkooporderId: "io_1",
      });
      expect(result.success).toBe(true);
    });
  });
});

// ============================================================
// Project Kosten Schemas
// ============================================================
describe("project-kosten schemas", () => {
  describe("projectKostenTypeEnum", () => {
    it("accepts all valid types", () => {
      for (const type of ["materiaal", "arbeid", "transport", "huur", "onderaannemer", "overig"] as const) {
        expect(projectKostenTypeEnum.safeParse(type).success).toBe(true);
      }
    });

    it("rejects invalid type", () => {
      expect(projectKostenTypeEnum.safeParse("invalid").success).toBe(false);
    });
  });

  describe("projectKostenSchema", () => {
    const validKosten = {
      projectId: "proj_123",
      datum: new Date("2026-03-20"),
      type: "materiaal" as const,
      omschrijving: "Tegels bestrating",
      bedrag: 1250.00,
    };

    it("accepts valid project kosten with Date datum", () => {
      expect(projectKostenSchema.safeParse(validKosten).success).toBe(true);
    });

    it("accepts string datum", () => {
      expect(
        projectKostenSchema.safeParse({ ...validKosten, datum: "2026-03-20" }).success
      ).toBe(true);
    });

    it("rejects empty projectId", () => {
      expect(projectKostenSchema.safeParse({ ...validKosten, projectId: "" }).success).toBe(false);
    });

    it("rejects empty omschrijving", () => {
      expect(projectKostenSchema.safeParse({ ...validKosten, omschrijving: "" }).success).toBe(false);
    });

    it("rejects bedrag of 0", () => {
      expect(projectKostenSchema.safeParse({ ...validKosten, bedrag: 0 }).success).toBe(false);
    });

    it("rejects negative bedrag", () => {
      expect(projectKostenSchema.safeParse({ ...validKosten, bedrag: -100 }).success).toBe(false);
    });

    it("accepts minimal bedrag (0.01)", () => {
      expect(projectKostenSchema.safeParse({ ...validKosten, bedrag: 0.01 }).success).toBe(true);
    });

    it("accepts optional fields", () => {
      const result = projectKostenSchema.safeParse({
        ...validKosten,
        scopeId: "scope_1",
        leverancierId: "lev_1",
        inkooporderId: "io_1",
        factuurNummer: "F-2026-001",
        notities: "Dringend besteld",
      });
      expect(result.success).toBe(true);
    });

    it("transforms empty optional strings to undefined", () => {
      const result = projectKostenSchema.parse({
        ...validKosten,
        scopeId: "",
        factuurNummer: "  ",
        notities: "",
      });
      expect(result.scopeId).toBeUndefined();
      expect(result.factuurNummer).toBeUndefined();
      expect(result.notities).toBeUndefined();
    });
  });

  describe("projectKostenCreateSchema", () => {
    it("accepts string datum", () => {
      const result = projectKostenCreateSchema.safeParse({
        projectId: "proj_123",
        datum: "2026-03-20",
        type: "arbeid",
        omschrijving: "Arbeidsloon",
        bedrag: 500,
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty datum string", () => {
      const result = projectKostenCreateSchema.safeParse({
        projectId: "proj_123",
        datum: "",
        type: "arbeid",
        omschrijving: "Arbeidsloon",
        bedrag: 500,
      });
      expect(result.success).toBe(false);
    });
  });
});

// ============================================================
// Kwaliteits Controle Schemas
// ============================================================
describe("kwaliteits-controle schemas", () => {
  describe("kwaliteitsStatusEnum", () => {
    it("accepts all valid statuses", () => {
      for (const s of ["gepland", "in_uitvoering", "afgerond", "afgekeurd"] as const) {
        expect(kwaliteitsStatusEnum.safeParse(s).success).toBe(true);
      }
    });

    it("rejects invalid status", () => {
      expect(kwaliteitsStatusEnum.safeParse("voltooid").success).toBe(false);
    });
  });

  describe("kwaliteitsResultaatEnum", () => {
    it("accepts all valid resultaten", () => {
      for (const r of ["goedgekeurd", "afgekeurd", "voorwaardelijk"] as const) {
        expect(kwaliteitsResultaatEnum.safeParse(r).success).toBe(true);
      }
    });

    it("rejects invalid resultaat", () => {
      expect(kwaliteitsResultaatEnum.safeParse("neutraal").success).toBe(false);
    });
  });

  describe("controlePuntSchema", () => {
    it("accepts minimal valid data", () => {
      expect(controlePuntSchema.safeParse({ naam: "Waterpas controle" }).success).toBe(true);
    });

    it("accepts full data", () => {
      const result = controlePuntSchema.safeParse({
        naam: "Waterpas controle",
        omschrijving: "Controleer of bestrating waterpas is gelegd",
        resultaat: "goedgekeurd",
        opmerkingen: "Geen afwijkingen gevonden",
        fotoUrls: ["https://example.com/foto1.jpg", "https://example.com/foto2.jpg"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty naam", () => {
      expect(controlePuntSchema.safeParse({ naam: "" }).success).toBe(false);
    });

    it("accepts all resultaat options", () => {
      for (const r of ["goedgekeurd", "afgekeurd", "voorwaardelijk"] as const) {
        expect(controlePuntSchema.safeParse({ naam: "Test", resultaat: r }).success).toBe(true);
      }
    });

    it("transforms empty omschrijving to undefined", () => {
      const result = controlePuntSchema.parse({ naam: "Test", omschrijving: "" });
      expect(result.omschrijving).toBeUndefined();
    });
  });

  describe("kwaliteitsControleSchema", () => {
    const validControle = {
      projectId: "proj_123",
      controleurId: "user_456",
      datum: new Date("2026-03-20"),
      type: "oplevering" as const,
      status: "gepland" as const,
      controlePunten: [{ naam: "Waterpas controle" }],
    };

    it("accepts valid controle", () => {
      expect(kwaliteitsControleSchema.safeParse(validControle).success).toBe(true);
    });

    it("accepts string datum", () => {
      expect(
        kwaliteitsControleSchema.safeParse({ ...validControle, datum: "2026-03-20" }).success
      ).toBe(true);
    });

    it("accepts all type options", () => {
      for (const t of ["tussentijds", "oplevering", "garantie"] as const) {
        expect(kwaliteitsControleSchema.safeParse({ ...validControle, type: t }).success).toBe(true);
      }
    });

    it("rejects empty controlePunten", () => {
      expect(
        kwaliteitsControleSchema.safeParse({ ...validControle, controlePunten: [] }).success
      ).toBe(false);
    });

    it("rejects missing projectId", () => {
      expect(
        kwaliteitsControleSchema.safeParse({ ...validControle, projectId: "" }).success
      ).toBe(false);
    });

    it("rejects missing controleurId", () => {
      expect(
        kwaliteitsControleSchema.safeParse({ ...validControle, controleurId: "" }).success
      ).toBe(false);
    });

    it("accepts optional fields", () => {
      const result = kwaliteitsControleSchema.safeParse({
        ...validControle,
        scopeId: "scope_1",
        algemeenResultaat: "goedgekeurd",
        opmerkingen: "Alles ziet er goed uit",
        vervolgacties: "Geen",
      });
      expect(result.success).toBe(true);
    });

    it("transforms empty optional strings to undefined", () => {
      const result = kwaliteitsControleSchema.parse({
        ...validControle,
        scopeId: "",
        opmerkingen: "  ",
        vervolgacties: "",
      });
      expect(result.scopeId).toBeUndefined();
      expect(result.opmerkingen).toBeUndefined();
      expect(result.vervolgacties).toBeUndefined();
    });
  });

  describe("kwaliteitsControleCreateSchema", () => {
    it("accepts string datum", () => {
      const result = kwaliteitsControleCreateSchema.safeParse({
        projectId: "proj_123",
        controleurId: "user_456",
        datum: "2026-03-20",
        type: "tussentijds",
        status: "gepland",
        controlePunten: [{ naam: "Check" }],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty datum string", () => {
      const result = kwaliteitsControleCreateSchema.safeParse({
        projectId: "proj_123",
        controleurId: "user_456",
        datum: "",
        type: "tussentijds",
        status: "gepland",
        controlePunten: [{ naam: "Check" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("afkeurItemSchema", () => {
    it("accepts valid afkeur item", () => {
      const result = afkeurItemSchema.safeParse({
        controlePuntNaam: "Waterpas",
        reden: "Bestrating niet waterpas gelegd",
      });
      expect(result.success).toBe(true);
    });

    it("accepts full data", () => {
      const result = afkeurItemSchema.safeParse({
        controlePuntNaam: "Waterpas",
        reden: "Bestrating niet waterpas gelegd",
        herstelActie: "Bestrating opnieuw leggen",
        deadline: "2026-04-01",
        verantwoordelijke: "Jan",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty reden", () => {
      expect(
        afkeurItemSchema.safeParse({ controlePuntNaam: "Waterpas", reden: "" }).success
      ).toBe(false);
    });

    it("transforms empty optional strings to undefined", () => {
      const result = afkeurItemSchema.parse({
        controlePuntNaam: "Test",
        reden: "Afgekeurd",
        herstelActie: "",
        deadline: "  ",
        verantwoordelijke: "",
      });
      expect(result.herstelActie).toBeUndefined();
      expect(result.deadline).toBeUndefined();
      expect(result.verantwoordelijke).toBeUndefined();
    });
  });
});
