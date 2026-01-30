import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List email logs for an offerte
export const listByOfferte = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("email_logs")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .order("desc")
      .collect();
  },
});

// List email logs for a user
export const listByUser = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return await ctx.db
      .query("email_logs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

// Create email log entry
export const create = mutation({
  args: {
    offerteId: v.id("offertes"),
    userId: v.id("users"),
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
    return await ctx.db.insert("email_logs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// Update email log status (e.g., when opened)
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
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Get email stats for an offerte
export const getOfferteEmailStats = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
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
