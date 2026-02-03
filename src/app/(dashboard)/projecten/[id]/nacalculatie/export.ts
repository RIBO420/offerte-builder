/**
 * Nacalculatie Excel Export
 *
 * Exports nacalculatie data to Excel format using ExcelJS.
 */

import type { NacalculatieResult } from "@/lib/nacalculatie-calculator";

interface ExportData {
  projectNaam: string;
  berekening: NacalculatieResult;
  voorcalculatie?: {
    normUrenTotaal: number;
    geschatteDagen: number;
    normUrenPerScope: Record<string, number>;
    teamGrootte: number;
    effectieveUrenPerDag: number;
  } | null;
  conclusies?: string;
}

// Format date for Excel
function formatDate(): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
}

// Format scope name
function formatScopeName(scope: string): string {
  return scope
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

export async function exportNacalculatieToExcel(data: ExportData) {
  // Dynamic import of exceljs
  const ExcelJS = await import("exceljs");

  const workbook = new ExcelJS.Workbook();
  const { projectNaam, berekening, voorcalculatie, conclusies } = data;

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

  // ===== Summary Sheet =====
  const wsSummary = workbook.addWorksheet("Samenvatting");
  wsSummary.columns = [
    { header: "Omschrijving", key: "omschrijving", width: 25 },
    { header: "Waarde", key: "waarde", width: 20 },
  ];
  styleHeaderRow(wsSummary);

  const summaryRows = [
    { omschrijving: "Project", waarde: projectNaam },
    { omschrijving: "Exportdatum", waarde: formatDate() },
    { omschrijving: "", waarde: "" },
    { omschrijving: "SAMENVATTING", waarde: "" },
    { omschrijving: "", waarde: "" },
    { omschrijving: "Geplande uren", waarde: berekening.geplandeUren },
    { omschrijving: "Werkelijke uren", waarde: berekening.werkelijkeUren },
    { omschrijving: "Afwijking uren", waarde: berekening.afwijkingUren },
    { omschrijving: "Afwijking percentage", waarde: `${berekening.afwijkingPercentage}%` },
    { omschrijving: "", waarde: "" },
    { omschrijving: "Geplande dagen", waarde: berekening.geplandeDagen },
    { omschrijving: "Werkelijke dagen", waarde: berekening.werkelijkeDagen },
    { omschrijving: "Afwijking dagen", waarde: berekening.afwijkingDagen },
    { omschrijving: "", waarde: "" },
    { omschrijving: "Geplande machinekosten", waarde: berekening.geplandeMachineKosten },
    { omschrijving: "Werkelijke machinekosten", waarde: berekening.werkelijkeMachineKosten },
    { omschrijving: "Afwijking machinekosten", waarde: berekening.afwijkingMachineKosten },
    { omschrijving: "", waarde: "" },
    { omschrijving: "Aantal registraties", waarde: berekening.aantalRegistraties },
    { omschrijving: "Aantal medewerkers", waarde: berekening.aantalMedewerkers },
  ];

  if (voorcalculatie) {
    summaryRows.push({ omschrijving: "", waarde: "" });
    summaryRows.push({ omschrijving: "Team grootte", waarde: voorcalculatie.teamGrootte });
    summaryRows.push({ omschrijving: "Effectieve uren per dag", waarde: voorcalculatie.effectieveUrenPerDag });
  }

  summaryRows.forEach((row) => wsSummary.addRow(row));

  // ===== Scope Details Sheet =====
  const wsScope = workbook.addWorksheet("Per Scope");
  wsScope.columns = [
    { header: "Scope", key: "scope", width: 20 },
    { header: "Geplande uren", key: "geplandeUren", width: 15 },
    { header: "Werkelijke uren", key: "werkelijkeUren", width: 15 },
    { header: "Afwijking (uren)", key: "afwijkingUren", width: 15 },
    { header: "Afwijking (%)", key: "afwijkingPercentage", width: 12 },
    { header: "Status", key: "status", width: 12 },
  ];
  styleHeaderRow(wsScope);

  berekening.afwijkingenPerScope.forEach((s) => {
    wsScope.addRow({
      scope: formatScopeName(s.scope),
      geplandeUren: s.geplandeUren,
      werkelijkeUren: s.werkelijkeUren,
      afwijkingUren: s.afwijkingUren,
      afwijkingPercentage: `${s.afwijkingPercentage}%`,
      status:
        s.status === "good"
          ? "Goed"
          : s.status === "warning"
            ? "Aandacht"
            : "Kritiek",
    });
  });

  // ===== Insights Sheet =====
  if (berekening.insights.length > 0) {
    const wsInsights = workbook.addWorksheet("Inzichten");
    wsInsights.columns = [
      { header: "Type", key: "type", width: 15 },
      { header: "Titel", key: "titel", width: 25 },
      { header: "Beschrijving", key: "beschrijving", width: 50 },
      { header: "Scope", key: "scope", width: 15 },
    ];
    styleHeaderRow(wsInsights);

    berekening.insights.forEach((insight) => {
      wsInsights.addRow({
        type:
          insight.type === "success"
            ? "Succes"
            : insight.type === "warning"
              ? "Waarschuwing"
              : insight.type === "critical"
                ? "Kritiek"
                : "Info",
        titel: insight.title,
        beschrijving: insight.description,
        scope: insight.scope ? formatScopeName(insight.scope) : "-",
      });
    });
  }

  // ===== Conclusions Sheet =====
  if (conclusies) {
    const wsConclusies = workbook.addWorksheet("Conclusies");
    wsConclusies.columns = [
      { header: "Conclusies", key: "conclusies", width: 80 },
    ];
    styleHeaderRow(wsConclusies);
    wsConclusies.addRow({ conclusies: conclusies });
  }

  // Generate filename
  const dateStr = formatDate().replace(/\//g, "-");
  const safeProjectName = projectNaam.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `nacalculatie_${safeProjectName}_${dateStr}.xlsx`;

  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer();
  downloadExcelFile(buffer as ArrayBuffer, filename);
}
