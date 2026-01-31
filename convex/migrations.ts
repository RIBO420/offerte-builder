import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Migreer user van oude Clerk ID naar nieuwe Clerk ID
export const migrateUserClerkId = mutation({
  args: {
    oldClerkId: v.string(),
    newClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    // Vind de oude user
    const oldUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.oldClerkId))
      .first();

    if (!oldUser) {
      throw new Error(`User met clerkId ${args.oldClerkId} niet gevonden`);
    }

    // Vind en verwijder de nieuwe user (als die bestaat)
    const newUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.newClerkId))
      .first();

    if (newUser) {
      await ctx.db.delete(newUser._id);
    }

    // Update de oude user met de nieuwe clerkId
    await ctx.db.patch(oldUser._id, {
      clerkId: args.newClerkId,
    });

    return {
      success: true,
      message: `User ${oldUser.email} gemigreerd van ${args.oldClerkId} naar ${args.newClerkId}`,
    };
  },
});
