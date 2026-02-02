// XLSX is imported dynamically to reduce initial bundle size (~400KB)
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

export async function exportToExcel(data: ExportRow[], filename: string = "offertes-export") {
  // Dynamic import of xlsx
  const XLSX = await import("xlsx");

  // Transform data for Dutch Excel format
  const excelData = data.map((row) => ({
    "Offerte Nr.": row.offerteNummer,
    "Type": typeLabels[row.type] ?? row.type,
    "Status": statusLabels[row.status] ?? row.status,
    "Klant": row.klantNaam,
    "Adres": row.klantAdres,
    "Postcode": row.klantPostcode,
    "Plaats": row.klantPlaats,
    "E-mail": row.klantEmail,
    "Telefoon": row.klantTelefoon,
    "Materiaalkosten": formatCurrencyExcel(row.materiaalkosten),
    "Arbeidskosten": formatCurrencyExcel(row.arbeidskosten),
    "Totaal Uren": row.totaalUren,
    "Subtotaal": formatCurrencyExcel(row.subtotaal),
    "Marge": formatCurrencyExcel(row.marge),
    "Marge %": row.margePercentage,
    "Totaal ex. BTW": formatCurrencyExcel(row.totaalExBtw),
    "BTW": formatCurrencyExcel(row.btw),
    "Totaal incl. BTW": formatCurrencyExcel(row.totaalInclBtw),
    "Aangemaakt": formatDateExcel(row.aangemaakt),
    "Bijgewerkt": formatDateExcel(row.bijgewerkt),
    "Verzonden": formatDateExcel(row.verzonden),
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const colWidths = [
    { wch: 14 }, // Offerte Nr.
    { wch: 12 }, // Type
    { wch: 12 }, // Status
    { wch: 25 }, // Klant
    { wch: 30 }, // Adres
    { wch: 10 }, // Postcode
    { wch: 15 }, // Plaats
    { wch: 25 }, // E-mail
    { wch: 15 }, // Telefoon
    { wch: 14 }, // Materiaalkosten
    { wch: 14 }, // Arbeidskosten
    { wch: 12 }, // Totaal Uren
    { wch: 12 }, // Subtotaal
    { wch: 12 }, // Marge
    { wch: 10 }, // Marge %
    { wch: 14 }, // Totaal ex. BTW
    { wch: 12 }, // BTW
    { wch: 14 }, // Totaal incl. BTW
    { wch: 12 }, // Aangemaakt
    { wch: 12 }, // Bijgewerkt
    { wch: 12 }, // Verzonden
  ];
  ws["!cols"] = colWidths;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, "Offertes");

  // Generate filename with date
  const dateStr = new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date()).replace(/\//g, "-");

  const fullFilename = `${filename}-${dateStr}.xlsx`;

  // Download file
  XLSX.writeFile(wb, fullFilename);
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
  // Dynamic import of xlsx
  const XLSX = await import("xlsx");

  const wb = XLSX.utils.book_new();

  // ============================================
  // Sheet 1: Samenvatting (KPIs)
  // ============================================
  const kpiData = [
    { "Categorie": "OFFERTE PRESTATIES", "KPI": "", "Waarde": "", "Toelichting": "" },
    { "Categorie": "", "KPI": "Totaal Offertes", "Waarde": kpis.totaalOffertes, "Toelichting": "Aantal offertes in geselecteerde periode" },
    { "Categorie": "", "KPI": "Geaccepteerd", "Waarde": kpis.geaccepteerdCount ?? "-", "Toelichting": "Aantal geaccepteerde offertes" },
    { "Categorie": "", "KPI": "Afgewezen", "Waarde": kpis.afgewezenCount ?? "-", "Toelichting": "Aantal afgewezen offertes" },
    { "Categorie": "", "KPI": "Win Rate", "Waarde": formatPercentageExcel(kpis.winRate), "Toelichting": "Percentage geaccepteerde offertes" },
    { "Categorie": "", "KPI": "", "Waarde": "", "Toelichting": "" },
    { "Categorie": "FINANCIEEL", "KPI": "", "Waarde": "", "Toelichting": "" },
    { "Categorie": "", "KPI": "Totale Omzet", "Waarde": formatCurrencyExcel(kpis.totaleOmzet), "Toelichting": "Som van geaccepteerde offertes (incl. BTW)" },
    { "Categorie": "", "KPI": "Gemiddelde Offerte Waarde", "Waarde": formatCurrencyExcel(kpis.gemiddeldeWaarde), "Toelichting": "Gemiddelde waarde per offerte" },
    { "Categorie": "", "KPI": "", "Waarde": "", "Toelichting": "" },
    { "Categorie": "KLANT INZICHTEN", "KPI": "", "Waarde": "", "Toelichting": "" },
    { "Categorie": "", "KPI": "Totaal Klanten", "Waarde": kpis.totalCustomers ?? "-", "Toelichting": "Unieke klanten" },
    { "Categorie": "", "KPI": "Terugkerende Klanten", "Waarde": kpis.repeatCustomerCount ?? "-", "Toelichting": "Klanten met 2+ geaccepteerde offertes" },
    { "Categorie": "", "KPI": "Terugkerende Klanten %", "Waarde": kpis.repeatCustomerPercentage ? formatPercentageExcel(kpis.repeatCustomerPercentage) : "-", "Toelichting": "Percentage terugkerende klanten" },
    { "Categorie": "", "KPI": "", "Waarde": "", "Toelichting": "" },
    { "Categorie": "DOORLOOPTIJDEN", "KPI": "", "Waarde": "", "Toelichting": "" },
    { "Categorie": "", "KPI": "Gem. Doorlooptijd", "Waarde": kpis.avgCycleTime ? `${kpis.avgCycleTime} dagen` : "-", "Toelichting": "Gemiddelde tijd van aanmaak tot acceptatie" },
    { "Categorie": "", "KPI": "Gem. Reactietijd", "Waarde": kpis.avgResponseTime ? `${kpis.avgResponseTime} dagen` : "-", "Toelichting": "Gemiddelde tijd van verzending tot reactie klant" },
  ];

  const wsKpi = XLSX.utils.json_to_sheet(kpiData);
  wsKpi["!cols"] = [{ wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsKpi, "Samenvatting");

  // ============================================
  // Sheet 2: Offertes Detail
  // ============================================
  const offerteData = offertes.map((row) => ({
    "Offerte Nr.": row.offerteNummer,
    "Type": typeLabels[row.type] ?? row.type,
    "Status": statusLabels[row.status] ?? row.status,
    "Klant": row.klantNaam,
    "Adres": row.klantAdres,
    "Postcode": row.klantPostcode,
    "Plaats": row.klantPlaats,
    "E-mail": row.klantEmail,
    "Telefoon": row.klantTelefoon,
    "Materiaalkosten": formatCurrencyExcel(row.materiaalkosten),
    "Arbeidskosten": formatCurrencyExcel(row.arbeidskosten),
    "Totaal Uren": row.totaalUren,
    "Subtotaal": formatCurrencyExcel(row.subtotaal),
    "Marge": formatCurrencyExcel(row.marge),
    "Marge %": row.margePercentage,
    "Totaal ex. BTW": formatCurrencyExcel(row.totaalExBtw),
    "BTW": formatCurrencyExcel(row.btw),
    "Totaal incl. BTW": formatCurrencyExcel(row.totaalInclBtw),
    "Aangemaakt": formatDateExcel(row.aangemaakt),
    "Bijgewerkt": formatDateExcel(row.bijgewerkt),
    "Verzonden": formatDateExcel(row.verzonden),
  }));

  const wsOffertes = XLSX.utils.json_to_sheet(offerteData);
  wsOffertes["!cols"] = [
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 30 },
    { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 14 },
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsOffertes, "Offertes Detail");

  // ============================================
  // Sheet 3: Per Scope Analyse
  // ============================================
  const totalScopeOmzet = scopeMarges.reduce((sum, s) => sum + (s.omzet ?? s.totaal + s.marge), 0);

  const scopeData = scopeMarges.map((s) => {
    const omzet = s.omzet ?? (s.totaal + s.marge);
    const aandeel = totalScopeOmzet > 0 ? (omzet / totalScopeOmzet) * 100 : 0;

    return {
      "Scope": scopeLabels[s.scope] ?? s.scope,
      "Aantal Offertes": s.count,
      "Totaal Kosten": formatCurrencyExcel(s.totaal),
      "Totaal Marge": formatCurrencyExcel(s.marge),
      "Marge %": formatPercentageExcel(s.margePercentage),
      "Totaal Omzet": formatCurrencyExcel(omzet),
      "Aandeel Omzet": formatPercentageExcel(aandeel),
      "Gem. per Offerte": formatCurrencyExcel(s.gemiddeldPerOfferte ?? (omzet / (s.count || 1))),
    };
  });

  // Add totals row
  const scopeTotals = {
    "Scope": "TOTAAL",
    "Aantal Offertes": scopeMarges.reduce((sum, s) => sum + s.count, 0),
    "Totaal Kosten": formatCurrencyExcel(scopeMarges.reduce((sum, s) => sum + s.totaal, 0)),
    "Totaal Marge": formatCurrencyExcel(scopeMarges.reduce((sum, s) => sum + s.marge, 0)),
    "Marge %": formatPercentageExcel(
      scopeMarges.reduce((sum, s) => sum + s.totaal, 0) > 0
        ? (scopeMarges.reduce((sum, s) => sum + s.marge, 0) / scopeMarges.reduce((sum, s) => sum + s.totaal, 0)) * 100
        : 0
    ),
    "Totaal Omzet": formatCurrencyExcel(totalScopeOmzet),
    "Aandeel Omzet": "100%",
    "Gem. per Offerte": "-",
  };

  const wsScope = XLSX.utils.json_to_sheet([...scopeData, scopeTotals]);
  wsScope["!cols"] = [
    { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 14 },
    { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsScope, "Per Scope Analyse");

  // ============================================
  // Sheet 4: Per Klant
  // ============================================
  const klantenData = topKlanten.map((k, index) => ({
    "#": index + 1,
    "Klant": k.klantNaam,
    "Totaal Omzet": formatCurrencyExcel(k.totaalOmzet),
    "Aantal Offertes": k.aantalOffertes,
    "Geaccepteerd": k.aantalGeaccepteerd ?? "-",
    "Gem. Waarde": formatCurrencyExcel(k.gemiddeldeWaarde),
    "Terugkerend": k.isRepeatCustomer ? "Ja" : "Nee",
    "Aandeel": kpis.totaleOmzet > 0 ? formatPercentageExcel((k.totaalOmzet / kpis.totaleOmzet) * 100) : "-",
  }));

  const wsKlanten = XLSX.utils.json_to_sheet(klantenData);
  wsKlanten["!cols"] = [
    { wch: 5 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsKlanten, "Per Klant");

  // ============================================
  // Sheet 5: Maandelijkse Trends
  // ============================================
  if (maandelijkseTrend && maandelijkseTrend.length > 0) {
    const trendData = maandelijkseTrend.map((m) => ({
      "Maand": m.maand,
      "Aanleg": m.aanleg,
      "Onderhoud": m.onderhoud,
      "Totaal Offertes": m.totaal,
      "Omzet": formatCurrencyExcel(m.omzet),
      "Voortschrijdend Gem. (Offertes)": m.movingAvgTotal ?? "-",
      "Voortschrijdend Gem. (Omzet)": m.movingAvgOmzet ? formatCurrencyExcel(m.movingAvgOmzet) : "-",
    }));

    // Calculate monthly averages
    const avgOffertes = maandelijkseTrend.length > 0
      ? maandelijkseTrend.reduce((sum, m) => sum + m.totaal, 0) / maandelijkseTrend.length
      : 0;
    const avgOmzet = maandelijkseTrend.length > 0
      ? maandelijkseTrend.reduce((sum, m) => sum + m.omzet, 0) / maandelijkseTrend.length
      : 0;

    // Add summary row
    const trendSummary = {
      "Maand": "GEMIDDELDE",
      "Aanleg": Math.round(maandelijkseTrend.reduce((sum, m) => sum + m.aanleg, 0) / maandelijkseTrend.length * 10) / 10,
      "Onderhoud": Math.round(maandelijkseTrend.reduce((sum, m) => sum + m.onderhoud, 0) / maandelijkseTrend.length * 10) / 10,
      "Totaal Offertes": Math.round(avgOffertes * 10) / 10,
      "Omzet": formatCurrencyExcel(avgOmzet),
      "Voortschrijdend Gem. (Offertes)": "-",
      "Voortschrijdend Gem. (Omzet)": "-",
    };

    const wsTrend = XLSX.utils.json_to_sheet([...trendData, trendSummary]);
    wsTrend["!cols"] = [
      { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
      { wch: 14 }, { wch: 25 }, { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, wsTrend, "Maandelijkse Trends");
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
      .map(([_, data]) => data);

    if (sortedMonths.length > 0) {
      const trendData = sortedMonths.map((m) => ({
        "Maand": m.maand,
        "Aanleg": m.aanleg,
        "Onderhoud": m.onderhoud,
        "Totaal Offertes": m.totaal,
        "Omzet": formatCurrencyExcel(m.omzet),
      }));

      const wsTrend = XLSX.utils.json_to_sheet(trendData);
      wsTrend["!cols"] = [
        { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 14 },
      ];
      XLSX.utils.book_append_sheet(wb, wsTrend, "Maandelijkse Trends");
    }
  }

  // Generate filename with date
  const dateStr = new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date()).replace(/\//g, "-");

  const fullFilename = `${filename}-${dateStr}.xlsx`;

  // Download file
  XLSX.writeFile(wb, fullFilename);
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
