// ExcelJS is imported dynamically to reduce initial bundle size
// This module is only loaded when user clicks export

import {
  formatDateCompact,
  formatMonth,
  formatCurrencyNumeric,
  formatPercentage,
} from "@/lib/format";

interface ExportRow {
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

// Dutch status labels
const statusLabels: Record<string, string> = {
  concept: "Concept",
  voorcalculatie: "Voorcalculatie",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};

// Dutch type labels
const typeLabels: Record<string, string> = {
  aanleg: "Aanleg",
  onderhoud: "Onderhoud",
};

// Dutch scope labels
const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & Elektra",
  specials: "Specials",
  gras_onderhoud: "Gras Onderhoud",
  borders_onderhoud: "Borders Onderhoud",
  heggen: "Heggen",
  bomen: "Bomen",
  overig: "Overig",
};

// Format date for Excel
function formatDateExcel(timestamp: number | null): string {
  if (!timestamp) return "";
  return formatDateCompact(timestamp);
}

// Format month for Excel
function formatMonthExcel(timestamp: number): string {
  return formatMonth(timestamp);
}

// Get month key from timestamp
function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Format currency for Excel (without symbol for proper number sorting)
function formatCurrencyExcel(amount: number): number {
  return formatCurrencyNumeric(amount);
}

// Format percentage for Excel
function formatPercentageExcel(value: number): string {
  return formatPercentage(value, 1);
}

// Helper to trigger file download from buffer
function downloadExcelFile(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export async function exportToExcel(data: ExportRow[], filename: string = "offertes-export") {
  // Dynamic import of exceljs
  const ExcelJS = await import("exceljs");

  // Create workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Offertes");

  // Define columns with headers and widths
  worksheet.columns = [
    { header: "Offerte Nr.", key: "offerteNummer", width: 14 },
    { header: "Type", key: "type", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Klant", key: "klant", width: 25 },
    { header: "Adres", key: "adres", width: 30 },
    { header: "Postcode", key: "postcode", width: 10 },
    { header: "Plaats", key: "plaats", width: 15 },
    { header: "E-mail", key: "email", width: 25 },
    { header: "Telefoon", key: "telefoon", width: 15 },
    { header: "Materiaalkosten", key: "materiaalkosten", width: 14 },
    { header: "Arbeidskosten", key: "arbeidskosten", width: 14 },
    { header: "Totaal Uren", key: "totaalUren", width: 12 },
    { header: "Subtotaal", key: "subtotaal", width: 12 },
    { header: "Marge", key: "marge", width: 12 },
    { header: "Marge %", key: "margePercentage", width: 10 },
    { header: "Totaal ex. BTW", key: "totaalExBtw", width: 14 },
    { header: "BTW", key: "btw", width: 12 },
    { header: "Totaal incl. BTW", key: "totaalInclBtw", width: 14 },
    { header: "Aangemaakt", key: "aangemaakt", width: 12 },
    { header: "Bijgewerkt", key: "bijgewerkt", width: 12 },
    { header: "Verzonden", key: "verzonden", width: 12 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data rows
  data.forEach((row) => {
    worksheet.addRow({
      offerteNummer: row.offerteNummer,
      type: typeLabels[row.type] ?? row.type,
      status: statusLabels[row.status] ?? row.status,
      klant: row.klantNaam,
      adres: row.klantAdres,
      postcode: row.klantPostcode,
      plaats: row.klantPlaats,
      email: row.klantEmail,
      telefoon: row.klantTelefoon,
      materiaalkosten: formatCurrencyExcel(row.materiaalkosten),
      arbeidskosten: formatCurrencyExcel(row.arbeidskosten),
      totaalUren: row.totaalUren,
      subtotaal: formatCurrencyExcel(row.subtotaal),
      marge: formatCurrencyExcel(row.marge),
      margePercentage: row.margePercentage,
      totaalExBtw: formatCurrencyExcel(row.totaalExBtw),
      btw: formatCurrencyExcel(row.btw),
      totaalInclBtw: formatCurrencyExcel(row.totaalInclBtw),
      aangemaakt: formatDateExcel(row.aangemaakt),
      bijgewerkt: formatDateExcel(row.bijgewerkt),
      verzonden: formatDateExcel(row.verzonden),
    });
  });

  // Generate filename with date
  const dateStr = new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date()).replace(/\//g, "-");

  const fullFilename = `${filename}-${dateStr}.xlsx`;

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelFile(buffer as ArrayBuffer, fullFilename);
}

// Export KPI summary - Extended types
interface KpiData {
  winRate: number;
  gemiddeldeWaarde: number;
  totaleOmzet: number;
  totaalOffertes: number;
  geaccepteerdCount?: number;
  afgewezenCount?: number;
  avgCycleTime?: number;
  avgResponseTime?: number;
  repeatCustomerPercentage?: number;
  repeatCustomerCount?: number;
  totalCustomers?: number;
  overallConversion?: number;
}

interface TopKlant {
  klantNaam: string;
  totaalOmzet: number;
  aantalOffertes: number;
  gemiddeldeWaarde: number;
  aantalGeaccepteerd?: number;
  isRepeatCustomer?: boolean;
}

interface ScopeMarge {
  scope: string;
  totaal: number;
  marge: number;
  margePercentage: number;
  count: number;
  omzet?: number;
  gemiddeldPerOfferte?: number;
}

interface MaandelijkeTrend {
  maand: string;
  aanleg: number;
  onderhoud: number;
  totaal: number;
  omzet: number;
  movingAvgTotal?: number;
  movingAvgOmzet?: number;
}

// Enhanced multi-sheet export for analytics report
export async function exportAnalyticsReport(
  kpis: KpiData,
  topKlanten: TopKlant[],
  scopeMarges: ScopeMarge[],
  offertes: ExportRow[],
  filename: string = "rapportage",
  maandelijkseTrend?: MaandelijkeTrend[]
) {
  // Dynamic import of exceljs
  const ExcelJS = await import("exceljs");

  const workbook = new ExcelJS.Workbook();

  // Helper to style header row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const styleHeaderRow = (worksheet: any) => {
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };
  };

  // ============================================
  // Sheet 1: Samenvatting (KPIs)
  // ============================================
  const wsKpi = workbook.addWorksheet("Samenvatting");
  wsKpi.columns = [
    { header: "Categorie", key: "categorie", width: 20 },
    { header: "KPI", key: "kpi", width: 28 },
    { header: "Waarde", key: "waarde", width: 18 },
    { header: "Toelichting", key: "toelichting", width: 45 },
  ];
  styleHeaderRow(wsKpi);

  const kpiRows = [
    { categorie: "OFFERTE PRESTATIES", kpi: "", waarde: "", toelichting: "" },
    { categorie: "", kpi: "Totaal Offertes", waarde: kpis.totaalOffertes, toelichting: "Aantal offertes in geselecteerde periode" },
    { categorie: "", kpi: "Geaccepteerd", waarde: kpis.geaccepteerdCount ?? "-", toelichting: "Aantal geaccepteerde offertes" },
    { categorie: "", kpi: "Afgewezen", waarde: kpis.afgewezenCount ?? "-", toelichting: "Aantal afgewezen offertes" },
    { categorie: "", kpi: "Win Rate", waarde: formatPercentageExcel(kpis.winRate), toelichting: "Percentage geaccepteerde offertes" },
    { categorie: "", kpi: "", waarde: "", toelichting: "" },
    { categorie: "FINANCIEEL", kpi: "", waarde: "", toelichting: "" },
    { categorie: "", kpi: "Totale Omzet", waarde: formatCurrencyExcel(kpis.totaleOmzet), toelichting: "Som van geaccepteerde offertes (incl. BTW)" },
    { categorie: "", kpi: "Gemiddelde Offerte Waarde", waarde: formatCurrencyExcel(kpis.gemiddeldeWaarde), toelichting: "Gemiddelde waarde per offerte" },
    { categorie: "", kpi: "", waarde: "", toelichting: "" },
    { categorie: "KLANT INZICHTEN", kpi: "", waarde: "", toelichting: "" },
    { categorie: "", kpi: "Totaal Klanten", waarde: kpis.totalCustomers ?? "-", toelichting: "Unieke klanten" },
    { categorie: "", kpi: "Terugkerende Klanten", waarde: kpis.repeatCustomerCount ?? "-", toelichting: "Klanten met 2+ geaccepteerde offertes" },
    { categorie: "", kpi: "Terugkerende Klanten %", waarde: kpis.repeatCustomerPercentage ? formatPercentageExcel(kpis.repeatCustomerPercentage) : "-", toelichting: "Percentage terugkerende klanten" },
    { categorie: "", kpi: "", waarde: "", toelichting: "" },
    { categorie: "DOORLOOPTIJDEN", kpi: "", waarde: "", toelichting: "" },
    { categorie: "", kpi: "Gem. Doorlooptijd", waarde: kpis.avgCycleTime ? `${kpis.avgCycleTime} dagen` : "-", toelichting: "Gemiddelde tijd van aanmaak tot acceptatie" },
    { categorie: "", kpi: "Gem. Reactietijd", waarde: kpis.avgResponseTime ? `${kpis.avgResponseTime} dagen` : "-", toelichting: "Gemiddelde tijd van verzending tot reactie klant" },
  ];
  kpiRows.forEach((row) => wsKpi.addRow(row));

  // ============================================
  // Sheet 2: Offertes Detail
  // ============================================
  const wsOffertes = workbook.addWorksheet("Offertes Detail");
  wsOffertes.columns = [
    { header: "Offerte Nr.", key: "offerteNummer", width: 14 },
    { header: "Type", key: "type", width: 12 },
    { header: "Status", key: "status", width: 12 },
    { header: "Klant", key: "klant", width: 25 },
    { header: "Adres", key: "adres", width: 30 },
    { header: "Postcode", key: "postcode", width: 10 },
    { header: "Plaats", key: "plaats", width: 15 },
    { header: "E-mail", key: "email", width: 25 },
    { header: "Telefoon", key: "telefoon", width: 15 },
    { header: "Materiaalkosten", key: "materiaalkosten", width: 14 },
    { header: "Arbeidskosten", key: "arbeidskosten", width: 14 },
    { header: "Totaal Uren", key: "totaalUren", width: 12 },
    { header: "Subtotaal", key: "subtotaal", width: 12 },
    { header: "Marge", key: "marge", width: 12 },
    { header: "Marge %", key: "margePercentage", width: 10 },
    { header: "Totaal ex. BTW", key: "totaalExBtw", width: 14 },
    { header: "BTW", key: "btw", width: 12 },
    { header: "Totaal incl. BTW", key: "totaalInclBtw", width: 14 },
    { header: "Aangemaakt", key: "aangemaakt", width: 12 },
    { header: "Bijgewerkt", key: "bijgewerkt", width: 12 },
    { header: "Verzonden", key: "verzonden", width: 12 },
  ];
  styleHeaderRow(wsOffertes);

  offertes.forEach((row) => {
    wsOffertes.addRow({
      offerteNummer: row.offerteNummer,
      type: typeLabels[row.type] ?? row.type,
      status: statusLabels[row.status] ?? row.status,
      klant: row.klantNaam,
      adres: row.klantAdres,
      postcode: row.klantPostcode,
      plaats: row.klantPlaats,
      email: row.klantEmail,
      telefoon: row.klantTelefoon,
      materiaalkosten: formatCurrencyExcel(row.materiaalkosten),
      arbeidskosten: formatCurrencyExcel(row.arbeidskosten),
      totaalUren: row.totaalUren,
      subtotaal: formatCurrencyExcel(row.subtotaal),
      marge: formatCurrencyExcel(row.marge),
      margePercentage: row.margePercentage,
      totaalExBtw: formatCurrencyExcel(row.totaalExBtw),
      btw: formatCurrencyExcel(row.btw),
      totaalInclBtw: formatCurrencyExcel(row.totaalInclBtw),
      aangemaakt: formatDateExcel(row.aangemaakt),
      bijgewerkt: formatDateExcel(row.bijgewerkt),
      verzonden: formatDateExcel(row.verzonden),
    });
  });

  // ============================================
  // Sheet 3: Per Scope Analyse
  // ============================================
  const wsScope = workbook.addWorksheet("Per Scope Analyse");
  wsScope.columns = [
    { header: "Scope", key: "scope", width: 18 },
    { header: "Aantal Offertes", key: "aantalOffertes", width: 15 },
    { header: "Totaal Kosten", key: "totaalKosten", width: 15 },
    { header: "Totaal Marge", key: "totaalMarge", width: 14 },
    { header: "Marge %", key: "margePercentage", width: 10 },
    { header: "Totaal Omzet", key: "totaalOmzet", width: 14 },
    { header: "Aandeel Omzet", key: "aandeelOmzet", width: 14 },
    { header: "Gem. per Offerte", key: "gemPerOfferte", width: 16 },
  ];
  styleHeaderRow(wsScope);

  const totalScopeOmzet = scopeMarges.reduce((sum, s) => sum + (s.omzet ?? s.totaal + s.marge), 0);

  scopeMarges.forEach((s) => {
    const omzet = s.omzet ?? (s.totaal + s.marge);
    const aandeel = totalScopeOmzet > 0 ? (omzet / totalScopeOmzet) * 100 : 0;

    wsScope.addRow({
      scope: scopeLabels[s.scope] ?? s.scope,
      aantalOffertes: s.count,
      totaalKosten: formatCurrencyExcel(s.totaal),
      totaalMarge: formatCurrencyExcel(s.marge),
      margePercentage: formatPercentageExcel(s.margePercentage),
      totaalOmzet: formatCurrencyExcel(omzet),
      aandeelOmzet: formatPercentageExcel(aandeel),
      gemPerOfferte: formatCurrencyExcel(s.gemiddeldPerOfferte ?? (omzet / (s.count || 1))),
    });
  });

  // Add totals row
  const totalsRow = wsScope.addRow({
    scope: "TOTAAL",
    aantalOffertes: scopeMarges.reduce((sum, s) => sum + s.count, 0),
    totaalKosten: formatCurrencyExcel(scopeMarges.reduce((sum, s) => sum + s.totaal, 0)),
    totaalMarge: formatCurrencyExcel(scopeMarges.reduce((sum, s) => sum + s.marge, 0)),
    margePercentage: formatPercentageExcel(
      scopeMarges.reduce((sum, s) => sum + s.totaal, 0) > 0
        ? (scopeMarges.reduce((sum, s) => sum + s.marge, 0) / scopeMarges.reduce((sum, s) => sum + s.totaal, 0)) * 100
        : 0
    ),
    totaalOmzet: formatCurrencyExcel(totalScopeOmzet),
    aandeelOmzet: "100%",
    gemPerOfferte: "-",
  });
  totalsRow.font = { bold: true };

  // ============================================
  // Sheet 4: Per Klant
  // ============================================
  const wsKlanten = workbook.addWorksheet("Per Klant");
  wsKlanten.columns = [
    { header: "#", key: "nummer", width: 5 },
    { header: "Klant", key: "klant", width: 30 },
    { header: "Totaal Omzet", key: "totaalOmzet", width: 15 },
    { header: "Aantal Offertes", key: "aantalOffertes", width: 15 },
    { header: "Geaccepteerd", key: "geaccepteerd", width: 12 },
    { header: "Gem. Waarde", key: "gemWaarde", width: 15 },
    { header: "Terugkerend", key: "terugkerend", width: 12 },
    { header: "Aandeel", key: "aandeel", width: 10 },
  ];
  styleHeaderRow(wsKlanten);

  topKlanten.forEach((k, index) => {
    wsKlanten.addRow({
      nummer: index + 1,
      klant: k.klantNaam,
      totaalOmzet: formatCurrencyExcel(k.totaalOmzet),
      aantalOffertes: k.aantalOffertes,
      geaccepteerd: k.aantalGeaccepteerd ?? "-",
      gemWaarde: formatCurrencyExcel(k.gemiddeldeWaarde),
      terugkerend: k.isRepeatCustomer ? "Ja" : "Nee",
      aandeel: kpis.totaleOmzet > 0 ? formatPercentageExcel((k.totaalOmzet / kpis.totaleOmzet) * 100) : "-",
    });
  });

  // ============================================
  // Sheet 5: Maandelijkse Trends
  // ============================================
  if (maandelijkseTrend && maandelijkseTrend.length > 0) {
    const wsTrend = workbook.addWorksheet("Maandelijkse Trends");
    wsTrend.columns = [
      { header: "Maand", key: "maand", width: 15 },
      { header: "Aanleg", key: "aanleg", width: 10 },
      { header: "Onderhoud", key: "onderhoud", width: 12 },
      { header: "Totaal Offertes", key: "totaalOffertes", width: 15 },
      { header: "Omzet", key: "omzet", width: 14 },
      { header: "Voortschrijdend Gem. (Offertes)", key: "movingAvgOffertes", width: 25 },
      { header: "Voortschrijdend Gem. (Omzet)", key: "movingAvgOmzet", width: 25 },
    ];
    styleHeaderRow(wsTrend);

    maandelijkseTrend.forEach((m) => {
      wsTrend.addRow({
        maand: m.maand,
        aanleg: m.aanleg,
        onderhoud: m.onderhoud,
        totaalOffertes: m.totaal,
        omzet: formatCurrencyExcel(m.omzet),
        movingAvgOffertes: m.movingAvgTotal ?? "-",
        movingAvgOmzet: m.movingAvgOmzet ? formatCurrencyExcel(m.movingAvgOmzet) : "-",
      });
    });

    // Calculate monthly averages
    const avgOffertes = maandelijkseTrend.length > 0
      ? maandelijkseTrend.reduce((sum, m) => sum + m.totaal, 0) / maandelijkseTrend.length
      : 0;
    const avgOmzet = maandelijkseTrend.length > 0
      ? maandelijkseTrend.reduce((sum, m) => sum + m.omzet, 0) / maandelijkseTrend.length
      : 0;

    // Add summary row
    const summaryRow = wsTrend.addRow({
      maand: "GEMIDDELDE",
      aanleg: Math.round(maandelijkseTrend.reduce((sum, m) => sum + m.aanleg, 0) / maandelijkseTrend.length * 10) / 10,
      onderhoud: Math.round(maandelijkseTrend.reduce((sum, m) => sum + m.onderhoud, 0) / maandelijkseTrend.length * 10) / 10,
      totaalOffertes: Math.round(avgOffertes * 10) / 10,
      omzet: formatCurrencyExcel(avgOmzet),
      movingAvgOffertes: "-",
      movingAvgOmzet: "-",
    });
    summaryRow.font = { bold: true };
  } else {
    // Generate monthly trends from offertes if not provided
    const monthlyAggregation: Record<string, { maand: string; aanleg: number; onderhoud: number; totaal: number; omzet: number }> = {};

    for (const offerte of offertes) {
      const monthKey = getMonthKey(offerte.aangemaakt);
      const monthLabel = formatMonthExcel(offerte.aangemaakt);

      if (!monthlyAggregation[monthKey]) {
        monthlyAggregation[monthKey] = {
          maand: monthLabel,
          aanleg: 0,
          onderhoud: 0,
          totaal: 0,
          omzet: 0,
        };
      }

      monthlyAggregation[monthKey].totaal++;
      if (offerte.type === "aanleg") {
        monthlyAggregation[monthKey].aanleg++;
      } else {
        monthlyAggregation[monthKey].onderhoud++;
      }

      if (offerte.status === "geaccepteerd") {
        monthlyAggregation[monthKey].omzet += offerte.totaalInclBtw;
      }
    }

    const sortedMonths = Object.entries(monthlyAggregation)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, data]) => data);

    if (sortedMonths.length > 0) {
      const wsTrend = workbook.addWorksheet("Maandelijkse Trends");
      wsTrend.columns = [
        { header: "Maand", key: "maand", width: 15 },
        { header: "Aanleg", key: "aanleg", width: 10 },
        { header: "Onderhoud", key: "onderhoud", width: 12 },
        { header: "Totaal Offertes", key: "totaalOffertes", width: 15 },
        { header: "Omzet", key: "omzet", width: 14 },
      ];
      styleHeaderRow(wsTrend);

      sortedMonths.forEach((m) => {
        wsTrend.addRow({
          maand: m.maand,
          aanleg: m.aanleg,
          onderhoud: m.onderhoud,
          totaalOffertes: m.totaal,
          omzet: formatCurrencyExcel(m.omzet),
        });
      });
    }
  }

  // Generate filename with date
  const dateStr = new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date()).replace(/\//g, "-");

  const fullFilename = `${filename}-${dateStr}.xlsx`;

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelFile(buffer as ArrayBuffer, fullFilename);
}

// Simple export for backwards compatibility
export async function exportAnalyticsReportSimple(
  kpis: KpiData,
  topKlanten: TopKlant[],
  scopeMarges: ScopeMarge[],
  offertes: ExportRow[],
  filename: string = "rapportage"
) {
  return exportAnalyticsReport(kpis, topKlanten, scopeMarges, offertes, filename);
}
