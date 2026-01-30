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
import type * as berekeningen from "../berekeningen.js";
import type * as correctiefactoren from "../correctiefactoren.js";
import type * as emailLogs from "../emailLogs.js";
import type * as instellingen from "../instellingen.js";
import type * as klanten from "../klanten.js";
import type * as normuren from "../normuren.js";
import type * as offerteVersions from "../offerteVersions.js";
import type * as offertes from "../offertes.js";
import type * as producten from "../producten.js";
import type * as standaardtuinen from "../standaardtuinen.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  berekeningen: typeof berekeningen;
  correctiefactoren: typeof correctiefactoren;
  emailLogs: typeof emailLogs;
  instellingen: typeof instellingen;
  klanten: typeof klanten;
  normuren: typeof normuren;
  offerteVersions: typeof offerteVersions;
  offertes: typeof offertes;
  producten: typeof producten;
  standaardtuinen: typeof standaardtuinen;
  users: typeof users;
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
