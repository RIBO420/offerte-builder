import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get current user by Clerk ID
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

// Get current user (for use with auth)
export const current = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

// Create or update user (called from Clerk webhook or on first login)
export const upsert = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    bedrijfsnaam: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        bedrijfsnaam: args.bedrijfsnaam,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      bedrijfsnaam: args.bedrijfsnaam,
      createdAt: Date.now(),
    });
  },
});

// List all users (admin only)
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

// Update user profile
export const updateProfile = mutation({
  args: {
    clerkId: v.string(),
    name: v.optional(v.string()),
    bedrijfsnaam: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const updates: Record<string, string | undefined> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.bedrijfsnaam !== undefined) updates.bedrijfsnaam = args.bedrijfsnaam;

    await ctx.db.patch(user._id, updates);
    return user._id;
  },
});
