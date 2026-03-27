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
 * - getCompanyUserId(ctx)         — returns company owner userId
 * - getLinkedMedewerker(ctx)      — returns linked medewerker doc
 * - requireLinkedMedewerker(ctx)  — throws if no linked medewerker
 */

import { v, ConvexError } from "convex/values";
import { QueryCtx, MutationCtx, mutation, query } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { AuthError, requireAuth } from "./auth";
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

/** Legacy roles still present in the database until migrated */
type LegacyRole = "admin" | "viewer";

/** Any role string that may appear in the database (new + legacy) */
type AnyRole = UserRole | LegacyRole;

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
 * Get the company userId for the authenticated user.
 * For directie: returns their own userId
 * For medewerkers/voorman/etc: returns the userId of the company (from medewerker record)
 * For klant: returns their own userId (they can only view their assigned data)
 */
export async function getCompanyUserId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users">> {
  const user = await requireAuth(ctx);
  const role = normalizeRole(user.role);

  if (role === "directie") {
    return user._id;
  }

  // For all other roles, get the company from their linked medewerker record
  const medewerker = await getLinkedMedewerker(ctx);
  if (medewerker) {
    return medewerker.userId;
  }

  // Fallback to user's own ID (for klant or users without linked medewerker)
  return user._id;
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

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError("Gebruiker niet gevonden");
    }

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

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError("Gebruiker niet gevonden");
    }

    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker) {
      throw new ConvexError("Medewerker niet gevonden");
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

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new ConvexError("Gebruiker niet gevonden");
    }

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
// QUERIES - User & Role Listing (Directie Only)
// ============================================

/**
 * List all users with their roles (directie only).
 * Includes linked medewerker information if available.
 */
export const listUsersWithRoles = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();

    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        let linkedMedewerker = null;
        if (user.linkedMedewerkerId) {
          linkedMedewerker = await ctx.db.get(user.linkedMedewerkerId);
        }

        return {
          _id: user._id,
          clerkId: user.clerkId,
          email: user.email,
          name: user.name,
          role: normalizeRole(user.role),
          linkedMedewerkerId: user.linkedMedewerkerId,
          linkedMedewerkerNaam: linkedMedewerker?.naam ?? null,
          createdAt: user.createdAt,
        };
      })
    );

    return usersWithRoles;
  },
});

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
 * List users by role (directie only).
 */
export const listUsersByRole = query({
  args: {
    role: userRoleValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const users = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", args.role))
      .collect();

    return users.map((user) => ({
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role),
      linkedMedewerkerId: user.linkedMedewerkerId,
      createdAt: user.createdAt,
    }));
  },
});

/**
 * Get available medewerkers that are not yet linked to a user (directie only).
 */
export const getAvailableMedewerkers = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);

    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user", (q) => q.eq("userId", admin._id))
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
