/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analytics from "../analytics.js";
import type * as archief from "../archief.js";
import type * as auth from "../auth.js";
import type * as berekeningen from "../berekeningen.js";
import type * as brandstof from "../brandstof.js";
import type * as brandstofRegistratie from "../brandstofRegistratie.js";
import type * as chat from "../chat.js";
import type * as correctiefactoren from "../correctiefactoren.js";
import type * as emailLogs from "../emailLogs.js";
import type * as facturen from "../facturen.js";
import type * as instellingen from "../instellingen.js";
import type * as kilometerStanden from "../kilometerStanden.js";
import type * as klanten from "../klanten.js";
import type * as leerfeedback from "../leerfeedback.js";
import type * as machineGebruik from "../machineGebruik.js";
import type * as machines from "../machines.js";
import type * as medewerkerAnalytics from "../medewerkerAnalytics.js";
import type * as medewerkerRapportages from "../medewerkerRapportages.js";
import type * as medewerkers from "../medewerkers.js";
import type * as migrations from "../migrations.js";
import type * as mobile from "../mobile.js";
import type * as nacalculaties from "../nacalculaties.js";
import type * as normuren from "../normuren.js";
import type * as notifications from "../notifications.js";
import type * as offerteMessages from "../offerteMessages.js";
import type * as offerteVersions from "../offerteVersions.js";
import type * as offertes from "../offertes.js";
import type * as planningTaken from "../planningTaken.js";
import type * as producten from "../producten.js";
import type * as projectRapportages from "../projectRapportages.js";
import type * as projecten from "../projecten.js";
import type * as publicOffertes from "../publicOffertes.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as roles from "../roles.js";
import type * as smartAnalytics from "../smartAnalytics.js";
import type * as softDelete from "../softDelete.js";
import type * as standaardtuinen from "../standaardtuinen.js";
import type * as teams from "../teams.js";
import type * as urenRegistraties from "../urenRegistraties.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as voertuigOnderhoud from "../voertuigOnderhoud.js";
import type * as voertuigSchades from "../voertuigSchades.js";
import type * as voertuigUitrusting from "../voertuigUitrusting.js";
import type * as voertuigen from "../voertuigen.js";
import type * as voorcalculaties from "../voorcalculaties.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  archief: typeof archief;
  auth: typeof auth;
  berekeningen: typeof berekeningen;
  brandstof: typeof brandstof;
  brandstofRegistratie: typeof brandstofRegistratie;
  chat: typeof chat;
  correctiefactoren: typeof correctiefactoren;
  emailLogs: typeof emailLogs;
  facturen: typeof facturen;
  instellingen: typeof instellingen;
  kilometerStanden: typeof kilometerStanden;
  klanten: typeof klanten;
  leerfeedback: typeof leerfeedback;
  machineGebruik: typeof machineGebruik;
  machines: typeof machines;
  medewerkerAnalytics: typeof medewerkerAnalytics;
  medewerkerRapportages: typeof medewerkerRapportages;
  medewerkers: typeof medewerkers;
  migrations: typeof migrations;
  mobile: typeof mobile;
  nacalculaties: typeof nacalculaties;
  normuren: typeof normuren;
  notifications: typeof notifications;
  offerteMessages: typeof offerteMessages;
  offerteVersions: typeof offerteVersions;
  offertes: typeof offertes;
  planningTaken: typeof planningTaken;
  producten: typeof producten;
  projectRapportages: typeof projectRapportages;
  projecten: typeof projecten;
  publicOffertes: typeof publicOffertes;
  pushNotifications: typeof pushNotifications;
  roles: typeof roles;
  smartAnalytics: typeof smartAnalytics;
  softDelete: typeof softDelete;
  standaardtuinen: typeof standaardtuinen;
  teams: typeof teams;
  urenRegistraties: typeof urenRegistraties;
  users: typeof users;
  validators: typeof validators;
  voertuigOnderhoud: typeof voertuigOnderhoud;
  voertuigSchades: typeof voertuigSchades;
  voertuigUitrusting: typeof voertuigUitrusting;
  voertuigen: typeof voertuigen;
  voorcalculaties: typeof voorcalculaties;
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
