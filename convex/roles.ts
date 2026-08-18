/**
 * Role & Permission System for Convex
 *
 * 7-role model for Top Tuinen:
 * - directie:          Full access to everything (replaces old "admin")
 * - projectleider:     Manage projects, offertes, klanten, planning, read rapportages
 * - voorman:           Manage field work: uren, planning read, project read, toolbox manage
 * - medewerker:        Own uren, own verlof, chat, read assigned projects
 * - klant:             Read own offertes, own facturen, own projects (future portal)
 * - onderaannemer_zzp: Own uren, read assigned projects, own facturen
 * - materiaalman:      Manage voorraad, wagenpark, read inkoop
 *
 * Backward compatibility:
 * - "admin" in the database is treated as "directie"
 * - "viewer" in the database is treated as "klant"
 *
 * Exported helpers (backward-compatible API surface):
 * - requireAdmin(ctx)             — throws if not directie (or legacy admin)
 * - requireNotViewer(ctx)         — throws if klant/viewer (read-only)
 * - requireMedewerkerOrAdmin(ctx) — throws if klant/viewer
 * - getUserRole(ctx)              — returns normalized UserRole
 * - isAdmin(ctx)                  — true if directie (or legacy admin)
 * - isMedewerker(ctx)             — true if medewerker
 * - isViewer(ctx)                 — true if klant (or legacy viewer)
 * - hasPermission(role, action, resource) — permission matrix check
 * - hasRole(role, roles[])        — check if role is in list
 * - getLinkedMedewerker(ctx)      — returns linked medewerker doc
 * - requireLinkedMedewerker(ctx)  — throws if no linked medewerker
 */

import { v, ConvexError } from "convex/values";
import { QueryCtx, MutationCtx, mutation, query } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { AuthError, requireAuth, requireOrgId } from "./auth";
import { userRoleValidator } from "./validators";

// ============================================
// TYPE DEFINITIONS
// ============================================

/** All valid roles (new 7-role model) */
export type UserRole =
  | "directie"
  | "projectleider"
  | "voorman"
  | "medewerker"
  | "klant"
  | "onderaannemer_zzp"
  | "materiaalman";


/** Permission actions */
export type Action = "create" | "read" | "update" | "delete" | "manage";

/** Resources (modules) in the application */
export type Resource =
  | "offertes"
  | "projecten"
  | "klanten"
  | "facturen"
  | "contracten"
  | "planning"
  | "uren"
  | "medewerkers"
  | "wagenpark"
  | "voorraad"
  | "rapportages"
  | "instellingen"
  | "chat"
  | "verlof"
  | "verzuim"
  | "toolbox"
  | "inkoop"
  | "gebruikers";

// ============================================
// ROLE NORMALIZATION (Legacy compatibility)
// ============================================

/**
 * Normalize a database role string to the new 7-role model.
 * - "admin" -> "directie"
 * - "viewer" -> "klant"
 * - undefined/null -> "medewerker" (safe default)
 */
export function normalizeRole(role: string | undefined | null): UserRole {
  if (!role) return "medewerker";
  if (role === "admin") return "directie";
  if (role === "viewer") return "klant";
  return role as UserRole;
}

// ============================================
// PERMISSIONS MATRIX
// ============================================

const ALL_ACTIONS: Action[] = ["create", "read", "update", "delete", "manage"];

/**
 * Permissions matrix: what each role can do per resource.
 *
 * "manage" implies all CRUD actions on that resource.
 * Individual actions can be listed for finer control.
 */
const PERMISSIONS: Record<UserRole, Partial<Record<Resource, Action[]>>> = {
  directie: {
    offertes: ALL_ACTIONS,
    projecten: ALL_ACTIONS,
    klanten: ALL_ACTIONS,
    facturen: ALL_ACTIONS,
    contracten: ALL_ACTIONS,
    planning: ALL_ACTIONS,
    uren: ALL_ACTIONS,
    medewerkers: ALL_ACTIONS,
    wagenpark: ALL_ACTIONS,
    voorraad: ALL_ACTIONS,
    rapportages: ALL_ACTIONS,
    instellingen: ALL_ACTIONS,
    chat: ALL_ACTIONS,
    verlof: ALL_ACTIONS,
    verzuim: ALL_ACTIONS,
    toolbox: ALL_ACTIONS,
    inkoop: ALL_ACTIONS,
    gebruikers: ALL_ACTIONS,
  },

  projectleider: {
    offertes: ["create", "read", "update"],
    projecten: ["create", "read", "update", "manage"],
    klanten: ["create", "read", "update"],
    facturen: ["create", "read", "update"],
    contracten: ["create", "read", "update", "manage"],
    planning: ["create", "read", "update", "manage"],
    uren: ["read", "update", "manage"],
    medewerkers: ["read"],
    wagenpark: ["read"],
    voorraad: ["read"],
    rapportages: ["read"],
    instellingen: ["read"],
    chat: ["create", "read"],
    verlof: ["read", "update", "manage"],
    verzuim: ["read", "update", "manage"],
    toolbox: ["create", "read", "update"],
    inkoop: ["create", "read", "update"],
    gebruikers: ["read"],
  },

  voorman: {
    offertes: ["read"],
    projecten: ["read", "update"],
    klanten: ["read"],
    facturen: ["read"],
    contracten: ["read"],
    planning: ["read"],
    uren: ["create", "read", "update", "manage"],
    medewerkers: ["read"],
    wagenpark: ["read"],
    voorraad: ["read"],
    rapportages: [],
    instellingen: [],
    chat: ["create", "read"],
    verlof: ["create", "read"],
    verzuim: ["read"],
    toolbox: ["create", "read", "update", "manage"],
    inkoop: ["read"],
    gebruikers: [],
  },

  medewerker: {
    offertes: ["read"],
    projecten: ["read"],
    klanten: [],
    facturen: [],
    contracten: [],
    planning: ["read"],
    uren: ["create", "read", "update"],
    medewerkers: [],
    wagenpark: [],
    voorraad: [],
    rapportages: [],
    instellingen: [],
    chat: ["create", "read"],
    verlof: ["create", "read"],
    verzuim: [],
    toolbox: ["read"],
    inkoop: [],
    gebruikers: [],
  },

  klant: {
    offertes: ["read"],
    projecten: ["read"],
    klanten: [],
    facturen: ["read"],
    contracten: [],
    planning: [],
    uren: [],
    medewerkers: [],
    wagenpark: [],
    voorraad: [],
    rapportages: [],
    instellingen: [],
    chat: ["create", "read"],
    verlof: [],
    verzuim: [],
    toolbox: [],
    inkoop: [],
    gebruikers: [],
  },

  onderaannemer_zzp: {
    offertes: ["read"],
    projecten: ["read"],
    klanten: [],
    facturen: ["read"],
    contracten: [],
    planning: ["read"],
    uren: ["create", "read", "update"],
    medewerkers: [],
    wagenpark: [],
    voorraad: [],
    rapportages: [],
    instellingen: [],
    chat: ["create", "read"],
    verlof: [],
    verzuim: [],
    toolbox: ["read"],
    inkoop: [],
    gebruikers: [],
  },

  materiaalman: {
    offertes: ["read"],
    projecten: ["read"],
    klanten: ["read"],
    facturen: ["read"],
    contracten: [],
    planning: ["read"],
    uren: ["create", "read", "update"],
    medewerkers: [],
    wagenpark: ["create", "read", "update", "manage"],
    voorraad: ["create", "read", "update", "delete", "manage"],
    rapportages: ["read"],
    instellingen: [],
    chat: ["create", "read"],
    verlof: ["create", "read"],
    verzuim: [],
    toolbox: ["read"],
    inkoop: ["create", "read", "update"],
    gebruikers: [],
  },
};

// ============================================
// CANONIEK ROLLENMODEL (PRD §1.2, fase 0)
// ============================================
//
// De PRD definieert vier canonieke rollen. Het bestaande 7-rollenmodel
// blijft het opslagformaat (bestaand schema wint); dit is de bindende mapping:
//
//   kantoor    = directie, projectleider     (Yannick, Mickey, Romeo, Elke)
//   voorman    = voorman
//   medewerker = medewerker, onderaannemer_zzp, materiaalman
//   klant      = klant
//
// Legacy: "admin" → directie → kantoor; "viewer" → klant.
//
// Bindende regels (PRD §1.2):
// - Alleen `kantoor` heeft de capability *versturen naar klant*
//   (mail, portaalbericht, offerte-/factuurverzending, portaaluitnodiging).
//   Voor andere rollen bestaat de verstuurknop niet in de UI en weigert de API.
// - `klant` ziet uitsluitend het eigen dossier (scoping op linkedKlantId).

/** De vier canonieke rollen uit PRD §1.2. */
export type CanonicaleRol = "kantoor" | "voorman" | "medewerker" | "klant";

/** Bindende mapping van het 7-rollenmodel naar het canonieke 4-rollenmodel. */
export const CANONIEKE_ROL_MAPPING: Record<UserRole, CanonicaleRol> = {
  directie: "kantoor",
  projectleider: "kantoor",
  voorman: "voorman",
  medewerker: "medewerker",
  onderaannemer_zzp: "medewerker",
  materiaalman: "medewerker",
  klant: "klant",
};

/** Map een (legacy) database-rol naar de canonieke PRD-rol. */
export function toCanonicaleRol(
  role: string | undefined | null
): CanonicaleRol {
  return CANONIEKE_ROL_MAPPING[normalizeRole(role)];
}

/** True als de rol tot `kantoor` behoort (directie of projectleider). */
export function isKantoorRol(role: string | undefined | null): boolean {
  return toCanonicaleRol(role) === "kantoor";
}

/**
 * Capability-check (PRD §1.2): alleen `kantoor` mag naar de klant versturen.
 * Pure functie — testbaar zonder ctx.
 */
export function kanNaarKlantVersturen(
  role: string | undefined | null
): boolean {
  return isKantoorRol(role);
}

/**
 * Vereis dat de ingelogde gebruiker een kantoor-rol heeft
 * (directie of projectleider). Gooit AuthError voor alle andere rollen.
 */
export async function requireKantoor(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (!isKantoorRol(user.role)) {
    throw new AuthError(
      "Alleen kantoor (directie of projectleider) mag deze actie uitvoeren"
    );
  }
  return user;
}

/**
 * Capability: *versturen naar klant* (PRD §1.2).
 * Server-side afdwinging op ELK verstuurpad richting klant: e-mail,
 * portaalbericht, offerte-/factuurverzending en portaaluitnodiging.
 * Gooit AuthError voor voorman/medewerker/klant.
 */
export async function assertKanNaarKlantVersturen(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (!kanNaarKlantVersturen(user.role)) {
    throw new AuthError(
      "Alleen kantoor mag berichten of documenten naar de klant versturen"
    );
  }
  return user;
}

/**
 * Klant-toegang tot een chat-thread (RLS-equivalent, PRD §1.2):
 * uitsluitend threads van het type "klant" die aan de eigen klant-id hangen.
 * Interne threads (team/project/dm) zijn voor de klant-rol per definitie
 * onzichtbaar — ook als er per ongeluk een klantId op staat.
 * Pure functie — testbaar zonder ctx.
 */
export function klantHeeftToegangTotThread(
  linkedKlantId: string | { toString(): string } | undefined | null,
  thread:
    | { type: string; klantId?: { toString(): string } | string | null }
    | null
    | undefined
): boolean {
  if (!thread || !linkedKlantId) return false;
  if (thread.type !== "klant") return false;
  if (!thread.klantId) return false;
  return thread.klantId.toString() === linkedKlantId.toString();
}

// ============================================
// PERMISSION HELPERS
// ============================================

/**
 * Check if a role has a specific permission on a resource.
 * Accepts both new and legacy role strings (normalizes automatically).
 *
 * "manage" in the matrix grants all actions.
 * Checking for "manage" explicitly only matches if "manage" is in the list.
 */
export function hasPermission(
  role: string | undefined | null,
  action: Action,
  resource: Resource
): boolean {
  const normalized = normalizeRole(role);
  const actions = PERMISSIONS[normalized]?.[resource];
  if (!actions || actions.length === 0) return false;
  if (actions.includes("manage")) return true;
  return actions.includes(action);
}

/**
 * Check if a role (normalized) is in a list of allowed roles.
 * Accepts legacy role strings — normalizes before comparison.
 */
export function hasRole(
  role: string | undefined | null,
  allowedRoles: UserRole[]
): boolean {
  const normalized = normalizeRole(role);
  return allowedRoles.includes(normalized);
}

/**
 * Returns true if the role is considered an "admin" level role.
 * This means directie (or legacy "admin").
 */
export function isAdminRole(role: string | undefined | null): boolean {
  return hasRole(role, ["directie"]);
}

/**
 * Returns true if the role is read-only (klant or legacy viewer).
 */
export function isReadOnlyRole(role: string | undefined | null): boolean {
  return hasRole(role, ["klant"]);
}

/**
 * Returns true if the role can perform write operations (not read-only).
 */
export function isWriteRole(role: string | undefined | null): boolean {
  return !isReadOnlyRole(role);
}

// ============================================
// CONTEXT-BASED ROLE HELPERS (async, hit DB)
// ============================================

/**
 * Get the normalized role of the authenticated user.
 * Returns "medewerker" for users without a role (least privilege).
 */
export async function getUserRole(
  ctx: QueryCtx | MutationCtx
): Promise<UserRole> {
  const user = await requireAuth(ctx);
  return normalizeRole(user.role);
}

/**
 * Check if the authenticated user has directie (admin) role.
 */
export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const role = await getUserRole(ctx);
  return role === "directie";
}

/**
 * Check if the authenticated user has medewerker role.
 */
export async function isMedewerker(
  ctx: QueryCtx | MutationCtx
): Promise<boolean> {
  const role = await getUserRole(ctx);
  return role === "medewerker";
}

/**
 * Check if the authenticated user has klant (viewer) role.
 */
export async function isViewer(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const role = await getUserRole(ctx);
  return role === "klant";
}

/**
 * Check if the authenticated user has a specific permission.
 */
export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  action: Action,
  resource: Resource
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  const role = normalizeRole(user.role);

  if (!hasPermission(role, action, resource)) {
    throw new AuthError(
      `Je hebt geen ${action}-rechten voor ${resource}`
    );
  }

  return user;
}

/**
 * Require the authenticated user is NOT a read-only role (klant/viewer).
 * Throws AuthError if role is klant or legacy viewer.
 * Use this in mutations accessible to all write roles but not read-only users.
 */
export async function requireNotViewer(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  const role = normalizeRole(user.role);

  if (isReadOnlyRole(role)) {
    throw new AuthError(
      "Viewers hebben geen schrijfrechten voor deze actie"
    );
  }

  return user;
}

/**
 * Require the authenticated user to be directie (admin).
 * Throws AuthError if not directie (or legacy admin).
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  const role = normalizeRole(user.role);

  if (role !== "directie") {
    throw new AuthError("Je hebt geen admin rechten voor deze actie");
  }

  return user;
}

/**
 * Require the authenticated user to have directie or projectleider role.
 * Throws AuthError if neither.
 */
export async function requireDirectieOrProjectleider(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  const role = normalizeRole(user.role);

  if (!hasRole(role, ["directie", "projectleider"])) {
    throw new AuthError(
      "Je hebt geen directie- of projectleiderrechten voor deze actie"
    );
  }

  return user;
}

/**
 * Require the authenticated user to be a medewerker-level or higher (not klant).
 * Throws AuthError if klant/viewer.
 *
 * This is equivalent to requireNotViewer but with a clearer name.
 */
export async function requireMedewerkerOrAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  const role = normalizeRole(user.role);

  if (isReadOnlyRole(role)) {
    throw new AuthError(
      "Je hebt geen medewerker of admin rechten voor deze actie"
    );
  }

  return user;
}

/**
 * Get the linked medewerker for the authenticated user.
 * Returns null if user is not linked to a medewerker.
 */
export async function getLinkedMedewerker(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"medewerkers"> | null> {
  const user = await requireAuth(ctx);

  if (!user.linkedMedewerkerId) {
    return null;
  }

  return await ctx.db.get(user.linkedMedewerkerId);
}

/**
 * Get the linked klant for the authenticated user.
 * Returns null if user is not linked to a klant.
 */
export async function getLinkedKlant(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"klanten"> | null> {
  const user = await requireAuth(ctx);

  if (!user.linkedKlantId) {
    return null;
  }

  return await ctx.db.get(user.linkedKlantId);
}

/**
 * Get the linked medewerker or throw if not linked.
 * Use this in medewerker-only functions that require a linked medewerker.
 */
export async function requireLinkedMedewerker(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"medewerkers">> {
  const medewerker = await getLinkedMedewerker(ctx);

  if (!medewerker) {
    throw new AuthError("Je account is niet gekoppeld aan een medewerker");
  }

  return medewerker;
}

/**
 * Vereis dat een `users`-record binnen de eigen organisatie valt, en geef het
 * terug. DE tenantgrens voor alle user-management-mutaties: rol wijzigen,
 * koppelen, ontkoppelen, verwijderen.
 *
 * De users-tabel heeft zelf geen `orgId` (een account kan in meerdere Clerk-
 * organisaties zitten). We leiden de tenant af uit de koppeling die er wél is:
 *
 *   linkedMedewerkerId -> medewerker.orgId
 *   linkedKlantId      -> klant.orgId
 *
 * Wijst die koppeling naar een ándere organisatie, dan weigeren we: directie
 * van bedrijf A mag de rol van een medewerker van bedrijf B niet degraderen,
 * diens `clerkUserId` niet wissen en diens account niet verwijderen.
 *
 * Een account ZONDER koppeling hoort bij niemand en mag wél. Dat is bewust
 * ruimer dan het leesfilter in `users.listUsersWithDetails`, dat ongekoppelde
 * klantaccounts juist verbergt. Reden voor het verschil: het leesfilter houdt
 * portaalaccounts uit een teamscherm, terwijl deze guard voorkomt dat je aan
 * andermans account zit. Zou hij ongekoppelde accounts óók weigeren, dan is
 * een account direct ná het ontkoppelen (dat de rol op "klant" zet en de
 * koppeling wist) niet meer opnieuw te koppelen — onbereikbaar voor iedereen.
 */
export async function vereisUserBinnenOrg(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<Doc<"users">> {
  const doelUser = await ctx.db.get(userId);
  if (!doelUser) {
    throw new ConvexError("Gebruiker niet gevonden");
  }

  const gekoppeldeOrgId = doelUser.linkedMedewerkerId
    ? (await ctx.db.get(doelUser.linkedMedewerkerId))?.orgId
    : doelUser.linkedKlantId
      ? (await ctx.db.get(doelUser.linkedKlantId))?.orgId
      : undefined;

  if (gekoppeldeOrgId) {
    const orgId = await requireOrgId(ctx);
    if (gekoppeldeOrgId !== orgId) {
      throw new ConvexError("Deze gebruiker hoort bij een andere organisatie");
    }
  }

  return doelUser;
}

// ============================================
// MUTATIONS - Role Assignment (Directie Only)
// ============================================

/**
 * Assign a role to a user (directie only).
 */
export const assignRole = mutation({
  args: {
    userId: v.id("users"),
    role: userRoleValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await vereisUserBinnenOrg(ctx, args.userId);

    // Normalize legacy role values before saving
    const roleToSave = normalizeRole(args.role);

    await ctx.db.patch(args.userId, {
      role: roleToSave,
    });

    return { success: true, userId: args.userId, role: roleToSave };
  },
});

/**
 * Link a user to a medewerker (directie only).
 * This is typically used when a medewerker creates an account in the app.
 */
export const linkMedewerker = mutation({
  args: {
    userId: v.id("users"),
    medewerkerId: v.id("medewerkers"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const targetUser = await vereisUserBinnenOrg(ctx, args.userId);

    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker) {
      throw new ConvexError("Medewerker niet gevonden");
    }
    // Tenantgrens: een beheerder mag alleen medewerkers van de eigen
    // organisatie koppelen — anders krijgt een vreemd account via
    // `linkedMedewerkerId` toegang tot het personeelsbestand van die tenant.
    const orgId = await requireOrgId(ctx);
    if (medewerker.orgId !== orgId) {
      throw new ConvexError("Geen toegang tot deze medewerker");
    }

    await ctx.db.patch(args.userId, {
      linkedMedewerkerId: args.medewerkerId,
      role: "medewerker",
    });

    await ctx.db.patch(args.medewerkerId, {
      clerkUserId: targetUser.clerkId,
      status: "active",
    });

    return {
      success: true,
      userId: args.userId,
      medewerkerId: args.medewerkerId,
    };
  },
});

/**
 * Unlink a user from a medewerker (directie only).
 */
export const unlinkMedewerker = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const targetUser = await vereisUserBinnenOrg(ctx, args.userId);

    if (targetUser.linkedMedewerkerId) {
      const medewerker = await ctx.db.get(targetUser.linkedMedewerkerId);
      if (medewerker) {
        await ctx.db.patch(medewerker._id, {
          clerkUserId: undefined,
          status: "inactive",
        });
      }
    }

    await ctx.db.patch(args.userId, {
      linkedMedewerkerId: undefined,
      role: "klant",
    });

    return { success: true, userId: args.userId };
  },
});

// ============================================
// QUERIES - User & Role Listing
// ============================================
//
// `listUsersWithRoles` en `listUsersByRole` stonden hier tot cluster 3.9: twee
// deployment-brede dumps van de hele users-tabel, zonder org-scope en zonder
// aanroepers. `users.listUsersWithDetails` doet hetzelfde werk wél
// org-gescoped en is wat het Team-scherm gebruikt; de dumps zijn daarom weg in
// plaats van gemarkeerd.

/**
 * Get current user's role information.
 * This is a public query that any authenticated user can call.
 */
export const getCurrentUserRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const role = normalizeRole(user.role);

    let linkedMedewerker = null;
    if (user.linkedMedewerkerId) {
      linkedMedewerker = await ctx.db.get(user.linkedMedewerkerId);
    }

    return {
      userId: user._id,
      role,
      isAdmin: role === "directie",
      isProjectleider: role === "projectleider",
      isVoorman: role === "voorman",
      isMedewerker: role === "medewerker",
      isKlant: role === "klant",
      isOnderaannemerZzp: role === "onderaannemer_zzp",
      isMateriaalman: role === "materiaalman",
      // Legacy compat booleans
      isViewer: role === "klant",
      linkedMedewerkerId: user.linkedMedewerkerId,
      linkedMedewerkerNaam: linkedMedewerker?.naam ?? null,
    };
  },
});

/**
 * Get available medewerkers that are not yet linked to a user (directie only).
 */
export const getAvailableMedewerkers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orgId = await requireOrgId(ctx);

    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const users = await ctx.db.query("users").collect();
    const linkedMedewerkerIds = new Set(
      users
        .filter((u) => u.linkedMedewerkerId)
        .map((u) => u.linkedMedewerkerId!.toString())
    );

    const availableMedewerkers = medewerkers.filter(
      (m) => !linkedMedewerkerIds.has(m._id.toString())
    );

    return availableMedewerkers.map((m) => ({
      _id: m._id,
      naam: m.naam,
      email: m.email,
      functie: m.functie,
      isActief: m.isActief,
      status: m.status,
    }));
  },
});

// Migration migrateOldRolesToNew completed 2026-03-26: 4/10 users migrated (admin→directie, viewer→klant).
