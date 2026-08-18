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
 *   metadata: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))),
 *   createdAt: v.number(),
 *   updatedAt: v.number(),
 * })
 *   .index("by_org", ["orgId"])
 *   .index("by_mollieId", ["molliePaymentId"])
 *   .index("by_referentie", ["referentie"]),
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrg, requireOrgId } from "./auth";
import { requireNotViewer } from "./roles";

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
 * Haal betalingen op — alle betalingen van de eigen organisatie.
 * Gesorteerd op aanmaakdatum, nieuwste eerst.
 *
 * De vroegere admin-uitzondering ("admins zien álle betalingen", zonder
 * index) is met de org-migratie vervallen: die tak las de tabel van élke
 * tenant. De organisatie ís nu de grens, dus kantoor ziet de betalingen van
 * het eigen bedrijf en niets daarbuiten.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);

    return await ctx.db
      .query("betalingen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .order("desc")
      .collect();
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
    const orgId = await requireOrgId(ctx);

    const betaling = await ctx.db
      .query("betalingen")
      .withIndex("by_mollieId", (q) =>
        q.eq("molliePaymentId", args.molliePaymentId)
      )
      .unique();

    // by_mollieId is niet org-gescoped (Mollie-id is globaal uniek): hier
    // expliciet controleren dat de betaling van de eigen organisatie is.
    if (!betaling || betaling.orgId?.toString() !== orgId.toString()) {
      return null;
    }

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
    const orgId = await requireOrgId(ctx);

    const betalingen = await ctx.db
      .query("betalingen")
      .withIndex("by_referentie", (q) => q.eq("referentie", args.referentie))
      .collect();

    // Referentienummers zijn per organisatie uniek, niet globaal — filteren.
    return betalingen.filter(
      (b) => b.orgId?.toString() === orgId.toString()
    );
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
    metadata: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);
    const now = Date.now();

    const betalingId = await ctx.db.insert("betalingen", {
      orgId: org._id,
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
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    const betaling = await ctx.db
      .query("betalingen")
      .withIndex("by_mollieId", (q) =>
        q.eq("molliePaymentId", args.molliePaymentId)
      )
      .unique();

    // Zelfde melding voor "bestaat niet" en "andere organisatie": het bestaan
    // van een betaling van een andere tenant mag niet lekken.
    if (!betaling || betaling.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError(
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
