import { describe, it, expect } from "vitest";
import {
  processKlantImportData,
  parseKlantenFile,
  getSampleKlantCSV,
  type ParsedKlantEntry,
  type KlantParseResult,
} from "@/lib/klant-import-parser";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a single valid row with all required + optional fields */
function makeRow(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    naam: "Jan Jansen",
    email: "jan@voorbeeld.nl",
    telefoon: "06-12345678",
    straat: "Hoofdstraat",
    huisnummer: "1",
    postcode: "1234 AB",
    plaats: "Amsterdam",
    type: "particulier",
    ...overrides,
  };
}

/**
 * Build a File object from raw text (simulates CSV upload).
 * jsdom's File does not implement .text(), so we polyfill it here.
 */
function makeCSVFile(content: string, name = "klanten.csv"): File {
  const file = new File([content], name, { type: "text/csv" });
  if (typeof file.text !== "function") {
    (file as any).text = () => Promise.resolve(content);
  }
  return file;
}

// ===========================================================================
// processKlantImportData
// ===========================================================================

describe("processKlantImportData", () => {
  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------
  describe("valid data", () => {
    it("parses a single valid row with all fields", () => {
      const result = processKlantImportData([makeRow()]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(1);

      const entry = result.entries[0];
      expect(entry.naam).toBe("Jan Jansen");
      expect(entry.email).toBe("jan@voorbeeld.nl");
      expect(entry.telefoon).toBe("06-12345678");
      expect(entry.adres).toBe("Hoofdstraat 1");
      expect(entry.postcode).toBe("1234 AB");
      expect(entry.plaats).toBe("Amsterdam");
      expect(entry.klantType).toBe("particulier");
    });

    it("parses multiple rows", () => {
      const rows = [
        makeRow(),
        makeRow({ naam: "Piet Pietersen", postcode: "5678CD", plaats: "Rotterdam" }),
        makeRow({ naam: "Klaas Klaassen", postcode: "9012 EF", plaats: "Utrecht" }),
      ];
      const result = processKlantImportData(rows);

      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(3);
    });

    it("formats postcode to standard format (1234 AB) when no space present", () => {
      const result = processKlantImportData([makeRow({ postcode: "1234AB" })]);

      expect(result.entries[0].postcode).toBe("1234 AB");
    });

    it("uppercases postcode letters", () => {
      const result = processKlantImportData([makeRow({ postcode: "1234ab" })]);

      expect(result.entries[0].postcode).toBe("1234 AB");
    });

    it("preserves postcode that already has correct format", () => {
      const result = processKlantImportData([makeRow({ postcode: "1234 AB" })]);

      expect(result.entries[0].postcode).toBe("1234 AB");
    });
  });

  // -----------------------------------------------------------------------
  // Column name mapping
  // -----------------------------------------------------------------------
  describe("column name mapping", () => {
    it("recognises alternative column name 'klantnaam' for naam", () => {
      const row: Record<string, string> = {
        klantnaam: "Test Klant",
        postcode: "1234 AB",
        plaats: "Amsterdam",
      };
      const result = processKlantImportData([row]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries[0].naam).toBe("Test Klant");
    });

    it("recognises 'e-mail' as email column", () => {
      const row: Record<string, string> = {
        naam: "Test",
        postcode: "1234 AB",
        plaats: "Amsterdam",
        "e-mail": "test@test.nl",
      };
      const result = processKlantImportData([row]);

      expect(result.entries[0].email).toBe("test@test.nl");
    });

    it("recognises 'stad' as plaats column", () => {
      const row: Record<string, string> = {
        naam: "Test",
        postcode: "1234 AB",
        stad: "Den Haag",
      };
      const result = processKlantImportData([row]);

      expect(result.entries[0].plaats).toBe("Den Haag");
    });

    it("recognises 'woonplaats' as plaats column", () => {
      const row: Record<string, string> = {
        naam: "Test",
        postcode: "1234 AB",
        woonplaats: "Eindhoven",
      };
      const result = processKlantImportData([row]);

      expect(result.entries[0].plaats).toBe("Eindhoven");
    });

    it("recognises 'zip' as postcode column", () => {
      const row: Record<string, string> = {
        naam: "Test",
        zip: "1234 AB",
        plaats: "Amsterdam",
      };
      const result = processKlantImportData([row]);

      expect(result.entries[0].postcode).toBe("1234 AB");
    });

    it("recognises 'tel' as telefoon column", () => {
      const row: Record<string, string> = {
        naam: "Test",
        postcode: "1234 AB",
        plaats: "Amsterdam",
        tel: "06-11111111",
      };
      const result = processKlantImportData([row]);

      expect(result.entries[0].telefoon).toBe("06-11111111");
    });
  });

  // -----------------------------------------------------------------------
  // Missing required fields
  // -----------------------------------------------------------------------
  describe("missing required fields", () => {
    it("returns error when data array is empty", () => {
      const result = processKlantImportData([]);

      expect(result.entries).toHaveLength(0);
      expect(result.errors).toContain("Geen data gevonden in bestand");
    });

    it("returns error when naam column is missing from data", () => {
      const row: Record<string, string> = {
        email: "test@test.nl",
        postcode: "1234 AB",
        plaats: "Amsterdam",
      };
      const result = processKlantImportData([row]);

      expect(result.errors.some((e) => e.includes("naam"))).toBe(true);
    });

    it("returns error when postcode column is missing from data", () => {
      const row: Record<string, string> = {
        naam: "Test",
        plaats: "Amsterdam",
      };
      const result = processKlantImportData([row]);

      expect(result.errors.some((e) => e.includes("postcode"))).toBe(true);
    });

    it("returns error when plaats column is missing from data", () => {
      const row: Record<string, string> = {
        naam: "Test",
        postcode: "1234 AB",
      };
      const result = processKlantImportData([row]);

      expect(result.errors.some((e) => e.includes("plaats"))).toBe(true);
    });

    it("returns row-level error when naam value is empty", () => {
      const result = processKlantImportData([makeRow({ naam: "" })]);

      expect(result.entries).toHaveLength(0);
      expect(result.errors.some((e) => e.includes("Rij 2") && e.includes("Naam"))).toBe(true);
    });

    it("returns row-level error when postcode value is empty", () => {
      const result = processKlantImportData([makeRow({ postcode: "" })]);

      expect(result.entries).toHaveLength(0);
      expect(result.errors.some((e) => e.includes("Rij 2") && e.includes("Postcode"))).toBe(true);
    });

    it("returns row-level error when plaats value is empty", () => {
      const result = processKlantImportData([makeRow({ plaats: "" })]);

      expect(result.entries).toHaveLength(0);
      expect(result.errors.some((e) => e.includes("Rij 2") && e.includes("Plaats"))).toBe(true);
    });

    it("skips bad rows but still processes good rows", () => {
      const rows = [
        makeRow({ naam: "" }), // bad — missing naam
        makeRow({ naam: "Good Row", postcode: "1234 AB", plaats: "Utrecht" }),
      ];
      const result = processKlantImportData(rows);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].naam).toBe("Good Row");
      expect(result.errors).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Postcode validation
  // -----------------------------------------------------------------------
  describe("postcode validation", () => {
    it("rejects postcode with too few digits", () => {
      const result = processKlantImportData([makeRow({ postcode: "123 AB" })]);

      expect(result.errors.some((e) => e.includes("Ongeldige postcode"))).toBe(true);
      expect(result.entries).toHaveLength(0);
    });

    it("rejects postcode with too many digits", () => {
      const result = processKlantImportData([makeRow({ postcode: "12345 AB" })]);

      expect(result.errors.some((e) => e.includes("Ongeldige postcode"))).toBe(true);
    });

    it("rejects postcode with only digits", () => {
      const result = processKlantImportData([makeRow({ postcode: "1234" })]);

      expect(result.errors.some((e) => e.includes("Ongeldige postcode"))).toBe(true);
    });

    it("rejects postcode with three letters", () => {
      const result = processKlantImportData([makeRow({ postcode: "1234 ABC" })]);

      expect(result.errors.some((e) => e.includes("Ongeldige postcode"))).toBe(true);
    });

    it("accepts postcode without space (e.g. 1234AB)", () => {
      const result = processKlantImportData([makeRow({ postcode: "1234AB" })]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries[0].postcode).toBe("1234 AB");
    });

    it("accepts postcode with lowercase letters", () => {
      const result = processKlantImportData([makeRow({ postcode: "1234 ab" })]);

      expect(result.errors).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Email validation
  // -----------------------------------------------------------------------
  describe("email validation", () => {
    it("accepts a valid email address", () => {
      const result = processKlantImportData([makeRow({ email: "test@example.com" })]);

      expect(result.entries[0].email).toBe("test@example.com");
      expect(result.warnings).toHaveLength(0);
    });

    it("adds warning for invalid email but still creates entry", () => {
      const result = processKlantImportData([makeRow({ email: "not-an-email" })]);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].email).toBeUndefined();
      expect(result.warnings.some((w) => w.includes("Ongeldig e-mailadres"))).toBe(true);
    });

    it("sets email to undefined for email missing @ sign", () => {
      const result = processKlantImportData([makeRow({ email: "testexample.com" })]);

      expect(result.entries[0].email).toBeUndefined();
    });

    it("sets email to undefined for email missing domain", () => {
      const result = processKlantImportData([makeRow({ email: "test@" })]);

      expect(result.entries[0].email).toBeUndefined();
    });

    it("leaves email undefined when not provided", () => {
      const row: Record<string, string> = {
        naam: "Test",
        postcode: "1234 AB",
        plaats: "Amsterdam",
      };
      const result = processKlantImportData([row]);

      expect(result.entries[0].email).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Telefoon handling
  // -----------------------------------------------------------------------
  describe("telefoon handling", () => {
    it("preserves phone number as-is", () => {
      const result = processKlantImportData([makeRow({ telefoon: "06-12345678" })]);

      expect(result.entries[0].telefoon).toBe("06-12345678");
    });

    it("sets telefoon to undefined when empty", () => {
      const result = processKlantImportData([makeRow({ telefoon: "" })]);

      expect(result.entries[0].telefoon).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // KlantType normalisation
  // -----------------------------------------------------------------------
  describe("klantType normalisation", () => {
    it.each([
      ["particulier", "particulier"],
      ["zakelijk", "zakelijk"],
      ["vve", "vve"],
      ["gemeente", "gemeente"],
      ["overig", "overig"],
    ] as const)("maps '%s' directly to '%s'", (input, expected) => {
      const result = processKlantImportData([makeRow({ type: input })]);
      expect(result.entries[0].klantType).toBe(expected);
    });

    it.each([
      ["bedrijf", "zakelijk"],
      ["business", "zakelijk"],
      ["company", "zakelijk"],
      ["prive", "particulier"],
      ["privé", "particulier"],
      ["private", "particulier"],
      ["personal", "particulier"],
      ["vereniging", "vve"],
      ["overheid", "gemeente"],
      ["government", "gemeente"],
      ["other", "overig"],
      ["anders", "overig"],
    ] as const)("maps alias '%s' to '%s'", (input, expected) => {
      const result = processKlantImportData([makeRow({ type: input })]);
      expect(result.entries[0].klantType).toBe(expected);
    });

    it("defaults to 'particulier' for empty type", () => {
      const result = processKlantImportData([makeRow({ type: "" })]);
      expect(result.entries[0].klantType).toBe("particulier");
    });

    it("defaults to 'particulier' for unknown type", () => {
      const result = processKlantImportData([makeRow({ type: "onbekend" })]);
      expect(result.entries[0].klantType).toBe("particulier");
    });

    it("is case-insensitive", () => {
      const result = processKlantImportData([makeRow({ type: "ZAKELIJK" })]);
      expect(result.entries[0].klantType).toBe("zakelijk");
    });

    it("defaults to 'particulier' when type column is absent", () => {
      const row: Record<string, string> = {
        naam: "Test",
        postcode: "1234 AB",
        plaats: "Amsterdam",
      };
      const result = processKlantImportData([row]);
      expect(result.entries[0].klantType).toBe("particulier");
    });
  });

  // -----------------------------------------------------------------------
  // Address composition
  // -----------------------------------------------------------------------
  describe("address composition", () => {
    it("combines straat and huisnummer with space", () => {
      const result = processKlantImportData([
        makeRow({ straat: "Kerkweg", huisnummer: "42" }),
      ]);
      expect(result.entries[0].adres).toBe("Kerkweg 42");
    });

    it("uses only straat when huisnummer is empty", () => {
      const result = processKlantImportData([
        makeRow({ straat: "Kerkweg", huisnummer: "" }),
      ]);
      expect(result.entries[0].adres).toBe("Kerkweg");
    });

    it("uses only huisnummer when straat is empty", () => {
      const result = processKlantImportData([
        makeRow({ straat: "", huisnummer: "42" }),
      ]);
      expect(result.entries[0].adres).toBe("42");
    });

    it("uses 'Onbekend' when both straat and huisnummer are empty", () => {
      const result = processKlantImportData([
        makeRow({ straat: "", huisnummer: "" }),
      ]);
      expect(result.entries[0].adres).toBe("Onbekend");
    });

    it("produces warning when straat column is absent entirely", () => {
      const row: Record<string, string> = {
        naam: "Test",
        postcode: "1234 AB",
        plaats: "Amsterdam",
      };
      const result = processKlantImportData([row]);

      expect(result.warnings.some((w) => w.includes("straat"))).toBe(true);
      expect(result.entries[0].adres).toBe("Onbekend");
    });
  });

  // -----------------------------------------------------------------------
  // Special characters (Dutch)
  // -----------------------------------------------------------------------
  describe("special Dutch characters", () => {
    it("preserves accented characters like e-acute in naam", () => {
      const result = processKlantImportData([makeRow({ naam: "Renée" })]);
      expect(result.entries[0].naam).toBe("Renée");
    });

    it("preserves diaeresis in naam", () => {
      const result = processKlantImportData([makeRow({ naam: "Coöperatie de Boër" })]);
      expect(result.entries[0].naam).toBe("Coöperatie de Boër");
    });

    it("preserves umlaut in plaats", () => {
      const result = processKlantImportData([makeRow({ plaats: "Düsseldorf" })]);
      expect(result.entries[0].plaats).toBe("Düsseldorf");
    });
  });

  // -----------------------------------------------------------------------
  // Whitespace trimming
  // -----------------------------------------------------------------------
  describe("whitespace handling", () => {
    it("trims leading and trailing whitespace from naam", () => {
      const result = processKlantImportData([makeRow({ naam: "  Jan Jansen  " })]);
      expect(result.entries[0].naam).toBe("Jan Jansen");
    });

    it("trims whitespace from postcode before validation", () => {
      const result = processKlantImportData([makeRow({ postcode: " 1234 AB " })]);
      expect(result.entries[0].postcode).toBe("1234 AB");
    });

    it("trims whitespace from email", () => {
      const result = processKlantImportData([makeRow({ email: " jan@test.nl " })]);
      expect(result.entries[0].email).toBe("jan@test.nl");
    });
  });

  // -----------------------------------------------------------------------
  // Multiple rows with mixed errors
  // -----------------------------------------------------------------------
  describe("mixed valid and invalid rows", () => {
    it("collects errors from multiple rows", () => {
      const rows = [
        makeRow({ naam: "" }),           // Error: naam missing
        makeRow({ postcode: "INVALID" }), // Error: invalid postcode
        makeRow(),                         // Valid
      ];
      const result = processKlantImportData(rows);

      expect(result.entries).toHaveLength(1);
      expect(result.errors).toHaveLength(2);
    });

    it("reports correct row numbers in error messages (header = row 1)", () => {
      const rows = [
        makeRow(),                         // Row 2 — valid
        makeRow({ naam: "" }),             // Row 3 — error
        makeRow(),                         // Row 4 — valid
        makeRow({ postcode: "INVALID" }),  // Row 5 — error
      ];
      const result = processKlantImportData(rows);

      expect(result.errors.some((e) => e.includes("Rij 3"))).toBe(true);
      expect(result.errors.some((e) => e.includes("Rij 5"))).toBe(true);
      expect(result.entries).toHaveLength(2);
    });
  });
});

// ===========================================================================
// parseKlantenFile (async File-based parser)
// ===========================================================================

describe("parseKlantenFile", () => {
  it("parses a valid semicolon-separated CSV file", async () => {
    const csv = `naam;postcode;plaats
Jan Jansen;1234 AB;Amsterdam`;
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].naam).toBe("Jan Jansen");
  });

  it("parses a valid comma-separated CSV file", async () => {
    const csv = `naam,postcode,plaats
Piet Pietersen,5678 CD,Rotterdam`;
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].naam).toBe("Piet Pietersen");
  });

  it("rejects non-CSV file extensions", async () => {
    const file = new File(["data"], "klanten.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = await parseKlantenFile(file);

    expect(result.entries).toHaveLength(0);
    expect(result.errors.some((e) => e.includes("Ongeldig bestandstype"))).toBe(true);
  });

  it("rejects .txt file extension", async () => {
    const file = new File(["data"], "klanten.txt", { type: "text/plain" });
    const result = await parseKlantenFile(file);

    expect(result.errors.some((e) => e.includes("Ongeldig bestandstype"))).toBe(true);
  });

  it("handles UTF-8 BOM in CSV file", async () => {
    const bom = "\uFEFF";
    const csv = `${bom}naam;postcode;plaats
Jan;1234 AB;Amsterdam`;
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].naam).toBe("Jan");
  });

  it("handles Windows line endings (CRLF)", async () => {
    const csv = "naam;postcode;plaats\r\nJan;1234 AB;Amsterdam\r\nPiet;5678 CD;Rotterdam";
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.entries).toHaveLength(2);
  });

  it("returns error for file with header only (no data rows)", async () => {
    const csv = "naam;postcode;plaats";
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    // parseCSVText returns [] for < 2 lines → processKlantImportData gets empty array
    expect(result.errors).toContain("Geen data gevonden in bestand");
  });

  it("returns error for empty file", async () => {
    const file = makeCSVFile("");
    const result = await parseKlantenFile(file);

    expect(result.errors).toContain("Geen data gevonden in bestand");
  });

  it("skips empty rows in CSV", async () => {
    const csv = `naam;postcode;plaats
Jan;1234 AB;Amsterdam

Piet;5678 CD;Rotterdam
`;
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.entries).toHaveLength(2);
  });

  it("strips surrounding quotes from values", async () => {
    const csv = `naam;postcode;plaats
"Jan Jansen";"1234 AB";"Amsterdam"`;
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.entries[0].naam).toBe("Jan Jansen");
    expect(result.entries[0].postcode).toBe("1234 AB");
  });

  it("handles all columns from sample CSV", async () => {
    const csv = `naam;email;telefoon;straat;huisnummer;postcode;plaats;type
Jan Jansen;jan@voorbeeld.nl;06-12345678;Hoofdstraat;1;1234 AB;Amsterdam;particulier`;
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.errors).toHaveLength(0);
    const entry = result.entries[0];
    expect(entry.naam).toBe("Jan Jansen");
    expect(entry.email).toBe("jan@voorbeeld.nl");
    expect(entry.telefoon).toBe("06-12345678");
    expect(entry.adres).toBe("Hoofdstraat 1");
    expect(entry.postcode).toBe("1234 AB");
    expect(entry.plaats).toBe("Amsterdam");
    expect(entry.klantType).toBe("particulier");
  });

  it("handles extra columns gracefully", async () => {
    const csv = `naam;postcode;plaats;extra_col;another
Jan;1234 AB;Amsterdam;ignored;alsoignored`;
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.entries).toHaveLength(1);
  });

  it("preserves special Dutch characters through file parsing", async () => {
    const csv = `naam;postcode;plaats
Renée van der Bühl;1234 AB;Zürich`;
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.entries[0].naam).toBe("Renée van der Bühl");
    expect(result.entries[0].plaats).toBe("Zürich");
  });

  it("handles a large number of rows", async () => {
    const header = "naam;postcode;plaats";
    const rows = Array.from({ length: 500 }, (_, i) => `Klant ${i};1234 AB;Amsterdam`);
    const csv = [header, ...rows].join("\n");
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.entries).toHaveLength(500);
    expect(result.errors).toHaveLength(0);
  });
});

// ===========================================================================
// getSampleKlantCSV
// ===========================================================================

describe("getSampleKlantCSV", () => {
  it("returns a string with semicolon-separated header", () => {
    const csv = getSampleKlantCSV();
    const firstLine = csv.split("\n")[0];

    expect(firstLine).toContain("naam");
    expect(firstLine).toContain("email");
    expect(firstLine).toContain("telefoon");
    expect(firstLine).toContain("postcode");
    expect(firstLine).toContain("plaats");
    expect(firstLine.split(";").length).toBeGreaterThanOrEqual(7);
  });

  it("contains sample data rows", () => {
    const csv = getSampleKlantCSV();
    const lines = csv.split("\n").filter((l) => l.trim());

    // Header + at least 1 data row
    expect(lines.length).toBeGreaterThan(1);
  });

  it("sample CSV can be parsed without errors", async () => {
    const csv = getSampleKlantCSV();
    const file = makeCSVFile(csv);
    const result = await parseKlantenFile(file);

    expect(result.errors).toHaveLength(0);
    expect(result.entries.length).toBeGreaterThan(0);
  });
});
