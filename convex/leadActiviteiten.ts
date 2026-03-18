import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { requireNotViewer } from "./roles";

// ============================================
// Queries
// ============================================

/**
 * Haal alle activiteiten op voor een lead, gesorteerd op datum aflopend.
 */
export const listByLead = query({
  args: {
    leadId: v.id("configuratorAanvragen"),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    const activiteiten = await ctx.db
      .query("leadActiviteiten")
      .withIndex("by_lead", (q) => q.eq("leadId", args.leadId))
      .order("desc")
      .collect();
    return activiteiten;
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Maak een nieuwe activiteit aan voor een lead.
 */
export const create = mutation({
  args: {
    leadId: v.id("configuratorAanvragen"),
    type: v.union(
      v.literal("status_wijziging"),
      v.literal("notitie"),
      v.literal("toewijzing"),
      v.literal("offerte_gekoppeld"),
      v.literal("aangemaakt")
    ),
    beschrijving: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const user = await requireNotViewer(ctx);

    const id = await ctx.db.insert("leadActiviteiten", {
      leadId: args.leadId,
      type: args.type,
      beschrijving: args.beschrijving,
      gebruikerId: user._id,
      metadata: args.metadata,
      createdAt: Date.now(),
    });

    return id;
  },
});
