import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOwnedOfferte, isShareTokenValid, requireAuthUserId } from "./auth";
import { requireNotViewer } from "./roles";
import { checkPublicOfferteRateLimit } from "./security";

// Get all messages for an offerte (with ownership verification)
export const listByOfferte = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify ownership
    await getOwnedOfferte(ctx, args.offerteId);

    return await ctx.db
      .query("offerte_messages")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .order("asc")
      .collect();
  },
});

// Get messages by share token (for public/customer use)
export const listByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Find the offerte by token
    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    // Validate token and check expiry
    if (!isShareTokenValid(offerte, args.token)) {
      return [];
    }

    return await ctx.db
      .query("offerte_messages")
      .withIndex("by_offerte", (q) => q.eq("offerteId", offerte!._id))
      .order("asc")
      .collect();
  },
});

// Get unread message count for an offerte (with ownership verification)
export const getUnreadCount = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    // Verify ownership
    await getOwnedOfferte(ctx, args.offerteId);

    const unread = await ctx.db
      .query("offerte_messages")
      .withIndex("by_offerte_unread", (q) =>
        q.eq("offerteId", args.offerteId).eq("isRead", false)
      )
      .filter((q) => q.eq(q.field("sender"), "klant"))
      .collect();

    return unread.length;
  },
});

// Send message from business (with ownership verification)
export const sendFromBusiness = mutation({
  args: {
    offerteId: v.id("offertes"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // Verify ownership
    await getOwnedOfferte(ctx, args.offerteId);

    return await ctx.db.insert("offerte_messages", {
      offerteId: args.offerteId,
      sender: "bedrijf",
      message: args.message,
      isRead: false,
      createdAt: Date.now(),
    });
  },
});

// Public: accessed via share token — customer sends message (no auth required)
export const sendFromCustomer = mutation({
  args: {
    token: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // Rate limiting: max 30 requests per minute per token
    const rateLimitResult = checkPublicOfferteRateLimit(args.token);
    if (!rateLimitResult.allowed) {
      throw new ConvexError(rateLimitResult.message || "Te veel verzoeken. Probeer het later opnieuw.");
    }

    // Find the offerte by token
    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    // Validate token and check expiry
    if (!isShareTokenValid(offerte, args.token)) {
      throw new ConvexError("Ongeldige of verlopen link");
    }

    return await ctx.db.insert("offerte_messages", {
      offerteId: offerte!._id,
      sender: "klant",
      message: args.message,
      isRead: false,
      createdAt: Date.now(),
    });
  },
});

// Mark messages as read (for business reading customer messages, with ownership verification)
export const markAsRead = mutation({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);
    // Verify ownership
    await getOwnedOfferte(ctx, args.offerteId);

    const unread = await ctx.db
      .query("offerte_messages")
      .withIndex("by_offerte_unread", (q) =>
        q.eq("offerteId", args.offerteId).eq("isRead", false)
      )
      .filter((q) => q.eq(q.field("sender"), "klant"))
      .collect();

    for (const msg of unread) {
      await ctx.db.patch(msg._id, { isRead: true });
    }

    return unread.length;
  },
});

// Public: accessed via share token — customer marks business messages as read (no auth required)
export const markCustomerMessagesAsRead = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Rate limiting: max 30 requests per minute per token
    const rateLimitResult = checkPublicOfferteRateLimit(args.token);
    if (!rateLimitResult.allowed) {
      throw new ConvexError(rateLimitResult.message || "Te veel verzoeken. Probeer het later opnieuw.");
    }

    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    // Validate token and check expiry
    if (!isShareTokenValid(offerte, args.token)) {
      throw new ConvexError("Ongeldige of verlopen link");
    }

    const unread = await ctx.db
      .query("offerte_messages")
      .withIndex("by_offerte_unread", (q) =>
        q.eq("offerteId", offerte!._id).eq("isRead", false)
      )
      .filter((q) => q.eq(q.field("sender"), "bedrijf"))
      .collect();

    for (const msg of unread) {
      await ctx.db.patch(msg._id, { isRead: true });
    }

    return unread.length;
  },
});
