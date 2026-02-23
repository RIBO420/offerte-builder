/**
 * Betalingen Functions - Mollie betalingen module
 *
 * Beheert de registratie en statustracking van Mollie betalingen.
 *
 * Tabel: betalingen
 * Zodra de tabel aan schema.ts is toegevoegd, kunnen de inline v.object()
 * validators worden vervangen door de schema-referenties.
 *
 * Schema definitie voor schema.ts:
 * betalingen: defineTable({
 *   userId: v.id("users"),
 *   molliePaymentId: v.string(),
 *   bedrag: v.number(),
 *   status: v.union(
 *     v.literal("open"), v.literal("pending"), v.literal("paid"),
 *     v.literal("failed"), v.literal("expired"), v.literal("canceled")
 *   ),
 *   beschrijving: v.string(),
 *   referentie: v.string(),
 *   klantNaam: v.string(),
 *   klantEmail: v.string(),
 *   type: v.union(
 *     v.literal("aanbetaling"), v.literal("configurator"), v.literal("factuur")
 *   ),
 *   metadata: v.optional(v.any()),
 *   createdAt: v.number(),
 *   updatedAt: v.number(),
 * })
 *   .index("by_user", ["userId"])
 *   .index("by_mollieId", ["molliePaymentId"])
 *   .index("by_referentie", ["referentie"])
 *   .index("by_user_status", ["userId", "status"]),
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";

// ============================================
// VALIDATORS
// ============================================

const betalingStatusValidator = v.union(
  v.literal("open"),
  v.literal("pending"),
  v.literal("paid"),
  v.literal("failed"),
  v.literal("expired"),
  v.literal("canceled")
);

const betalingTypeValidator = v.union(
  v.literal("aanbetaling"),
  v.literal("configurator"),
  v.literal("factuur")
);

// ============================================
// QUERIES
// ============================================

/**
 * Haal alle betalingen op (admin).
 * Gesorteerd op aanmaakdatum, nieuwste eerst.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);

    const betalingen = await ctx.db
      .query("betalingen")
      .order("desc")
      .collect();

    return betalingen;
  },
});

/**
 * Zoek een betaling op aan de hand van het Mollie betaling-ID.
 */
export const getByMollieId = query({
  args: {
    molliePaymentId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const betaling = await ctx.db
      .query("betalingen")
      .withIndex("by_mollieId", (q) =>
        q.eq("molliePaymentId", args.molliePaymentId)
      )
      .unique();

    return betaling;
  },
});

/**
 * Zoek betalingen op aan de hand van een referentienummer.
 */
export const getByReferentie = query({
  args: {
    referentie: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const betalingen = await ctx.db
      .query("betalingen")
      .withIndex("by_referentie", (q) => q.eq("referentie", args.referentie))
      .collect();

    return betalingen;
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Registreer een nieuwe betaling na het aanmaken bij Mollie.
 */
export const create = mutation({
  args: {
    molliePaymentId: v.string(),
    bedrag: v.number(),
    beschrijving: v.string(),
    referentie: v.string(),
    klantNaam: v.string(),
    klantEmail: v.string(),
    type: betalingTypeValidator,
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const now = Date.now();

    const betalingId = await ctx.db.insert("betalingen", {
      molliePaymentId: args.molliePaymentId,
      bedrag: args.bedrag,
      status: "open",
      beschrijving: args.beschrijving,
      referentie: args.referentie,
      klantNaam: args.klantNaam,
      klantEmail: args.klantEmail,
      type: args.type,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });

    return betalingId;
  },
});

/**
 * Werk de status van een betaling bij na een Mollie webhook.
 * Zoekt de betaling op via het Mollie payment ID.
 */
export const updateStatus = mutation({
  args: {
    molliePaymentId: v.string(),
    status: betalingStatusValidator,
  },
  handler: async (ctx, args) => {
    const betaling = await ctx.db
      .query("betalingen")
      .withIndex("by_mollieId", (q) =>
        q.eq("molliePaymentId", args.molliePaymentId)
      )
      .unique();

    if (!betaling) {
      throw new Error(
        `Betaling met Mollie ID ${args.molliePaymentId} niet gevonden`
      );
    }

    await ctx.db.patch(betaling._id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    return betaling._id;
  },
});
