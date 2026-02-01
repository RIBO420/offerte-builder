import { v } from "convex/values";
import { mutation, query, QueryCtx, MutationCtx } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { Id } from "./_generated/dataModel";

/**
 * Task templates per scope - must match src/lib/planning-templates.ts
 */
const takenTemplates: Record<string, string[]> = {
  // Aanleg scopes
  grondwerk: ["Ontgraven", "Grond afvoeren", "Onderbouw voorbereiden"],
  bestrating: ["Fundering leggen", "Bestraten", "Aftrillen/afwerken"],
  borders: ["Grond voorbereiden", "Beplanting plaatsen", "Afwerking aanbrengen"],
  gras: ["Ondergrond voorbereiden", "Gras zaaien/leggen", "Afwerken"],
  houtwerk: ["Fundering maken", "Houtwerk monteren", "Afwerking"],
  water_elektra: ["Sleuven graven", "Bekabeling leggen", "Armaturen plaatsen"],
  specials: ["Voorbereiding", "Installatie", "Afwerking"],

  // Onderhoud scopes
  gras_onderhoud: ["Maaien", "Kanten steken", "Afvoeren"],
  borders_onderhoud: ["Onkruid verwijderen", "Snoeien", "Afvoeren"],
  heggen_onderhoud: ["Snoeien", "Afvoeren snoeisel"],
  heggen: ["Snoeien", "Afvoeren snoeisel"],
  bomen_onderhoud: ["Snoeien", "Afvoeren"],
  bomen: ["Snoeien", "Afvoeren"],
  overig_onderhoud: ["Diverse werkzaamheden"],
  overig: ["Diverse werkzaamheden"],
};

/**
 * Get project and verify ownership
 */
async function getOwnedProject(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projecten">
) {
  const userId = await requireAuthUserId(ctx);
  const project = await ctx.db.get(projectId);

  if (!project) {
    throw new Error("Project niet gevonden");
  }

  if (project.userId.toString() !== userId.toString()) {
    throw new Error("Je hebt geen toegang tot dit project");
  }

  return { project, userId };
}

/**
 * Generate planning tasks from a voorcalculatie
 * Uses scope hours and team settings to calculate task durations
 */
export const generateFromVoorcalculatie = mutation({
  args: {
    projectId: v.id("projecten"),
  },
  handler: async (ctx, args) => {
    const { project } = await getOwnedProject(ctx, args.projectId);

    // Get the voorcalculatie - first try by offerte (new workflow), then by project (legacy)
    let voorcalculatie = await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", project.offerteId))
      .unique();

    // Fallback to project-based voorcalculatie for legacy data
    if (!voorcalculatie) {
      voorcalculatie = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .unique();
    }

    if (!voorcalculatie) {
      throw new Error("Geen voorcalculatie gevonden. Maak eerst een voorcalculatie aan bij de offerte.");
    }

    // Delete existing tasks for this project (regenerate)
    const existingTasks = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const task of existingTasks) {
      await ctx.db.delete(task._id);
    }

    // Get the offerte to know the scopes
    const offerte = await ctx.db.get(project.offerteId);
    if (!offerte) {
      throw new Error("Offerte niet gevonden");
    }

    // Determine active scopes
    const activeScopes =
      offerte.scopes ||
      Object.keys(voorcalculatie.normUrenPerScope).filter(
        (scope) => voorcalculatie.normUrenPerScope[scope] > 0
      );

    // Calculate effective hours per day
    const effectiveHoursPerDay =
      voorcalculatie.effectieveUrenPerDag * voorcalculatie.teamGrootte;

    // Generate tasks for each scope
    let volgorde = 0;
    const createdTasks: Id<"planningTaken">[] = [];

    for (const scope of activeScopes) {
      const scopeHours = voorcalculatie.normUrenPerScope[scope] || 0;
      if (scopeHours <= 0) continue;

      const tasks = takenTemplates[scope] || ["Werkzaamheden uitvoeren"];
      const hoursPerTask = scopeHours / tasks.length;
      const daysPerTask = hoursPerTask / effectiveHoursPerDay;

      for (const taskName of tasks) {
        const taskId = await ctx.db.insert("planningTaken", {
          projectId: args.projectId,
          scope,
          taakNaam: taskName,
          normUren: Math.round(hoursPerTask * 100) / 100,
          geschatteDagen: Math.round(daysPerTask * 100) / 100,
          volgorde: volgorde++,
          status: "gepland",
        });
        createdTasks.push(taskId);
      }
    }

    return {
      count: createdTasks.length,
      taskIds: createdTasks,
    };
  },
});

/**
 * List all planning tasks for a project
 */
export const list = query({
  args: {
    projectId: v.id("projecten"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      return [];
    }

    // Get tasks ordered by volgorde
    const tasks = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Sort by volgorde
    return tasks.sort((a, b) => a.volgorde - b.volgorde);
  },
});

/**
 * Update task status
 */
export const update = mutation({
  args: {
    taskId: v.id("planningTaken"),
    status: v.optional(
      v.union(v.literal("gepland"), v.literal("gestart"), v.literal("afgerond"))
    ),
    taakNaam: v.optional(v.string()),
    normUren: v.optional(v.number()),
    geschatteDagen: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get task and verify ownership through project
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Taak niet gevonden");
    }

    const project = await ctx.db.get(task.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Je hebt geen toegang tot deze taak");
    }

    // Build update object
    const updates: Record<string, unknown> = {};
    if (args.status !== undefined) updates.status = args.status;
    if (args.taakNaam !== undefined) updates.taakNaam = args.taakNaam;
    if (args.normUren !== undefined) updates.normUren = args.normUren;
    if (args.geschatteDagen !== undefined)
      updates.geschatteDagen = args.geschatteDagen;

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.taskId, updates);
    }

    return args.taskId;
  },
});

/**
 * Update task order (reorder tasks)
 */
export const updateVolgorde = mutation({
  args: {
    projectId: v.id("projecten"),
    taskOrders: v.array(
      v.object({
        taskId: v.id("planningTaken"),
        volgorde: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    await getOwnedProject(ctx, args.projectId);

    // Update each task's volgorde
    for (const { taskId, volgorde } of args.taskOrders) {
      const task = await ctx.db.get(taskId);
      if (task && task.projectId.toString() === args.projectId.toString()) {
        await ctx.db.patch(taskId, { volgorde });
      }
    }

    return args.taskOrders.length;
  },
});

/**
 * Delete a task
 */
export const remove = mutation({
  args: {
    taskId: v.id("planningTaken"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Get task and verify ownership through project
    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Taak niet gevonden");
    }

    const project = await ctx.db.get(task.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Je hebt geen toegang tot deze taak");
    }

    await ctx.db.delete(args.taskId);
    return args.taskId;
  },
});

/**
 * Add a custom task
 */
export const add = mutation({
  args: {
    projectId: v.id("projecten"),
    scope: v.string(),
    taakNaam: v.string(),
    normUren: v.number(),
    geschatteDagen: v.number(),
  },
  handler: async (ctx, args) => {
    await getOwnedProject(ctx, args.projectId);

    // Get highest volgorde
    const tasks = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const maxVolgorde = tasks.reduce(
      (max, t) => Math.max(max, t.volgorde),
      -1
    );

    const taskId = await ctx.db.insert("planningTaken", {
      projectId: args.projectId,
      scope: args.scope,
      taakNaam: args.taakNaam,
      normUren: args.normUren,
      geschatteDagen: args.geschatteDagen,
      volgorde: maxVolgorde + 1,
      status: "gepland",
    });

    return taskId;
  },
});

/**
 * Get planning summary for a project
 */
export const getSummary = query({
  args: {
    projectId: v.id("projecten"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      return null;
    }

    // Get all tasks
    const tasks = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Calculate totals
    const totaalUren = tasks.reduce((sum, t) => sum + t.normUren, 0);
    const totaalDagen = tasks.reduce((sum, t) => sum + t.geschatteDagen, 0);

    // Group by scope
    const perScope: Record<
      string,
      { uren: number; dagen: number; taken: number; afgerond: number }
    > = {};
    for (const task of tasks) {
      if (!perScope[task.scope]) {
        perScope[task.scope] = { uren: 0, dagen: 0, taken: 0, afgerond: 0 };
      }
      perScope[task.scope].uren += task.normUren;
      perScope[task.scope].dagen += task.geschatteDagen;
      perScope[task.scope].taken += 1;
      if (task.status === "afgerond") {
        perScope[task.scope].afgerond += 1;
      }
    }

    // Calculate progress
    const totaalTaken = tasks.length;
    const afgerondTaken = tasks.filter((t) => t.status === "afgerond").length;
    const gestartTaken = tasks.filter((t) => t.status === "gestart").length;
    const voortgang =
      totaalTaken > 0 ? Math.round((afgerondTaken / totaalTaken) * 100) : 0;

    return {
      totaalUren: Math.round(totaalUren * 100) / 100,
      totaalDagen: Math.round(totaalDagen * 100) / 100,
      totaalTaken,
      afgerondTaken,
      gestartTaken,
      voortgang,
      perScope,
    };
  },
});

/**
 * Move task up in order
 */
export const moveUp = mutation({
  args: {
    taskId: v.id("planningTaken"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Taak niet gevonden");
    }

    const project = await ctx.db.get(task.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Je hebt geen toegang tot deze taak");
    }

    // Find task with lower volgorde (to swap with)
    const tasks = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", task.projectId))
      .collect();

    const sortedTasks = tasks.sort((a, b) => a.volgorde - b.volgorde);
    const currentIndex = sortedTasks.findIndex((t) => t._id === args.taskId);

    if (currentIndex <= 0) {
      return args.taskId; // Already at top
    }

    const previousTask = sortedTasks[currentIndex - 1];

    // Swap volgorde
    await ctx.db.patch(args.taskId, { volgorde: previousTask.volgorde });
    await ctx.db.patch(previousTask._id, { volgorde: task.volgorde });

    return args.taskId;
  },
});

/**
 * Move task down in order
 */
export const moveDown = mutation({
  args: {
    taskId: v.id("planningTaken"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    const task = await ctx.db.get(args.taskId);
    if (!task) {
      throw new Error("Taak niet gevonden");
    }

    const project = await ctx.db.get(task.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      throw new Error("Je hebt geen toegang tot deze taak");
    }

    // Find task with higher volgorde (to swap with)
    const tasks = await ctx.db
      .query("planningTaken")
      .withIndex("by_project", (q) => q.eq("projectId", task.projectId))
      .collect();

    const sortedTasks = tasks.sort((a, b) => a.volgorde - b.volgorde);
    const currentIndex = sortedTasks.findIndex((t) => t._id === args.taskId);

    if (currentIndex >= sortedTasks.length - 1) {
      return args.taskId; // Already at bottom
    }

    const nextTask = sortedTasks[currentIndex + 1];

    // Swap volgorde
    await ctx.db.patch(args.taskId, { volgorde: nextTask.volgorde });
    await ctx.db.patch(nextTask._id, { volgorde: task.volgorde });

    return args.taskId;
  },
});
