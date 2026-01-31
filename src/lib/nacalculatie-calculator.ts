/**
 * Nacalculatie Calculator
 *
 * Client-side calculation logic for post-calculation analysis.
 * Compares voorcalculatie (planned) vs urenRegistraties (actual).
 */

// Deviation threshold percentages for color coding
const DEVIATION_THRESHOLDS = {
  good: 5, // <= 5% = green
  warning: 15, // <= 15% = yellow
  // > 15% = red
} as const;

export interface VoorcalculatieData {
  normUrenTotaal: number;
  geschatteDagen: number;
  normUrenPerScope: Record<string, number>;
  teamGrootte: 2 | 3 | 4;
  effectieveUrenPerDag: number;
}

export interface UrenRegistratie {
  datum: string;
  medewerker: string;
  uren: number;
  scope?: string;
  notities?: string;
}

export interface MachineGebruik {
  datum: string;
  uren: number;
  kosten: number;
}

export interface OfferteRegel {
  scope: string;
  type: "materiaal" | "arbeid" | "machine";
  totaal: number;
}

export interface NacalculatieInput {
  voorcalculatie: VoorcalculatieData;
  urenRegistraties: UrenRegistratie[];
  machineGebruik: MachineGebruik[];
  offerteRegels?: OfferteRegel[];
}

export interface ScopeAfwijking {
  scope: string;
  geplandeUren: number;
  werkelijkeUren: number;
  afwijkingUren: number;
  afwijkingPercentage: number;
  status: "good" | "warning" | "critical";
}

export interface NacalculatieResult {
  // Totals
  geplandeUren: number;
  werkelijkeUren: number;
  geplandeDagen: number;
  werkelijkeDagen: number;
  geplandeMachineKosten: number;
  werkelijkeMachineKosten: number;

  // Deviations
  afwijkingUren: number;
  afwijkingPercentage: number;
  afwijkingDagen: number;
  afwijkingMachineKosten: number;
  afwijkingMachineKostenPercentage: number;

  // Overall status
  status: "good" | "warning" | "critical";

  // Per scope breakdown
  afwijkingenPerScope: ScopeAfwijking[];
  werkelijkeUrenPerScope: Record<string, number>;
  afwijkingenPerScopeMap: Record<string, number>;

  // Insights
  insights: NacalculatieInsight[];

  // Metadata
  aantalRegistraties: number;
  aantalMedewerkers: number;
}

export interface NacalculatieInsight {
  type: "info" | "warning" | "critical" | "success";
  title: string;
  description: string;
  scope?: string;
}

/**
 * Calculate the deviation status based on percentage
 */
export function getDeviationStatus(
  percentage: number
): "good" | "warning" | "critical" {
  const absPercentage = Math.abs(percentage);
  if (absPercentage <= DEVIATION_THRESHOLDS.good) return "good";
  if (absPercentage <= DEVIATION_THRESHOLDS.warning) return "warning";
  return "critical";
}

/**
 * Get color class based on deviation status
 */
export function getDeviationColor(status: "good" | "warning" | "critical"): {
  text: string;
  bg: string;
  border: string;
} {
  switch (status) {
    case "good":
      return {
        text: "text-green-600 dark:text-green-400",
        bg: "bg-green-100 dark:bg-green-900/30",
        border: "border-green-500",
      };
    case "warning":
      return {
        text: "text-yellow-600 dark:text-yellow-400",
        bg: "bg-yellow-100 dark:bg-yellow-900/30",
        border: "border-yellow-500",
      };
    case "critical":
      return {
        text: "text-red-600 dark:text-red-400",
        bg: "bg-red-100 dark:bg-red-900/30",
        border: "border-red-500",
      };
  }
}

/**
 * Calculate nacalculatie from input data
 */
export function calculateNacalculatie(
  input: NacalculatieInput
): NacalculatieResult {
  const { voorcalculatie, urenRegistraties, machineGebruik, offerteRegels } =
    input;

  // Calculate werkelijke uren totaal
  const werkelijkeUren = urenRegistraties.reduce((sum, r) => sum + r.uren, 0);

  // Calculate werkelijke dagen (unique dates)
  const uniqueDates = new Set(urenRegistraties.map((r) => r.datum));
  const werkelijkeDagen = uniqueDates.size;

  // Calculate unique medewerkers
  const uniqueMedewerkers = new Set(urenRegistraties.map((r) => r.medewerker));
  const aantalMedewerkers = uniqueMedewerkers.size;

  // Calculate werkelijke machine kosten
  const werkelijkeMachineKosten = machineGebruik.reduce(
    (sum, m) => sum + m.kosten,
    0
  );

  // Calculate geplande machine kosten from offerte
  const geplandeMachineKosten =
    offerteRegels
      ?.filter((r) => r.type === "machine")
      .reduce((sum, r) => sum + r.totaal, 0) || 0;

  // Calculate werkelijke uren per scope
  const werkelijkeUrenPerScope: Record<string, number> = {};
  for (const registratie of urenRegistraties) {
    if (registratie.scope) {
      werkelijkeUrenPerScope[registratie.scope] =
        (werkelijkeUrenPerScope[registratie.scope] || 0) + registratie.uren;
    }
  }

  // Calculate afwijkingen per scope
  const allScopes = new Set([
    ...Object.keys(voorcalculatie.normUrenPerScope),
    ...Object.keys(werkelijkeUrenPerScope),
  ]);

  const afwijkingenPerScope: ScopeAfwijking[] = [];
  const afwijkingenPerScopeMap: Record<string, number> = {};

  for (const scope of allScopes) {
    const geplandeUren = voorcalculatie.normUrenPerScope[scope] || 0;
    const werkelijkUren = werkelijkeUrenPerScope[scope] || 0;
    const afwijkingUren = werkelijkUren - geplandeUren;
    const afwijkingPercentage =
      geplandeUren > 0
        ? Math.round((afwijkingUren / geplandeUren) * 100 * 10) / 10
        : werkelijkUren > 0
          ? 100
          : 0;

    afwijkingenPerScope.push({
      scope,
      geplandeUren,
      werkelijkeUren: werkelijkUren,
      afwijkingUren: Math.round(afwijkingUren * 100) / 100,
      afwijkingPercentage,
      status: getDeviationStatus(afwijkingPercentage),
    });

    afwijkingenPerScopeMap[scope] = Math.round(afwijkingUren * 100) / 100;
  }

  // Sort by absolute deviation (largest first)
  afwijkingenPerScope.sort(
    (a, b) => Math.abs(b.afwijkingPercentage) - Math.abs(a.afwijkingPercentage)
  );

  // Calculate total deviations
  const afwijkingUren = werkelijkeUren - voorcalculatie.normUrenTotaal;
  const afwijkingPercentage =
    voorcalculatie.normUrenTotaal > 0
      ? Math.round(
          (afwijkingUren / voorcalculatie.normUrenTotaal) * 100 * 10
        ) / 10
      : 0;

  const afwijkingDagen = werkelijkeDagen - voorcalculatie.geschatteDagen;

  const afwijkingMachineKosten =
    werkelijkeMachineKosten - geplandeMachineKosten;
  const afwijkingMachineKostenPercentage =
    geplandeMachineKosten > 0
      ? Math.round(
          (afwijkingMachineKosten / geplandeMachineKosten) * 100 * 10
        ) / 10
      : 0;

  // Generate insights
  const insights = generateInsights({
    afwijkingPercentage,
    afwijkingDagen,
    afwijkingMachineKostenPercentage,
    afwijkingenPerScope,
    werkelijkeDagen,
    geplandeDagen: voorcalculatie.geschatteDagen,
    teamGrootte: voorcalculatie.teamGrootte,
  });

  return {
    // Totals
    geplandeUren: voorcalculatie.normUrenTotaal,
    werkelijkeUren,
    geplandeDagen: voorcalculatie.geschatteDagen,
    werkelijkeDagen,
    geplandeMachineKosten,
    werkelijkeMachineKosten,

    // Deviations
    afwijkingUren: Math.round(afwijkingUren * 100) / 100,
    afwijkingPercentage,
    afwijkingDagen,
    afwijkingMachineKosten: Math.round(afwijkingMachineKosten * 100) / 100,
    afwijkingMachineKostenPercentage,

    // Status
    status: getDeviationStatus(afwijkingPercentage),

    // Per scope
    afwijkingenPerScope,
    werkelijkeUrenPerScope,
    afwijkingenPerScopeMap,

    // Insights
    insights,

    // Metadata
    aantalRegistraties: urenRegistraties.length,
    aantalMedewerkers,
  };
}

/**
 * Generate insights based on nacalculatie results
 */
function generateInsights(data: {
  afwijkingPercentage: number;
  afwijkingDagen: number;
  afwijkingMachineKostenPercentage: number;
  afwijkingenPerScope: ScopeAfwijking[];
  werkelijkeDagen: number;
  geplandeDagen: number;
  teamGrootte: number;
}): NacalculatieInsight[] {
  const insights: NacalculatieInsight[] = [];

  // Overall performance insight
  if (Math.abs(data.afwijkingPercentage) <= 5) {
    insights.push({
      type: "success",
      title: "Uitstekende planning",
      description: `De werkelijke uren wijken slechts ${Math.abs(data.afwijkingPercentage)}% af van de planning.`,
    });
  } else if (data.afwijkingPercentage > 15) {
    insights.push({
      type: "critical",
      title: "Significante overschrijding",
      description: `Er is ${data.afwijkingPercentage}% meer tijd besteed dan gepland. Controleer de normuren voor betrokken scopes.`,
    });
  } else if (data.afwijkingPercentage < -15) {
    insights.push({
      type: "warning",
      title: "Onder budget",
      description: `Er is ${Math.abs(data.afwijkingPercentage)}% minder tijd besteed dan gepland. Controleer of alle werk correct is geregistreerd.`,
    });
  }

  // Machine costs insight
  if (Math.abs(data.afwijkingMachineKostenPercentage) > 20) {
    insights.push({
      type: data.afwijkingMachineKostenPercentage > 0 ? "warning" : "info",
      title:
        data.afwijkingMachineKostenPercentage > 0
          ? "Hogere machinekosten"
          : "Lagere machinekosten",
      description: `De machinekosten wijken ${Math.abs(data.afwijkingMachineKostenPercentage)}% af van de planning.`,
    });
  }

  // Days deviation insight
  if (data.afwijkingDagen > 2) {
    insights.push({
      type: "warning",
      title: "Meer dagen nodig",
      description: `Het project duurde ${data.afwijkingDagen} dagen langer dan gepland.`,
    });
  } else if (data.afwijkingDagen < -2) {
    insights.push({
      type: "success",
      title: "Sneller afgerond",
      description: `Het project is ${Math.abs(data.afwijkingDagen)} dagen eerder afgerond dan gepland.`,
    });
  }

  // Problematic scopes
  const problematicScopes = data.afwijkingenPerScope.filter(
    (s) => s.status === "critical"
  );
  if (problematicScopes.length > 0) {
    const scopeNames = problematicScopes.map((s) => s.scope).join(", ");
    insights.push({
      type: "critical",
      title: "Aandachtspunten per scope",
      description: `De volgende scopes hebben significante afwijkingen: ${scopeNames}. Overweeg normuur aanpassingen.`,
    });
  }

  // Underestimated scopes (positive deviation)
  const underestimated = data.afwijkingenPerScope.filter(
    (s) => s.afwijkingPercentage > DEVIATION_THRESHOLDS.warning
  );
  for (const scope of underestimated.slice(0, 2)) {
    insights.push({
      type: "warning",
      title: `${scope.scope}: Onderschatting`,
      description: `${scope.werkelijkeUren} uur nodig vs ${scope.geplandeUren} uur gepland (+${scope.afwijkingPercentage}%)`,
      scope: scope.scope,
    });
  }

  // Overestimated scopes (negative deviation)
  const overestimated = data.afwijkingenPerScope.filter(
    (s) => s.afwijkingPercentage < -DEVIATION_THRESHOLDS.warning
  );
  for (const scope of overestimated.slice(0, 2)) {
    insights.push({
      type: "info",
      title: `${scope.scope}: Overschatting`,
      description: `${scope.werkelijkeUren} uur nodig vs ${scope.geplandeUren} uur gepland (${scope.afwijkingPercentage}%)`,
      scope: scope.scope,
    });
  }

  return insights;
}

/**
 * Format hours as days and hours for display
 */
export function formatHoursAsDays(
  hours: number,
  hoursPerDay: number = 8
): string {
  const days = Math.floor(hours / hoursPerDay);
  const remainingHours = Math.round((hours % hoursPerDay) * 10) / 10;

  if (days === 0) {
    return `${remainingHours} uur`;
  }
  if (remainingHours === 0) {
    return `${days} ${days === 1 ? "dag" : "dagen"}`;
  }
  return `${days} ${days === 1 ? "dag" : "dagen"}, ${remainingHours} uur`;
}

/**
 * Format deviation percentage for display
 */
export function formatDeviation(percentage: number): string {
  const sign = percentage > 0 ? "+" : "";
  return `${sign}${percentage}%`;
}

/**
 * Get scope display name (capitalize first letter)
 */
export function getScopeDisplayName(scope: string): string {
  // Handle scopes like "water_elektra" -> "Water/Elektra"
  return scope
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("/");
}
