import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mock ExcelJS — must be defined before the module under test is imported
// ---------------------------------------------------------------------------

// Track all worksheet data for assertions
interface MockWorksheetData {
  name: string;
  columns: unknown[];
  rows: Record<string, unknown>[];
  headerRow: { font?: unknown; fill?: unknown };
}

let mockWorksheets: MockWorksheetData[] = [];
let mockWriteBufferResult: ArrayBuffer;

function createMockRow() {
  return {
    font: undefined as unknown,
    fill: undefined as unknown,
  };
}

function createMockWorksheet(name: string): MockWorksheetData & {
  columns: unknown[];
  getRow: (n: number) => { font: unknown; fill: unknown };
  addRow: (row: Record<string, unknown>) => { font: unknown };
} {
  const data: MockWorksheetData = {
    name,
    columns: [],
    rows: [],
    headerRow: {},
  };
  mockWorksheets.push(data);

  return {
    get columns() {
      return data.columns;
    },
    set columns(val: unknown[]) {
      data.columns = val;
    },
    rows: data.rows,
    headerRow: data.headerRow,
    getRow(n: number) {
      if (n === 1) {
        return data.headerRow as { font: unknown; fill: unknown };
      }
      return createMockRow();
    },
    addRow(row: Record<string, unknown>) {
      data.rows.push(row);
      return createMockRow();
    },
  };
}

vi.mock("exceljs", () => ({
  default: {
    Workbook: class {
      xlsx = {
        writeBuffer: () => Promise.resolve(mockWriteBufferResult),
      };
      addWorksheet(name: string) {
        return createMockWorksheet(name);
      }
    },
  },
  Workbook: class {
    xlsx = {
      writeBuffer: () => Promise.resolve(mockWriteBufferResult),
    };
    addWorksheet(name: string) {
      return createMockWorksheet(name);
    }
  },
}));

// Mock DOM APIs used by downloadExcelFile
let lastCreatedLink: { href: string; download: string; click: Mock };
const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  mockWorksheets = [];
  mockWriteBufferResult = new ArrayBuffer(8);

  lastCreatedLink = {
    href: "",
    download: "",
    click: vi.fn(),
  };

  vi.stubGlobal("URL", {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  });

  // Mock document.createElement to capture link element
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "a") {
      return lastCreatedLink as unknown as HTMLElement;
    }
    return document.createElement(tag);
  });

  vi.spyOn(document.body, "appendChild").mockImplementation((node) => node);
  vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
});

// ---------------------------------------------------------------------------
// Import the module under test (after mocks are set up)
// ---------------------------------------------------------------------------
import { exportToExcel, exportAnalyticsReport } from "@/lib/excel-export";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExportRow(overrides: Partial<ExportRowInput> = {}): ExportRowInput {
  return {
    offerteNummer: "OFF-2026-001",
    type: "aanleg",
    status: "concept",
    klantNaam: "Jan Jansen",
    klantAdres: "Hoofdstraat 1",
    klantPostcode: "1234 AB",
    klantPlaats: "Amsterdam",
    klantEmail: "jan@test.nl",
    klantTelefoon: "06-12345678",
    materiaalkosten: 1000,
    arbeidskosten: 2000,
    totaalUren: 40,
    subtotaal: 3000,
    marge: 600,
    margePercentage: 20,
    totaalExBtw: 3600,
    btw: 756,
    totaalInclBtw: 4356,
    aangemaakt: 1711900800000, // 2024-04-01
    bijgewerkt: 1711987200000, // 2024-04-02
    verzonden: null,
    ...overrides,
  };
}

// The ExportRow type from excel-export.ts
interface ExportRowInput {
  offerteNummer: string;
  type: string;
  status: string;
  klantNaam: string;
  klantAdres: string;
  klantPostcode: string;
  klantPlaats: string;
  klantEmail: string;
  klantTelefoon: string;
  materiaalkosten: number;
  arbeidskosten: number;
  totaalUren: number;
  subtotaal: number;
  marge: number;
  margePercentage: number;
  totaalExBtw: number;
  btw: number;
  totaalInclBtw: number;
  aangemaakt: number;
  bijgewerkt: number;
  verzonden: number | null;
}

// ===========================================================================
// exportToExcel
// ===========================================================================

describe("exportToExcel", () => {
  // -----------------------------------------------------------------------
  // Worksheet creation
  // -----------------------------------------------------------------------
  describe("worksheet creation", () => {
    it("creates a worksheet named 'Offertes'", async () => {
      await exportToExcel([makeExportRow()]);

      expect(mockWorksheets).toHaveLength(1);
      expect(mockWorksheets[0].name).toBe("Offertes");
    });

    it("defines correct column headers", async () => {
      await exportToExcel([makeExportRow()]);

      const ws = mockWorksheets[0];
      const headers = ws.columns.map((c: any) => c.header);

      expect(headers).toContain("Offerte Nr.");
      expect(headers).toContain("Type");
      expect(headers).toContain("Status");
      expect(headers).toContain("Klant");
      expect(headers).toContain("Adres");
      expect(headers).toContain("Postcode");
      expect(headers).toContain("Plaats");
      expect(headers).toContain("E-mail");
      expect(headers).toContain("Telefoon");
      expect(headers).toContain("Materiaalkosten");
      expect(headers).toContain("Arbeidskosten");
      expect(headers).toContain("Totaal Uren");
      expect(headers).toContain("Subtotaal");
      expect(headers).toContain("Marge");
      expect(headers).toContain("Marge %");
      expect(headers).toContain("Totaal ex. BTW");
      expect(headers).toContain("BTW");
      expect(headers).toContain("Totaal incl. BTW");
      expect(headers).toContain("Aangemaakt");
      expect(headers).toContain("Bijgewerkt");
      expect(headers).toContain("Verzonden");
    });

    it("defines 21 columns total", async () => {
      await exportToExcel([makeExportRow()]);

      expect(mockWorksheets[0].columns).toHaveLength(21);
    });
  });

  // -----------------------------------------------------------------------
  // Data transformation
  // -----------------------------------------------------------------------
  describe("data transformation", () => {
    it("adds one data row per input record", async () => {
      const data = [makeExportRow(), makeExportRow({ offerteNummer: "OFF-002" })];
      await exportToExcel(data);

      expect(mockWorksheets[0].rows).toHaveLength(2);
    });

    it("maps klantNaam to klant column", async () => {
      await exportToExcel([makeExportRow({ klantNaam: "Piet Pietersen" })]);

      expect(mockWorksheets[0].rows[0].klant).toBe("Piet Pietersen");
    });

    it("translates type 'aanleg' to 'Aanleg'", async () => {
      await exportToExcel([makeExportRow({ type: "aanleg" })]);

      expect(mockWorksheets[0].rows[0].type).toBe("Aanleg");
    });

    it("translates type 'onderhoud' to 'Onderhoud'", async () => {
      await exportToExcel([makeExportRow({ type: "onderhoud" })]);

      expect(mockWorksheets[0].rows[0].type).toBe("Onderhoud");
    });

    it("passes through unknown type values as-is", async () => {
      await exportToExcel([makeExportRow({ type: "custom_type" })]);

      expect(mockWorksheets[0].rows[0].type).toBe("custom_type");
    });

    it("translates status 'concept' to 'Concept'", async () => {
      await exportToExcel([makeExportRow({ status: "concept" })]);

      expect(mockWorksheets[0].rows[0].status).toBe("Concept");
    });

    it("translates status 'geaccepteerd' to 'Geaccepteerd'", async () => {
      await exportToExcel([makeExportRow({ status: "geaccepteerd" })]);

      expect(mockWorksheets[0].rows[0].status).toBe("Geaccepteerd");
    });

    it("translates status 'afgewezen' to 'Afgewezen'", async () => {
      await exportToExcel([makeExportRow({ status: "afgewezen" })]);

      expect(mockWorksheets[0].rows[0].status).toBe("Afgewezen");
    });

    it("passes through unknown status values as-is", async () => {
      await exportToExcel([makeExportRow({ status: "unknown_status" })]);

      expect(mockWorksheets[0].rows[0].status).toBe("unknown_status");
    });
  });

  // -----------------------------------------------------------------------
  // Currency formatting (numeric, rounded to 2 decimals)
  // -----------------------------------------------------------------------
  describe("currency formatting", () => {
    it("rounds materiaalkosten to 2 decimal places", async () => {
      await exportToExcel([makeExportRow({ materiaalkosten: 1234.567 })]);

      expect(mockWorksheets[0].rows[0].materiaalkosten).toBe(1234.57);
    });

    it("preserves exact amounts with 2 decimals", async () => {
      await exportToExcel([makeExportRow({ subtotaal: 3000.0 })]);

      expect(mockWorksheets[0].rows[0].subtotaal).toBe(3000);
    });

    it("handles zero amounts", async () => {
      await exportToExcel([makeExportRow({ materiaalkosten: 0, arbeidskosten: 0 })]);

      expect(mockWorksheets[0].rows[0].materiaalkosten).toBe(0);
      expect(mockWorksheets[0].rows[0].arbeidskosten).toBe(0);
    });

    it("handles negative amounts", async () => {
      await exportToExcel([makeExportRow({ marge: -500.999 })]);

      expect(mockWorksheets[0].rows[0].marge).toBe(-501);
    });
  });

  // -----------------------------------------------------------------------
  // Date formatting
  // -----------------------------------------------------------------------
  describe("date formatting", () => {
    it("formats verzonden as empty string when null", async () => {
      await exportToExcel([makeExportRow({ verzonden: null })]);

      expect(mockWorksheets[0].rows[0].verzonden).toBe("");
    });

    it("formats a timestamp into a date string", async () => {
      // Just check it is a non-empty string when timestamp is provided
      await exportToExcel([makeExportRow({ aangemaakt: 1711900800000 })]);

      const val = mockWorksheets[0].rows[0].aangemaakt;
      expect(typeof val).toBe("string");
      expect(val).not.toBe("");
    });
  });

  // -----------------------------------------------------------------------
  // Empty dataset
  // -----------------------------------------------------------------------
  describe("empty dataset", () => {
    it("creates worksheet with headers but no data rows", async () => {
      await exportToExcel([]);

      expect(mockWorksheets).toHaveLength(1);
      expect(mockWorksheets[0].rows).toHaveLength(0);
      expect(mockWorksheets[0].columns).toHaveLength(21);
    });
  });

  // -----------------------------------------------------------------------
  // Special characters
  // -----------------------------------------------------------------------
  describe("special characters in data", () => {
    it("preserves Dutch special characters in klant name", async () => {
      await exportToExcel([makeExportRow({ klantNaam: "Café Renée" })]);

      expect(mockWorksheets[0].rows[0].klant).toBe("Café Renée");
    });

    it("preserves special characters in address", async () => {
      await exportToExcel([makeExportRow({ klantAdres: "Bühlstraße 12" })]);

      expect(mockWorksheets[0].rows[0].adres).toBe("Bühlstraße 12");
    });
  });

  // -----------------------------------------------------------------------
  // File download
  // -----------------------------------------------------------------------
  describe("file download", () => {
    it("triggers a download via link click", async () => {
      await exportToExcel([makeExportRow()]);

      expect(lastCreatedLink.click).toHaveBeenCalledOnce();
    });

    it("generates filename with date suffix", async () => {
      await exportToExcel([makeExportRow()], "test-export");

      expect(lastCreatedLink.download).toMatch(/^test-export-\d{2}-\d{2}-\d{4}\.xlsx$/);
    });

    it("uses default filename when not specified", async () => {
      await exportToExcel([makeExportRow()]);

      expect(lastCreatedLink.download).toMatch(/^offertes-export-/);
    });

    it("creates blob URL and revokes it after download", async () => {
      await exportToExcel([makeExportRow()]);

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });
});

// ===========================================================================
// exportAnalyticsReport
// ===========================================================================

describe("exportAnalyticsReport", () => {
  const kpis = {
    winRate: 65,
    gemiddeldeWaarde: 5000,
    totaleOmzet: 150000,
    totaalOffertes: 30,
    geaccepteerdCount: 20,
    afgewezenCount: 10,
    avgCycleTime: 14,
    avgResponseTime: 3,
    repeatCustomerPercentage: 40,
    repeatCustomerCount: 8,
    totalCustomers: 20,
    overallConversion: 65,
  };

  const topKlanten = [
    {
      klantNaam: "Bedrijf A",
      totaalOmzet: 50000,
      aantalOffertes: 5,
      gemiddeldeWaarde: 10000,
      aantalGeaccepteerd: 4,
      isRepeatCustomer: true,
    },
    {
      klantNaam: "Familie B",
      totaalOmzet: 25000,
      aantalOffertes: 2,
      gemiddeldeWaarde: 12500,
      aantalGeaccepteerd: 2,
      isRepeatCustomer: true,
    },
  ];

  const scopeMarges = [
    {
      scope: "bestrating",
      totaal: 30000,
      marge: 9000,
      margePercentage: 30,
      count: 10,
      omzet: 39000,
      gemiddeldPerOfferte: 3900,
    },
    {
      scope: "grondwerk",
      totaal: 20000,
      marge: 4000,
      margePercentage: 20,
      count: 8,
      omzet: 24000,
      gemiddeldPerOfferte: 3000,
    },
  ];

  const offertes = [makeExportRow()];

  // -----------------------------------------------------------------------
  // Sheet creation
  // -----------------------------------------------------------------------
  describe("sheet creation", () => {
    it("creates at least 4 worksheets (Samenvatting, Offertes Detail, Per Scope Analyse, Per Klant)", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes);

      const names = mockWorksheets.map((ws) => ws.name);
      expect(names).toContain("Samenvatting");
      expect(names).toContain("Offertes Detail");
      expect(names).toContain("Per Scope Analyse");
      expect(names).toContain("Per Klant");
    });

    it("creates Maandelijkse Trends sheet when maandelijkseTrend is provided", async () => {
      const trends = [
        { maand: "januari 2026", aanleg: 5, onderhoud: 3, totaal: 8, omzet: 40000 },
        { maand: "februari 2026", aanleg: 4, onderhoud: 2, totaal: 6, omzet: 30000 },
      ];

      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes, "rapportage", trends);

      const names = mockWorksheets.map((ws) => ws.name);
      expect(names).toContain("Maandelijkse Trends");
    });

    it("auto-generates monthly trends from offertes when maandelijkseTrend is omitted", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes);

      // Should create the trends sheet from offertes data
      const names = mockWorksheets.map((ws) => ws.name);
      expect(names).toContain("Maandelijkse Trends");
    });
  });

  // -----------------------------------------------------------------------
  // KPI sheet (Samenvatting)
  // -----------------------------------------------------------------------
  describe("Samenvatting sheet", () => {
    it("contains KPI rows with category labels", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes);

      const ws = mockWorksheets.find((w) => w.name === "Samenvatting")!;
      const categories = ws.rows.map((r) => r.categorie).filter(Boolean);

      expect(categories).toContain("OFFERTE PRESTATIES");
      expect(categories).toContain("FINANCIEEL");
      expect(categories).toContain("KLANT INZICHTEN");
      expect(categories).toContain("DOORLOOPTIJDEN");
    });

    it("includes total offertes count", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes);

      const ws = mockWorksheets.find((w) => w.name === "Samenvatting")!;
      const totaalRow = ws.rows.find((r) => r.kpi === "Totaal Offertes");
      expect(totaalRow?.waarde).toBe(30);
    });
  });

  // -----------------------------------------------------------------------
  // Per Scope Analyse sheet
  // -----------------------------------------------------------------------
  describe("Per Scope Analyse sheet", () => {
    it("adds one row per scope plus a totals row", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes);

      const ws = mockWorksheets.find((w) => w.name === "Per Scope Analyse")!;
      // 2 scope rows + 1 TOTAAL row
      expect(ws.rows).toHaveLength(3);
    });

    it("translates scope keys to Dutch labels", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes);

      const ws = mockWorksheets.find((w) => w.name === "Per Scope Analyse")!;
      const scopeNames = ws.rows.map((r) => r.scope);

      expect(scopeNames).toContain("Bestrating");
      expect(scopeNames).toContain("Grondwerk");
    });

    it("includes a bold TOTAAL row", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes);

      const ws = mockWorksheets.find((w) => w.name === "Per Scope Analyse")!;
      const totaalRow = ws.rows.find((r) => r.scope === "TOTAAL");

      expect(totaalRow).toBeDefined();
      expect(totaalRow!.aantalOffertes).toBe(18); // 10 + 8
    });
  });

  // -----------------------------------------------------------------------
  // Per Klant sheet
  // -----------------------------------------------------------------------
  describe("Per Klant sheet", () => {
    it("adds numbered rows for each klant", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes);

      const ws = mockWorksheets.find((w) => w.name === "Per Klant")!;
      expect(ws.rows).toHaveLength(2);
      expect(ws.rows[0].nummer).toBe(1);
      expect(ws.rows[1].nummer).toBe(2);
    });

    it("shows terugkerend as 'Ja' or 'Nee'", async () => {
      const klanten = [
        { ...topKlanten[0], isRepeatCustomer: true },
        { ...topKlanten[1], isRepeatCustomer: false },
      ];
      await exportAnalyticsReport(kpis, klanten, scopeMarges, offertes);

      const ws = mockWorksheets.find((w) => w.name === "Per Klant")!;
      expect(ws.rows[0].terugkerend).toBe("Ja");
      expect(ws.rows[1].terugkerend).toBe("Nee");
    });
  });

  // -----------------------------------------------------------------------
  // Offertes Detail sheet
  // -----------------------------------------------------------------------
  describe("Offertes Detail sheet", () => {
    it("maps offerte data to correct columns", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes);

      const ws = mockWorksheets.find((w) => w.name === "Offertes Detail")!;
      expect(ws.rows).toHaveLength(1);
      expect(ws.rows[0].offerteNummer).toBe("OFF-2026-001");
      expect(ws.rows[0].klant).toBe("Jan Jansen");
    });
  });

  // -----------------------------------------------------------------------
  // Empty data
  // -----------------------------------------------------------------------
  describe("empty data", () => {
    it("handles empty offertes, klanten, and scopes arrays", async () => {
      const emptyKpis = {
        winRate: 0,
        gemiddeldeWaarde: 0,
        totaleOmzet: 0,
        totaalOffertes: 0,
      };

      await exportAnalyticsReport(emptyKpis, [], [], []);

      // Should not throw and should create at least the 4 main sheets
      const names = mockWorksheets.map((ws) => ws.name);
      expect(names).toContain("Samenvatting");
      expect(names).toContain("Offertes Detail");
      expect(names).toContain("Per Scope Analyse");
      expect(names).toContain("Per Klant");
    });
  });

  // -----------------------------------------------------------------------
  // Filename
  // -----------------------------------------------------------------------
  describe("filename", () => {
    it("uses custom filename prefix", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes, "my-report");

      expect(lastCreatedLink.download).toMatch(/^my-report-/);
    });

    it("uses default 'rapportage' filename when not specified", async () => {
      await exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes);

      expect(lastCreatedLink.download).toMatch(/^rapportage-/);
    });
  });
});
