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
import type * as auth from "../auth.js";
import type * as berekeningen from "../berekeningen.js";
import type * as correctiefactoren from "../correctiefactoren.js";
import type * as emailLogs from "../emailLogs.js";
import type * as facturen from "../facturen.js";
import type * as instellingen from "../instellingen.js";
import type * as klanten from "../klanten.js";
import type * as leerfeedback from "../leerfeedback.js";
import type * as machineGebruik from "../machineGebruik.js";
import type * as machines from "../machines.js";
import type * as migrations from "../migrations.js";
import type * as nacalculaties from "../nacalculaties.js";
import type * as normuren from "../normuren.js";
import type * as offerteMessages from "../offerteMessages.js";
import type * as offerteVersions from "../offerteVersions.js";
import type * as offertes from "../offertes.js";
import type * as planningTaken from "../planningTaken.js";
import type * as producten from "../producten.js";
import type * as projecten from "../projecten.js";
import type * as publicOffertes from "../publicOffertes.js";
import type * as smartAnalytics from "../smartAnalytics.js";
import type * as standaardtuinen from "../standaardtuinen.js";
import type * as urenRegistraties from "../urenRegistraties.js";
import type * as users from "../users.js";
import type * as validators from "../validators.js";
import type * as voorcalculaties from "../voorcalculaties.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  auth: typeof auth;
  berekeningen: typeof berekeningen;
  correctiefactoren: typeof correctiefactoren;
  emailLogs: typeof emailLogs;
  facturen: typeof facturen;
  instellingen: typeof instellingen;
  klanten: typeof klanten;
  leerfeedback: typeof leerfeedback;
  machineGebruik: typeof machineGebruik;
  machines: typeof machines;
  migrations: typeof migrations;
  nacalculaties: typeof nacalculaties;
  normuren: typeof normuren;
  offerteMessages: typeof offerteMessages;
  offerteVersions: typeof offerteVersions;
  offertes: typeof offertes;
  planningTaken: typeof planningTaken;
  producten: typeof producten;
  projecten: typeof projecten;
  publicOffertes: typeof publicOffertes;
  smartAnalytics: typeof smartAnalytics;
  standaardtuinen: typeof standaardtuinen;
  urenRegistraties: typeof urenRegistraties;
  users: typeof users;
  validators: typeof validators;
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
