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

/**
 * Migration to add factuur settings to existing instellingen records
 * Adds default values for factuur numbering and payment terms.
 *
 * Usage: npx convex run migrations:migrateInstellingenForFacturen
 */
export const migrateInstellingenForFacturen = mutation({
  args: {},
  handler: async (ctx) => {
    // Haal alle bestaande instellingen op
    const alleInstellingen = await ctx.db.query("instellingen").collect();

    // Huidige jaar voor factuurNummerPrefix
    const huidigJaar = new Date().getFullYear();
    const factuurNummerPrefix = `${huidigJaar}-`;

    let migratedCount = 0;

    for (const instellingen of alleInstellingen) {
      // Controleer of factuur instellingen al bestaan
      if (
        instellingen.factuurNummerPrefix === undefined ||
        instellingen.laatsteFactuurNummer === undefined ||
        instellingen.standaardBetalingstermijn === undefined
      ) {
        await ctx.db.patch(instellingen._id, {
          factuurNummerPrefix:
            instellingen.factuurNummerPrefix ?? factuurNummerPrefix,
          laatsteFactuurNummer: instellingen.laatsteFactuurNummer ?? 0,
          standaardBetalingstermijn:
            instellingen.standaardBetalingstermijn ?? 14,
        });
        migratedCount++;
      }
    }

    return {
      success: true,
      migratedCount,
      message: `Migrated ${migratedCount} instellingen records with factuur settings (prefix: ${factuurNummerPrefix}, betalingstermijn: 14 dagen)`,
    };
  },
});

/**
 * Migration to update projects with completed facturen to "gefactureerd" status
 * Finds projects that have facturen with status definitief/verzonden/betaald
 * and updates the project status to "gefactureerd".
 *
 * Note: Currently this will migrate 0 records as there are no facturen yet,
 * but is useful for future migrations.
 *
 * Usage: npx convex run migrations:migrateProjectsWithFacturen
 */
export const migrateProjectsWithFacturen = mutation({
  args: {},
  handler: async (ctx) => {
    // Haal alle facturen op met voltooide status
    const voltooideFacturen = await ctx.db
      .query("facturen")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "definitief"),
          q.eq(q.field("status"), "verzonden"),
          q.eq(q.field("status"), "betaald")
        )
      )
      .collect();

    // Verzamel unieke project IDs
    const projectIdSet = new Set(
      voltooideFacturen.map((factuur) => factuur.projectId)
    );
    const projectIds = Array.from(projectIdSet);

    let migratedCount = 0;

    for (const projectId of projectIds) {
      const project = await ctx.db.get(projectId);

      // Update alleen als project bestaat en nog niet gefactureerd is
      if (project && "status" in project && project.status !== "gefactureerd") {
        await ctx.db.patch(projectId, {
          status: "gefactureerd",
        });
        migratedCount++;
      }
    }

    return {
      success: true,
      migratedCount,
      totalFacturenFound: voltooideFacturen.length,
      message: `Migrated ${migratedCount} projects to 'gefactureerd' status (found ${voltooideFacturen.length} completed facturen)`,
    };
  },
});
