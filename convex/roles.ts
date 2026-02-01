/**
 * Role Helper Functions for Convex
 *
 * Provides role-based access control helpers.
 * Roles:
 * - admin: Full access to all features, can manage users, medewerkers, and all data
 * - medewerker: Limited access, can only see own data, linked to a medewerker profile
 * - viewer: Read-only access to allowed features
 *
 * Usage:
 * - requireAdmin(ctx) - throws if not admin
 * - requireMedewerkerOrAdmin(ctx) - throws if neither
 * - getUserRole(ctx) - returns the user's role
 * - isAdmin(ctx) - returns boolean
 * - isMedewerker(ctx) - returns boolean
 * - isViewer(ctx) - returns boolean
 * - getLinkedMedewerker(ctx) - returns linked medewerker if exists
 */

import { v } from "convex/values";
import { QueryCtx, MutationCtx, mutation, query } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import { AuthError, requireAuth } from "./auth";
import { userRoleValidator } from "./validators";

// Role types
export type UserRole = "admin" | "medewerker" | "viewer";

/**
 * Get the role of the authenticated user.
 * Returns "admin" for users without a role (backwards compatibility).
 */
export async function getUserRole(
  ctx: QueryCtx | MutationCtx
): Promise<UserRole> {
  const user = await requireAuth(ctx);
  // Default to "admin" for backwards compatibility (existing users without role)
  return (user.role as UserRole) ?? "admin";
}

/**
 * Check if the authenticated user is an admin.
 * Users without a role are considered admin (backwards compatibility).
 */
export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const role = await getUserRole(ctx);
  return role === "admin";
}

/**
 * Check if the authenticated user is a medewerker.
 */
export async function isMedewerker(
  ctx: QueryCtx | MutationCtx
): Promise<boolean> {
  const role = await getUserRole(ctx);
  return role === "medewerker";
}

/**
 * Check if the authenticated user is a viewer (read-only access).
 */
export async function isViewer(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const role = await getUserRole(ctx);
  return role === "viewer";
}

/**
 * Require the authenticated user to be an admin.
 * Throws AuthError if not admin.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  const admin = await isAdmin(ctx);

  if (!admin) {
    throw new AuthError("Je hebt geen admin rechten voor deze actie");
  }

  return user;
}

/**
 * Require the authenticated user to be a medewerker or admin.
 * Throws AuthError if neither.
 */
export async function requireMedewerkerOrAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  const role = await getUserRole(ctx);

  if (role !== "admin" && role !== "medewerker") {
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
 * For admins: returns their own userId
 * For medewerkers: returns the userId of the company they work for (from medewerker record)
 * For viewers: returns their own userId (they can only view their assigned data)
 */
export async function getCompanyUserId(
  ctx: QueryCtx | MutationCtx
): Promise<Id<"users">> {
  const user = await requireAuth(ctx);
  const admin = await isAdmin(ctx);

  if (admin) {
    return user._id;
  }

  // For medewerkers, get the company from their linked medewerker record
  const medewerker = await getLinkedMedewerker(ctx);
  if (medewerker) {
    return medewerker.userId;
  }

  // Fallback to user's own ID (for viewers or users without linked medewerker)
  return user._id;
}

// ============================================
// MUTATIONS - Role Assignment (Admin Only)
// ============================================

/**
 * Assign a role to a user (admin only).
 */
export const assignRole = mutation({
  args: {
    userId: v.id("users"),
    role: userRoleValidator,
  },
  handler: async (ctx, args) => {
    // Require admin to assign roles
    await requireAdmin(ctx);

    // Get the target user
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Gebruiker niet gevonden");
    }

    // Update the role
    await ctx.db.patch(args.userId, {
      role: args.role,
    });

    return { success: true, userId: args.userId, role: args.role };
  },
});

/**
 * Link a user to a medewerker (admin only).
 * This is typically used when a medewerker creates an account in the app.
 */
export const linkMedewerker = mutation({
  args: {
    userId: v.id("users"),
    medewerkerId: v.id("medewerkers"),
  },
  handler: async (ctx, args) => {
    // Require admin to link medewerkers
    await requireAdmin(ctx);

    // Get the target user
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Gebruiker niet gevonden");
    }

    // Get the medewerker
    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }

    // Update the user with the linked medewerker
    await ctx.db.patch(args.userId, {
      linkedMedewerkerId: args.medewerkerId,
      role: "medewerker", // Automatically set role to medewerker
    });

    // Update the medewerker with the Clerk user ID
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
 * Unlink a user from a medewerker (admin only).
 */
export const unlinkMedewerker = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Require admin to unlink medewerkers
    await requireAdmin(ctx);

    // Get the target user
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("Gebruiker niet gevonden");
    }

    // If user has a linked medewerker, update the medewerker status
    if (targetUser.linkedMedewerkerId) {
      const medewerker = await ctx.db.get(targetUser.linkedMedewerkerId);
      if (medewerker) {
        await ctx.db.patch(medewerker._id, {
          clerkUserId: undefined,
          status: "inactive",
        });
      }
    }

    // Remove the link and reset role to viewer
    await ctx.db.patch(args.userId, {
      linkedMedewerkerId: undefined,
      role: "viewer",
    });

    return { success: true, userId: args.userId };
  },
});

// ============================================
// QUERIES - User & Role Listing (Admin Only)
// ============================================

/**
 * List all users with their roles (admin only).
 * Includes linked medewerker information if available.
 */
export const listUsersWithRoles = query({
  args: {},
  handler: async (ctx) => {
    // Require admin to list users
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();

    // Get linked medewerker info for each user
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
          role: (user.role as UserRole) ?? "admin", // Default to admin for backwards compatibility
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
    const role = (user.role as UserRole) ?? "admin";

    let linkedMedewerker = null;
    if (user.linkedMedewerkerId) {
      linkedMedewerker = await ctx.db.get(user.linkedMedewerkerId);
    }

    return {
      userId: user._id,
      role,
      isAdmin: role === "admin",
      isMedewerker: role === "medewerker",
      isViewer: role === "viewer",
      linkedMedewerkerId: user.linkedMedewerkerId,
      linkedMedewerkerNaam: linkedMedewerker?.naam ?? null,
    };
  },
});

/**
 * List users by role (admin only).
 */
export const listUsersByRole = query({
  args: {
    role: userRoleValidator,
  },
  handler: async (ctx, args) => {
    // Require admin to list users
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
      role: user.role,
      linkedMedewerkerId: user.linkedMedewerkerId,
      createdAt: user.createdAt,
    }));
  },
});

/**
 * Get available medewerkers that are not yet linked to a user (admin only).
 * Useful when linking a new user to a medewerker.
 */
export const getAvailableMedewerkers = query({
  args: {},
  handler: async (ctx) => {
    // Require admin
    const admin = await requireAdmin(ctx);

    // Get all medewerkers for this admin's company
    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_user", (q) => q.eq("userId", admin._id))
      .collect();

    // Get all users that have linkedMedewerkerId set
    const users = await ctx.db.query("users").collect();
    const linkedMedewerkerIds = new Set(
      users
        .filter((u) => u.linkedMedewerkerId)
        .map((u) => u.linkedMedewerkerId!.toString())
    );

    // Filter to only medewerkers without a linked user
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
