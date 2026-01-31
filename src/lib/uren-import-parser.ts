/**
 * CSV/Excel parser for time registration imports
 * Expected format: datum, medewerker, uren, notities
 */

export interface ParsedUrenEntry {
  datum: string; // YYYY-MM-DD
  medewerker: string;
  uren: number;
  scope?: string;
  notities?: string;
}

export interface ParseResult {
  entries: ParsedUrenEntry[];
  errors: string[];
  warnings: string[];
}

// Column name mappings (multiple possible names per field)
const columnMappings: Record<string, string[]> = {
  datum: ["datum", "date", "dag", "werkdatum", "registratiedatum"],
  medewerker: [
    "medewerker",
    "werknemer",
    "naam",
    "name",
    "employee",
    "persoon",
    "wie",
  ],
  uren: ["uren", "hours", "tijd", "gewerkt", "werkuren", "aantaluren"],
  scope: ["scope", "taak", "task", "categorie", "afdeling", "werkzaamheden"],
  notities: [
    "notities",
    "notitie",
    "notes",
    "note",
    "opmerking",
    "opmerkingen",
    "omschrijving",
  ],
};

/**
 * Parse CSV file
 */
export const parseCSV = async (file: File): Promise<Record<string, string>[]> => {
  const Papa = (await import("papaparse")).default;
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data as Record<string, string>[]),
      error: (error) => reject(error),
    });
  });
};

/**
 * Parse Excel file
 */
export const parseExcel = async (
  file: File
): Promise<Record<string, string>[]> => {
  const XLSX = await import("xlsx");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as Record<
          string,
          string
        >[];
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Find column by possible names
 */
const findColumn = (
  row: Record<string, string>,
  possibleNames: string[]
): string | undefined => {
  const lowerKeys = Object.keys(row).map((k) => k.toLowerCase());
  for (const name of possibleNames) {
    const index = lowerKeys.findIndex((k) => k.includes(name.toLowerCase()));
    if (index !== -1) {
      return Object.keys(row)[index];
    }
  }
  return undefined;
};

/**
 * Parse date string to YYYY-MM-DD format
 */
const parseDate = (value: string | undefined): string | null => {
  if (!value) return null;

  // Clean the value
  const cleaned = value.toString().trim();

  // Try various date formats
  // ISO format: 2024-01-15
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // Dutch format: 15-01-2024 or 15/01/2024
  const dutchMatch = cleaned.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dutchMatch) {
    const [, day, month, year] = dutchMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // US format: 01/15/2024 (month/day/year)
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    // If first number > 12, assume it's day (European format)
    if (parseInt(month) > 12) {
      return `${year}-${day.padStart(2, "0")}-${month.padStart(2, "0")}`;
    }
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Excel serial date number
  if (/^\d{5}$/.test(cleaned)) {
    const excelDate = parseInt(cleaned);
    // Excel's epoch is January 1, 1900
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split("T")[0];
  }

  // Try native Date parsing as fallback
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split("T")[0];
  }

  return null;
};

/**
 * Parse hours value
 */
const parseHours = (value: string | undefined): number => {
  if (!value) return 0;

  const cleaned = value.toString().replace(",", ".").trim();

  // Handle time format (e.g., "8:30" for 8.5 hours)
  if (cleaned.includes(":")) {
    const [hours, minutes] = cleaned.split(":").map(Number);
    return hours + (minutes || 0) / 60;
  }

  return parseFloat(cleaned) || 0;
};

/**
 * Process imported data and validate
 */
export const processUrenImportData = (
  data: Record<string, string>[]
): ParseResult => {
  const entries: ParsedUrenEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  if (data.length === 0) {
    errors.push("Geen data gevonden in bestand");
    return { entries, errors, warnings };
  }

  // Detect columns from first row
  const firstRow = data[0];
  const datumCol = findColumn(firstRow, columnMappings.datum);
  const medewerkerCol = findColumn(firstRow, columnMappings.medewerker);
  const urenCol = findColumn(firstRow, columnMappings.uren);
  const scopeCol = findColumn(firstRow, columnMappings.scope);
  const notitiesCol = findColumn(firstRow, columnMappings.notities);

  if (!datumCol) {
    errors.push(
      "Kolom 'datum' niet gevonden. Verwachte namen: datum, date, dag"
    );
  }
  if (!medewerkerCol) {
    errors.push(
      "Kolom 'medewerker' niet gevonden. Verwachte namen: medewerker, werknemer, naam"
    );
  }
  if (!urenCol) {
    errors.push("Kolom 'uren' niet gevonden. Verwachte namen: uren, hours, tijd");
  }

  if (errors.length > 0) {
    return { entries, errors, warnings };
  }

  // Process each row
  data.forEach((row, index) => {
    const rowNum = index + 2; // +1 for header, +1 for 1-based index

    // Parse datum
    const datum = parseDate(datumCol ? row[datumCol] : undefined);
    if (!datum) {
      errors.push(`Rij ${rowNum}: Ongeldige datum "${row[datumCol!]}"`);
      return;
    }

    // Parse medewerker
    const medewerker = medewerkerCol
      ? row[medewerkerCol]?.toString().trim()
      : undefined;
    if (!medewerker) {
      errors.push(`Rij ${rowNum}: Medewerker ontbreekt`);
      return;
    }

    // Parse uren
    const uren = parseHours(urenCol ? row[urenCol] : undefined);
    if (uren <= 0) {
      warnings.push(
        `Rij ${rowNum}: Uren is 0 of negatief, wordt overgeslagen`
      );
      return;
    }

    if (uren > 24) {
      warnings.push(`Rij ${rowNum}: Ongebruikelijk hoog aantal uren (${uren})`);
    }

    // Parse optional fields
    const scope = scopeCol ? row[scopeCol]?.toString().trim() : undefined;
    const notities = notitiesCol
      ? row[notitiesCol]?.toString().trim()
      : undefined;

    entries.push({
      datum,
      medewerker,
      uren,
      scope: scope || undefined,
      notities: notities || undefined,
    });
  });

  return { entries, errors, warnings };
};

/**
 * Main parse function - detects file type and processes
 */
export const parseUrenFile = async (file: File): Promise<ParseResult> => {
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  try {
    let data: Record<string, string>[];

    if (fileExtension === "csv") {
      data = await parseCSV(file);
    } else if (fileExtension === "xlsx" || fileExtension === "xls") {
      data = await parseExcel(file);
    } else {
      return {
        entries: [],
        errors: ["Ongeldig bestandstype. Gebruik CSV of XLS/XLSX"],
        warnings: [],
      };
    }

    return processUrenImportData(data);
  } catch (error) {
    return {
      entries: [],
      errors: [`Fout bij laden bestand: ${error}`],
      warnings: [],
    };
  }
};

/**
 * Get sample CSV content for download
 */
export const getSampleCSVContent = (): string => {
  return `datum,medewerker,uren,scope,notities
2024-01-15,Jan Jansen,8,grondwerk,Grond afgegraven
2024-01-15,Piet Peters,8,grondwerk,Afvoer grond
2024-01-16,Jan Jansen,6,bestrating,Tegels gelegd
2024-01-16,Piet Peters,4,bestrating,Opsluitbanden geplaatst
2024-01-17,Jan Jansen,8,borders,Planten gezet`;
};
