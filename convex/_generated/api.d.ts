/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as acceptatieKeten from "../acceptatieKeten.js";
import type * as acceptatieRegels from "../acceptatieRegels.js";
import type * as afronding from "../afronding.js";
import type * as analytics from "../analytics.js";
import type * as archief from "../archief.js";
import type * as auth from "../auth.js";
import type * as backfillKlantIds from "../backfillKlantIds.js";
import type * as berekeningen from "../berekeningen.js";
import type * as betalingen from "../betalingen.js";
import type * as betalingsherinneringen from "../betalingsherinneringen.js";
import type * as beurtNacalculatie from "../beurtNacalculatie.js";
import type * as beurtNacalculatieLogica from "../beurtNacalculatieLogica.js";
import type * as beurtgenerator from "../beurtgenerator.js";
import type * as boekhouding from "../boekhouding.js";
import type * as bouwstenen from "../bouwstenen.js";
import type * as brandstofRegistratie from "../brandstofRegistratie.js";
import type * as caseThread from "../caseThread.js";
import type * as chat from "../chat.js";
import type * as chatMigration from "../chatMigration.js";
import type * as chatThreads from "../chatThreads.js";
import type * as conceptMails from "../conceptMails.js";
import type * as configuratorAanvragen from "../configuratorAanvragen.js";
import type * as correctiefactoren from "../correctiefactoren.js";
import type * as crons from "../crons.js";
import type * as dagkaart from "../dagkaart.js";
import type * as dagkaartLogica from "../dagkaartLogica.js";
import type * as dashboard from "../dashboard.js";
import type * as debiteuren from "../debiteuren.js";
import type * as debiteurenLogica from "../debiteurenLogica.js";
import type * as emailLogs from "../emailLogs.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as export_ from "../export.js";
import type * as facturatieEngine from "../facturatieEngine.js";
import type * as facturatieLogica from "../facturatieLogica.js";
import type * as facturen from "../facturen.js";
import type * as fotoStorage from "../fotoStorage.js";
import type * as garanties from "../garanties.js";
import type * as http from "../http.js";
import type * as inkooporders from "../inkooporders.js";
import type * as instellingen from "../instellingen.js";
import type * as kilometerStanden from "../kilometerStanden.js";
import type * as klanten from "../klanten.js";
import type * as kwaliteitsControles from "../kwaliteitsControles.js";
import type * as leadActiviteiten from "../leadActiviteiten.js";
import type * as leadsKlantenHelpers from "../leadsKlantenHelpers.js";
import type * as leerfeedback from "../leerfeedback.js";
import type * as leveranciers from "../leveranciers.js";
import type * as lib_mailGuard from "../lib/mailGuard.js";
import type * as lib_mailRender from "../lib/mailRender.js";
import type * as lib_pipelineKpis from "../lib/pipelineKpis.js";
import type * as losseBeurten from "../losseBeurten.js";
import type * as machineGebruik from "../machineGebruik.js";
import type * as machinepark from "../machinepark.js";
import type * as machineparkLogica from "../machineparkLogica.js";
import type * as machines from "../machines.js";
import type * as mailTriggers from "../mailTriggers.js";
import type * as materiaalDelta from "../materiaalDelta.js";
import type * as medewerkers from "../medewerkers.js";
import type * as meerwerk from "../meerwerk.js";
import type * as migrations from "../migrations.js";
import type * as migrations_backfillWerkitemType from "../migrations/backfillWerkitemType.js";
import type * as migrations_consolidateNotificationLogs from "../migrations/consolidateNotificationLogs.js";
import type * as migrations_migreerWeekPlanningNaarWerkitems from "../migrations/migreerWeekPlanningNaarWerkitems.js";
import type * as migrations_saneerLeadsKlanten from "../migrations/saneerLeadsKlanten.js";
import type * as migrations_seedBouwstenen from "../migrations/seedBouwstenen.js";
import type * as migrations_seedTekstblokken from "../migrations/seedTekstblokken.js";
import type * as migrations_splitsFactuurStatus from "../migrations/splitsFactuurStatus.js";
import type * as mobile from "../mobile.js";
import type * as nacalculaties from "../nacalculaties.js";
import type * as normuren from "../normuren.js";
import type * as notifications from "../notifications.js";
import type * as offerteMessages from "../offerteMessages.js";
import type * as offerteReminders from "../offerteReminders.js";
import type * as offerteVersions from "../offerteVersions.js";
import type * as offertes from "../offertes.js";
import type * as onderhoudscontracten from "../onderhoudscontracten.js";
import type * as pipelineHelpers from "../pipelineHelpers.js";
import type * as planbord from "../planbord.js";
import type * as planbordLogica from "../planbordLogica.js";
import type * as planningTaken from "../planningTaken.js";
import type * as planningsattendering from "../planningsattendering.js";
import type * as portaal from "../portaal.js";
import type * as portaalEmail from "../portaalEmail.js";
import type * as proactiveWarnings from "../proactiveWarnings.js";
import type * as producten from "../producten.js";
import type * as productenImport from "../productenImport.js";
import type * as projectKosten from "../projectKosten.js";
import type * as projectRapportages from "../projectRapportages.js";
import type * as projecten from "../projecten.js";
import type * as reistijdLogica from "../reistijdLogica.js";
import type * as roles from "../roles.js";
import type * as security from "../security.js";
import type * as servicemeldingen from "../servicemeldingen.js";
import type * as smartAnalytics from "../smartAnalytics.js";
import type * as softDelete from "../softDelete.js";
import type * as standaardtuinen from "../standaardtuinen.js";
import type * as teams from "../teams.js";
import type * as tekstblokken from "../tekstblokken.js";
import type * as tijdlijn from "../tijdlijn.js";
import type * as tijdlijnMigratie from "../tijdlijnMigratie.js";
import type * as toolboxMeetings from "../toolboxMeetings.js";
import type * as urenRegistraties from "../urenRegistraties.js";
import type * as urenSegmenten from "../urenSegmenten.js";
import type * as users from "../users.js";
import type * as uurtarieven from "../uurtarieven.js";
import type * as validators from "../validators.js";
import type * as veldLogica from "../veldLogica.js";
import type * as verlof from "../verlof.js";
import type * as vervalItems from "../vervalItems.js";
import type * as vervalLogica from "../vervalLogica.js";
import type * as verzuim from "../verzuim.js";
import type * as voertuigOnderhoud from "../voertuigOnderhoud.js";
import type * as voertuigSchades from "../voertuigSchades.js";
import type * as voertuigUitrusting from "../voertuigUitrusting.js";
import type * as voertuigen from "../voertuigen.js";
import type * as voorcalculaties from "../voorcalculaties.js";
import type * as voormanDashboard from "../voormanDashboard.js";
import type * as voorraad from "../voorraad.js";
import type * as vrijeOfferte from "../vrijeOfferte.js";
import type * as vrijeOfferteBerekening from "../vrijeOfferteBerekening.js";
import type * as weekPlanning from "../weekPlanning.js";
import type * as werkitems from "../werkitems.js";
import type * as werklocaties from "../werklocaties.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  acceptatieKeten: typeof acceptatieKeten;
  acceptatieRegels: typeof acceptatieRegels;
  afronding: typeof afronding;
  analytics: typeof analytics;
  archief: typeof archief;
  auth: typeof auth;
  backfillKlantIds: typeof backfillKlantIds;
  berekeningen: typeof berekeningen;
  betalingen: typeof betalingen;
  betalingsherinneringen: typeof betalingsherinneringen;
  beurtNacalculatie: typeof beurtNacalculatie;
  beurtNacalculatieLogica: typeof beurtNacalculatieLogica;
  beurtgenerator: typeof beurtgenerator;
  boekhouding: typeof boekhouding;
  bouwstenen: typeof bouwstenen;
  brandstofRegistratie: typeof brandstofRegistratie;
  caseThread: typeof caseThread;
  chat: typeof chat;
  chatMigration: typeof chatMigration;
  chatThreads: typeof chatThreads;
  conceptMails: typeof conceptMails;
  configuratorAanvragen: typeof configuratorAanvragen;
  correctiefactoren: typeof correctiefactoren;
  crons: typeof crons;
  dagkaart: typeof dagkaart;
  dagkaartLogica: typeof dagkaartLogica;
  dashboard: typeof dashboard;
  debiteuren: typeof debiteuren;
  debiteurenLogica: typeof debiteurenLogica;
  emailLogs: typeof emailLogs;
  emailTemplates: typeof emailTemplates;
  export: typeof export_;
  facturatieEngine: typeof facturatieEngine;
  facturatieLogica: typeof facturatieLogica;
  facturen: typeof facturen;
  fotoStorage: typeof fotoStorage;
  garanties: typeof garanties;
  http: typeof http;
  inkooporders: typeof inkooporders;
  instellingen: typeof instellingen;
  kilometerStanden: typeof kilometerStanden;
  klanten: typeof klanten;
  kwaliteitsControles: typeof kwaliteitsControles;
  leadActiviteiten: typeof leadActiviteiten;
  leadsKlantenHelpers: typeof leadsKlantenHelpers;
  leerfeedback: typeof leerfeedback;
  leveranciers: typeof leveranciers;
  "lib/mailGuard": typeof lib_mailGuard;
  "lib/mailRender": typeof lib_mailRender;
  "lib/pipelineKpis": typeof lib_pipelineKpis;
  losseBeurten: typeof losseBeurten;
  machineGebruik: typeof machineGebruik;
  machinepark: typeof machinepark;
  machineparkLogica: typeof machineparkLogica;
  machines: typeof machines;
  mailTriggers: typeof mailTriggers;
  materiaalDelta: typeof materiaalDelta;
  medewerkers: typeof medewerkers;
  meerwerk: typeof meerwerk;
  migrations: typeof migrations;
  "migrations/backfillWerkitemType": typeof migrations_backfillWerkitemType;
  "migrations/consolidateNotificationLogs": typeof migrations_consolidateNotificationLogs;
  "migrations/migreerWeekPlanningNaarWerkitems": typeof migrations_migreerWeekPlanningNaarWerkitems;
  "migrations/saneerLeadsKlanten": typeof migrations_saneerLeadsKlanten;
  "migrations/seedBouwstenen": typeof migrations_seedBouwstenen;
  "migrations/seedTekstblokken": typeof migrations_seedTekstblokken;
  "migrations/splitsFactuurStatus": typeof migrations_splitsFactuurStatus;
  mobile: typeof mobile;
  nacalculaties: typeof nacalculaties;
  normuren: typeof normuren;
  notifications: typeof notifications;
  offerteMessages: typeof offerteMessages;
  offerteReminders: typeof offerteReminders;
  offerteVersions: typeof offerteVersions;
  offertes: typeof offertes;
  onderhoudscontracten: typeof onderhoudscontracten;
  pipelineHelpers: typeof pipelineHelpers;
  planbord: typeof planbord;
  planbordLogica: typeof planbordLogica;
  planningTaken: typeof planningTaken;
  planningsattendering: typeof planningsattendering;
  portaal: typeof portaal;
  portaalEmail: typeof portaalEmail;
  proactiveWarnings: typeof proactiveWarnings;
  producten: typeof producten;
  productenImport: typeof productenImport;
  projectKosten: typeof projectKosten;
  projectRapportages: typeof projectRapportages;
  projecten: typeof projecten;
  reistijdLogica: typeof reistijdLogica;
  roles: typeof roles;
  security: typeof security;
  servicemeldingen: typeof servicemeldingen;
  smartAnalytics: typeof smartAnalytics;
  softDelete: typeof softDelete;
  standaardtuinen: typeof standaardtuinen;
  teams: typeof teams;
  tekstblokken: typeof tekstblokken;
  tijdlijn: typeof tijdlijn;
  tijdlijnMigratie: typeof tijdlijnMigratie;
  toolboxMeetings: typeof toolboxMeetings;
  urenRegistraties: typeof urenRegistraties;
  urenSegmenten: typeof urenSegmenten;
  users: typeof users;
  uurtarieven: typeof uurtarieven;
  validators: typeof validators;
  veldLogica: typeof veldLogica;
  verlof: typeof verlof;
  vervalItems: typeof vervalItems;
  vervalLogica: typeof vervalLogica;
  verzuim: typeof verzuim;
  voertuigOnderhoud: typeof voertuigOnderhoud;
  voertuigSchades: typeof voertuigSchades;
  voertuigUitrusting: typeof voertuigUitrusting;
  voertuigen: typeof voertuigen;
  voorcalculaties: typeof voorcalculaties;
  voormanDashboard: typeof voormanDashboard;
  voorraad: typeof voorraad;
  vrijeOfferte: typeof vrijeOfferte;
  vrijeOfferteBerekening: typeof vrijeOfferteBerekening;
  weekPlanning: typeof weekPlanning;
  werkitems: typeof werkitems;
  werklocaties: typeof werklocaties;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
