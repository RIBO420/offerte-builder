import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId, getOwnedOfferte } from "./auth";

// List email logs for an offerte (with ownership verification)
export const listByOfferte = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify user owns this offerte
    await getOwnedOfferte(ctx, args.offerteId);

    return await ctx.db
      .query("email_logs")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .order("desc")
      .collect();
  },
});

// List email logs for authenticated user
export const listByUser = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("email_logs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

// Create email log entry (with ownership verification)
export const create = mutation({
  args: {
    offerteId: v.id("offertes"),
    type: v.union(
      v.literal("offerte_verzonden"),
      v.literal("herinnering"),
      v.literal("bedankt")
    ),
    to: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("verzonden"),
      v.literal("mislukt"),
      v.literal("geopend")
    ),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user owns this offerte
    const offerte = await getOwnedOfferte(ctx, args.offerteId);

    return await ctx.db.insert("email_logs", {
      offerteId: args.offerteId,
      userId: offerte.userId,
      type: args.type,
      to: args.to,
      subject: args.subject,
      status: args.status,
      resendId: args.resendId,
      error: args.error,
      createdAt: Date.now(),
    });
  },
});

// Update email log status (with ownership verification)
export const updateStatus = mutation({
  args: {
    id: v.id("email_logs"),
    status: v.union(
      v.literal("verzonden"),
      v.literal("mislukt"),
      v.literal("geopend")
    ),
    openedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get the log and verify ownership
    const log = await ctx.db.get(args.id);
    if (!log) {
      throw new Error("Email log niet gevonden");
    }
    if (log.userId.toString() !== userId.toString()) {
      throw new Error("Geen toegang tot deze email log");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Get email stats for an offerte (with ownership verification)
export const getOfferteEmailStats = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify user owns this offerte
    await getOwnedOfferte(ctx, args.offerteId);

    const logs = await ctx.db
      .query("email_logs")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .collect();

    return {
      total: logs.length,
      verzonden: logs.filter((l) => l.status === "verzonden").length,
      geopend: logs.filter((l) => l.status === "geopend").length,
      mislukt: logs.filter((l) => l.status === "mislukt").length,
      laatsteEmail: logs[0] ?? null,
    };
  },
});
