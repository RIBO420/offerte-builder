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
  // Debiteurenladder (PRD §3.2, fase 2): één event per ladder-trede
  "betalingsherinnering_1",
  "betalingsherinnering_2",
  "betalingsherinnering_3",
  "betalingsherinnering_4",
  // Klantenportaal (PRD §3.1, fase 2): ontvangstbevestiging portaal-melding
  "melding_ontvangen",
] as const;

export type MailEvent = (typeof MAIL_EVENTS)[number];

export const MAIL_EVENT_LABELS: Record<string, string> = {
  lead_ontvangen: "Lead ontvangen (website)",
  offerte_verzonden: "Offerte verzonden",
  inplanning_bevestigd: "Inplanning bevestigd",
  offerte_opvolging: "Offerte-opvolging",
  inplan_attendering: "Inplan-mail (planningsattendering)",
  betalingsherinnering_1: "Betalingsherinnering (ladder trede 1)",
  betalingsherinnering_2: "Tweede betalingsherinnering (ladder trede 2)",
  betalingsherinnering_3: "Aanmaning (ladder trede 3)",
  betalingsherinnering_4: "Laatste aanmaning (ladder trede 4)",
  melding_ontvangen: "Melding ontvangen (portaal)",
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
