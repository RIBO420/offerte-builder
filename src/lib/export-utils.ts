/**
 * Export Utilities - CSV and Excel Export Functions
 *
 * Provides utilities for exporting data to CSV and Excel formats.
 * Supports Dutch column headers and proper formatting.
 */

// Column definition for exports
export interface ExportColumn<T> {
  key: keyof T | string;
  header: string; // Dutch column header
  format?: (value: unknown, row: T) => string | number;
}

/**
 * Format date for export (Dutch format)
 */
export function formatExportDate(timestamp: number | undefined | null): string {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

/**
 * Format currency for export (number without symbol for Excel compatibility)
 */
export function formatExportCurrency(amount: number | undefined | null): number {
  if (amount === undefined || amount === null) return 0;
  return Math.round(amount * 100) / 100;
}

/**
 * Format percentage for export
 */
export function formatExportPercentage(value: number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return `${Math.round(value * 10) / 10}%`;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue<T>(obj: T, path: string): unknown {
  return path.split(".").reduce((current: unknown, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Generate filename with date
 */
function generateFilename(baseName: string, extension: string): string {
  const dateStr = new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date()).replace(/\//g, "-");
  return `${baseName}-${dateStr}.${extension}`;
}

/**
 * Escape CSV value (handle quotes, commas, newlines)
 */
function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Export data to CSV and trigger download
 *
 * @param data - Array of data objects to export
 * @param columns - Column definitions with keys and Dutch headers
 * @param filename - Base filename (without extension, date will be added)
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Build header row
  const headerRow = columns.map((col) => escapeCSVValue(col.header)).join(",");

  // Build data rows
  const dataRows = data.map((row) => {
    return columns
      .map((col) => {
        let value: unknown;

        if (col.format) {
          // Use custom formatter
          value = col.format(getNestedValue(row, col.key as string), row);
        } else {
          // Get value using key (supports nested keys like "klant.naam")
          value = getNestedValue(row, col.key as string);
        }

        return escapeCSVValue(value as string | number | null | undefined);
      })
      .join(",");
  });

  // Combine header and data
  const csvContent = [headerRow, ...dataRows].join("\n");

  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  // Trigger download
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = generateFilename(filename, "csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

/**
 * Export data to Excel and trigger download
 * Uses dynamic import to avoid loading xlsx in initial bundle
 *
 * @param data - Array of data objects to export
 * @param columns - Column definitions with keys and Dutch headers
 * @param filename - Base filename (without extension, date will be added)
 * @param sheetName - Name of the Excel sheet (default: "Data")
 */
export async function exportToExcel<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName: string = "Data"
): Promise<void> {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Dynamic import of xlsx to reduce initial bundle size
  const XLSX = await import("xlsx");

  // Transform data to objects with Dutch headers
  const excelData = data.map((row) => {
    const excelRow: Record<string, string | number> = {};

    columns.forEach((col) => {
      let value: unknown;

      if (col.format) {
        // Use custom formatter
        value = col.format(getNestedValue(row, col.key as string), row);
      } else {
        // Get value using key
        value = getNestedValue(row, col.key as string);
      }

      // Convert to string or number for Excel
      if (value === null || value === undefined) {
        excelRow[col.header] = "";
      } else if (typeof value === "number") {
        excelRow[col.header] = value;
      } else {
        excelRow[col.header] = String(value);
      }
    });

    return excelRow;
  });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths based on header length and content
  const colWidths = columns.map((col) => {
    // Calculate width based on header length and typical content
    const headerWidth = col.header.length;
    // Estimate content width (minimum 10, max 40)
    const contentWidth = Math.max(10, Math.min(40, headerWidth + 5));
    return { wch: contentWidth };
  });
  ws["!cols"] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate and download file
  const fullFilename = generateFilename(filename, "xlsx");
  XLSX.writeFile(wb, fullFilename);
}

// ============================================
// Pre-defined column configurations for common exports
// ============================================

/**
 * Status labels in Dutch
 */
export const statusLabels: Record<string, string> = {
  // Offerte statuses
  concept: "Concept",
  voorcalculatie: "Voorcalculatie",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
  // Project statuses
  gepland: "Gepland",
  in_uitvoering: "In Uitvoering",
  afgerond: "Afgerond",
  nacalculatie_compleet: "Nacalculatie Compleet",
  gefactureerd: "Gefactureerd",
  // Factuur statuses
  definitief: "Definitief",
  betaald: "Betaald",
  vervallen: "Vervallen",
};

/**
 * Type labels in Dutch
 */
export const typeLabels: Record<string, string> = {
  aanleg: "Aanleg",
  onderhoud: "Onderhoud",
};
