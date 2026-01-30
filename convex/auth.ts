/**
 * Authentication Helpers for Convex
 *
 * Provides secure user authentication using Clerk identity.
 * All mutations/queries that need user context should use these helpers
 * instead of accepting userId from client arguments.
 */

import { QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export class AuthError extends Error {
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
 */
export async function requireAuthUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const user = await requireAuth(ctx);
  return user._id;
}

/**
 * Verify that a document belongs to the authenticated user.
 * Throws AuthError if the user doesn't own the document.
 */
export async function verifyOwnership<T extends { userId: Id<"users"> }>(
  ctx: QueryCtx | MutationCtx,
  document: T | null,
  resourceName: string = "resource"
): Promise<T> {
  if (!document) {
    throw new AuthError(`${resourceName} niet gevonden`);
  }

  const user = await requireAuth(ctx);
  if (document.userId.toString() !== user._id.toString()) {
    throw new AuthError(`Je hebt geen toegang tot deze ${resourceName}`);
  }

  return document;
}

/**
 * Get an offerte and verify ownership.
 */
export async function getOwnedOfferte(
  ctx: QueryCtx | MutationCtx,
  offerteId: Id<"offertes">
) {
  const offerte = await ctx.db.get(offerteId);
  return verifyOwnership(ctx, offerte, "offerte");
}

/**
 * Get a klant and verify ownership.
 */
export async function getOwnedKlant(
  ctx: QueryCtx | MutationCtx,
  klantId: Id<"klanten">
) {
  const klant = await ctx.db.get(klantId);
  return verifyOwnership(ctx, klant, "klant");
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
