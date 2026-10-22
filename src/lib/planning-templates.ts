import { TAAK_STATUS_CONFIG, type TaakStatus } from "@/lib/constants/statuses";

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
  parkeerplaats: ["Ontgraven en afvoeren", "Fundering aanbrengen en verdichten", "Verharding aanbrengen", "Opsluitbanden en kolken", "Belijning aanbrengen"],
  beregening: ["Sleuven graven", "Leidingwerk leggen", "Zoneventielen plaatsen", "Sproeiers plaatsen en afstellen", "Regelkast programmeren"],
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
  parkeerplaats: "Parkeerplaats",
  beregening: "Beregening",
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
  grondwerk: "bg-scope-grondwerk",
  bestrating: "bg-scope-bestrating",
  parkeerplaats: "bg-scope-bestrating",
  beregening: "bg-scope-water",
  borders: "bg-scope-borders",
  gras: "bg-scope-gras",
  houtwerk: "bg-scope-houtwerk",
  water_elektra: "bg-scope-water",
  specials: "bg-scope-specials",
  gras_onderhoud: "bg-scope-gras",
  borders_onderhoud: "bg-scope-borders",
  heggen_onderhoud: "bg-scope-borders",
  heggen: "bg-scope-borders",
  bomen_onderhoud: "bg-scope-houtwerk",
  bomen: "bg-scope-houtwerk",
  overig_onderhoud: "bg-muted-foreground",
  overig: "bg-muted-foreground",
};

/**
 * Get color class for a scope
 */
export function getScopeColor(scope: string): string {
  return scopeColors[scope] || "bg-muted-foreground";
}

/**
 * Status display configuration.
 * Kleuren uit de centrale statusbron (WS4): zelfde status = zelfde kleur.
 */
export const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = Object.fromEntries(
  Object.entries(TAAK_STATUS_CONFIG).map(([key, config]) => [
    key,
    {
      label: config.label,
      color: config.color.text,
      bgColor: config.color.bg,
    },
  ])
);

export type { TaakStatus };
