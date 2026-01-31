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

/**
 * Migration to update deprecated "definitief" status to "voorcalculatie" for offertes
 * Run this once after deploying the schema changes.
 *
 * Usage: npx convex run migrations:migrateDefinitiefToVoorcalculatie
 */
export const migrateDefinitiefToVoorcalculatie = mutation({
  args: {},
  handler: async (ctx) => {
    // Find all offertes with "definitief" status
    const offertesWithDefinitief = await ctx.db
      .query("offertes")
      .filter((q) => q.eq(q.field("status"), "definitief"))
      .collect();

    let migratedCount = 0;

    for (const offerte of offertesWithDefinitief) {
      await ctx.db.patch(offerte._id, {
        status: "voorcalculatie",
      });
      migratedCount++;
    }

    return {
      success: true,
      migratedCount,
      message: `Migrated ${migratedCount} offertes from 'definitief' to 'voorcalculatie'`,
    };
  },
});

/**
 * Migration to update deprecated "voorcalculatie" status to "gepland" for projects
 * Run this once after deploying the schema changes.
 *
 * Usage: npx convex run migrations:migrateProjectVoorcalculatieToGepland
 */
export const migrateProjectVoorcalculatieToGepland = mutation({
  args: {},
  handler: async (ctx) => {
    // Find all projects with "voorcalculatie" status
    const projectsWithVoorcalculatie = await ctx.db
      .query("projecten")
      .filter((q) => q.eq(q.field("status"), "voorcalculatie"))
      .collect();

    let migratedCount = 0;

    for (const project of projectsWithVoorcalculatie) {
      await ctx.db.patch(project._id, {
        status: "gepland",
      });
      migratedCount++;
    }

    return {
      success: true,
      migratedCount,
      message: `Migrated ${migratedCount} projects from 'voorcalculatie' to 'gepland'`,
    };
  },
});

/**
 * Run all status migrations at once
 *
 * Usage: npx convex run migrations:migrateAllStatuses
 */
export const migrateAllStatuses = mutation({
  args: {},
  handler: async (ctx) => {
    // Migrate offertes: definitief -> voorcalculatie
    const offertesWithDefinitief = await ctx.db
      .query("offertes")
      .filter((q) => q.eq(q.field("status"), "definitief"))
      .collect();

    for (const offerte of offertesWithDefinitief) {
      await ctx.db.patch(offerte._id, { status: "voorcalculatie" });
    }

    // Migrate projects: voorcalculatie -> gepland
    const projectsWithVoorcalculatie = await ctx.db
      .query("projecten")
      .filter((q) => q.eq(q.field("status"), "voorcalculatie"))
      .collect();

    for (const project of projectsWithVoorcalculatie) {
      await ctx.db.patch(project._id, { status: "gepland" });
    }

    return {
      success: true,
      offerteMigrations: offertesWithDefinitief.length,
      projectMigrations: projectsWithVoorcalculatie.length,
      message: `Migrated ${offertesWithDefinitief.length} offertes and ${projectsWithVoorcalculatie.length} projects`,
    };
  },
});
