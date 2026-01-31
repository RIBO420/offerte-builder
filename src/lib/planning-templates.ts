/**
 * Planning Task Templates per Scope
 *
 * These templates define the standard tasks generated for each scope
 * when creating a project planning from a voorcalculatie.
 */

export const takenTemplates: Record<string, string[]> = {
  // Aanleg scopes
  grondwerk: ["Ontgraven", "Grond afvoeren", "Onderbouw voorbereiden"],
  bestrating: ["Fundering leggen", "Bestraten", "Aftrillen/afwerken"],
  borders: ["Grond voorbereiden", "Beplanting plaatsen", "Afwerking aanbrengen"],
  gras: ["Ondergrond voorbereiden", "Gras zaaien/leggen", "Afwerken"],
  houtwerk: ["Fundering maken", "Houtwerk monteren", "Afwerking"],
  water_elektra: ["Sleuven graven", "Bekabeling leggen", "Armaturen plaatsen"],
  specials: ["Voorbereiding", "Installatie", "Afwerking"],

  // Onderhoud scopes
  gras_onderhoud: ["Maaien", "Kanten steken", "Afvoeren"],
  borders_onderhoud: ["Onkruid verwijderen", "Snoeien", "Afvoeren"],
  heggen_onderhoud: ["Snoeien", "Afvoeren snoeisel"],
  bomen_onderhoud: ["Snoeien", "Afvoeren"],
  overig_onderhoud: ["Diverse werkzaamheden"],
};

/**
 * Scope display names for Dutch UI
 */
export const scopeDisplayNames: Record<string, string> = {
  // Aanleg scopes
  grondwerk: "Grondwerk",
  bestrating: "Bestrating",
  borders: "Borders",
  gras: "Gras",
  houtwerk: "Houtwerk",
  water_elektra: "Water & Elektra",
  specials: "Specials",

  // Onderhoud scopes
  gras_onderhoud: "Gras Onderhoud",
  borders_onderhoud: "Borders Onderhoud",
  heggen_onderhoud: "Heggen Onderhoud",
  heggen: "Heggen",
  bomen_onderhoud: "Bomen Onderhoud",
  bomen: "Bomen",
  overig_onderhoud: "Overig Onderhoud",
  overig: "Overig",
};

/**
 * Get display name for a scope
 */
export function getScopeDisplayName(scope: string): string {
  return scopeDisplayNames[scope] || scope.charAt(0).toUpperCase() + scope.slice(1).replace(/_/g, " ");
}

/**
 * Get tasks for a scope
 */
export function getTasksForScope(scope: string): string[] {
  return takenTemplates[scope] || ["Werkzaamheden uitvoeren"];
}

/**
 * Scope colors for visual distinction
 */
export const scopeColors: Record<string, string> = {
  grondwerk: "bg-amber-500",
  bestrating: "bg-slate-500",
  borders: "bg-green-500",
  gras: "bg-emerald-500",
  houtwerk: "bg-orange-600",
  water_elektra: "bg-blue-500",
  specials: "bg-purple-500",
  gras_onderhoud: "bg-emerald-400",
  borders_onderhoud: "bg-green-400",
  heggen_onderhoud: "bg-lime-500",
  heggen: "bg-lime-500",
  bomen_onderhoud: "bg-teal-500",
  bomen: "bg-teal-500",
  overig_onderhoud: "bg-gray-500",
  overig: "bg-gray-500",
};

/**
 * Get color class for a scope
 */
export function getScopeColor(scope: string): string {
  return scopeColors[scope] || "bg-gray-400";
}

/**
 * Status display configuration
 */
export const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  gepland: {
    label: "Gepland",
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  gestart: {
    label: "Gestart",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900",
  },
  afgerond: {
    label: "Afgerond",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-900",
  },
};

export type TaakStatus = "gepland" | "gestart" | "afgerond";
