import { describe, it, expect } from "vitest";
import {
  inputPatterns,
  getInputPattern,
  validateInput,
  formatInput,
} from "@/lib/input-patterns";
import type { InputPatternKey } from "@/lib/input-patterns";

// ============================================================
// Configuration completeness
// ============================================================
describe("input patterns configuration", () => {
  const expectedKeys: InputPatternKey[] = [
    "postcode",
    "telefoon",
    "email",
    "oppervlakte",
    "bedrag",
    "huisnummer",
    "kvkNummer",
    "btwNummer",
    "iban",
  ];

  it("defines all expected input patterns", () => {
    for (const key of expectedKeys) {
      expect(inputPatterns[key]).toBeDefined();
    }
  });

  it("every pattern has a placeholder", () => {
    for (const key of expectedKeys) {
      expect(inputPatterns[key].placeholder).toBeDefined();
      expect(inputPatterns[key].placeholder!.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// getInputPattern helper
// ============================================================
describe("getInputPattern", () => {
  it("returns config for known key", () => {
    const config = getInputPattern("postcode");
    expect(config).toBeDefined();
    expect(config.placeholder).toBe("1234 AB");
  });

  it("returns config for each key", () => {
    const keys: InputPatternKey[] = [
      "postcode", "telefoon", "email", "oppervlakte",
      "bedrag", "huisnummer", "kvkNummer", "btwNummer", "iban",
    ];
    for (const key of keys) {
      expect(getInputPattern(key)).toBeDefined();
    }
  });
});

// ============================================================
// Postcode validation and formatting
// ============================================================
describe("postcode pattern", () => {
  it("validates correct postcode '1234 AB'", () => {
    expect(validateInput("postcode", "1234 AB")).toBe(true);
  });

  it("validates postcode without space '1234AB'", () => {
    expect(validateInput("postcode", "1234AB")).toBe(true);
  });

  it("validates lowercase '1234ab'", () => {
    expect(validateInput("postcode", "1234ab")).toBe(true);
  });

  it("rejects postcode starting with 0", () => {
    expect(validateInput("postcode", "0123 AB")).toBe(false);
  });

  it("rejects too few digits", () => {
    expect(validateInput("postcode", "123 AB")).toBe(false);
  });

  it("formats '1234ab' to '1234 AB'", () => {
    expect(formatInput("postcode", "1234ab")).toBe("1234 AB");
  });

  it("formats '1234AB' to '1234 AB'", () => {
    expect(formatInput("postcode", "1234AB")).toBe("1234 AB");
  });

  it("formats partial input '1234' correctly", () => {
    expect(formatInput("postcode", "1234")).toBe("1234");
  });
});

// ============================================================
// Telefoon validation and formatting
// ============================================================
describe("telefoon pattern", () => {
  it("validates '0612345678'", () => {
    expect(validateInput("telefoon", "0612345678")).toBe(true);
  });

  it("validates '+31612345678'", () => {
    expect(validateInput("telefoon", "+31612345678")).toBe(true);
  });

  it("validates with spaces '06 1234 5678'", () => {
    expect(validateInput("telefoon", "06 1234 5678")).toBe(true);
  });

  it("rejects too short number", () => {
    expect(validateInput("telefoon", "06123")).toBe(false);
  });

  it("formats mobile number '0612345678' with spaces", () => {
    const result = formatInput("telefoon", "0612345678");
    expect(result).toBe("06 1234 5678");
  });

  it("formats landline '0201234567' with spaces", () => {
    const result = formatInput("telefoon", "0201234567");
    expect(result).toBe("020 123 4567");
  });
});

// ============================================================
// Email validation
// ============================================================
describe("email pattern", () => {
  it("validates 'user@example.nl'", () => {
    expect(validateInput("email", "user@example.nl")).toBe(true);
  });

  it("rejects 'invalid-email'", () => {
    expect(validateInput("email", "invalid-email")).toBe(false);
  });

  it("rejects email without domain", () => {
    expect(validateInput("email", "user@")).toBe(false);
  });
});

// ============================================================
// Oppervlakte validation
// ============================================================
describe("oppervlakte pattern", () => {
  it("validates positive number", () => {
    expect(validateInput("oppervlakte", "100")).toBe(true);
  });

  it("validates decimal with comma", () => {
    expect(validateInput("oppervlakte", "10,5")).toBe(true);
  });

  it("validates decimal with period", () => {
    expect(validateInput("oppervlakte", "10.5")).toBe(true);
  });

  it("rejects above max 10000", () => {
    expect(validateInput("oppervlakte", "10001")).toBe(false);
  });

  it("validates zero", () => {
    expect(validateInput("oppervlakte", "0")).toBe(true);
  });

  it("formats removes non-numeric chars", () => {
    expect(formatInput("oppervlakte", "abc100.5xyz")).toBe("100.5");
  });

  it("formats comma to period", () => {
    expect(formatInput("oppervlakte", "10,5")).toBe("10.5");
  });

  it("has m\u00B2 suffix", () => {
    const config = getInputPattern("oppervlakte");
    expect(config.suffix).toBe("m\u00B2");
  });
});

// ============================================================
// Bedrag validation
// ============================================================
describe("bedrag pattern", () => {
  it("validates positive amount", () => {
    expect(validateInput("bedrag", "100.50")).toBe(true);
  });

  it("validates zero", () => {
    expect(validateInput("bedrag", "0")).toBe(true);
  });

  it("validates comma format", () => {
    expect(validateInput("bedrag", "99,99")).toBe(true);
  });

  it("has EUR prefix", () => {
    const config = getInputPattern("bedrag");
    expect(config.prefix).toBe("\u20AC");
  });

  it("formats removes non-numeric chars", () => {
    expect(formatInput("bedrag", "\u20AC100,50")).toBe("100.50");
  });
});

// ============================================================
// KvK Nummer validation
// ============================================================
describe("kvkNummer pattern", () => {
  it("validates 8-digit KvK number", () => {
    expect(validateInput("kvkNummer", "12345678")).toBe(true);
  });

  it("rejects 7-digit number", () => {
    expect(validateInput("kvkNummer", "1234567")).toBe(false);
  });

  it("rejects letters", () => {
    expect(validateInput("kvkNummer", "1234567A")).toBe(false);
  });

  it("formats strips non-digits and limits to 8", () => {
    expect(formatInput("kvkNummer", "12.345.678.90")).toBe("12345678");
  });
});

// ============================================================
// BTW Nummer validation
// ============================================================
describe("btwNummer pattern", () => {
  it("validates 'NL123456789B01'", () => {
    expect(validateInput("btwNummer", "NL123456789B01")).toBe(true);
  });

  it("validates lowercase input", () => {
    expect(validateInput("btwNummer", "nl123456789b01")).toBe(true);
  });

  it("rejects missing NL prefix", () => {
    expect(validateInput("btwNummer", "123456789B01")).toBe(false);
  });

  it("formats adds NL prefix and uppercases", () => {
    const result = formatInput("btwNummer", "nl123456789b01");
    expect(result).toBe("NL123456789B01");
  });

  it("formats limits to 14 characters", () => {
    const result = formatInput("btwNummer", "NL123456789B0199");
    expect(result.length).toBeLessThanOrEqual(14);
  });
});

// ============================================================
// IBAN validation and formatting
// ============================================================
describe("iban pattern", () => {
  it("validates 'NL91ABNA0417164300'", () => {
    expect(validateInput("iban", "NL91ABNA0417164300")).toBe(true);
  });

  it("validates with spaces", () => {
    expect(validateInput("iban", "NL91 ABNA 0417 1643 00")).toBe(true);
  });

  it("rejects non-NL IBAN", () => {
    expect(validateInput("iban", "DE89370400440532013000")).toBe(false);
  });

  it("formats with groups of 4", () => {
    const result = formatInput("iban", "nl91abna0417164300");
    expect(result).toBe("NL91 ABNA 0417 1643 00");
  });
});

// ============================================================
// Huisnummer
// ============================================================
describe("huisnummer pattern", () => {
  it("validates '123'", () => {
    expect(validateInput("huisnummer", "123")).toBe(true);
  });

  it("validates '123a'", () => {
    expect(validateInput("huisnummer", "123a")).toBe(true);
  });

  it("rejects starting with 0", () => {
    expect(validateInput("huisnummer", "0123")).toBe(false);
  });

  it("formats strips special chars", () => {
    expect(formatInput("huisnummer", "123-a")).toBe("123a");
  });
});

// ============================================================
// formatInput and validateInput edge cases
// ============================================================
describe("formatInput edge cases", () => {
  it("returns value unchanged for patterns without format function", () => {
    // email has no format function defined
    const result = formatInput("email", "test@test.nl");
    expect(result).toBe("test@test.nl");
  });
});
