/**
 * Leerfeedback Analyzer
 *
 * Client-side analysis logic for generating normuur adjustment suggestions.
 * Analyzes multiple nacalculaties to find patterns of consistent under/over-estimation.
 *
 * IMPORTANT: No automatic optimization - only suggestions that require explicit user action.
 */

// Minimum number of projects required for a reliable suggestion
const MIN_PROJECTS_FOR_SUGGESTION = 3;

// Threshold for deviation to trigger a suggestion (percentage)
const DEVIATION_THRESHOLD = 10;

export interface NacalculatieDataPoint {
  projectId: string;
  projectNaam: string;
  afwijkingenPerScope: Record<string, number>; // Hours deviation per scope
  geplandeUrenPerScope: Record<string, number>;
  createdAt?: number;
}

export interface Normuur {
  _id: string;
  activiteit: string;
  scope: string;
  normuurPerEenheid: number;
  eenheid: string;
  omschrijving?: string;
}

export interface ActiviteitSuggestie {
  normuurId: string;
  activiteit: string;
  huidigeWaarde: number;
  gesuggereerdeWaarde: number;
  wijzigingPercentage: number;
  eenheid: string;
}

export interface ScopeSuggestie {
  id: string;
  scope: string;
  activiteiten: ActiviteitSuggestie[];
  gemiddeldeAfwijking: number; // Hours
  gemiddeldeAfwijkingPercentage: number;
  aantalProjecten: number;
  betrouwbaarheid: "laag" | "gemiddeld" | "hoog";
  bronProjecten: string[];
  reden: string;
  type: "onderschatting" | "overschatting";
}

export interface LeerfeedbackAnalyse {
  suggesties: ScopeSuggestie[];
  totaalAnalyseerdeProjecten: number;
  scopesMetVoldoendeData: number;
  scopesZonderSuggestie: string[];
}

/**
 * Get confidence level based on sample size
 */
function getConfidenceLevel(
  sampleSize: number
): "laag" | "gemiddeld" | "hoog" {
  if (sampleSize >= 10) return "hoog";
  if (sampleSize >= 5) return "gemiddeld";
  return "laag";
}

/**
 * Get confidence color class
 */
export function getConfidenceColor(
  level: "laag" | "gemiddeld" | "hoog"
): string {
  switch (level) {
    case "hoog":
      return "text-green-600 dark:text-green-400";
    case "gemiddeld":
      return "text-yellow-600 dark:text-yellow-400";
    case "laag":
      return "text-orange-600 dark:text-orange-400";
  }
}

/**
 * Get confidence badge variant
 */
export function getConfidenceBadgeVariant(
  level: "laag" | "gemiddeld" | "hoog"
): "default" | "secondary" | "outline" {
  switch (level) {
    case "hoog":
      return "default";
    case "gemiddeld":
      return "secondary";
    case "laag":
      return "outline";
  }
}

/**
 * Analyze nacalculatie data and generate normuur suggestions
 */
export function analyzeNacalculaties(
  nacalculaties: NacalculatieDataPoint[],
  normuren: Normuur[]
): LeerfeedbackAnalyse {
  if (nacalculaties.length === 0) {
    return {
      suggesties: [],
      totaalAnalyseerdeProjecten: 0,
      scopesMetVoldoendeData: 0,
      scopesZonderSuggestie: [],
    };
  }

  // Group deviations by scope
  const scopeAnalysis: Record<
    string,
    {
      totalAfwijking: number;
      totalGepland: number;
      count: number;
      projectIds: string[];
    }
  > = {};

  for (const data of nacalculaties) {
    for (const [scope, afwijking] of Object.entries(data.afwijkingenPerScope)) {
      if (!scopeAnalysis[scope]) {
        scopeAnalysis[scope] = {
          totalAfwijking: 0,
          totalGepland: 0,
          count: 0,
          projectIds: [],
        };
      }

      const gepland = data.geplandeUrenPerScope[scope] || 0;
      scopeAnalysis[scope].totalAfwijking += afwijking;
      scopeAnalysis[scope].totalGepland += gepland;
      scopeAnalysis[scope].count++;
      scopeAnalysis[scope].projectIds.push(data.projectId);
    }
  }

  // Generate suggestions
  const suggesties: ScopeSuggestie[] = [];
  const scopesZonderSuggestie: string[] = [];
  let scopesMetVoldoendeData = 0;

  for (const [scope, analysis] of Object.entries(scopeAnalysis)) {
    // Check if we have enough data points
    if (analysis.count < MIN_PROJECTS_FOR_SUGGESTION) {
      scopesZonderSuggestie.push(scope);
      continue;
    }

    scopesMetVoldoendeData++;

    const gemiddeldeAfwijking = analysis.totalAfwijking / analysis.count;
    const gemiddeldeAfwijkingPercentage =
      analysis.totalGepland > 0
        ? (analysis.totalAfwijking / analysis.totalGepland) * 100
        : 0;

    // Only suggest if deviation exceeds threshold
    if (Math.abs(gemiddeldeAfwijkingPercentage) < DEVIATION_THRESHOLD) {
      scopesZonderSuggestie.push(scope);
      continue;
    }

    // Find normuren for this scope
    const scopeNormuren = normuren.filter((n) => n.scope === scope);
    if (scopeNormuren.length === 0) {
      scopesZonderSuggestie.push(scope);
      continue;
    }

    // Calculate suggested adjustment factor
    // If actual > planned (positive deviation), we need to increase normuren
    // If actual < planned (negative deviation), we need to decrease normuren
    const adjustmentFactor = 1 + gemiddeldeAfwijkingPercentage / 100;

    const activiteiten: ActiviteitSuggestie[] = scopeNormuren.map((normuur) => {
      const gesuggereerdeWaarde =
        Math.round(normuur.normuurPerEenheid * adjustmentFactor * 1000) / 1000;
      const wijzigingPercentage =
        Math.round(
          ((gesuggereerdeWaarde - normuur.normuurPerEenheid) /
            normuur.normuurPerEenheid) *
            100 *
            10
        ) / 10;

      return {
        normuurId: normuur._id,
        activiteit: normuur.activiteit,
        huidigeWaarde: normuur.normuurPerEenheid,
        gesuggereerdeWaarde,
        wijzigingPercentage,
        eenheid: normuur.eenheid,
      };
    });

    const type: "onderschatting" | "overschatting" =
      gemiddeldeAfwijkingPercentage > 0 ? "onderschatting" : "overschatting";
    const reden = `Gemiddelde ${type} van ${Math.abs(Math.round(gemiddeldeAfwijkingPercentage))}% over ${analysis.count} projecten`;

    suggesties.push({
      id: `suggestie_${scope}_${Date.now()}`,
      scope,
      activiteiten,
      gemiddeldeAfwijking: Math.round(gemiddeldeAfwijking * 100) / 100,
      gemiddeldeAfwijkingPercentage:
        Math.round(gemiddeldeAfwijkingPercentage * 10) / 10,
      aantalProjecten: analysis.count,
      betrouwbaarheid: getConfidenceLevel(analysis.count),
      bronProjecten: analysis.projectIds,
      reden,
      type,
    });
  }

  // Sort by absolute deviation (most significant first)
  suggesties.sort(
    (a, b) =>
      Math.abs(b.gemiddeldeAfwijkingPercentage) -
      Math.abs(a.gemiddeldeAfwijkingPercentage)
  );

  return {
    suggesties,
    totaalAnalyseerdeProjecten: nacalculaties.length,
    scopesMetVoldoendeData,
    scopesZonderSuggestie,
  };
}

/**
 * Format scope name for display
 */
export function formatScopeName(scope: string): string {
  return scope
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Calculate impact of applying a suggestion
 */
export function calculateSuggestionImpact(
  suggestie: ScopeSuggestie,
  averageProjectHours: number
): {
  estimatedHoursDifference: number;
  estimatedCostDifference: number; // Assuming hourly rate
} {
  // Estimate how many hours would be added/removed per average project
  const avgHoursChange =
    (suggestie.gemiddeldeAfwijkingPercentage / 100) *
    (averageProjectHours / suggestie.aantalProjecten);

  return {
    estimatedHoursDifference: Math.round(avgHoursChange * 10) / 10,
    estimatedCostDifference: 0, // Would need hourly rate to calculate
  };
}

/**
 * Validate suggestion before applying
 */
export function validateSuggestion(
  suggestie: ScopeSuggestie
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (suggestie.betrouwbaarheid === "laag") {
    warnings.push(
      `Lage betrouwbaarheid: gebaseerd op slechts ${suggestie.aantalProjecten} projecten`
    );
  }

  if (Math.abs(suggestie.gemiddeldeAfwijkingPercentage) > 50) {
    warnings.push(
      `Grote aanpassing (${Math.abs(suggestie.gemiddeldeAfwijkingPercentage)}%): controleer of dit realistisch is`
    );
  }

  for (const activiteit of suggestie.activiteiten) {
    if (activiteit.gesuggereerdeWaarde <= 0) {
      warnings.push(
        `Waarschuwing: ${activiteit.activiteit} zou een waarde van 0 of minder krijgen`
      );
    }
    if (Math.abs(activiteit.wijzigingPercentage) > 100) {
      warnings.push(
        `Grote wijziging voor ${activiteit.activiteit}: ${activiteit.wijzigingPercentage}%`
      );
    }
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Get suggestion priority based on impact and confidence
 */
export function getSuggestionPriority(
  suggestie: ScopeSuggestie
): "hoog" | "gemiddeld" | "laag" {
  const absDeviation = Math.abs(suggestie.gemiddeldeAfwijkingPercentage);

  if (suggestie.betrouwbaarheid === "hoog" && absDeviation > 20) {
    return "hoog";
  }
  if (
    suggestie.betrouwbaarheid !== "laag" &&
    absDeviation > DEVIATION_THRESHOLD
  ) {
    return "gemiddeld";
  }
  return "laag";
}

/**
 * Get color for suggestion type
 */
export function getSuggestionTypeColor(
  type: "onderschatting" | "overschatting"
): { text: string; bg: string } {
  if (type === "onderschatting") {
    return {
      text: "text-red-600 dark:text-red-400",
      bg: "bg-red-100 dark:bg-red-900/30",
    };
  }
  return {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-900/30",
  };
}
