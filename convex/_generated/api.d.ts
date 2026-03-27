/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as afvalverwerkers from "../afvalverwerkers.js";
import type * as analytics from "../analytics.js";
import type * as archief from "../archief.js";
import type * as auth from "../auth.js";
import type * as backfillKlantIds from "../backfillKlantIds.js";
import type * as berekeningen from "../berekeningen.js";
import type * as betalingen from "../betalingen.js";
import type * as betalingsherinneringen from "../betalingsherinneringen.js";
import type * as boekhouding from "../boekhouding.js";
import type * as brandstofRegistratie from "../brandstofRegistratie.js";
import type * as chat from "../chat.js";
import type * as chatMigration from "../chatMigration.js";
import type * as chatThreads from "../chatThreads.js";
import type * as configuratorAanvragen from "../configuratorAanvragen.js";
import type * as correctiefactoren from "../correctiefactoren.js";
import type * as crons from "../crons.js";
import type * as directieDashboard from "../directieDashboard.js";
import type * as emailLogs from "../emailLogs.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as export_ from "../export.js";
import type * as facturen from "../facturen.js";
import type * as fotoStorage from "../fotoStorage.js";
import type * as garantiePakketten from "../garantiePakketten.js";
import type * as garanties from "../garanties.js";
import type * as http from "../http.js";
import type * as inkooporders from "../inkooporders.js";
import type * as instellingen from "../instellingen.js";
import type * as kilometerStanden from "../kilometerStanden.js";
import type * as klanten from "../klanten.js";
import type * as kwaliteitsControles from "../kwaliteitsControles.js";
import type * as leadActiviteiten from "../leadActiviteiten.js";
import type * as leerfeedback from "../leerfeedback.js";
import type * as leveranciers from "../leveranciers.js";
import type * as machineGebruik from "../machineGebruik.js";
import type * as machines from "../machines.js";
import type * as materiaalmanDashboard from "../materiaalmanDashboard.js";
import type * as medewerkers from "../medewerkers.js";
import type * as migrations from "../migrations.js";
import type * as migrations_consolidateNotificationLogs from "../migrations/consolidateNotificationLogs.js";
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
import type * as planningTaken from "../planningTaken.js";
import type * as plantsoorten from "../plantsoorten.js";
import type * as portaal from "../portaal.js";
import type * as portaalEmail from "../portaalEmail.js";
import type * as proactiveWarnings from "../proactiveWarnings.js";
import type * as producten from "../producten.js";
import type * as projectKosten from "../projectKosten.js";
import type * as projectRapportages from "../projectRapportages.js";
import type * as projecten from "../projecten.js";
import type * as publicOffertes from "../publicOffertes.js";
import type * as realtime from "../realtime.js";
import type * as roles from "../roles.js";
import type * as security from "../security.js";
import type * as servicemeldingen from "../servicemeldingen.js";
import type * as smartAnalytics from "../smartAnalytics.js";
import type * as softDelete from "../softDelete.js";
import type * as standaardtuinen from "../standaardtuinen.js";
import type * as teams from "../teams.js";
import type * as toolboxMeetings from "../toolboxMeetings.js";
import type * as transportbedrijven from "../transportbedrijven.js";
import type * as urenRegistraties from "../urenRegistraties.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as verlof from "../verlof.js";
import type * as verzuim from "../verzuim.js";
import type * as voertuigOnderhoud from "../voertuigOnderhoud.js";
import type * as voertuigSchades from "../voertuigSchades.js";
import type * as voertuigUitrusting from "../voertuigUitrusting.js";
import type * as voertuigen from "../voertuigen.js";
import type * as voorcalculaties from "../voorcalculaties.js";
import type * as voormanDashboard from "../voormanDashboard.js";
import type * as voorraad from "../voorraad.js";
import type * as weekPlanning from "../weekPlanning.js";
import type * as werklocaties from "../werklocaties.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  afvalverwerkers: typeof afvalverwerkers;
  analytics: typeof analytics;
  archief: typeof archief;
  auth: typeof auth;
  backfillKlantIds: typeof backfillKlantIds;
  berekeningen: typeof berekeningen;
  betalingen: typeof betalingen;
  betalingsherinneringen: typeof betalingsherinneringen;
  boekhouding: typeof boekhouding;
  brandstofRegistratie: typeof brandstofRegistratie;
  chat: typeof chat;
  chatMigration: typeof chatMigration;
  chatThreads: typeof chatThreads;
  configuratorAanvragen: typeof configuratorAanvragen;
  correctiefactoren: typeof correctiefactoren;
  crons: typeof crons;
  directieDashboard: typeof directieDashboard;
  emailLogs: typeof emailLogs;
  emailTemplates: typeof emailTemplates;
  export: typeof export_;
  facturen: typeof facturen;
  fotoStorage: typeof fotoStorage;
  garantiePakketten: typeof garantiePakketten;
  garanties: typeof garanties;
  http: typeof http;
  inkooporders: typeof inkooporders;
  instellingen: typeof instellingen;
  kilometerStanden: typeof kilometerStanden;
  klanten: typeof klanten;
  kwaliteitsControles: typeof kwaliteitsControles;
  leadActiviteiten: typeof leadActiviteiten;
  leerfeedback: typeof leerfeedback;
  leveranciers: typeof leveranciers;
  machineGebruik: typeof machineGebruik;
  machines: typeof machines;
  materiaalmanDashboard: typeof materiaalmanDashboard;
  medewerkers: typeof medewerkers;
  migrations: typeof migrations;
  "migrations/consolidateNotificationLogs": typeof migrations_consolidateNotificationLogs;
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
  planningTaken: typeof planningTaken;
  plantsoorten: typeof plantsoorten;
  portaal: typeof portaal;
  portaalEmail: typeof portaalEmail;
  proactiveWarnings: typeof proactiveWarnings;
  producten: typeof producten;
  projectKosten: typeof projectKosten;
  projectRapportages: typeof projectRapportages;
  projecten: typeof projecten;
  publicOffertes: typeof publicOffertes;
  realtime: typeof realtime;
  roles: typeof roles;
  security: typeof security;
  servicemeldingen: typeof servicemeldingen;
  smartAnalytics: typeof smartAnalytics;
  softDelete: typeof softDelete;
  standaardtuinen: typeof standaardtuinen;
  teams: typeof teams;
  toolboxMeetings: typeof toolboxMeetings;
  transportbedrijven: typeof transportbedrijven;
  urenRegistraties: typeof urenRegistraties;
  users: typeof users;
  validators: typeof validators;
  verlof: typeof verlof;
  verzuim: typeof verzuim;
  voertuigOnderhoud: typeof voertuigOnderhoud;
  voertuigSchades: typeof voertuigSchades;
  voertuigUitrusting: typeof voertuigUitrusting;
  voertuigen: typeof voertuigen;
  voorcalculaties: typeof voorcalculaties;
  voormanDashboard: typeof voormanDashboard;
  voorraad: typeof voorraad;
  weekPlanning: typeof weekPlanning;
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
