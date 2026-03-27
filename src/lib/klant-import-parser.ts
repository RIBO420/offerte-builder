/**
 * CSV parser for klanten (customer) imports
 * Handles Dutch CSV format (semicolon separator, UTF-8 with BOM)
 *
 * Expected columns: naam, email, telefoon, straat, huisnummer, postcode, plaats, type
 */

export type KlantType = "particulier" | "zakelijk" | "vve" | "gemeente" | "overig";

export interface ParsedKlantEntry {
  naam: string;
  email?: string;
  telefoon?: string;
  adres: string; // Combined straat + huisnummer
  postcode: string;
  plaats: string;
  klantType: KlantType;
}

export interface KlantParseResult {
  entries: ParsedKlantEntry[];
  errors: string[];
  warnings: string[];
}

// Column name mappings (multiple possible names per field)
const columnMappings: Record<string, string[]> = {
  naam: ["naam", "name", "klantnaam", "bedrijfsnaam", "klant", "customer"],
  email: ["email", "e-mail", "emailadres", "e-mailadres", "mail"],
  telefoon: ["telefoon", "telefoonnummer", "tel", "phone", "mobiel", "gsm"],
  straat: ["straat", "straatnaam", "street", "adres", "address"],
  huisnummer: ["huisnummer", "nummer", "nr", "housenumber", "huis_nr"],
  postcode: ["postcode", "postal", "zip", "zipcode", "postal_code"],
  plaats: ["plaats", "stad", "city", "woonplaats", "town", "gemeente"],
  type: ["type", "klanttype", "klant_type", "soort", "categorie"],
};

const VALID_KLANT_TYPES: KlantType[] = ["particulier", "zakelijk", "vve", "gemeente", "overig"];

// Dutch postcode regex: 4 digits + 2 letters (with optional space)
const POSTCODE_REGEX = /^\d{4}\s?[A-Za-z]{2}$/;

/**
 * Remove UTF-8 BOM if present
 */
function stripBOM(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Detect separator (semicolon or comma)
 */
function detectSeparator(firstLine: string): string {
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount >= commaCount ? ";" : ",";
}

/**
 * Parse CSV text manually to handle both ; and , separators
 */
function parseCSVText(text: string): Record<string, string>[] {
  const cleaned = stripBOM(text);
  const lines = cleaned.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    return [];
  }

  const separator = detectSeparator(lines[0]);
  const headers = lines[0].split(separator).map((h) => h.trim().replace(/^["']|["']$/g, ""));

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(separator).map((v) => v.trim().replace(/^["']|["']$/g, ""));
    const row: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || "";
    }

    // Skip completely empty rows
    if (Object.values(row).some((v) => v.trim())) {
      rows.push(row);
    }
  }

  return rows;
}

/**
 * Find column by possible names (case-insensitive partial match)
 */
function findColumn(
  row: Record<string, string>,
  possibleNames: string[]
): string | undefined {
  const keys = Object.keys(row);
  const lowerKeys = keys.map((k) => k.toLowerCase().trim());

  for (const name of possibleNames) {
    const index = lowerKeys.findIndex((k) => k === name.toLowerCase());
    if (index !== -1) return keys[index];
  }

  // Fallback: partial match
  for (const name of possibleNames) {
    const index = lowerKeys.findIndex((k) => k.includes(name.toLowerCase()));
    if (index !== -1) return keys[index];
  }

  return undefined;
}

/**
 * Normalize klant type string to valid enum value
 */
function normalizeKlantType(value: string | undefined): KlantType {
  if (!value) return "particulier";

  const lower = value.toLowerCase().trim();

  // Direct match
  if (VALID_KLANT_TYPES.includes(lower as KlantType)) {
    return lower as KlantType;
  }

  // Common aliases
  const aliases: Record<string, KlantType> = {
    bedrijf: "zakelijk",
    business: "zakelijk",
    company: "zakelijk",
    prive: "particulier",
    privé: "particulier",
    private: "particulier",
    personal: "particulier",
    vereniging: "vve",
    "vereniging van eigenaren": "vve",
    overheid: "gemeente",
    government: "gemeente",
    other: "overig",
    anders: "overig",
  };

  return aliases[lower] ?? "particulier";
}

/**
 * Validate Dutch postcode format
 */
function isValidPostcode(postcode: string): boolean {
  return POSTCODE_REGEX.test(postcode.trim());
}

/**
 * Format postcode to standard format (1234 AB)
 */
function formatPostcode(postcode: string): string {
  const cleaned = postcode.replace(/\s/g, "").toUpperCase();
  if (cleaned.length === 6) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  }
  return postcode.trim();
}

/**
 * Process imported data and validate
 */
export function processKlantImportData(
  data: Record<string, string>[]
): KlantParseResult {
  const entries: ParsedKlantEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.length === 0) {
    errors.push("Geen data gevonden in bestand");
    return { entries, errors, warnings };
  }

  // Detect columns from first row
  const firstRow = data[0];
  const naamCol = findColumn(firstRow, columnMappings.naam);
  const emailCol = findColumn(firstRow, columnMappings.email);
  const telefoonCol = findColumn(firstRow, columnMappings.telefoon);
  const straatCol = findColumn(firstRow, columnMappings.straat);
  const huisnummerCol = findColumn(firstRow, columnMappings.huisnummer);
  const postcodeCol = findColumn(firstRow, columnMappings.postcode);
  const plaatsCol = findColumn(firstRow, columnMappings.plaats);
  const typeCol = findColumn(firstRow, columnMappings.type);

  if (!naamCol) {
    errors.push(
      "Kolom 'naam' niet gevonden. Verwachte namen: naam, klantnaam, bedrijfsnaam"
    );
  }

  if (!postcodeCol) {
    errors.push(
      "Kolom 'postcode' niet gevonden. Verwachte namen: postcode, postal, zip"
    );
  }

  if (!plaatsCol) {
    errors.push(
      "Kolom 'plaats' niet gevonden. Verwachte namen: plaats, stad, woonplaats"
    );
  }

  if (errors.length > 0) {
    return { entries, errors, warnings };
  }

  if (!straatCol) {
    warnings.push(
      "Kolom 'straat' niet gevonden. Adres wordt leeg gelaten. Verwachte namen: straat, adres"
    );
  }

  // Process each row
  data.forEach((row, index) => {
    const rowNum = index + 2; // +1 for header, +1 for 1-based index

    // Parse naam (required)
    const naam = naamCol ? row[naamCol]?.trim() : undefined;
    if (!naam) {
      errors.push(`Rij ${rowNum}: Naam ontbreekt`);
      return;
    }

    // Parse postcode (required)
    const rawPostcode = postcodeCol ? row[postcodeCol]?.trim() : undefined;
    if (!rawPostcode) {
      errors.push(`Rij ${rowNum}: Postcode ontbreekt`);
      return;
    }

    if (!isValidPostcode(rawPostcode)) {
      errors.push(
        `Rij ${rowNum}: Ongeldige postcode "${rawPostcode}" (verwacht formaat: 1234 AB)`
      );
      return;
    }
    const postcode = formatPostcode(rawPostcode);

    // Parse plaats (required)
    const plaats = plaatsCol ? row[plaatsCol]?.trim() : undefined;
    if (!plaats) {
      errors.push(`Rij ${rowNum}: Plaats ontbreekt`);
      return;
    }

    // Parse adres (optional, combine straat + huisnummer)
    const straat = straatCol ? row[straatCol]?.trim() : "";
    const huisnummer = huisnummerCol ? row[huisnummerCol]?.trim() : "";
    const adres = [straat, huisnummer].filter(Boolean).join(" ") || "Onbekend";

    // Parse email (optional)
    const email = emailCol ? row[emailCol]?.trim() : undefined;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      warnings.push(`Rij ${rowNum}: Ongeldig e-mailadres "${email}", wordt overgeslagen`);
    }

    // Parse telefoon (optional)
    const telefoon = telefoonCol ? row[telefoonCol]?.trim() : undefined;

    // Parse type (optional, defaults to particulier)
    const rawType = typeCol ? row[typeCol]?.trim() : undefined;
    const klantType = normalizeKlantType(rawType);

    entries.push({
      naam,
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
      telefoon: telefoon || undefined,
      adres,
      postcode,
      plaats,
      klantType,
    });
  });

  return { entries, errors, warnings };
}

/**
 * Main parse function - reads file and processes
 */
export async function parseKlantenFile(file: File): Promise<KlantParseResult> {
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  if (fileExtension !== "csv") {
    return {
      entries: [],
      errors: ["Ongeldig bestandstype. Gebruik een CSV bestand (.csv)"],
      warnings: [],
    };
  }

  try {
    const text = await file.text();
    const data = parseCSVText(text);
    return processKlantImportData(data);
  } catch (error) {
    return {
      entries: [],
      errors: [`Fout bij laden bestand: ${error}`],
      warnings: [],
    };
  }
}

/**
 * Get sample CSV content for download (Dutch format with semicolons)
 */
export function getSampleKlantCSV(): string {
  return `naam;email;telefoon;straat;huisnummer;postcode;plaats;type
Jan Jansen;jan@voorbeeld.nl;06-12345678;Hoofdstraat;1;1234 AB;Amsterdam;particulier
De Groene Tuin B.V.;info@groen.nl;020-1234567;Kerkweg;42;5678 CD;Rotterdam;zakelijk
Familie de Vries;devries@email.nl;06-87654321;Parkweg;15a;9012 EF;Utrecht;particulier
VvE Zonnedael;bestuur@zonnedael.nl;030-9876543;Zonnebloemstraat;8;3456 GH;Den Haag;vve
Gemeente Hilversum;groen@hilversum.nl;035-6291111;Raadhuis;1;1211 AB;Hilversum;gemeente`;
}
