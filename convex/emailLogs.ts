import { v, ConvexError } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { requireAuthUserId, getOwnedOfferte } from "./auth";
import { requireNotViewer } from "./roles";

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
      v.literal("geopend"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained")
    ),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
    customMessage: v.optional(v.string()),
    cc: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
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
      customMessage: args.customMessage,
      cc: args.cc,
      createdAt: Date.now(),
    });
  },
});

// Create email log entry (internal — no auth required, for cron jobs/actions)
export const createInternal = internalMutation({
  args: {
    offerteId: v.id("offertes"),
    userId: v.id("users"),
    type: v.union(
      v.literal("offerte_verzonden"),
      v.literal("herinnering"),
      v.literal("bedankt"),
      v.literal("factuur_verzonden"),
      v.literal("factuur_herinnering")
    ),
    to: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("verzonden"),
      v.literal("mislukt"),
      v.literal("geopend"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained")
    ),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("email_logs", {
      offerteId: args.offerteId,
      userId: args.userId,
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
      v.literal("geopend"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("complained")
    ),
    openedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Get the log and verify ownership
    const log = await ctx.db.get(args.id);
    if (!log) {
      throw new ConvexError("Email log niet gevonden");
    }
    if (log.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot deze email log");
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
      delivered: logs.filter((l) => l.status === "delivered").length,
      geopend: logs.filter((l) => l.status === "geopend").length,
      mislukt: logs.filter((l) => l.status === "mislukt").length,
      bounced: logs.filter((l) => l.status === "bounced").length,
      laatsteEmail: logs[0] ?? null,
    };
  },
});

// ── Webhook mutations ────────────────────────────────────────────────────

/**
 * Update email log from Resend webhook event.
 * Called by the /api/webhooks/resend route handler after signature verification.
 * This mutation does not require user auth — security is handled by
 * the webhook endpoint's Svix signature verification.
 */
export const updateFromWebhook = mutation({
  args: {
    resendId: v.string(),
    eventType: v.union(
      v.literal("email.delivered"),
      v.literal("email.opened"),
      v.literal("email.bounced"),
      v.literal("email.clicked"),
      v.literal("email.complained")
    ),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    // Find the email log by resendId
    const log = await ctx.db
      .query("email_logs")
      .withIndex("by_resendId", (q) => q.eq("resendId", args.resendId))
      .first();

    if (!log) {
      // No matching log found — this can happen if the email was sent
      // before we started tracking resendIds, or for non-offerte emails.
      console.warn(
        `[emailLogs/webhook] No email log found for resendId: ${args.resendId}`
      );
      return null;
    }

    switch (args.eventType) {
      case "email.delivered": {
        // Only update if not already in a more advanced state
        if (log.status === "verzonden") {
          await ctx.db.patch(log._id, {
            status: "delivered",
            deliveredAt: args.timestamp,
          });
        }
        break;
      }

      case "email.opened": {
        // Set openedAt only on first open, update status
        await ctx.db.patch(log._id, {
          status: "geopend",
          // Only set openedAt if not already set (first open)
          ...(log.openedAt ? {} : { openedAt: args.timestamp }),
        });
        break;
      }

      case "email.bounced": {
        await ctx.db.patch(log._id, {
          status: "bounced",
          bouncedAt: args.timestamp,
        });
        break;
      }

      case "email.clicked": {
        // Set clickedAt only on first click
        await ctx.db.patch(log._id, {
          ...(log.clickedAt ? {} : { clickedAt: args.timestamp }),
        });
        break;
      }

      case "email.complained": {
        await ctx.db.patch(log._id, {
          status: "complained",
        });
        break;
      }
    }

    return log._id;
  },
});
