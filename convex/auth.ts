/**
 * Authentication Helpers for Convex
 *
 * Provides secure user authentication using Clerk identity.
 * All mutations/queries that need user context should use these helpers
 * instead of accepting userId from client arguments.
 */

import { ConvexError } from "convex/values";
import type { UserIdentity } from "convex/server";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { normalizeRole } from "./roles";

/**
 * Autorisatiefout die de gebruiker daadwerkelijk te zien krijgt.
 *
 * **Erft van `ConvexError`, niet van `Error`.** Convex levert alleen de inhoud
 * van een ConvexError aan de client; een gewone Error wordt onderweg vervangen
 * door een kale "Server Error" zonder tekst. Deze klasse erfde van Error, en
 * daardoor kreeg de gebruiker bij élke van de 19 throw-plekken (verlopen
 * sessie, mutatie die vuurt vóór het Clerk-token binnen is, een rol zonder
 * schrijfrechten) alleen:
 *
 *     [CONVEX M(projecten:create)] [Request ID: …] Server Error
 *
 * terwijl in het serverlog netjes "Je moet ingelogd zijn…" stond. Onvindbaar
 * voor wie de logs niet leest, en de client kon er ook niet op reageren.
 *
 * `instanceof AuthError` en `error.message` blijven werken: ConvexError erft
 * zelf van Error.
 */
export class AuthError extends ConvexError<string> {
  constructor(message: string = "Niet geautoriseerd") {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Get the authenticated user from Clerk identity.
 * Returns null if not authenticated.
 */
export async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  // Look up user by Clerk subject (their unique ID)
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return user;
}

/**
 * Get the authenticated user, throwing an error if not authenticated.
 * Use this in protected mutations/queries.
 */
export async function requireAuth(ctx: QueryCtx | MutationCtx) {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    throw new AuthError("Je moet ingelogd zijn om deze actie uit te voeren");
  }
  return user;
}

/**
 * Get the authenticated user's ID, throwing if not authenticated.
 *
 * GEEN tenant-resolver: sinds de org-migratie scopet alle bedrijfsdata op
 * `orgId`. Alleen persoonlijke paden (het eigen notificatiepostvak) gebruiken
 * dit nog.
 */
export async function requireAuthUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const user = await requireAuth(ctx);
  return user._id;
}

/**
 * De uitkomst van de org-resolutie, *zonder* te gooien.
 *
 * De vier faalgevallen zijn echt vier verschillende problemen (geen sessie,
 * geen actieve org in Clerk, een claim dat naar niets wijst, een uitgezette
 * org) en de UI moet ze uit elkaar kunnen houden om de juiste zin te tonen.
 * `requireOrg` c.s. vertalen dit naar een AuthError; `orgToegang` geeft het
 * onvertaald door aan wie er zélf op wil beslissen — de OrgGate en het
 * bootstrap-hulpje `users.initializeDefaults`.
 */
export type OrgToegang =
  | { status: "geen-sessie" }
  | { status: "geen-organisatie" }
  | { status: "onbekende-organisatie"; clerkOrgId: string }
  | { status: "inactieve-organisatie"; org: Doc<"organisaties"> }
  | { status: "ok"; org: Doc<"organisaties"> };

/**
 * Zoekt de organisatie die bij het org_id-claim van deze identity hoort en
 * geeft terug wát er aan de hand is. Gooit nooit.
 */
async function toegangVanIdentity(
  ctx: QueryCtx | MutationCtx,
  identity: UserIdentity
): Promise<OrgToegang> {
  // Convex hangt custom claims ongewijzigd aan de identity: `UserIdentity`
  // heeft een index-signature `[key: string]: JSONValue | undefined`, en alleen
  // de OIDC-standaardvelden worden hernoemd (given_name → givenName). Het claim
  // heet hier dus letterlijk `org_id`. De typeof-check is geen formaliteit: een
  // niet-string claim mag niet als string de index-query in glippen.
  const claim = identity.org_id;
  const clerkOrgId = typeof claim === "string" ? claim : undefined;
  if (!clerkOrgId) {
    // Ook de lege string komt hier terecht: Clerk vult `{{org.id}}` niet als de
    // gebruiker geen actieve organisatie heeft.
    return { status: "geen-organisatie" };
  }

  const org = await ctx.db
    .query("organisaties")
    .withIndex("by_clerk_org_id", (q) => q.eq("clerkOrgId", clerkOrgId))
    .unique();

  if (!org) return { status: "onbekende-organisatie", clerkOrgId };
  if (!org.actief) return { status: "inactieve-organisatie", org };
  return { status: "ok", org };
}

/**
 * De org-resolutie als *uitslag* in plaats van als fout.
 *
 * Gebruik dit alleen waar een fout géén nette uitkomst is: de OrgGate moet op
 * "onbekende organisatie" naar het geen-toegang-scherm sturen in plaats van de
 * hele dashboard-tree tientallen queries te laten gooien. Voor gewone
 * tenant-data blijft `requireOrg`/`requireOrgId` de norm — die weigert, en dat
 * hoort ook.
 */
export async function orgToegang(
  ctx: QueryCtx | MutationCtx
): Promise<OrgToegang> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return { status: "geen-sessie" };
  return toegangVanIdentity(ctx, identity);
}

/**
 * Zoekt de organisatie die bij het org_id-claim van deze identity hoort.
 * Losse functie zodat `requireOrg` en `requireOrgContext` dezelfde controles
 * doen zonder de identity-call te herhalen.
 */
async function organisatieVanIdentity(
  ctx: QueryCtx | MutationCtx,
  identity: UserIdentity
) {
  const toegang = await toegangVanIdentity(ctx, identity);

  switch (toegang.status) {
    case "ok":
      return toegang.org;

    case "geen-organisatie":
      throw new AuthError(
        "Je account is nog niet aan een organisatie gekoppeld. Vraag je beheerder om een uitnodiging."
      );

    // Twee verschillende problemen, dus twee meldingen. Een geldig JWT dat naar
    // een onbekende organisatie wijst is een systeemfout: de org is nooit
    // geprovisioneerd (of is verwijderd terwijl de sessie liep). Dat hoort in
    // het serverlog, want de gebruiker kan er niets aan doen en support moet
    // het zien.
    case "onbekende-organisatie":
      console.warn(
        `[auth] JWT verwijst naar onbekende organisatie "${toegang.clerkOrgId}" (subject: ${identity.subject}) — niet geprovisioneerd?`
      );
      throw new AuthError(
        "Organisatie niet gevonden. Neem contact op met je beheerder."
      );

    // Een bestaande maar uitgezette organisatie is juist een bewuste
    // beheerdersactie — geen logregel waard.
    case "inactieve-organisatie":
      throw new AuthError(
        "Deze organisatie is niet actief. Neem contact op met je beheerder."
      );

    case "geen-sessie":
      throw new AuthError("Je moet ingelogd zijn om deze actie uit te voeren");
  }
}

/**
 * De actieve organisatie uit het Clerk-JWT (org_id-claim, gezet door het
 * JWT-template "convex"). DE standaard-resolver voor alle tenant-data.
 */
export async function requireOrg(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new AuthError("Je moet ingelogd zijn om deze actie uit te voeren");
  }
  return organisatieVanIdentity(ctx, identity);
}

/**
 * De organisatie én de users-rij van de ingelogde gebruiker, in één
 * identity-call.
 *
 * Gebruik dit waar naast de tenant ook de gebruiker zelf nodig is (een `door`-
 * of `auteur`-veld, een rolcheck): `requireOrg` + `requireAuth` naast elkaar
 * zou de identity- en users-lookup dubbel doen. Heb je alleen de tenant nodig,
 * gebruik dan `requireOrgId` — die raakt de users-tabel niet.
 */
export async function requireOrgContext(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new AuthError("Je moet ingelogd zijn om deze actie uit te voeren");
  }

  const org = await organisatieVanIdentity(ctx, identity);

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) {
    // Zelfde melding als requireAuth: een Clerk-account zonder users-rij is
    // vanuit de app gezien niet ingelogd.
    throw new AuthError("Je moet ingelogd zijn om deze actie uit te voeren");
  }

  return { org, user };
}

/**
 * Het id van de actieve organisatie — de org-variant van requireAuthUserId.
 */
export async function requireOrgId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"organisaties">> {
  return (await requireOrg(ctx))._id;
}

/**
 * DE eigendomscheck: een document hoort bij de organisatie uit het JWT.
 *
 * Blijft tolerant getypeerd (`orgId?`) voor de systeemdefault-tabellen, waar
 * een ontbrekende `orgId` "systeembreed" betekent — zo'n rij hoort bij geen
 * enkele organisatie en wordt hier dus geweigerd.
 */
export async function verifyOrgOwnership<
  T extends { orgId?: Id<"organisaties"> },
>(
  ctx: QueryCtx | MutationCtx,
  document: T | null,
  resourceName: string = "resource"
): Promise<T> {
  if (!document) {
    throw new AuthError(`${resourceName} niet gevonden`);
  }

  const orgId = await requireOrgId(ctx);
  if (!document.orgId || document.orgId.toString() !== orgId.toString()) {
    throw new AuthError(`Je hebt geen toegang tot deze ${resourceName}`);
  }

  return document;
}

/**
 * Get an offerte and verify org-ownership.
 * Sinds de org-migratie (fase 3): eigendom = zelfde organisatie, niet dezelfde
 * user — een medewerker mag de offerte van een collega zien.
 */
export async function getOwnedOfferte(
  ctx: QueryCtx | MutationCtx,
  offerteId: Id<"offertes">
) {
  const offerte = await ctx.db.get(offerteId);
  return verifyOrgOwnership(ctx, offerte, "offerte");
}

/**
 * Get a klant and verify org-ownership (zie getOwnedOfferte).
 */
export async function getOwnedKlant(
  ctx: QueryCtx | MutationCtx,
  klantId: Id<"klanten">
) {
  const klant = await ctx.db.get(klantId);
  return verifyOrgOwnership(ctx, klant, "klant");
}

/**
 * Require the authenticated user to be a klant with a linked klant profile.
 * Returns both the user and klant records.
 * Use this in portal queries/mutations that are klant-only.
 */
export async function requireKlant(ctx: QueryCtx | MutationCtx) {
  const user = await requireAuth(ctx);
  const role = normalizeRole(user.role);
  if (role !== "klant") {
    throw new AuthError("Deze functie is alleen beschikbaar voor klanten");
  }
  if (!user.linkedKlantId) {
    throw new AuthError("Uw account is niet gekoppeld aan een klantprofiel");
  }
  const klant = await ctx.db.get(user.linkedKlantId);
  if (!klant) {
    throw new AuthError("Klantprofiel niet gevonden");
  }
  return { user, klant };
}

/**
 * Generate a cryptographically secure token.
 * Uses Web Crypto API available in Convex runtime.
 */
export function generateSecureToken(length: number = 32): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);

  let token = "";
  for (let i = 0; i < length; i++) {
    token += chars[array[i] % chars.length];
  }
  return token;
}

/**
 * Verify that a share token is valid and not expired.
 */
export function isShareTokenValid(
  offerte: { shareToken?: string; shareExpiresAt?: number } | null,
  providedToken: string
): boolean {
  if (!offerte) return false;
  if (!offerte.shareToken || offerte.shareToken !== providedToken) return false;
  if (offerte.shareExpiresAt && offerte.shareExpiresAt < Date.now()) return false;
  return true;
}
