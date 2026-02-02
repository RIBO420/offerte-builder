/**
 * Projecten Functions - Calculatie, Planning & Nacalculatie Add-on
 *
 * Provides CRUD operations for projects linked to offertes.
 * Projects are created from accepted offertes that have voorcalculatie completed.
 * Workflow: gepland → in_uitvoering → afgerond → nacalculatie_compleet
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireAuthUserId, verifyOwnership } from "./auth";
import { Id } from "./_generated/dataModel";
import { getUserRole, getLinkedMedewerker } from "./roles";

// Status validator for project status
// Note: voorcalculatie is now done at offerte level before a project is created
const projectStatusValidator = v.union(
  v.literal("gepland"),
  v.literal("in_uitvoering"),
  v.literal("afgerond"),
  v.literal("nacalculatie_compleet"),
  v.literal("gefactureerd")
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
 * Prerequisites:
 * - Offerte must have status "geaccepteerd"
 * - Offerte must have a voorcalculatie
 * Projects start with status "gepland".
 */
export const create = mutation({
  args: {
    offerteId: v.id("offertes"),
    naam: v.optional(v.string()),
    copyVoorcalculatie: v.optional(v.boolean()), // Whether to copy/link voorcalculatie from offerte to project
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

    // Validate: Offerte must be accepted before creating a project
    if (offerte.status !== "geaccepteerd") {
      throw new Error(
        `Kan geen project aanmaken: offerte heeft status "${offerte.status}". ` +
        "De offerte moet eerst geaccepteerd zijn door de klant."
      );
    }

    // Validate: Offerte must have a voorcalculatie
    const offerteVoorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .unique();

    if (!offerteVoorcalculatie) {
      throw new Error(
        "Kan geen project aanmaken: er is nog geen voorcalculatie voor deze offerte. " +
        "Maak eerst een voorcalculatie aan bij de offerte."
      );
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

    // Create the project with status "gepland" (voorcalculatie is now at offerte level)
    const projectId = await ctx.db.insert("projecten", {
      userId,
      offerteId: args.offerteId,
      naam: projectNaam,
      status: "gepland",
      createdAt: now,
      updatedAt: now,
    });

    // Optionally copy the voorcalculatie from offerte to project for reference
    if (args.copyVoorcalculatie) {
      await ctx.db.insert("voorcalculaties", {
        projectId,
        offerteId: args.offerteId, // Keep link to original offerte
        teamGrootte: offerteVoorcalculatie.teamGrootte,
        teamleden: offerteVoorcalculatie.teamleden,
        effectieveUrenPerDag: offerteVoorcalculatie.effectieveUrenPerDag,
        normUrenTotaal: offerteVoorcalculatie.normUrenTotaal,
        geschatteDagen: offerteVoorcalculatie.geschatteDagen,
        normUrenPerScope: offerteVoorcalculatie.normUrenPerScope,
        createdAt: now,
      });
    }

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
 * By default, archived projects are excluded.
 */
export const list = query({
  args: {
    status: v.optional(projectStatusValidator),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter out archived projects unless explicitly requested
    let filteredProjects = projects;
    if (!args.includeArchived) {
      filteredProjects = projects.filter((p) => p.isArchived !== true);
    }

    // Filter by status if provided
    if (args.status) {
      return filteredProjects.filter((p) => p.status === args.status);
    }

    return filteredProjects;
  },
});

/**
 * Update the status of a project.
 * Status must follow the workflow: gepland -> in_uitvoering -> afgerond -> nacalculatie_compleet
 * Note: voorcalculatie is now done at offerte level, so projects start at "gepland".
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

    // Define valid status transitions (voorcalculatie removed from workflow)
    const validTransitions: Record<string, string[]> = {
      gepland: ["in_uitvoering"],
      in_uitvoering: ["afgerond"],
      afgerond: ["nacalculatie_compleet"],
      nacalculatie_compleet: ["gefactureerd"],
      gefactureerd: [], // Final state, no further transitions
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
 * Archive a project.
 * Sets isArchived to true and records the archive timestamp.
 */
export const archive = mutation({
  args: {
    id: v.id("projecten"),
  },
  handler: async (ctx, args) => {
    // Verify ownership before archiving
    await getOwnedProject(ctx, args.id);

    await ctx.db.patch(args.id, {
      isArchived: true,
      archivedAt: Date.now(),
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
    toegewezenVoertuigen: v.optional(v.array(v.id("voertuigen"))),
  },
  handler: async (ctx, args) => {
    // Verify ownership before updating
    await getOwnedProject(ctx, args.id);
    const now = Date.now();

    const updates: Record<string, unknown> = { updatedAt: now };

    if (args.naam !== undefined) {
      updates.naam = args.naam;
    }

    if (args.toegewezenVoertuigen !== undefined) {
      updates.toegewezenVoertuigen = args.toegewezenVoertuigen;
    }

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Update assigned vehicles for a project.
 * Convenience mutation specifically for vehicle assignment.
 */
export const updateVoertuigen = mutation({
  args: {
    id: v.id("projecten"),
    voertuigIds: v.array(v.id("voertuigen")),
  },
  handler: async (ctx, args) => {
    // Verify ownership before updating
    await getOwnedProject(ctx, args.id);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      toegewezenVoertuigen: args.voertuigIds,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Get assigned vehicles for a project with full vehicle details.
 */
export const getVoertuigen = query({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project) return [];

    // Verify ownership
    const user = await requireAuth(ctx);
    if (project.userId.toString() !== user._id.toString()) {
      return [];
    }

    if (!project.toegewezenVoertuigen || project.toegewezenVoertuigen.length === 0) {
      return [];
    }

    // Fetch all assigned vehicles
    const voertuigen = await Promise.all(
      project.toegewezenVoertuigen.map((id) => ctx.db.get(id))
    );

    // Filter out any null values (deleted vehicles) and return
    return voertuigen.filter((v) => v !== null);
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

    // Get voorcalculatie - first check project-level (copied/linked)
    let voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.id))
      .unique();

    // If no project-level voorcalculatie, check offerte-level (new workflow)
    if (!voorcalculatie) {
      voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
        .unique();
    }

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
 * List projects for planning overview.
 * Admin sees all active (non-gefactureerd) projects.
 * Medewerker sees only projects where they are assigned as a teamlid.
 * Returns projects with team info from voorcalculatie.
 */
export const listForPlanning = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const role = await getUserRole(ctx);

    // Get projects based on role
    let projects;
    if (role === "admin") {
      // Admin sees all active projects (not gefactureerd, not archived)
      projects = await ctx.db
        .query("projecten")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.neq(q.field("status"), "gefactureerd"))
        .collect();

      // Filter out archived projects
      projects = projects.filter((p) => p.isArchived !== true);
    } else {
      // Medewerker sees assigned projects
      const medewerker = await getLinkedMedewerker(ctx);
      if (!medewerker) return [];

      // Get all active projects for the medewerker's company
      const allProjects = await ctx.db
        .query("projecten")
        .withIndex("by_user", (q) => q.eq("userId", medewerker.userId))
        .filter((q) => q.neq(q.field("status"), "gefactureerd"))
        .collect();

      // Filter out archived projects
      const activeProjects = allProjects.filter((p) => p.isArchived !== true);

      // Filter to projects where medewerker is in team (check voorcalculatie teamleden)
      const projectsWithTeam = await Promise.all(
        activeProjects.map(async (p) => {
          // Check project-level voorcalculatie first
          let voorcalc = await ctx.db
            .query("voorcalculaties")
            .withIndex("by_project", (q) => q.eq("projectId", p._id))
            .first();

          // If not found, check offerte-level voorcalculatie
          if (!voorcalc) {
            voorcalc = await ctx.db
              .query("voorcalculaties")
              .withIndex("by_offerte", (q) => q.eq("offerteId", p.offerteId))
              .first();
          }

          const teamleden = voorcalc?.teamleden ?? [];
          const isInTeam = teamleden.includes(medewerker.naam);

          return { project: p, voorcalc, isInTeam };
        })
      );

      // Only include projects where medewerker is in the team
      projects = projectsWithTeam
        .filter((pt) => pt.isInTeam)
        .map((pt) => pt.project);
    }

    // For each project, get voorcalculatie for team info
    return Promise.all(
      projects.map(async (p) => {
        // Check project-level voorcalculatie first
        let voorcalc = await ctx.db
          .query("voorcalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", p._id))
          .first();

        // If not found, check offerte-level voorcalculatie
        if (!voorcalc) {
          voorcalc = await ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", p.offerteId))
            .first();
        }

        return {
          ...p,
          teamleden: voorcalc?.teamleden ?? [],
          geschatteDagen: voorcalc?.geschatteDagen ?? 0,
        };
      })
    );
  },
});

/**
 * Get dashboard statistics for projects.
 * Note: voorcalculatie status has been removed from project workflow.
 * Only counts non-archived projects.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter out archived projects
    const activeProjects = projects.filter((p) => p.isArchived !== true);

    const stats = {
      totaal: activeProjects.length,
      gepland: 0,
      in_uitvoering: 0,
      afgerond: 0,
      nacalculatie_compleet: 0,
      gefactureerd: 0,
    };

    for (const project of activeProjects) {
      if (project.status in stats) {
        stats[project.status as keyof typeof stats]++;
      }
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
        // First check project-level voorcalculatie (copied/linked)
        let voorcalculatie = await ctx.db
          .query("voorcalculaties")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .unique();

        // If no project-level voorcalculatie, check offerte-level (new workflow)
        if (!voorcalculatie) {
          voorcalculatie = await ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
            .unique();
        }
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
