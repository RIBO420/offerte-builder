import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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
 * Also archives projects and offertes for paid (betaald) facturen.
 * Also fixes project statuses where nacalculatie exists but status is still "afgerond".
 *
 * Usage: npx convex run migrations:migrateProjectsWithFacturen
 */
export const migrateProjectsWithFacturen = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let statusMigratedCount = 0;
    let projectsArchivedCount = 0;
    let offertesArchivedCount = 0;
    let afgerondFixedCount = 0;

    // 1. First fix afgerond projects that have nacalculatie
    const afgerondProjects = await ctx.db
      .query("projecten")
      .filter((q) => q.eq(q.field("status"), "afgerond"))
      .collect();

    for (const project of afgerondProjects) {
      const nacalculatie = await ctx.db
        .query("nacalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .unique();

      if (nacalculatie) {
        await ctx.db.patch(project._id, {
          status: "nacalculatie_compleet",
          updatedAt: now,
        });
        afgerondFixedCount++;
      }
    }

    // 2. Haal alle facturen op met voltooide status
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

    for (const projectId of projectIds) {
      const project = await ctx.db.get(projectId);

      if (!project || !("status" in project)) continue;

      // Update to gefactureerd if not already
      if (project.status !== "gefactureerd") {
        await ctx.db.patch(projectId, {
          status: "gefactureerd",
          updatedAt: now,
        });
        statusMigratedCount++;
      }

      // Check if there's a betaald factuur for this project
      const betaaldeFactuur = voltooideFacturen.find(
        (f) => f.projectId === projectId && f.status === "betaald"
      );

      if (betaaldeFactuur) {
        // Archive project if not already
        if (!project.isArchived) {
          await ctx.db.patch(projectId, {
            isArchived: true,
            archivedAt: now,
          });
          projectsArchivedCount++;
        }

        // Archive offerte if exists and not already archived
        if (project.offerteId) {
          const offerte = await ctx.db
            .query("offertes")
            .filter((q) => q.eq(q.field("_id"), project.offerteId))
            .unique();
          if (offerte && !offerte.isArchived) {
            await ctx.db.patch(offerte._id, {
              isArchived: true,
              archivedAt: now,
            });
            offertesArchivedCount++;
          }
        }
      }
    }

    return {
      success: true,
      afgerondFixedCount,
      statusMigratedCount,
      projectsArchivedCount,
      offertesArchivedCount,
      totalFacturenFound: voltooideFacturen.length,
      message: `Migration complete: ${afgerondFixedCount} afgerond fixed, ${statusMigratedCount} to gefactureerd, ${projectsArchivedCount} projects archived, ${offertesArchivedCount} offertes archived`,
    };
  },
});

/**
 * Admin migration to fix project statuses for projects that have nacalculatie but are still "afgerond".
 * This is a one-time migration to correct any inconsistent data.
 * No authentication required - intended for CLI use only.
 *
 * Usage: npx convex run migrations:fixAllProjectStatusesAdmin
 */
export const fixAllProjectStatusesAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all projects with "afgerond" status
    const afgerondProjects = await ctx.db
      .query("projecten")
      .filter((q) => q.eq(q.field("status"), "afgerond"))
      .collect();

    let updatedCount = 0;

    // Check each "afgerond" project for existing nacalculatie
    for (const project of afgerondProjects) {
      const nacalculatie = await ctx.db
        .query("nacalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .unique();

      // If nacalculatie exists, update status to "nacalculatie_compleet"
      if (nacalculatie) {
        await ctx.db.patch(project._id, {
          status: "nacalculatie_compleet",
          updatedAt: now,
        });
        updatedCount++;
      }
    }

    return {
      success: true,
      checked: afgerondProjects.length,
      updated: updatedCount,
      message: `Checked ${afgerondProjects.length} afgerond projects, updated ${updatedCount} to nacalculatie_compleet`,
    };
  },
});

/**
 * Admin migration to archive offertes that already have facturen.
 * Archives offertes when their linked project has a definitief/verzonden/betaald factuur.
 * No authentication required - intended for CLI use only.
 *
 * Usage: npx convex run migrations:archiveOffertesWithFacturenAdmin
 */
export const archiveOffertesWithFacturenAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all facturen with voltooide status
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

    // Collect offerteIds from projects that have facturen
    const offerteIdsToArchive: Id<"offertes">[] = [];

    for (const factuur of voltooideFacturen) {
      const project = await ctx.db.get(factuur.projectId);
      if (project && project.offerteId && !offerteIdsToArchive.includes(project.offerteId)) {
        offerteIdsToArchive.push(project.offerteId);
      }
    }

    let archivedCount = 0;

    for (const offerteId of offerteIdsToArchive) {
      const offerte = await ctx.db
        .query("offertes")
        .filter((q) => q.eq(q.field("_id"), offerteId))
        .unique();
      if (offerte && !offerte.isArchived) {
        await ctx.db.patch(offerte._id, {
          isArchived: true,
          archivedAt: now,
        });
        archivedCount++;
      }
    }

    return {
      success: true,
      totalFacturenFound: voltooideFacturen.length,
      archivedCount,
      message: `Archived ${archivedCount} offertes that had facturen`,
    };
  },
});

/**
 * Admin migration to archive projects with paid facturen.
 * Archives projects where factuur status is "betaald".
 * No authentication required - intended for CLI use only.
 *
 * Usage: npx convex run migrations:archivePaidProjectsAdmin
 */
export const archivePaidProjectsAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all betaalde facturen
    const betaaldeFacturen = await ctx.db
      .query("facturen")
      .filter((q) => q.eq(q.field("status"), "betaald"))
      .collect();

    let archivedProjectCount = 0;
    let archivedOfferteCount = 0;

    for (const factuur of betaaldeFacturen) {
      const project = await ctx.db.get(factuur.projectId);

      if (project) {
        // Archive project if not already archived
        if (!project.isArchived) {
          await ctx.db.patch(project._id, {
            isArchived: true,
            archivedAt: now,
            status: "gefactureerd",
          });
          archivedProjectCount++;
        }

        // Archive offerte if not already archived
        if (project.offerteId) {
          const offerte = await ctx.db
            .query("offertes")
            .filter((q) => q.eq(q.field("_id"), project.offerteId))
            .unique();
          if (offerte && !offerte.isArchived) {
            await ctx.db.patch(offerte._id, {
              isArchived: true,
              archivedAt: now,
            });
            archivedOfferteCount++;
          }
        }
      }
    }

    return {
      success: true,
      betaaldeFacturenFound: betaaldeFacturen.length,
      archivedProjectCount,
      archivedOfferteCount,
      message: `Archived ${archivedProjectCount} projects and ${archivedOfferteCount} offertes from ${betaaldeFacturen.length} paid facturen`,
    };
  },
});

/**
 * Run all archiving-related migrations at once.
 * - Fixes project statuses (afgerond -> nacalculatie_compleet if nacalculatie exists)
 * - Updates projects with facturen to "gefactureerd" status
 * - Archives offertes that have facturen
 * - Archives paid projects and their offertes
 *
 * Usage: npx convex run migrations:runAllArchivingMigrations
 */
export const runAllArchivingMigrations = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results = {
      projectStatusFixes: 0,
      projectGefactureerdUpdates: 0,
      offertesArchived: 0,
      projectsArchived: 0,
    };

    // 1. Fix project statuses (afgerond -> nacalculatie_compleet)
    const afgerondProjects = await ctx.db
      .query("projecten")
      .filter((q) => q.eq(q.field("status"), "afgerond"))
      .collect();

    for (const project of afgerondProjects) {
      const nacalculatie = await ctx.db
        .query("nacalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .unique();

      if (nacalculatie) {
        await ctx.db.patch(project._id, {
          status: "nacalculatie_compleet",
          updatedAt: now,
        });
        results.projectStatusFixes++;
      }
    }

    // 2. Update projects with facturen to gefactureerd and archive paid ones
    const allFacturen = await ctx.db.query("facturen").collect();

    for (const factuur of allFacturen) {
      const project = await ctx.db.get(factuur.projectId);
      if (!project) continue;

      // Update to gefactureerd if has definitief/verzonden/betaald factuur
      if (
        ["definitief", "verzonden", "betaald"].includes(factuur.status) &&
        project.status !== "gefactureerd"
      ) {
        await ctx.db.patch(project._id, {
          status: "gefactureerd",
          updatedAt: now,
        });
        results.projectGefactureerdUpdates++;
      }

      // Archive if factuur is betaald
      if (factuur.status === "betaald") {
        if (!project.isArchived) {
          await ctx.db.patch(project._id, {
            isArchived: true,
            archivedAt: now,
          });
          results.projectsArchived++;
        }

        // Archive offerte too
        if (project.offerteId) {
          const offerte = await ctx.db
            .query("offertes")
            .filter((q) => q.eq(q.field("_id"), project.offerteId))
            .unique();
          if (offerte && !offerte.isArchived) {
            await ctx.db.patch(offerte._id, {
              isArchived: true,
              archivedAt: now,
            });
            results.offertesArchived++;
          }
        }
      }
    }

    return {
      success: true,
      ...results,
      message: `Migrations complete: ${results.projectStatusFixes} status fixes, ${results.projectGefactureerdUpdates} gefactureerd updates, ${results.projectsArchived} projects archived, ${results.offertesArchived} offertes archived`,
    };
  },
});

// ============================================
// ROLE MIGRATIONS
// ============================================

/**
 * Set a user's role by email.
 * No authentication required - for CLI/initial setup only.
 *
 * Usage:
 * npx convex run migrations:setUserRole '{"email": "user@example.com", "role": "admin"}'
 */
export const setUserRole = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("medewerker"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.email))
      .first();

    if (!user) {
      return {
        success: false,
        message: `User with email ${args.email} not found`,
      };
    }

    const oldRole = user.role || "none";
    await ctx.db.patch(user._id, { role: args.role });

    return {
      success: true,
      message: `Role for ${args.email} changed from "${oldRole}" to "${args.role}"`,
      userId: user._id,
      email: args.email,
      oldRole,
      newRole: args.role,
    };
  },
});

/**
 * Set all users without a role to admin.
 * No authentication required - for initial bootstrap only.
 *
 * Usage:
 * npx convex run migrations:setAllUsersToAdmin
 */
export const setAllUsersToAdmin = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let updatedCount = 0;

    for (const user of users) {
      if (!user.role) {
        await ctx.db.patch(user._id, { role: "admin" });
        updatedCount++;
      }
    }

    return {
      success: true,
      message: `${updatedCount} users updated to admin role`,
      updatedCount,
    };
  },
});

/**
 * List all users with their roles.
 * No authentication required - for CLI diagnostics only.
 *
 * Usage:
 * npx convex run migrations:listUsersWithRoles
 */
export const listUsersWithRoles = mutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      email: u.email,
      name: u.name,
      role: u.role || "none",
    }));
  },
});
