/**
 * Projecten Functions - Calculatie, Planning & Nacalculatie Add-on
 *
 * Provides CRUD operations for projects linked to offertes.
 * Projects track the lifecycle from voorcalculatie through nacalculatie.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
import { Id } from "./_generated/dataModel";

// Status validator for project status
const projectStatusValidator = v.union(
  v.literal("voorcalculatie"),
  v.literal("gepland"),
  v.literal("in_uitvoering"),
  v.literal("afgerond"),
  v.literal("nacalculatie_compleet")
);

/**
 * Get a project and verify ownership.
 */
async function getOwnedProject(
  ctx: Parameters<typeof requireAuth>[0],
  projectId: Id<"projecten">
) {
  const project = await ctx.db.get(projectId);
  return verifyOwnership(ctx, project, "project");
}

/**
 * Create a new project from an offerte.
 * The offerte must be owned by the authenticated user.
 */
export const create = mutation({
  args: {
    offerteId: v.id("offertes"),
    naam: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    // Verify the offerte exists and belongs to the user
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte) {
      throw new Error("Offerte niet gevonden");
    }
    if (offerte.userId.toString() !== userId.toString()) {
      throw new Error("Je hebt geen toegang tot deze offerte");
    }

    // Check if a project already exists for this offerte
    const existingProject = await ctx.db
      .query("projecten")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .unique();

    if (existingProject) {
      throw new Error("Er bestaat al een project voor deze offerte");
    }

    // Use provided name or derive from offerte
    const projectNaam =
      args.naam || `Project ${offerte.offerteNummer} - ${offerte.klant.naam}`;

    const projectId = await ctx.db.insert("projecten", {
      userId,
      offerteId: args.offerteId,
      naam: projectNaam,
      status: "voorcalculatie",
      createdAt: now,
      updatedAt: now,
    });

    return projectId;
  },
});

/**
 * Get a single project by ID.
 * Returns null if project doesn't exist or doesn't belong to user.
 */
export const get = query({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (project.userId.toString() !== user._id.toString()) {
      return null; // Don't reveal existence to unauthorized users
    }

    return project;
  },
});

/**
 * Get a project by offerte ID.
 * Returns null if no project exists for this offerte.
 */
export const getByOfferte = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const project = await ctx.db
      .query("projecten")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .unique();

    if (!project) return null;

    // Verify ownership
    if (project.userId.toString() !== userId.toString()) {
      return null;
    }

    return project;
  },
});

/**
 * List all projects for the authenticated user.
 * Ordered by updatedAt descending (most recent first).
 */
export const list = query({
  args: {
    status: v.optional(projectStatusValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter by status if provided
    if (args.status) {
      return projects.filter((p) => p.status === args.status);
    }

    return projects;
  },
});

/**
 * Update the status of a project.
 * Status must follow the workflow: voorcalculatie -> gepland -> in_uitvoering -> afgerond -> nacalculatie_compleet
 * Validates that transitions only happen in the correct order with proper prerequisites.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("projecten"),
    status: projectStatusValidator,
  },
  handler: async (ctx, args) => {
    // Verify ownership before updating
    const project = await getOwnedProject(ctx, args.id);
    const now = Date.now();

    // Define valid status transitions
    const validTransitions: Record<string, string[]> = {
      voorcalculatie: ["gepland"],
      gepland: ["in_uitvoering"],
      in_uitvoering: ["afgerond"],
      afgerond: ["nacalculatie_compleet"],
      nacalculatie_compleet: [], // Final state, no further transitions
    };

    const currentStatus = project.status;
    const newStatus = args.status;

    // Check if the transition is valid
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `Ongeldige status transitie: kan niet van "${currentStatus}" naar "${newStatus}" gaan. ` +
        `Toegestane transities vanuit "${currentStatus}": ${validTransitions[currentStatus]?.join(", ") || "geen"}.`
      );
    }

    // Validate prerequisites for specific transitions
    if (currentStatus === "voorcalculatie" && newStatus === "gepland") {
      // Check if voorcalculatie exists
      const voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", args.id))
        .unique();

      if (!voorcalculatie) {
        throw new Error(
          "Kan project niet naar 'gepland' verplaatsen: er is nog geen voorcalculatie aangemaakt. " +
          "Maak eerst een voorcalculatie aan."
        );
      }
    }

    if (currentStatus === "in_uitvoering" && newStatus === "afgerond") {
      // Check if there are registered hours
      const urenRegistraties = await ctx.db
        .query("urenRegistraties")
        .withIndex("by_project", (q) => q.eq("projectId", args.id))
        .first();

      if (!urenRegistraties) {
        throw new Error(
          "Kan project niet afronden: er zijn nog geen uren geregistreerd. " +
          "Registreer eerst de gewerkte uren."
        );
      }
    }

    if (currentStatus === "afgerond" && newStatus === "nacalculatie_compleet") {
      // Check if nacalculatie exists
      const nacalculatie = await ctx.db
        .query("nacalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", args.id))
        .unique();

      if (!nacalculatie) {
        throw new Error(
          "Kan project niet als 'nacalculatie compleet' markeren: er is nog geen nacalculatie aangemaakt. " +
          "Maak eerst een nacalculatie aan."
        );
      }
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Update project details.
 */
export const update = mutation({
  args: {
    id: v.id("projecten"),
    naam: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify ownership before updating
    await getOwnedProject(ctx, args.id);
    const now = Date.now();

    const updates: Record<string, unknown> = { updatedAt: now };

    if (args.naam !== undefined) {
      updates.naam = args.naam;
    }

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Delete a project and all related data.
 * This will also delete voorcalculaties, planningTaken, urenRegistraties,
 * machineGebruik, and nacalculaties linked to this project.
 */
export const remove = mutation({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verify ownership before deleting
    await getOwnedProject(ctx, args.id);

    // Delete related voorcalculaties
    const voorcalculaties = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const v of voorcalculaties) {
      await ctx.db.delete(v._id);
    }

    // Delete related planningTaken
    const planningTaken = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const t of planningTaken) {
      await ctx.db.delete(t._id);
    }

    // Delete related urenRegistraties
    const urenRegistraties = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const u of urenRegistraties) {
      await ctx.db.delete(u._id);
    }

    // Delete related machineGebruik
    const machineGebruik = await ctx.db
      .query("machineGebruik")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const m of machineGebruik) {
      await ctx.db.delete(m._id);
    }

    // Delete related nacalculaties
    const nacalculaties = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();
    for (const n of nacalculaties) {
      await ctx.db.delete(n._id);
    }

    // Finally delete the project itself
    await ctx.db.delete(args.id);

    return args.id;
  },
});

/**
 * Get project with all related data (voorcalculatie, nacalculatie, etc.)
 * Useful for displaying the complete project overview.
 */
export const getWithDetails = query({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) return null;

    // Verify ownership
    const user = await requireAuth(ctx);
    if (project.userId.toString() !== user._id.toString()) {
      return null;
    }

    // Get related offerte
    const offerte = await ctx.db.get(project.offerteId);

    // Get voorcalculatie
    const voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .unique();

    // Get planning taken
    const planningTaken = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    // Get nacalculatie
    const nacalculatie = await ctx.db
      .query("nacalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .unique();

    // Get uren registraties count
    const urenRegistraties = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    // Get machine gebruik
    const machineGebruik = await ctx.db
      .query("machineGebruik")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .collect();

    return {
      project,
      offerte,
      voorcalculatie,
      planningTaken: planningTaken.sort((a, b) => a.volgorde - b.volgorde),
      nacalculatie,
      urenRegistratiesCount: urenRegistraties.length,
      totaalGeregistreerdeUren: urenRegistraties.reduce(
        (sum, u) => sum + u.uren,
        0
      ),
      machineGebruikCount: machineGebruik.length,
      totaalMachineKosten: machineGebruik.reduce((sum, m) => sum + m.kosten, 0),
    };
  },
});

/**
 * Get projects for multiple offerte IDs at once.
 * Useful for efficiently checking which offertes already have a project.
 * Returns an object mapping offerteId -> project info (or null).
 */
export const getProjectsByOfferteIds = query({
  args: { offerteIds: v.array(v.id("offertes")) },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Build result object with null defaults
    const result: Record<string, {
      _id: Id<"projecten">;
      naam: string;
      status: string;
    } | null> = {};

    // Initialize all offerteIds with null
    for (const offerteId of args.offerteIds) {
      result[offerteId] = null;
    }

    // Query projects for all offerteIds
    // Since we need to check multiple offerteIds, we query all user's projects
    // and filter in memory (more efficient than N separate queries)
    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Map projects to their offerteIds
    for (const project of projects) {
      if (args.offerteIds.includes(project.offerteId)) {
        result[project.offerteId] = {
          _id: project._id,
          naam: project.naam,
          status: project.status,
        };
      }
    }

    return result;
  },
});

/**
 * Get dashboard statistics for projects.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const stats = {
      totaal: projects.length,
      voorcalculatie: 0,
      gepland: 0,
      in_uitvoering: 0,
      afgerond: 0,
      nacalculatie_compleet: 0,
    };

    for (const project of projects) {
      stats[project.status]++;
    }

    return stats;
  },
});

/**
 * Get active projects (in_uitvoering) with progress data for dashboard.
 * Returns max 5 projects sorted by most recently updated.
 */
export const getActiveProjectsWithProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Get all projects in_uitvoering for this user
    const allProjects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter to in_uitvoering and take max 5
    const activeProjects = allProjects
      .filter((p) => p.status === "in_uitvoering")
      .slice(0, 5);

    if (activeProjects.length === 0) {
      return [];
    }

    // Build result with all related data
    const results = await Promise.all(
      activeProjects.map(async (project) => {
        // Get offerte for klant naam
        const offerte = await ctx.db.get(project.offerteId);
        const klantNaam = offerte?.klant?.naam || "Onbekende klant";

        // Get voorcalculatie for begrote uren
        const voorcalculatie = await ctx.db
          .query("voorcalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .unique();
        const begroteUren = voorcalculatie?.normUrenTotaal || 0;

        // Get uren registraties for totaal uren
        const urenRegistraties = await ctx.db
          .query("urenRegistraties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect();
        const totaalUren = urenRegistraties.reduce((sum, u) => sum + u.uren, 0);

        // Calculate voortgang percentage (0-100)
        let voortgang = 0;
        if (begroteUren > 0) {
          voortgang = Math.min(100, Math.round((totaalUren / begroteUren) * 100));
        }

        return {
          _id: project._id,
          naam: project.naam,
          status: project.status,
          voortgang,
          totaalUren: Math.round(totaalUren * 10) / 10, // Round to 1 decimal
          begroteUren: Math.round(begroteUren * 10) / 10,
          klantNaam,
        };
      })
    );

    return results;
  },
});
