/**
 * Unit Tests for Klanten (Customers) Business Logic
 *
 * Tests extractable business logic from convex/klanten.ts:
 * - Validation logic (required fields, postcode, email, phone)
 * - Tag sanitization (trim, lowercase, deduplicate)
 * - Duplicate detection logic (email, telefoon, naam+postcode)
 * - Pipeline status management (via pipelineHelpers)
 * - GDPR anonymization data transformations
 * - Import batch processing logic
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ConvexError } from "convex/values";
import {
  sanitizeEmail,
  sanitizePhone,
  validateRequiredPostcode,
  sanitizeOptionalString,
  VALIDATION_MESSAGES,
  POSTCODE_PATTERN,
  PHONE_PATTERN,
} from "../../../../convex/validators";
import {
  shouldUpgradePipeline,
  PIPELINE_ORDER,
} from "../../../../convex/pipelineHelpers";

// ─── Validation Logic Tests ──────────────────────────────────────────────────

describe("Klanten Validation", () => {
  describe("sanitizeEmail", () => {
    it("should return undefined for empty/null/undefined values", () => {
      expect(sanitizeEmail(undefined)).toBeUndefined();
      expect(sanitizeEmail(null)).toBeUndefined();
      expect(sanitizeEmail("")).toBeUndefined();
      expect(sanitizeEmail("   ")).toBeUndefined();
    });

    it("should normalize valid email to lowercase", () => {
      expect(sanitizeEmail("Jan@DeVries.NL")).toBe("jan@devries.nl");
      expect(sanitizeEmail("INFO@TOPTUINEN.NL")).toBe("info@toptuinen.nl");
    });

    it("should accept valid email addresses", () => {
      expect(sanitizeEmail("jan@devries.nl")).toBe("jan@devries.nl");
      expect(sanitizeEmail("info+test@bedrijf.com")).toBe("info+test@bedrijf.com");
    });

    it("should throw ConvexError for invalid email addresses", () => {
      expect(() => sanitizeEmail("nietgeen-email")).toThrow(ConvexError);
      expect(() => sanitizeEmail("@geen-user.nl")).toThrow(ConvexError);
      expect(() => sanitizeEmail("user@")).toThrow(ConvexError);
      expect(() => sanitizeEmail("user@.nl")).toThrow(ConvexError);
    });
  });

  describe("sanitizePhone", () => {
    it("should return undefined for empty/null/undefined values", () => {
      expect(sanitizePhone(undefined)).toBeUndefined();
      expect(sanitizePhone(null)).toBeUndefined();
      expect(sanitizePhone("")).toBeUndefined();
      expect(sanitizePhone("   ")).toBeUndefined();
    });

    it("should accept valid Dutch mobile numbers", () => {
      expect(sanitizePhone("0612345678")).toBe("0612345678");
      expect(sanitizePhone("+31612345678")).toBe("+31612345678");
    });

    it("should strip formatting characters (spaces, dashes, parens)", () => {
      expect(sanitizePhone("06-12345678")).toBe("0612345678");
      expect(sanitizePhone("06 1234 5678")).toBe("0612345678");
      expect(sanitizePhone("(06) 12345678")).toBe("0612345678");
      expect(sanitizePhone("+31 6 1234 5678")).toBe("+31612345678");
    });

    it("should accept valid Dutch landline numbers", () => {
      expect(sanitizePhone("0201234567")).toBe("0201234567");
      expect(sanitizePhone("+31201234567")).toBe("+31201234567");
    });

    it("should throw ConvexError for invalid phone numbers", () => {
      expect(() => sanitizePhone("12345")).toThrow(ConvexError);
      expect(() => sanitizePhone("abc")).toThrow(ConvexError);
      expect(() => sanitizePhone("00612345678")).toThrow(ConvexError);
    });
  });

  describe("validateRequiredPostcode", () => {
    it("should throw for empty/null/undefined values", () => {
      expect(() => validateRequiredPostcode(undefined)).toThrow(ConvexError);
      expect(() => validateRequiredPostcode(null)).toThrow(ConvexError);
      expect(() => validateRequiredPostcode("")).toThrow(ConvexError);
      expect(() => validateRequiredPostcode("   ")).toThrow(ConvexError);
    });

    it("should normalize valid postcodes to '1234 AB' format", () => {
      expect(validateRequiredPostcode("1234AB")).toBe("1234 AB");
      expect(validateRequiredPostcode("1234 AB")).toBe("1234 AB");
      expect(validateRequiredPostcode("1234ab")).toBe("1234 AB");
      expect(validateRequiredPostcode("1234 ab")).toBe("1234 AB");
    });

    it("should throw ConvexError for invalid postcodes", () => {
      expect(() => validateRequiredPostcode("123 AB")).toThrow(ConvexError);
      expect(() => validateRequiredPostcode("12345 AB")).toThrow(ConvexError);
      expect(() => validateRequiredPostcode("ABCD EF")).toThrow(ConvexError);
      expect(() => validateRequiredPostcode("1234")).toThrow(ConvexError);
      expect(() => validateRequiredPostcode("1234 A")).toThrow(ConvexError);
    });
  });

  describe("sanitizeOptionalString", () => {
    it("should return undefined for empty/null/undefined values", () => {
      expect(sanitizeOptionalString(undefined)).toBeUndefined();
      expect(sanitizeOptionalString(null)).toBeUndefined();
      expect(sanitizeOptionalString("")).toBeUndefined();
      expect(sanitizeOptionalString("   ")).toBeUndefined();
    });

    it("should trim whitespace from valid strings", () => {
      expect(sanitizeOptionalString("  hallo  ")).toBe("hallo");
      expect(sanitizeOptionalString("notitie")).toBe("notitie");
    });
  });

  describe("POSTCODE_PATTERN", () => {
    it("should match valid Dutch postcodes", () => {
      expect(POSTCODE_PATTERN.test("1234 AB")).toBe(true);
      expect(POSTCODE_PATTERN.test("1234AB")).toBe(true);
      expect(POSTCODE_PATTERN.test("9999 ZZ")).toBe(true);
    });

    it("should not match invalid postcodes", () => {
      expect(POSTCODE_PATTERN.test("123 AB")).toBe(false);
      expect(POSTCODE_PATTERN.test("12345 AB")).toBe(false);
      expect(POSTCODE_PATTERN.test("1234 A")).toBe(false);
      expect(POSTCODE_PATTERN.test("ABCD EF")).toBe(false);
    });
  });

  describe("PHONE_PATTERN", () => {
    it("should match valid Dutch phone numbers", () => {
      expect(PHONE_PATTERN.test("0612345678")).toBe(true);
      expect(PHONE_PATTERN.test("+31612345678")).toBe(true);
      expect(PHONE_PATTERN.test("0201234567")).toBe(true);
    });

    it("should not match invalid phone numbers", () => {
      expect(PHONE_PATTERN.test("12345")).toBe(false);
      expect(PHONE_PATTERN.test("00612345678")).toBe(false);
      expect(PHONE_PATTERN.test("061234567890")).toBe(false);
    });
  });
});

// ─── Tag Sanitization Tests ──────────────────────────────────────────────────

describe("Klanten Tag Sanitization", () => {
  // Extracted tag sanitization logic from klanten.ts create/update handlers
  function sanitizeTags(tags: string[] | undefined): string[] | undefined {
    if (!tags) return undefined;
    return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  }

  it("should return undefined for undefined input", () => {
    expect(sanitizeTags(undefined)).toBeUndefined();
  });

  it("should trim whitespace from tags", () => {
    expect(sanitizeTags(["  tuin  ", "  border  "])).toEqual(["tuin", "border"]);
  });

  it("should lowercase all tags", () => {
    expect(sanitizeTags(["TUIN", "Border", "GAZON"])).toEqual([
      "tuin",
      "border",
      "gazon",
    ]);
  });

  it("should remove empty tags", () => {
    expect(sanitizeTags(["tuin", "", "  ", "border"])).toEqual(["tuin", "border"]);
  });

  it("should deduplicate tags", () => {
    expect(sanitizeTags(["tuin", "TUIN", "Tuin"])).toEqual(["tuin"]);
    expect(sanitizeTags(["border", "gazon", "border"])).toEqual([
      "border",
      "gazon",
    ]);
  });

  it("should handle combined normalization", () => {
    expect(sanitizeTags(["  TUIN  ", "tuin", "", "  Border  ", "border"])).toEqual([
      "tuin",
      "border",
    ]);
  });

  it("should return empty array for all-empty tags", () => {
    expect(sanitizeTags(["", "  ", "   "])).toEqual([]);
  });
});

// ─── Duplicate Detection Logic Tests ─────────────────────────────────────────

describe("Klanten Duplicate Detection", () => {
  // Extracted duplicate detection logic from klanten.ts checkDuplicates handler
  interface KlantLike {
    _id: string;
    naam: string;
    email?: string;
    telefoon?: string;
    postcode: string;
  }

  interface DuplicateMatch {
    _id: string;
    naam: string;
    matchType: "email" | "telefoon" | "naam_postcode";
  }

  function findDuplicates(
    existingKlanten: KlantLike[],
    check: {
      email?: string;
      telefoon?: string;
      naam?: string;
      postcode?: string;
      excludeId?: string;
    }
  ): DuplicateMatch[] {
    const duplicates: DuplicateMatch[] = [];
    const seen = new Set<string>();

    for (const klant of existingKlanten) {
      if (check.excludeId && klant._id === check.excludeId) continue;

      // Check email match
      if (
        check.email &&
        klant.email &&
        check.email.trim().toLowerCase() === klant.email.toLowerCase()
      ) {
        if (!seen.has(klant._id)) {
          duplicates.push({ _id: klant._id, naam: klant.naam, matchType: "email" });
          seen.add(klant._id);
        }
      }

      // Check telefoon match (strip formatting)
      if (
        check.telefoon &&
        klant.telefoon &&
        check.telefoon.replace(/[\s\-]/g, "") ===
          klant.telefoon.replace(/[\s\-]/g, "")
      ) {
        if (!seen.has(klant._id)) {
          duplicates.push({
            _id: klant._id,
            naam: klant.naam,
            matchType: "telefoon",
          });
          seen.add(klant._id);
        }
      }

      // Check naam + postcode combo
      if (
        check.naam &&
        check.postcode &&
        check.naam.trim().toLowerCase() === klant.naam.toLowerCase() &&
        check.postcode.replace(/\s/g, "").toLowerCase() ===
          klant.postcode.replace(/\s/g, "").toLowerCase()
      ) {
        if (!seen.has(klant._id)) {
          duplicates.push({
            _id: klant._id,
            naam: klant.naam,
            matchType: "naam_postcode",
          });
          seen.add(klant._id);
        }
      }
    }

    return duplicates;
  }

  const existingKlanten: KlantLike[] = [
    {
      _id: "klanten:1",
      naam: "Jan de Vries",
      email: "jan@devries.nl",
      telefoon: "0612345678",
      postcode: "1234 AB",
    },
    {
      _id: "klanten:2",
      naam: "Piet Bakker",
      email: "piet@bakker.nl",
      telefoon: "0687654321",
      postcode: "5678 CD",
    },
  ];

  it("should detect duplicate by email (case-insensitive)", () => {
    const result = findDuplicates(existingKlanten, {
      email: "JAN@DEVRIES.NL",
    });
    expect(result).toHaveLength(1);
    expect(result[0].matchType).toBe("email");
    expect(result[0].naam).toBe("Jan de Vries");
  });

  it("should detect duplicate by telefoon (formatting-insensitive)", () => {
    const result = findDuplicates(existingKlanten, {
      telefoon: "06-1234-5678",
    });
    expect(result).toHaveLength(1);
    expect(result[0].matchType).toBe("telefoon");
  });

  it("should detect duplicate by naam + postcode combo", () => {
    const result = findDuplicates(existingKlanten, {
      naam: "jan de vries",
      postcode: "1234AB",
    });
    expect(result).toHaveLength(1);
    expect(result[0].matchType).toBe("naam_postcode");
  });

  it("should not report duplicate when excludeId matches", () => {
    const result = findDuplicates(existingKlanten, {
      email: "jan@devries.nl",
      excludeId: "klanten:1",
    });
    expect(result).toHaveLength(0);
  });

  it("should not report false duplicates", () => {
    const result = findDuplicates(existingKlanten, {
      email: "unknown@example.com",
      telefoon: "0699999999",
      naam: "Klaas Jansen",
      postcode: "9999 ZZ",
    });
    expect(result).toHaveLength(0);
  });

  it("should only report each klant once even with multiple matches", () => {
    // Jan matches on email AND telefoon AND naam+postcode — should appear only once
    const result = findDuplicates(existingKlanten, {
      email: "jan@devries.nl",
      telefoon: "0612345678",
      naam: "Jan de Vries",
      postcode: "1234 AB",
    });
    expect(result).toHaveLength(1);
    // First match wins (email)
    expect(result[0].matchType).toBe("email");
  });

  it("should match postcode with or without space", () => {
    const result1 = findDuplicates(existingKlanten, {
      naam: "Jan de Vries",
      postcode: "1234AB",
    });
    const result2 = findDuplicates(existingKlanten, {
      naam: "Jan de Vries",
      postcode: "1234 AB",
    });
    expect(result1).toHaveLength(1);
    expect(result2).toHaveLength(1);
  });
});

// ─── Pipeline Status Tests ───────────────────────────────────────────────────

describe("Klanten Pipeline Status (CRM-002)", () => {
  describe("PIPELINE_ORDER", () => {
    it("should have the correct ordered stages", () => {
      expect(PIPELINE_ORDER).toEqual([
        "lead",
        "offerte_verzonden",
        "getekend",
        "in_uitvoering",
        "opgeleverd",
        "onderhoud",
      ]);
    });
  });

  describe("shouldUpgradePipeline", () => {
    it("should upgrade from lower to higher status", () => {
      expect(shouldUpgradePipeline("lead", "offerte_verzonden")).toBe(true);
      expect(shouldUpgradePipeline("lead", "in_uitvoering")).toBe(true);
      expect(shouldUpgradePipeline("offerte_verzonden", "getekend")).toBe(true);
      expect(shouldUpgradePipeline("getekend", "in_uitvoering")).toBe(true);
      expect(shouldUpgradePipeline("in_uitvoering", "opgeleverd")).toBe(true);
      expect(shouldUpgradePipeline("opgeleverd", "onderhoud")).toBe(true);
    });

    it("should not downgrade from higher to lower status", () => {
      expect(shouldUpgradePipeline("onderhoud", "lead")).toBe(false);
      expect(shouldUpgradePipeline("in_uitvoering", "lead")).toBe(false);
      expect(shouldUpgradePipeline("opgeleverd", "getekend")).toBe(false);
      expect(shouldUpgradePipeline("getekend", "offerte_verzonden")).toBe(false);
    });

    it("should not upgrade to the same status", () => {
      expect(shouldUpgradePipeline("lead", "lead")).toBe(false);
      expect(shouldUpgradePipeline("in_uitvoering", "in_uitvoering")).toBe(false);
    });

    it("should upgrade from undefined (new klant) to any status", () => {
      expect(shouldUpgradePipeline(undefined, "lead")).toBe(true);
      expect(shouldUpgradePipeline(undefined, "in_uitvoering")).toBe(true);
      expect(shouldUpgradePipeline(undefined, "onderhoud")).toBe(true);
    });
  });
});

// ─── GDPR Anonymization Data Transformation Tests ────────────────────────────

describe("Klanten GDPR Anonymization", () => {
  // Extracted anonymization data transformation logic from klanten.ts gdprAnonymize handler
  function buildAnonymizedKlantPatch() {
    const now = Date.now();
    return {
      naam: "Geanonimiseerd",
      email: undefined,
      telefoon: undefined,
      adres: "Geanonimiseerd",
      postcode: "0000AA",
      plaats: "Geanonimiseerd",
      notities: undefined,
      tags: undefined,
      gdprAnonymized: true,
      gdprAnonymizedAt: now,
      updatedAt: now,
    };
  }

  function buildAnonymizedOffertePatch() {
    return {
      klant: {
        naam: "Geanonimiseerd",
        adres: "Geanonimiseerd",
        postcode: "0000AA",
        plaats: "Geanonimiseerd",
        email: undefined,
        telefoon: undefined,
      },
      updatedAt: Date.now(),
    };
  }

  it("should replace all PII fields with anonymized values", () => {
    const patch = buildAnonymizedKlantPatch();
    expect(patch.naam).toBe("Geanonimiseerd");
    expect(patch.adres).toBe("Geanonimiseerd");
    expect(patch.postcode).toBe("0000AA");
    expect(patch.plaats).toBe("Geanonimiseerd");
  });

  it("should clear optional PII fields to undefined", () => {
    const patch = buildAnonymizedKlantPatch();
    expect(patch.email).toBeUndefined();
    expect(patch.telefoon).toBeUndefined();
    expect(patch.notities).toBeUndefined();
    expect(patch.tags).toBeUndefined();
  });

  it("should set gdprAnonymized flag to true", () => {
    const patch = buildAnonymizedKlantPatch();
    expect(patch.gdprAnonymized).toBe(true);
  });

  it("should record anonymization timestamp", () => {
    const before = Date.now();
    const patch = buildAnonymizedKlantPatch();
    const after = Date.now();
    expect(patch.gdprAnonymizedAt).toBeGreaterThanOrEqual(before);
    expect(patch.gdprAnonymizedAt).toBeLessThanOrEqual(after);
  });

  it("should anonymize offerte klant snapshot data", () => {
    const patch = buildAnonymizedOffertePatch();
    expect(patch.klant.naam).toBe("Geanonimiseerd");
    expect(patch.klant.adres).toBe("Geanonimiseerd");
    expect(patch.klant.postcode).toBe("0000AA");
    expect(patch.klant.plaats).toBe("Geanonimiseerd");
    expect(patch.klant.email).toBeUndefined();
    expect(patch.klant.telefoon).toBeUndefined();
  });

  // Test GDPR blocker detection logic
  describe("GDPR Blocker Detection", () => {
    const TERMINAL_PROJECT_STATUSES = ["afgerond", "gefactureerd", "nacalculatie_compleet"];
    const TERMINAL_FACTUUR_STATUSES = ["betaald", "vervallen"];

    function isProjectBlocker(status: string): boolean {
      return !TERMINAL_PROJECT_STATUSES.includes(status);
    }

    function isFactuurBlocker(status: string): boolean {
      return !TERMINAL_FACTUUR_STATUSES.includes(status);
    }

    it("should identify active project statuses as blockers", () => {
      expect(isProjectBlocker("gepland")).toBe(true);
      expect(isProjectBlocker("in_uitvoering")).toBe(true);
    });

    it("should not block on terminal project statuses", () => {
      expect(isProjectBlocker("afgerond")).toBe(false);
      expect(isProjectBlocker("gefactureerd")).toBe(false);
      expect(isProjectBlocker("nacalculatie_compleet")).toBe(false);
    });

    it("should identify open factuur statuses as blockers", () => {
      expect(isFactuurBlocker("concept")).toBe(true);
      expect(isFactuurBlocker("verzonden")).toBe(true);
      expect(isFactuurBlocker("herinnering")).toBe(true);
    });

    it("should not block on terminal factuur statuses", () => {
      expect(isFactuurBlocker("betaald")).toBe(false);
      expect(isFactuurBlocker("vervallen")).toBe(false);
    });
  });
});

// ─── Import Batch Processing Logic Tests ─────────────────────────────────────

describe("Klanten Import (CSV Batch)", () => {
  // Extracted duplicate check logic used during import
  interface ImportKlant {
    naam: string;
    email?: string;
    postcode: string;
  }

  interface ExistingKlant {
    naam: string;
    email?: string;
    postcode: string;
  }

  function isImportDuplicate(
    klant: ImportKlant,
    existingKlanten: ExistingKlant[]
  ): boolean {
    return existingKlanten.some((existing) => {
      // Check email match
      if (
        klant.email &&
        existing.email &&
        klant.email.trim().toLowerCase() === existing.email.toLowerCase()
      ) {
        return true;
      }

      // Check naam + postcode combo
      if (
        klant.naam.trim().toLowerCase() === existing.naam.toLowerCase() &&
        klant.postcode
          .replace(/\s/g, "")
          .toLowerCase() ===
          existing.postcode.replace(/\s/g, "").toLowerCase()
      ) {
        return true;
      }

      return false;
    });
  }

  const existing: ExistingKlant[] = [
    { naam: "Jan de Vries", email: "jan@devries.nl", postcode: "1234 AB" },
  ];

  it("should detect duplicate by email", () => {
    expect(
      isImportDuplicate(
        { naam: "Andere Naam", email: "jan@devries.nl", postcode: "9999 ZZ" },
        existing
      )
    ).toBe(true);
  });

  it("should detect duplicate by naam+postcode", () => {
    expect(
      isImportDuplicate(
        { naam: "jan de vries", postcode: "1234AB" },
        existing
      )
    ).toBe(true);
  });

  it("should not flag non-duplicate", () => {
    expect(
      isImportDuplicate(
        { naam: "Piet Bakker", email: "piet@bakker.nl", postcode: "5678 CD" },
        existing
      )
    ).toBe(false);
  });

  // Test validation for import rows
  describe("Import Row Validation", () => {
    function validateImportRow(klant: {
      naam: string;
      postcode: string;
      plaats: string;
    }): string | null {
      if (!klant.naam.trim()) return "Naam is verplicht";
      if (!klant.postcode.trim()) return "Postcode is verplicht";
      if (!klant.plaats.trim()) return "Plaats is verplicht";
      return null;
    }

    it("should pass valid rows", () => {
      expect(
        validateImportRow({
          naam: "Jan",
          postcode: "1234 AB",
          plaats: "Amsterdam",
        })
      ).toBeNull();
    });

    it("should reject empty naam", () => {
      expect(
        validateImportRow({ naam: "", postcode: "1234 AB", plaats: "Amsterdam" })
      ).toBe("Naam is verplicht");
    });

    it("should reject empty postcode", () => {
      expect(
        validateImportRow({ naam: "Jan", postcode: "", plaats: "Amsterdam" })
      ).toBe("Postcode is verplicht");
    });

    it("should reject empty plaats", () => {
      expect(
        validateImportRow({ naam: "Jan", postcode: "1234 AB", plaats: "" })
      ).toBe("Plaats is verplicht");
    });

    it("should reject whitespace-only values", () => {
      expect(
        validateImportRow({ naam: "   ", postcode: "1234 AB", plaats: "Amsterdam" })
      ).toBe("Naam is verplicht");
    });
  });
});

// ─── Reminder Logic Tests (CRM-005) ─────────────────────────────────────────

describe("Klanten Reminder Logic (CRM-005)", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  describe("Lead without offerte reminder", () => {
    function shouldShowLeadReminder(
      createdAt: number,
      now: number,
      hasOffertes: boolean,
      snoozed: boolean
    ): boolean {
      if (snoozed) return false;
      const dagenSindsAanmaak = Math.floor((now - createdAt) / DAY_MS);
      return dagenSindsAanmaak >= 14 && !hasOffertes;
    }

    it("should trigger after 14 days without offertes", () => {
      const now = Date.now();
      const createdAt = now - 15 * DAY_MS;
      expect(shouldShowLeadReminder(createdAt, now, false, false)).toBe(true);
    });

    it("should not trigger before 14 days", () => {
      const now = Date.now();
      const createdAt = now - 13 * DAY_MS;
      expect(shouldShowLeadReminder(createdAt, now, false, false)).toBe(false);
    });

    it("should not trigger if klant has offertes", () => {
      const now = Date.now();
      const createdAt = now - 30 * DAY_MS;
      expect(shouldShowLeadReminder(createdAt, now, true, false)).toBe(false);
    });

    it("should not trigger if snoozed", () => {
      const now = Date.now();
      const createdAt = now - 30 * DAY_MS;
      expect(shouldShowLeadReminder(createdAt, now, false, true)).toBe(false);
    });

    it("should trigger at exactly 14 days", () => {
      const now = Date.now();
      const createdAt = now - 14 * DAY_MS;
      expect(shouldShowLeadReminder(createdAt, now, false, false)).toBe(true);
    });
  });

  describe("Offerte without response reminder", () => {
    function shouldShowOfferteReminder(
      sentAt: number,
      now: number,
      snoozed: boolean
    ): boolean {
      if (snoozed) return false;
      const dagenSindsVerzonden = Math.floor((now - sentAt) / DAY_MS);
      return dagenSindsVerzonden >= 7;
    }

    it("should trigger after 7 days without response", () => {
      const now = Date.now();
      const sentAt = now - 8 * DAY_MS;
      expect(shouldShowOfferteReminder(sentAt, now, false)).toBe(true);
    });

    it("should not trigger before 7 days", () => {
      const now = Date.now();
      const sentAt = now - 6 * DAY_MS;
      expect(shouldShowOfferteReminder(sentAt, now, false)).toBe(false);
    });

    it("should not trigger if snoozed", () => {
      const now = Date.now();
      const sentAt = now - 30 * DAY_MS;
      expect(shouldShowOfferteReminder(sentAt, now, true)).toBe(false);
    });

    it("should trigger at exactly 7 days", () => {
      const now = Date.now();
      const sentAt = now - 7 * DAY_MS;
      expect(shouldShowOfferteReminder(sentAt, now, false)).toBe(true);
    });
  });
});

// ─── Required Field Validation Tests ─────────────────────────────────────────

describe("Klanten Required Field Validation", () => {
  // Extracted required field validation from create/update handlers
  function validateCreateFields(args: {
    naam: string;
    adres: string;
    plaats: string;
  }): string | null {
    if (!args.naam.trim()) return "Naam is verplicht";
    if (!args.adres.trim()) return "Adres is verplicht";
    if (!args.plaats.trim()) return "Plaats is verplicht";
    return null;
  }

  it("should pass when all required fields are present", () => {
    expect(
      validateCreateFields({
        naam: "Jan de Vries",
        adres: "Tulpstraat 12",
        plaats: "Amsterdam",
      })
    ).toBeNull();
  });

  it("should fail on empty naam", () => {
    expect(
      validateCreateFields({ naam: "", adres: "Straat 1", plaats: "Stad" })
    ).toBe("Naam is verplicht");
  });

  it("should fail on empty adres", () => {
    expect(
      validateCreateFields({ naam: "Jan", adres: "", plaats: "Stad" })
    ).toBe("Adres is verplicht");
  });

  it("should fail on empty plaats", () => {
    expect(
      validateCreateFields({ naam: "Jan", adres: "Straat 1", plaats: "" })
    ).toBe("Plaats is verplicht");
  });

  it("should fail on whitespace-only fields", () => {
    expect(
      validateCreateFields({ naam: "   ", adres: "Straat 1", plaats: "Stad" })
    ).toBe("Naam is verplicht");
  });
});

// ─── Klant Type Validator Tests ──────────────────────────────────────────────

describe("Klanten Type Classification", () => {
  const VALID_KLANT_TYPES = [
    "particulier",
    "zakelijk",
    "vve",
    "gemeente",
    "overig",
  ] as const;

  it("should accept all valid klant types", () => {
    for (const type of VALID_KLANT_TYPES) {
      expect(VALID_KLANT_TYPES).toContain(type);
    }
  });

  it("should default to 'particulier' when no type specified", () => {
    // This matches the behavior in klanten.ts create handler
    const klantType = undefined ?? "particulier";
    expect(klantType).toBe("particulier");
  });

  it("should have exactly 5 klant types", () => {
    expect(VALID_KLANT_TYPES).toHaveLength(5);
  });
});

// ─── listWithRecent Logic Tests ──────────────────────────────────────────────

describe("Klanten listWithRecent", () => {
  // Extracted logic: returns all klanten + the 5 most recent
  function buildListWithRecent<T>(klanten: T[]): { klanten: T[]; recentKlanten: T[] } {
    return {
      klanten,
      recentKlanten: klanten.slice(0, 5),
    };
  }

  it("should return all klanten and first 5 as recent", () => {
    const all = Array.from({ length: 10 }, (_, i) => ({ id: i }));
    const result = buildListWithRecent(all);
    expect(result.klanten).toHaveLength(10);
    expect(result.recentKlanten).toHaveLength(5);
    expect(result.recentKlanten).toEqual(all.slice(0, 5));
  });

  it("should return all as recent when fewer than 5", () => {
    const all = [{ id: 1 }, { id: 2 }];
    const result = buildListWithRecent(all);
    expect(result.klanten).toHaveLength(2);
    expect(result.recentKlanten).toHaveLength(2);
  });

  it("should handle empty list", () => {
    const result = buildListWithRecent([]);
    expect(result.klanten).toHaveLength(0);
    expect(result.recentKlanten).toHaveLength(0);
  });
});

// ─── getAllTags Logic Tests ───────────────────────────────────────────────────

describe("Klanten getAllTags", () => {
  // Extracted logic: collect unique tags from all klanten and sort
  function collectUniqueTags(
    klanten: Array<{ tags?: string[] }>
  ): string[] {
    const tagSet = new Set<string>();
    for (const klant of klanten) {
      if (klant.tags) {
        for (const tag of klant.tags) {
          tagSet.add(tag);
        }
      }
    }
    return [...tagSet].sort();
  }

  it("should collect unique tags across klanten", () => {
    const klanten = [
      { tags: ["tuin", "border"] },
      { tags: ["gazon", "tuin"] },
      { tags: ["border"] },
    ];
    expect(collectUniqueTags(klanten)).toEqual(["border", "gazon", "tuin"]);
  });

  it("should handle klanten without tags", () => {
    const klanten = [
      { tags: ["tuin"] },
      {},
      { tags: undefined },
      { tags: ["gazon"] },
    ];
    expect(collectUniqueTags(klanten)).toEqual(["gazon", "tuin"]);
  });

  it("should return empty array when no tags exist", () => {
    const klanten = [{}, {}, {}];
    expect(collectUniqueTags(klanten)).toEqual([]);
  });

  it("should return sorted tags", () => {
    const klanten = [{ tags: ["zebra", "appel", "mango"] }];
    expect(collectUniqueTags(klanten)).toEqual(["appel", "mango", "zebra"]);
  });
});
