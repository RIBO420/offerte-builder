import { describe, it, expect } from "vitest";
import {
  processKlantImportData,
  parseKlantenFile,
  getSampleKlantCSV,
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
    Object.assign(file, { text: () => Promise.resolve(content) });
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

    // Alleen de naam is verplicht: een import uit een ander pakket mag niet
    // stukvallen op een ontbrekend adres — aanvullen kan later in de app.
    it("importeert zonder postcodekolom, met waarschuwing", () => {
      const row: Record<string, string> = {
        naam: "Test",
        plaats: "Amsterdam",
      };
      const result = processKlantImportData([row]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].postcode).toBe("");
      expect(result.warnings.some((w) => w.includes("geen postcode"))).toBe(true);
    });

    it("importeert zonder plaatskolom", () => {
      const row: Record<string, string> = {
        naam: "Test",
        postcode: "1234 AB",
      };
      const result = processKlantImportData([row]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].plaats).toBe("");
      expect(result.entries[0].opmerkingen).toContain("plaats ontbreekt");
    });

    it("returns row-level error when naam value is empty", () => {
      const result = processKlantImportData([makeRow({ naam: "" })]);

      expect(result.entries).toHaveLength(0);
      expect(result.errors.some((e) => e.includes("Rij 2") && e.includes("naam"))).toBe(true);
    });

    it("importeert een rij zonder postcode en markeert die", () => {
      const result = processKlantImportData([makeRow({ postcode: "" })]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].postcode).toBe("");
      expect(result.entries[0].opmerkingen).toContain("postcode ontbreekt");
    });

    it("importeert een rij zonder plaats en markeert die", () => {
      const result = processKlantImportData([makeRow({ plaats: "" })]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].opmerkingen).toContain("plaats ontbreekt");
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
    // Geen enkele postcode blokkeert de import meer; afwijkende waarden komen
    // binnen mét een aandachtspunt zodat je ze in de app kunt nalopen.
    it("laat een te korte postcode door met aandachtspunt", () => {
      const result = processKlantImportData([makeRow({ postcode: "123 AB" })]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].opmerkingen).toContain("afwijkende postcode");
    });

    it("behoudt een Duitse postcode van 5 cijfers", () => {
      const result = processKlantImportData([makeRow({ postcode: "47906" })]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries[0].postcode).toBe("47906");
      expect(result.entries[0].opmerkingen).toContain("buitenlandse postcode");
    });

    it("behoudt een Belgische postcode van 4 cijfers", () => {
      const result = processKlantImportData([makeRow({ postcode: "3630" })]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries[0].postcode).toBe("3630");
    });

    it("laat een postcode met drie letters door met aandachtspunt", () => {
      const result = processKlantImportData([makeRow({ postcode: "1234 ABC" })]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries[0].opmerkingen).toContain("afwijkende postcode");
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
      expect(result.warnings.some((w) => w.includes("ongeldig e-mailadres"))).toBe(true);
      expect(result.entries[0].opmerkingen).toContain("ongeldig e-mailadres");
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

    it("laat het adres leeg als straat en huisnummer beide leeg zijn", () => {
      const result = processKlantImportData([
        makeRow({ straat: "", huisnummer: "" }),
      ]);
      expect(result.entries[0].adres).toBe("");
    });

    it("importeert ook zonder straatkolom", () => {
      const row: Record<string, string> = {
        naam: "Test",
        postcode: "1234 AB",
        plaats: "Amsterdam",
      };
      const result = processKlantImportData([row]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries[0].adres).toBe("");
    });
  });

  // -----------------------------------------------------------------------
  // Samengesteld adresveld — het formaat van de relatie-export
  // -----------------------------------------------------------------------
  describe("samengesteld adresveld", () => {
    /** Rij zoals de relatie-export hem levert: adres, postcode en plaats in één veld. */
    function exportRij(plaats: string, overrides: Record<string, string> = {}) {
      return {
        Type: "Persoon",
        Klantnummer: "1003",
        Bedrijfsnaam: "",
        Voornaam: "Annemiek",
        Achternaam: "van der Sanden",
        "E-mail": "a@voorbeeld.nl",
        Categorie: "Klant",
        Plaats: plaats,
        ...overrides,
      };
    }

    it("splitst straat, postcode en plaats uit één veld", () => {
      const result = processKlantImportData([
        exportRij("Dijk 24A, 6127 AG Grevenbicht"),
      ]);

      expect(result.entries[0].adres).toBe("Dijk 24A");
      expect(result.entries[0].postcode).toBe("6127 AG");
      expect(result.entries[0].plaats).toBe("Grevenbicht");
    });

    it("normaliseert een postcode zonder spatie", () => {
      const result = processKlantImportData([
        exportRij("Marconistraat 2 , 6132GT Sittard"),
      ]);

      expect(result.entries[0].postcode).toBe("6132 GT");
      expect(result.entries[0].plaats).toBe("Sittard");
    });

    it("kiest de laatste postcode als het adres er meerdere bevat", () => {
      const result = processKlantImportData([
        exportRij("ECI 2, Berkelplein 26 6301 ZE Valkenburg, 6041 MA Roermond"),
      ]);

      expect(result.entries[0].postcode).toBe("6041 MA");
      expect(result.entries[0].plaats).toBe("Roermond");
      expect(result.entries[0].adres).toBe("ECI 2, Berkelplein 26 6301 ZE Valkenburg");
    });

    it("houdt een Duitse postcode heel", () => {
      const result = processKlantImportData([
        exportRij("Briandstraße 12, 47906 Kempen"),
      ]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries[0].postcode).toBe("47906");
      expect(result.entries[0].plaats).toBe("Kempen");
      expect(result.entries[0].opmerkingen).toContain("buitenlandse postcode");
    });

    it("valt terug op adres + plaats als er geen postcode in staat", () => {
      const result = processKlantImportData([
        exportRij("Schoorsweg 9, Berg a d Maas"),
      ]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries[0].adres).toBe("Schoorsweg 9");
      expect(result.entries[0].plaats).toBe("Berg a d Maas");
      expect(result.entries[0].opmerkingen).toContain("postcode ontbreekt");
    });

    it("herkent een Nederlandse postcode zonder letters", () => {
      const result = processKlantImportData([exportRij("Gaarstraat 32, 6121 Born")]);

      expect(result.entries[0].postcode).toBe("6121");
      expect(result.entries[0].plaats).toBe("Born");
    });

    it("importeert een rij met een volledig leeg adres", () => {
      const result = processKlantImportData([exportRij("")]);

      expect(result.errors).toHaveLength(0);
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].adres).toBe("");
    });

    it("stelt de naam samen uit voornaam en achternaam", () => {
      const result = processKlantImportData([exportRij("Dijk 24A, 6127 AG Grevenbicht")]);

      expect(result.entries[0].naam).toBe("Annemiek van der Sanden");
      expect(result.entries[0].klantType).toBe("particulier");
    });

    it("gebruikt de bedrijfsnaam en zet de persoon als contactpersoon", () => {
      const result = processKlantImportData([
        exportRij("Lissabonlaan 2, 6135 LE Sittard", {
          Type: "Bedrijf",
          Bedrijfsnaam: "Bruls Prefab Beton",
          Voornaam: "B.",
          Achternaam: "Bruls",
        }),
      ]);

      expect(result.entries[0].naam).toBe("Bruls Prefab Beton");
      expect(result.entries[0].contactpersoon).toBe("B. Bruls");
      expect(result.entries[0].klantType).toBe("zakelijk");
    });

    it("herkent een VvE aan de bedrijfsnaam", () => {
      const result = processKlantImportData([
        exportRij("Prinsbisdomstraat 10D, 6121 JG Born", {
          Type: "Bedrijf",
          Bedrijfsnaam: "VvE Prins Bisdomstaete",
          Voornaam: "",
          Achternaam: "",
        }),
      ]);

      expect(result.entries[0].klantType).toBe("vve");
    });

    it("routeert op de kolom Categorie", () => {
      const result = processKlantImportData([
        exportRij("Roligt 9, 6088 NG Roggel", {
          Type: "Bedrijf",
          Bedrijfsnaam: "Heijnen Plants BV",
          Categorie: "Leverancier",
        }),
        exportRij("Dijk 24A, 6127 AG Grevenbicht"),
      ]);

      expect(result.entries[0].soort).toBe("leverancier");
      expect(result.entries[1].soort).toBe("klant");
    });

    it("decodeert HTML-entiteiten uit de export", () => {
      const result = processKlantImportData([
        exportRij("Engelenkampstraat 14, VvE Blok 1,2 &amp; 3, 6131 JH Sittard"),
      ]);

      expect(result.entries[0].adres).toContain("&");
      expect(result.entries[0].adres).not.toContain("&amp;");
      expect(result.entries[0].postcode).toBe("6131 JH");
    });

    it("markeert dubbele rijen binnen hetzelfde bestand", () => {
      const result = processKlantImportData([
        exportRij("Mauritslaan 30, 6129 EM Urmond"),
        exportRij("Mauritslaan 30, 6129 EM Urmond"),
      ]);

      expect(result.entries[1].opmerkingen).toContain("dubbel in bestand");
      expect(result.warnings.some((w) => w.includes("meerdere keren"))).toBe(true);
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
    it("slaat alleen rijen zonder naam over", () => {
      const rows = [
        makeRow({ naam: "" }),            // Overslaan: geen naam
        makeRow({ postcode: "INVALID" }), // Komt binnen met aandachtspunt
        makeRow({ naam: "Piet Pieters" }), // Geldig
      ];
      const result = processKlantImportData(rows);

      expect(result.entries).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
    });

    it("reports correct row numbers in error messages (header = row 1)", () => {
      const rows = [
        makeRow(),             // Rij 2 — geldig
        makeRow({ naam: "" }), // Rij 3 — geen naam
        makeRow({ naam: "Ander Persoon" }), // Rij 4 — geldig
        makeRow({ naam: "" }), // Rij 5 — geen naam
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
  // De voorbeeld-CSV volgt nu het relatie-exportformaat, zodat wat je
  // downloadt hetzelfde is als wat het bronsysteem oplevert.
  it("returns a string with semicolon-separated header", () => {
    const csv = getSampleKlantCSV();
    const firstLine = csv.split("\n")[0];

    expect(firstLine).toContain("Bedrijfsnaam");
    expect(firstLine).toContain("Voornaam");
    expect(firstLine).toContain("Achternaam");
    expect(firstLine).toContain("E-mail");
    expect(firstLine).toContain("Categorie");
    expect(firstLine).toContain("Plaats");
    expect(firstLine.split(";").length).toBeGreaterThanOrEqual(7);
  });

  it("bevat zowel een klant als een leverancier", async () => {
    const result = await parseKlantenFile(
      makeCSVFile(getSampleKlantCSV(), "voorbeeld.csv")
    );

    expect(result.entries.some((e) => e.soort === "klant")).toBe(true);
    expect(result.entries.some((e) => e.soort === "leverancier")).toBe(true);
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
