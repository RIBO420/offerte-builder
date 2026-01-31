/**
 * Nacalculatie Excel Export
 *
 * Exports nacalculatie data to Excel format.
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

export async function exportNacalculatieToExcel(data: ExportData) {
  // Dynamic import of xlsx
  const XLSX = await import("xlsx");

  const wb = XLSX.utils.book_new();
  const { projectNaam, berekening, voorcalculatie, conclusies } = data;

  // ===== Summary Sheet =====
  const summaryData = [
    { Omschrijving: "Project", Waarde: projectNaam },
    { Omschrijving: "Exportdatum", Waarde: formatDate() },
    { Omschrijving: "", Waarde: "" },
    { Omschrijving: "SAMENVATTING", Waarde: "" },
    { Omschrijving: "", Waarde: "" },
    {
      Omschrijving: "Geplande uren",
      Waarde: berekening.geplandeUren,
    },
    {
      Omschrijving: "Werkelijke uren",
      Waarde: berekening.werkelijkeUren,
    },
    {
      Omschrijving: "Afwijking uren",
      Waarde: berekening.afwijkingUren,
    },
    {
      Omschrijving: "Afwijking percentage",
      Waarde: `${berekening.afwijkingPercentage}%`,
    },
    { Omschrijving: "", Waarde: "" },
    {
      Omschrijving: "Geplande dagen",
      Waarde: berekening.geplandeDagen,
    },
    {
      Omschrijving: "Werkelijke dagen",
      Waarde: berekening.werkelijkeDagen,
    },
    {
      Omschrijving: "Afwijking dagen",
      Waarde: berekening.afwijkingDagen,
    },
    { Omschrijving: "", Waarde: "" },
    {
      Omschrijving: "Geplande machinekosten",
      Waarde: berekening.geplandeMachineKosten,
    },
    {
      Omschrijving: "Werkelijke machinekosten",
      Waarde: berekening.werkelijkeMachineKosten,
    },
    {
      Omschrijving: "Afwijking machinekosten",
      Waarde: berekening.afwijkingMachineKosten,
    },
    { Omschrijving: "", Waarde: "" },
    {
      Omschrijving: "Aantal registraties",
      Waarde: berekening.aantalRegistraties,
    },
    {
      Omschrijving: "Aantal medewerkers",
      Waarde: berekening.aantalMedewerkers,
    },
  ];

  if (voorcalculatie) {
    summaryData.push({ Omschrijving: "", Waarde: "" });
    summaryData.push({
      Omschrijving: "Team grootte",
      Waarde: voorcalculatie.teamGrootte,
    });
    summaryData.push({
      Omschrijving: "Effectieve uren per dag",
      Waarde: voorcalculatie.effectieveUrenPerDag,
    });
  }

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Samenvatting");

  // ===== Scope Details Sheet =====
  const scopeData = berekening.afwijkingenPerScope.map((s) => ({
    Scope: formatScopeName(s.scope),
    "Geplande uren": s.geplandeUren,
    "Werkelijke uren": s.werkelijkeUren,
    "Afwijking (uren)": s.afwijkingUren,
    "Afwijking (%)": `${s.afwijkingPercentage}%`,
    Status:
      s.status === "good"
        ? "Goed"
        : s.status === "warning"
          ? "Aandacht"
          : "Kritiek",
  }));

  const wsScope = XLSX.utils.json_to_sheet(scopeData);
  wsScope["!cols"] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsScope, "Per Scope");

  // ===== Insights Sheet =====
  if (berekening.insights.length > 0) {
    const insightsData = berekening.insights.map((insight) => ({
      Type:
        insight.type === "success"
          ? "Succes"
          : insight.type === "warning"
            ? "Waarschuwing"
            : insight.type === "critical"
              ? "Kritiek"
              : "Info",
      Titel: insight.title,
      Beschrijving: insight.description,
      Scope: insight.scope ? formatScopeName(insight.scope) : "-",
    }));

    const wsInsights = XLSX.utils.json_to_sheet(insightsData);
    wsInsights["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 50 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsInsights, "Inzichten");
  }

  // ===== Conclusions Sheet =====
  if (conclusies) {
    const conclusiesData = [
      { Conclusies: conclusies },
    ];
    const wsConclusies = XLSX.utils.json_to_sheet(conclusiesData);
    wsConclusies["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsConclusies, "Conclusies");
  }

  // Generate filename
  const dateStr = formatDate().replace(/\//g, "-");
  const safeProjectName = projectNaam.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `nacalculatie_${safeProjectName}_${dateStr}.xlsx`;

  // Download file
  XLSX.writeFile(wb, filename);
}
