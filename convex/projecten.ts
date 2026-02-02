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
 * By default, archived and deleted projects are excluded.
 */
export const list = query({
  args: {
    status: v.optional(projectStatusValidator),
    includeArchived: v.optional(v.boolean()),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter out deleted projects unless explicitly requested
    let filteredProjects = projects;
    if (!args.includeDeleted) {
      filteredProjects = filteredProjects.filter((p) => !p.deletedAt);
    }

    // Filter out archived projects unless explicitly requested
    if (!args.includeArchived) {
      filteredProjects = filteredProjects.filter((p) => p.isArchived !== true);
    }

    // Filter by status if provided
    if (args.status) {
      return filteredProjects.filter((p) => p.status === args.status);
    }

    return filteredProjects;
  },
});

/**
 * List projects with pagination.
 * Returns paginated results with total count for pagination UI.
 * By default, archived and deleted projects are excluded.
 */
export const listPaginated = query({
  args: {
    page: v.number(),
    limit: v.number(),
    status: v.optional(projectStatusValidator),
    includeArchived: v.optional(v.boolean()),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get all projects
    let allProjects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter out deleted projects unless explicitly requested
    if (!args.includeDeleted) {
      allProjects = allProjects.filter((p) => !p.deletedAt);
    }

    // Filter out archived projects unless explicitly requested
    if (!args.includeArchived) {
      allProjects = allProjects.filter((p) => p.isArchived !== true);
    }

    // Filter by status if provided
    if (args.status) {
      allProjects = allProjects.filter((p) => p.status === args.status);
    }

    const totalCount = allProjects.length;
    const totalPages = Math.ceil(totalCount / args.limit);

    // Calculate pagination slice
    const startIndex = (args.page - 1) * args.limit;
    const endIndex = startIndex + args.limit;
    const items = allProjects.slice(startIndex, endIndex);

    return {
      items,
      totalCount,
      totalPages,
      page: args.page,
      limit: args.limit,
    };
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
 * Soft delete a project (sets deletedAt timestamp).
 * Items can be restored within 30 days, after which they are permanently deleted.
 * Related data is preserved for restoration.
 */
export const remove = mutation({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verify ownership before deleting
    await getOwnedProject(ctx, args.id);
    const now = Date.now();

    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Restore a soft-deleted project.
 */
export const restore = mutation({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verify ownership before restoring
    const project = await getOwnedProject(ctx, args.id);

    // Check if actually deleted
    if (!project.deletedAt) {
      throw new Error("Dit project is niet verwijderd");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      deletedAt: undefined,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Permanently delete a project and all related data (hard delete).
 * Used by cleanup function or manual permanent deletion.
 * This will also delete voorcalculaties, planningTaken, urenRegistraties,
 * machineGebruik, and nacalculaties linked to this project.
 */
export const permanentlyDelete = mutation({
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
 * OPTIMIZED: Uses batch queries instead of N+1 pattern.
 */
export const listForPlanning = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    const role = await getUserRole(ctx);

    // Determine the userId to query based on role
    let queryUserId: Id<"users">;
    let medewerkerNaam: string | null = null;

    if (role === "admin") {
      queryUserId = user._id;
    } else {
      // Medewerker sees assigned projects
      const medewerker = await getLinkedMedewerker(ctx);
      if (!medewerker) return [];
      queryUserId = medewerker.userId;
      medewerkerNaam = medewerker.naam;
    }

    // Fetch all active projects
    const allProjects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", queryUserId))
      .filter((q) => q.neq(q.field("status"), "gefactureerd"))
      .collect();

    // Filter out archived and deleted projects
    const activeProjects = allProjects.filter((p) => p.isArchived !== true && !p.deletedAt);

    if (activeProjects.length === 0) {
      return [];
    }

    // OPTIMIZED: Batch fetch voorcalculaties for all projects in parallel
    const projectIds = activeProjects.map((p) => p._id);
    const offerteIds = activeProjects.map((p) => p.offerteId);

    const [voorcalculatiesByProject, voorcalculatiesByOfferte] = await Promise.all([
      // Batch 1: Fetch voorcalculaties by project IDs
      Promise.all(
        projectIds.map((projectId) =>
          ctx.db
            .query("voorcalculaties")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .first()
        )
      ),
      // Batch 2: Fetch voorcalculaties by offerte IDs (fallback)
      Promise.all(
        offerteIds.map((offerteId) =>
          ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", offerteId))
            .first()
        )
      ),
    ]);

    // Helper to get voorcalculatie for a project by index
    const getVoorcalculatie = (index: number) => {
      return voorcalculatiesByProject[index] || voorcalculatiesByOfferte[index];
    };

    // Filter projects based on role
    let filteredProjects: { project: typeof activeProjects[0]; voorcalc: typeof voorcalculatiesByProject[0] }[];
    if (role === "admin") {
      filteredProjects = activeProjects.map((p, i) => ({ project: p, voorcalc: getVoorcalculatie(i) }));
    } else {
      // For medewerker, filter to projects where they are in the team
      filteredProjects = activeProjects
        .map((p, i) => ({ project: p, voorcalc: getVoorcalculatie(i) }))
        .filter(({ voorcalc }) => {
          const teamleden = voorcalc?.teamleden ?? [];
          return medewerkerNaam ? teamleden.includes(medewerkerNaam) : false;
        });
    }

    // Build result with team info using in-memory lookups
    return filteredProjects.map(({ project, voorcalc }) => ({
      ...project,
      teamleden: voorcalc?.teamleden ?? [],
      geschatteDagen: voorcalc?.geschatteDagen ?? 0,
    }));
  },
});

/**
 * Search projects by name, offerte nummer, or klant naam.
 * Performs client-side filtering since Convex doesn't support full-text search on all fields.
 */
export const search = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const searchTerm = args.searchTerm.toLowerCase().trim();

    // If no search term, return recent projects
    if (!searchTerm) {
      const projects = await ctx.db
        .query("projecten")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(10);

      // Filter out deleted and archived
      return projects.filter((p) => !p.deletedAt && p.isArchived !== true);
    }

    // Get all projects for the user
    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter out deleted and archived
    const activeProjects = projects.filter((p) => !p.deletedAt && p.isArchived !== true);

    // Get offertes to search by offerte nummer and klant naam
    const offerteIds = [...new Set(activeProjects.map((p) => p.offerteId))];
    const offertes = await Promise.all(
      offerteIds.map((id) => ctx.db.get(id))
    );
    const offerteMap = new Map(
      offertes.filter((o) => o !== null).map((o) => [o!._id.toString(), o!])
    );

    // Filter projects by search term
    const matchingProjects = activeProjects.filter((project) => {
      // Search by project naam
      if (project.naam.toLowerCase().includes(searchTerm)) {
        return true;
      }

      // Search by offerte nummer and klant naam
      const offerte = offerteMap.get(project.offerteId.toString());
      if (offerte) {
        if (offerte.offerteNummer.toLowerCase().includes(searchTerm)) {
          return true;
        }
        if (offerte.klant.naam.toLowerCase().includes(searchTerm)) {
          return true;
        }
      }

      return false;
    });

    return matchingProjects.slice(0, 20);
  },
});

/**
 * Get dashboard statistics for projects.
 * Note: voorcalculatie status has been removed from project workflow.
 * Only counts non-archived and non-deleted projects.
 */
export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter out archived and deleted projects
    const activeProjects = projects.filter((p) => p.isArchived !== true && !p.deletedAt);

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
 * Bulk update status for multiple projects.
 * Note: Bulk update skips workflow validation for admin convenience.
 */
export const bulkUpdateStatus = mutation({
  args: {
    ids: v.array(v.id("projecten")),
    status: projectStatusValidator,
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const id of args.ids) {
      // Verify ownership for each project
      await getOwnedProject(ctx, id);

      await ctx.db.patch(id, {
        status: args.status,
        updatedAt: now,
      });
    }

    return args.ids.length;
  },
});

/**
 * Bulk soft delete projects (sets deletedAt timestamp).
 * Items can be restored within 30 days.
 */
export const bulkRemove = mutation({
  args: {
    ids: v.array(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const id of args.ids) {
      // Verify ownership for each project
      await getOwnedProject(ctx, id);

      await ctx.db.patch(id, {
        deletedAt: now,
        updatedAt: now,
      });
    }

    return args.ids.length;
  },
});

/**
 * Bulk restore soft-deleted projects.
 */
export const bulkRestore = mutation({
  args: {
    ids: v.array(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    for (const id of args.ids) {
      // Verify ownership for each project
      await getOwnedProject(ctx, id);

      await ctx.db.patch(id, {
        deletedAt: undefined,
        updatedAt: now,
      });
    }

    return args.ids.length;
  },
});

/**
 * Get active projects (in_uitvoering) with progress data for dashboard.
 * Returns max 5 projects sorted by most recently updated.
 * OPTIMIZED: Uses batch queries instead of N+1 pattern.
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

    // OPTIMIZED: Batch fetch all related data in parallel
    const projectIds = activeProjects.map((p) => p._id);
    const offerteIds = activeProjects.map((p) => p.offerteId);

    // Fetch all data in parallel batches
    const [allOffertes, voorcalculatiesByProject, voorcalculatiesByOfferte, urenByProject] = await Promise.all([
      // Batch 1: Fetch all offertes
      Promise.all(offerteIds.map((id) => ctx.db.get(id))),
      // Batch 2: Fetch voorcalculaties by project IDs
      Promise.all(
        projectIds.map((projectId) =>
          ctx.db
            .query("voorcalculaties")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .unique()
        )
      ),
      // Batch 3: Fetch voorcalculaties by offerte IDs (fallback)
      Promise.all(
        offerteIds.map((offerteId) =>
          ctx.db
            .query("voorcalculaties")
            .withIndex("by_offerte", (q) => q.eq("offerteId", offerteId))
            .unique()
        )
      ),
      // Batch 4: Fetch urenRegistraties by project IDs
      Promise.all(
        projectIds.map((projectId) =>
          ctx.db
            .query("urenRegistraties")
            .withIndex("by_project", (q) => q.eq("projectId", projectId))
            .collect()
        )
      ),
    ]);

    // Build lookup map for offertes
    const offerteMap = new Map(
      allOffertes.filter((o) => o !== null).map((o) => [o!._id.toString(), o!])
    );

    // Build result with in-memory lookups (no additional queries)
    const results = activeProjects.map((project, index) => {
      // Get offerte for klant naam
      const offerte = offerteMap.get(project.offerteId.toString());
      const klantNaam = offerte?.klant?.naam || "Onbekende klant";

      // Get voorcalculatie (check project-level first, then offerte-level)
      const voorcalculatie = voorcalculatiesByProject[index] || voorcalculatiesByOfferte[index];
      const begroteUren = voorcalculatie?.normUrenTotaal || 0;

      // Get uren registraties for totaal uren
      const urenRegistraties = urenByProject[index] || [];
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
    });

    return results;
  },
});
