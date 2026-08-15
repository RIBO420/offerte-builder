/**
 * Voorcalculatie — projectduur en weergave.
 *
 * **Let op: hier wordt niet meer gerekend aan uren.** De normuren van een
 * offerte komen uit één bron: `convex/lib/normuren.ts`. Tot 15 aug 2026 stond
 * hier een tweede scope-engine die op dezelfde offerte een ánder aantal uren
 * gaf dan het werkblad (12,50 vs 11,25 — zie de definitie in dat bestand).
 * Die engine is weg; wat overblijft is de vertaling van uren naar dagen en de
 * weergave.
 */

import {
  geschatteWerkdagen,
  normurenUitRegels,
  type NormuurBronRegel,
  type NormurenUitkomst,
} from "@convex/lib/normuren";
import { formatDagen as formatDagenNl, formatHoursWithUnit } from "@/lib/format/number";

export {
  geschatteWerkdagen,
  normurenUitRegels,
  type NormuurBronRegel,
  type NormurenUitkomst,
};

export interface ProjectDurationResult {
  geschatteDagen: number;
  effectieveUrenPerDag: number;
  teamGrootte: number;
  normUrenTotaal: number;
  teamCapaciteitPerDag: number;
}

/**
 * Calculate project duration based on team configuration
 */
export function calculateProjectDuration(
  normUrenTotaal: number,
  teamGrootte: 2 | 3 | 4,
  effectieveUrenPerDag: number = 7
): ProjectDurationResult {
  const teamCapaciteitPerDag = teamGrootte * effectieveUrenPerDag;
  const geschatteDagen = geschatteWerkdagen(
    normUrenTotaal,
    teamGrootte,
    effectieveUrenPerDag
  );

  return {
    geschatteDagen,
    effectieveUrenPerDag,
    teamGrootte,
    normUrenTotaal,
    teamCapaciteitPerDag,
  };
}

/**
 * Calculate project duration with buffer for weather/unforeseen
 */
export function calculateProjectDurationWithBuffer(
  normUrenTotaal: number,
  teamGrootte: 2 | 3 | 4,
  effectieveUrenPerDag: number = 7,
  bufferPercentage: number = 10
): ProjectDurationResult & { geschatteDagenMetBuffer: number } {
  const result = calculateProjectDuration(
    normUrenTotaal,
    teamGrootte,
    effectieveUrenPerDag
  );

  const geschatteDagenMetBuffer = Math.ceil(
    result.geschatteDagen * (1 + bufferPercentage / 100)
  );

  return {
    ...result,
    geschatteDagenMetBuffer,
  };
}

/**
 * Uren als tekst: "11,25 uur".
 *
 * Was ooit `11:15 uur` — dat leest als een kloktijd (kwart over elf) terwijl
 * het een duur is, en het week af van het werkblad, dat decimaal telt. Hele
 * uren blijven kort ("12 uur"); de rest krijgt twee decimalen met een
 * Nederlandse komma.
 */
export function formatUren(uren: number): string {
  if (Number.isInteger(uren)) return `${uren} uur`;
  return formatHoursWithUnit(uren);
}

/** Dagen als tekst: "1 dag", "3 dagen". */
export const formatDagen = formatDagenNl;

/**
 * Scope labels for display
 */
export const scopeLabels: Record<string, string> = {
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  parkeerplaats: "Parkeerplaats",
  beregening: "Beregening",
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

/**
 * Get scope label
 */
export function getScopeLabel(scope: string): string {
  return scopeLabels[scope] || scope;
}
