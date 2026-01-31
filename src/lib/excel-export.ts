// XLSX is imported dynamically to reduce initial bundle size (~400KB)
// This module is only loaded when user clicks export

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

// Format date for Excel
function formatDate(timestamp: number | null): string {
  if (!timestamp) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(timestamp));
}

// Format currency for Excel (without symbol for proper number sorting)
function formatCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
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
    "Materiaalkosten": formatCurrency(row.materiaalkosten),
    "Arbeidskosten": formatCurrency(row.arbeidskosten),
    "Totaal Uren": row.totaalUren,
    "Subtotaal": formatCurrency(row.subtotaal),
    "Marge": formatCurrency(row.marge),
    "Marge %": row.margePercentage,
    "Totaal ex. BTW": formatCurrency(row.totaalExBtw),
    "BTW": formatCurrency(row.btw),
    "Totaal incl. BTW": formatCurrency(row.totaalInclBtw),
    "Aangemaakt": formatDate(row.aangemaakt),
    "Bijgewerkt": formatDate(row.bijgewerkt),
    "Verzonden": formatDate(row.verzonden),
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

// Export KPI summary
interface KpiData {
  winRate: number;
  gemiddeldeWaarde: number;
  totaleOmzet: number;
  totaalOffertes: number;
}

interface TopKlant {
  klantNaam: string;
  totaalOmzet: number;
  aantalOffertes: number;
  gemiddeldeWaarde: number;
}

interface ScopeMarge {
  scope: string;
  totaal: number;
  marge: number;
  margePercentage: number;
  count: number;
}

export async function exportAnalyticsReport(
  kpis: KpiData,
  topKlanten: TopKlant[],
  scopeMarges: ScopeMarge[],
  offertes: ExportRow[],
  filename: string = "rapportage"
) {
  // Dynamic import of xlsx
  const XLSX = await import("xlsx");

  const wb = XLSX.utils.book_new();

  // KPI Summary sheet
  const kpiData = [
    { "KPI": "Win Rate", "Waarde": `${kpis.winRate}%` },
    { "KPI": "Gemiddelde Offerte Waarde", "Waarde": formatCurrency(kpis.gemiddeldeWaarde) },
    { "KPI": "Totale Omzet", "Waarde": formatCurrency(kpis.totaleOmzet) },
    { "KPI": "Aantal Offertes", "Waarde": kpis.totaalOffertes },
  ];
  const wsKpi = XLSX.utils.json_to_sheet(kpiData);
  wsKpi["!cols"] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsKpi, "KPIs");

  // Top Klanten sheet
  const klantenData = topKlanten.map((k) => ({
    "Klant": k.klantNaam,
    "Totaal Omzet": formatCurrency(k.totaalOmzet),
    "Aantal Offertes": k.aantalOffertes,
    "Gem. Waarde": formatCurrency(k.gemiddeldeWaarde),
  }));
  const wsKlanten = XLSX.utils.json_to_sheet(klantenData);
  wsKlanten["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsKlanten, "Top Klanten");

  // Scope Marges sheet
  const scopeData = scopeMarges.map((s) => ({
    "Scope": s.scope,
    "Totaal": formatCurrency(s.totaal),
    "Marge": formatCurrency(s.marge),
    "Marge %": `${s.margePercentage}%`,
    "Aantal": s.count,
  }));
  const wsScope = XLSX.utils.json_to_sheet(scopeData);
  wsScope["!cols"] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsScope, "Marges per Scope");

  // Full offertes data
  const offerteData = offertes.map((row) => ({
    "Offerte Nr.": row.offerteNummer,
    "Type": typeLabels[row.type] ?? row.type,
    "Status": statusLabels[row.status] ?? row.status,
    "Klant": row.klantNaam,
    "Totaal incl. BTW": formatCurrency(row.totaalInclBtw),
    "Marge %": row.margePercentage,
    "Aangemaakt": formatDate(row.aangemaakt),
  }));
  const wsOffertes = XLSX.utils.json_to_sheet(offerteData);
  wsOffertes["!cols"] = [
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsOffertes, "Alle Offertes");

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
