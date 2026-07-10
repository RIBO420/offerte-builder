/**
 * UI-constanten voor transactionele mails (PRD §2.7).
 *
 * Client-side kopie van de domeinconstanten (zelfde patroon als
 * src/lib/tekstblokken.ts): de convex-module importeert server-code en kan
 * niet in client-components geladen worden. Consistentie tussen beide
 * lijsten wordt afgedwongen in de unit-tests.
 */

export const MAIL_EVENTS = [
  "lead_ontvangen",
  "offerte_verzonden",
  "inplanning_bevestigd",
  "offerte_opvolging",
  "inplan_attendering",
] as const;

export type MailEvent = (typeof MAIL_EVENTS)[number];

export const MAIL_EVENT_LABELS: Record<string, string> = {
  lead_ontvangen: "Lead ontvangen (website)",
  offerte_verzonden: "Offerte verzonden",
  inplanning_bevestigd: "Inplanning bevestigd",
  offerte_opvolging: "Offerte-opvolging",
  inplan_attendering: "Inplan-mail (planningsattendering)",
};

export const MAIL_MODUS_LABELS: Record<string, string> = {
  concept: "Concept (kantoor keurt goed)",
  automatisch: "Automatisch (achter mail-guard)",
};

export const CONCEPT_MAIL_STATUS_LABELS: Record<string, string> = {
  gepland: "Gepland",
  wachtrij: "Wachtrij",
  verzonden: "Verzonden",
  verworpen: "Verworpen",
  mislukt: "Mislukt",
  "onderdrukt (sandbox)": "Onderdrukt (sandbox)",
};
