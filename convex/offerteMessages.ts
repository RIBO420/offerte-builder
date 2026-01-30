import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all messages for an offerte
export const listByOfferte = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
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

    if (!offerte) {
      return [];
    }

    return await ctx.db
      .query("offerte_messages")
      .withIndex("by_offerte", (q) => q.eq("offerteId", offerte._id))
      .order("asc")
      .collect();
  },
});

// Get unread message count for an offerte
export const getUnreadCount = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
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

// Send message from business
export const sendFromBusiness = mutation({
  args: {
    offerteId: v.id("offertes"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("offerte_messages", {
      offerteId: args.offerteId,
      sender: "bedrijf",
      message: args.message,
      isRead: false,
      createdAt: Date.now(),
    });
  },
});

// Send message from customer (via share token)
export const sendFromCustomer = mutation({
  args: {
    token: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the offerte by token
    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    if (!offerte) {
      throw new Error("Offerte not found");
    }

    // Check if link has expired
    if (offerte.shareExpiresAt && offerte.shareExpiresAt < Date.now()) {
      throw new Error("Share link expired");
    }

    return await ctx.db.insert("offerte_messages", {
      offerteId: offerte._id,
      sender: "klant",
      message: args.message,
      isRead: false,
      createdAt: Date.now(),
    });
  },
});

// Mark messages as read (for business reading customer messages)
export const markAsRead = mutation({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
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

// Mark customer messages as read (when customer views)
export const markCustomerMessagesAsRead = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const offerte = await ctx.db
      .query("offertes")
      .withIndex("by_share_token", (q) => q.eq("shareToken", args.token))
      .unique();

    if (!offerte) {
      throw new Error("Offerte not found");
    }

    const unread = await ctx.db
      .query("offerte_messages")
      .withIndex("by_offerte_unread", (q) =>
        q.eq("offerteId", offerte._id).eq("isRead", false)
      )
      .filter((q) => q.eq(q.field("sender"), "bedrijf"))
      .collect();

    for (const msg of unread) {
      await ctx.db.patch(msg._id, { isRead: true });
    }

    return unread.length;
  },
});
