/**
 * Eén bron van waarheid voor de organisatie-migratie.
 *
 * Twee vragen worden hier beantwoord:
 *   (a) welke tabellen zijn org-gescoped (alles behalve `systeem` en
 *       `persoonlijk`), en
 *   (b) wat bewaart de opruimfunctie en de productie-migratie, en wat wist die.
 *
 * `satisfies Record<TableNames, Classificatie>` maakt de map compile-time
 * exhaustief: een nieuwe tabel in convex/schema.ts breekt `npm run typecheck`
 * tot iemand hier een keuze maakt. Dat is opzet — een vergeten tabel betekent
 * bij de migratie stilzwijgend data die blijft staan of juist verdwijnt.
 */

import type { TableNames } from "../_generated/dataModel";

export type Classificatie =
  | "bewaren" // blijft staan bij opruimen én prod-migratie
  | "wissen" // transactiedata: weg bij opruimen én prod-migratie
  | "persoonlijk" // per-user (userId blijft!), niet org-gescoped
  | "systeem"; // convex-intern / geen classificatie nodig

export const TABEL_CLASSIFICATIE = {
  // ── systeem ────────────────────────────────────────────────────────────────
  users: "systeem",
  organisaties: "systeem",

  // ── bewaren: CRM ───────────────────────────────────────────────────────────
  klanten: "bewaren",
  leveranciers: "bewaren",
  configuratorAanvragen: "bewaren",
  leadActiviteiten: "bewaren",

  // ── bewaren: configuratie ──────────────────────────────────────────────────
  instellingen: "bewaren",
  producten: "bewaren",
  normuren: "bewaren",
  correctiefactoren: "bewaren",
  standaardtuinen: "bewaren",
  plantsoorten: "bewaren",
  uurtarieven: "bewaren",
  bouwstenen: "bewaren",
  tekstblokken: "bewaren",
  mailTriggers: "bewaren",
  emailTemplates: "bewaren",
  garantiePakketten: "bewaren",
  boekhoudInstellingen: "bewaren",

  // ── bewaren: stamdata ──────────────────────────────────────────────────────
  medewerkers: "bewaren",
  teams: "bewaren",
  machines: "bewaren",
  voertuigen: "bewaren",
  voertuigUitrusting: "bewaren",
  vervalItems: "bewaren",
  afvalverwerkers: "bewaren",
  transportbedrijven: "bewaren",

  // ── persoonlijk ────────────────────────────────────────────────────────────
  notification_preferences: "persoonlijk",
  pushTokens: "persoonlijk",

  // ── wissen: offertes & mail ────────────────────────────────────────────────
  offertes: "wissen",
  offerte_versions: "wissen",
  offerte_messages: "wissen",
  offerte_reminders: "wissen",
  conceptMails: "wissen",
  email_logs: "wissen",
  leerfeedback_historie: "wissen",

  // ── wissen: financieel ─────────────────────────────────────────────────────
  facturen: "wissen",
  betalingen: "wissen",
  betalingsherinneringen: "wissen",
  contractFacturen: "wissen",
  boekhoudSync: "wissen",

  // ── wissen: projecten & planning ───────────────────────────────────────────
  projecten: "wissen",
  planningTaken: "wissen",
  weekPlanning: "wissen",
  teamBemanning: "wissen",
  afwezigheidsblokken: "wissen",
  planbordLogboek: "wissen",
  reistijdCache: "wissen",
  dagkaartAfwijkingen: "wissen",
  teamBusOverrides: "wissen",
  middelReserveringen: "wissen",
  werklocaties: "wissen",
  jobSiteGeofences: "wissen",

  // ── wissen: uren & calculatie ──────────────────────────────────────────────
  urenSegmenten: "wissen",
  urenDagen: "wissen",
  urenLogboek: "wissen",
  urenRegistraties: "wissen",
  voorcalculaties: "wissen",
  nacalculaties: "wissen",
  materiaalChecks: "wissen",
  meerwerk: "wissen",

  // ── wissen: wagenpark & machines ───────────────────────────────────────────
  machineGebruik: "wissen",
  voertuigOnderhoud: "wissen",
  kilometerStanden: "wissen",
  brandstofRegistratie: "wissen",
  voertuigSchades: "wissen",

  // ── wissen: inkoop & voorraad ──────────────────────────────────────────────
  inkooporders: "wissen",
  voorraad: "wissen",
  voorraadMutaties: "wissen",
  projectKosten: "wissen",
  kwaliteitsControles: "wissen",

  // ── wissen: personeel ──────────────────────────────────────────────────────
  verlofaanvragen: "wissen",
  verzuimregistraties: "wissen",
  toolboxMeetings: "wissen",

  // ── wissen: onderhoud, garantie & service ──────────────────────────────────
  onderhoudscontracten: "wissen",
  contractWerkzaamheden: "wissen",
  garanties: "wissen",
  servicemeldingen: "wissen",
  meldingComments: "wissen",
  veldtaken: "wissen",
  serviceAfspraken: "wissen",

  // ── wissen: klantdossier ───────────────────────────────────────────────────
  klantTijdlijn: "wissen",
  klantTaken: "wissen",
  taakReacties: "wissen",
  dagLogboek: "wissen",
  klantBestanden: "wissen",

  // ── wissen: chat ───────────────────────────────────────────────────────────
  team_messages: "wissen",
  direct_messages: "wissen",
  chat_threads: "wissen",
  chat_messages: "wissen",
  chat_attachments: "wissen",

  // ── wissen: locatie ────────────────────────────────────────────────────────
  locationSessions: "wissen",
  locationData: "wissen",
  geofenceEvents: "wissen",
  routes: "wissen",
  locationAnalytics: "wissen",
  locationAuditLog: "wissen",

  // ── wissen: notificaties & seed ────────────────────────────────────────────
  notifications: "wissen",
  notificationDeliveryLog: "wissen",
  pushNotificationLogs: "wissen",
  notification_log: "wissen",
  demoSeed: "wissen",
} as const satisfies Record<TableNames, Classificatie>;

// Kindtabellen zonder eigen orgId: opruimen/migreren loopt via de ouder.
export const KIND_VAN: Partial<
  Record<TableNames, { ouder: TableNames; veld: string; index: string }>
> = {
  offerte_messages: { ouder: "offertes", veld: "offerteId", index: "by_offerte" },
  planningTaken: { ouder: "projecten", veld: "projectId", index: "by_project" },
  weekPlanning: { ouder: "projecten", veld: "projectId", index: "by_project" },
  machineGebruik: { ouder: "projecten", veld: "projectId", index: "by_project" },
  nacalculaties: { ouder: "projecten", veld: "projectId", index: "by_project" },
  geofenceEvents: {
    ouder: "locationSessions",
    veld: "sessionId",
    index: "by_session",
  },
  contractWerkzaamheden: {
    ouder: "onderhoudscontracten",
    veld: "contractId",
    index: "by_contract",
  },
  chat_messages: { ouder: "chat_threads", veld: "threadId", index: "by_thread" },
  leadActiviteiten: {
    ouder: "configuratorAanvragen",
    veld: "leadId",
    index: "by_lead",
  },
};
