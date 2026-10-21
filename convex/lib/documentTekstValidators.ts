/**
 * Convex-validators bij convex/lib/documentTekst.ts. Apart gehouden zodat
 * documentTekst.ts dependency-vrij blijft (ook in de browser te gebruiken).
 * De unit-test document-tekst.test.ts bewaakt dat de lijst gelijk blijft aan
 * DOCUMENT_SOORTEN.
 */

import { v } from "convex/values";

export const DOCUMENT_SOORT_WAARDEN = [
  "offerte_aanleg",
  "offerte_onderhoud",
  "factuur",
  "factuur_onderhoud",
  "termijnfactuur",
  "eindfactuur",
  "creditnota",
] as const;

export const documentSoortValidator = v.union(
  v.literal("offerte_aanleg"),
  v.literal("offerte_onderhoud"),
  v.literal("factuur"),
  v.literal("factuur_onderhoud"),
  v.literal("termijnfactuur"),
  v.literal("eindfactuur"),
  v.literal("creditnota")
);
