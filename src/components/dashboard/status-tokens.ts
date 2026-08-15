/**
 * Eén statussemantiek voor het hele dashboard: de dot-tokens uit `globals.css`
 * (Loof & Leem) zijn de enige kleurbron — geen eigen hexreeks naast de
 * statusbadges elders in de app.
 */
export const STATUS_STIP: Record<string, string> = {
  concept: "var(--status-concept-dot)",
  voorcalculatie: "var(--status-voorcalculatie-dot)",
  verzonden: "var(--status-verzonden-dot)",
  geaccepteerd: "var(--status-geaccepteerd-dot)",
  afgewezen: "var(--status-afgewezen-dot)",
};

/** Wat er ís gebeurd, niet hoe de status heet: het blok toont een tijdlijn. */
export const STATUS_GEBEURTENIS: Record<string, string> = {
  concept: "Concept aangemaakt",
  voorcalculatie: "Voorcalculatie gemaakt",
  verzonden: "Offerte verzonden",
  geaccepteerd: "Offerte geaccepteerd",
  afgewezen: "Offerte afgewezen",
};

/** De pipeline-fasen, in volgorde. §5.3b: concepten tellen niet mee. */
export const PIPELINE_FASEN = [
  "voorcalculatie",
  "verzonden",
  "geaccepteerd",
  "afgewezen",
] as const;

export const PIPELINE_FASE_LABEL: Record<(typeof PIPELINE_FASEN)[number], string> = {
  voorcalculatie: "Voorcalculatie",
  verzonden: "Verzonden",
  geaccepteerd: "Geaccepteerd",
  afgewezen: "Afgewezen",
};
