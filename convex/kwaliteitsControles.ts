/**
 * KwaliteitsControles Functions - Quality Control module
 *
 * Provides queries and mutations for managing quality control checklists,
 * inspections, photos, and approval workflows per project/scope.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId, verifyOwnership } from "./auth";
import { Id } from "./_generated/dataModel";

// ============================================
// STANDAARD CHECKLISTS PER SCOPE
// ============================================

const STANDAARD_CHECKLISTS: Record<string, string[]> = {
  // Aanleg scopes
  grondwerk: [
    "Ontgraving correct uitgevoerd",
    "Afvoer grond compleet",
    "Niveau correct afgewerkt",
    "Geen obstakels achtergebleven",
  ],
  bestrating: [
    "Fundering correct aangebracht",
    "Voegwerk netjes afgewerkt",
    "Waterpas gelegd",
    "Afwatering correct",
    "Randen netjes afgewerkt",
  ],
  borders: [
    "Grondverbetering toegepast",
    "Planten correct geplaatst",
    "Afwerking netjes",
    "Mulch/grind aangebracht",
    "Plantafstanden correct",
  ],
  gras: [
    "Ondergrond vlak gemaakt",
    "Graszoden/zaad correct aangebracht",
    "Afwatering werkt",
    "Randen netjes afgewerkt",
    "Eerste bewatering gedaan",
  ],
  houtwerk: [
    "Constructie stevig",
    "Bevestigingen correct",
    "Afwerking netjes",
    "Hout behandeld/geimpregneerd",
    "Niveau en waterpas correct",
  ],
  water_elektra: [
    "Leidingen correct aangelegd",
    "Aansluitingen waterdicht",
    "Elektra veilig afgewerkt",
    "Grondkabels correct diep",
    "Functionele test uitgevoerd",
  ],
  specials: [
    "Installatie correct",
    "Functioneert naar behoren",
    "Afwerking netjes",
    "Veiligheidscheck gedaan",
  ],
  // Onderhoud scopes
  gras_onderhoud: [
    "Grasmaaien correct uitgevoerd",
    "Randen bijgewerkt",
    "Maaisel verwijderd",
    "Geen kale plekken",
  ],
  borders_onderhoud: [
    "Onkruid verwijderd",
    "Planten gesnoeid",
    "Mulch bijgevuld indien nodig",
    "Afwerking netjes",
  ],
  heggen: [
    "Heggen correct gesnoeid",
    "Snoeiafval verwijderd",
    "Vorm behouden",
    "Geen bruine plekken veroorzaakt",
  ],
  bomen: [
    "Snoeiwerk correct uitgevoerd",
    "Snoeiwonden behandeld",
    "Takken correct verwijderd",
    "Veiligheidscheck gedaan",
  ],
  overig: [
    "Werkzaamheden correct uitgevoerd",
    "Terrein opgeruimd",
    "Afval afgevoerd",
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get a project and verify ownership.
 */
async function getOwnedProject(
  ctx: Parameters<typeof verifyOwnership>[0],
  projectId: Id<"projecten">
) {
  const project = await ctx.db.get(projectId);
  return verifyOwnership(ctx, project, "project");
}

/**
 * Generate a unique ID for checklist items.
 */
function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// QUERIES
// ============================================

/**
 * Get all QC checks for a project.
 */
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verify ownership of project
    await getOwnedProject(ctx, args.projectId);

    const controles = await ctx.db
      .query("kwaliteitsControles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return controles;
  },
});

/**
 * Get a specific QC check by ID.
 */
export const getById = query({
  args: { id: v.id("kwaliteitsControles") },
  handler: async (ctx, args) => {
    const controle = await ctx.db.get(args.id);

    if (!controle) {
      return null;
    }

    // Verify ownership via project
    await getOwnedProject(ctx, controle.projectId);

    return controle;
  },
});

/**
 * Get default checklist items for a specific scope.
 */
export const getDefaultChecklist = query({
  args: { scope: v.string() },
  handler: async (ctx, args) => {
    // No authentication needed for getting default checklist
    const items = STANDAARD_CHECKLISTS[args.scope] || STANDAARD_CHECKLISTS.overig;

    return items.map((omschrijving) => ({
      id: generateId(),
      omschrijving,
      isAfgevinkt: false,
    }));
  },
});

/**
 * Get all available scopes with their default checklists.
 */
export const getAllDefaultChecklists = query({
  args: {},
  handler: async () => {
    return Object.entries(STANDAARD_CHECKLISTS).map(([scope, items]) => ({
      scope,
      items: items.map((omschrijving) => ({
        id: generateId(),
        omschrijving,
        isAfgevinkt: false,
      })),
    }));
  },
});

/**
 * Get QC checks for a project filtered by status.
 */
export const getByProjectAndStatus = query({
  args: {
    projectId: v.id("projecten"),
    status: v.union(
      v.literal("open"),
      v.literal("in_uitvoering"),
      v.literal("goedgekeurd"),
      v.literal("afgekeurd")
    ),
  },
  handler: async (ctx, args) => {
    // Verify ownership of project
    await getOwnedProject(ctx, args.projectId);

    const controles = await ctx.db
      .query("kwaliteitsControles")
      .withIndex("by_project_status", (q) =>
        q.eq("projectId", args.projectId).eq("status", args.status)
      )
      .collect();

    return controles;
  },
});

// ============================================
// MUTATIONS
// ============================================

/**
 * Create a new QC check with default checklist items for the given scope.
 */
export const create = mutation({
  args: {
    projectId: v.id("projecten"),
    scope: v.string(),
    customChecklistItems: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify ownership of project
    await getOwnedProject(ctx, args.projectId);

    const now = Date.now();

    // Get default checklist items for this scope, or use custom items if provided
    const defaultItems =
      STANDAARD_CHECKLISTS[args.scope] || STANDAARD_CHECKLISTS.overig;
    const itemDescriptions = args.customChecklistItems || defaultItems;

    const checklistItems = itemDescriptions.map((omschrijving) => ({
      id: generateId(),
      omschrijving,
      isAfgevinkt: false,
    }));

    const id = await ctx.db.insert("kwaliteitsControles", {
      userId,
      projectId: args.projectId,
      scope: args.scope,
      checklistItems,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Update a checklist item (check/uncheck).
 */
export const updateChecklistItem = mutation({
  args: {
    id: v.id("kwaliteitsControles"),
    itemId: v.string(),
    isAfgevinkt: v.boolean(),
    notities: v.optional(v.string()),
    afgevinktDoor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const controle = await ctx.db.get(args.id);

    if (!controle) {
      throw new Error("Kwaliteitscontrole niet gevonden");
    }

    // Verify ownership via project
    await getOwnedProject(ctx, controle.projectId);

    const now = Date.now();

    // Update the specific checklist item
    const updatedItems = controle.checklistItems.map((item) => {
      if (item.id === args.itemId) {
        return {
          ...item,
          isAfgevinkt: args.isAfgevinkt,
          afgevinktAt: args.isAfgevinkt ? now : undefined,
          afgevinktDoor: args.isAfgevinkt ? args.afgevinktDoor : undefined,
          notities: args.notities !== undefined ? args.notities : item.notities,
        };
      }
      return item;
    });

    // Automatically update status based on progress
    let newStatus = controle.status;
    const checkedCount = updatedItems.filter((i) => i.isAfgevinkt).length;

    if (checkedCount > 0 && newStatus === "open") {
      newStatus = "in_uitvoering";
    }

    await ctx.db.patch(args.id, {
      checklistItems: updatedItems,
      status: newStatus,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Add a photo (before/after) to the QC check.
 */
export const addFoto = mutation({
  args: {
    id: v.id("kwaliteitsControles"),
    url: v.string(),
    type: v.union(v.literal("voor"), v.literal("na")),
    beschrijving: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const controle = await ctx.db.get(args.id);

    if (!controle) {
      throw new Error("Kwaliteitscontrole niet gevonden");
    }

    // Verify ownership via project
    await getOwnedProject(ctx, controle.projectId);

    const now = Date.now();

    const newFoto = {
      url: args.url,
      beschrijving: args.beschrijving,
      type: args.type,
      createdAt: now,
    };

    const existingFotos = controle.fotos || [];

    await ctx.db.patch(args.id, {
      fotos: [...existingFotos, newFoto],
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Remove a photo from the QC check.
 */
export const removeFoto = mutation({
  args: {
    id: v.id("kwaliteitsControles"),
    fotoUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const controle = await ctx.db.get(args.id);

    if (!controle) {
      throw new Error("Kwaliteitscontrole niet gevonden");
    }

    // Verify ownership via project
    await getOwnedProject(ctx, controle.projectId);

    const now = Date.now();

    const updatedFotos = (controle.fotos || []).filter(
      (foto) => foto.url !== args.fotoUrl
    );

    await ctx.db.patch(args.id, {
      fotos: updatedFotos,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Update the status of a QC check.
 */
export const updateStatus = mutation({
  args: {
    id: v.id("kwaliteitsControles"),
    status: v.union(
      v.literal("open"),
      v.literal("in_uitvoering"),
      v.literal("goedgekeurd"),
      v.literal("afgekeurd")
    ),
    opmerkingen: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const controle = await ctx.db.get(args.id);

    if (!controle) {
      throw new Error("Kwaliteitscontrole niet gevonden");
    }

    // Verify ownership via project
    await getOwnedProject(ctx, controle.projectId);

    const now = Date.now();

    const updates: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };

    if (args.opmerkingen !== undefined) {
      updates.opmerkingen = args.opmerkingen;
    }

    await ctx.db.patch(args.id, updates);

    return args.id;
  },
});

/**
 * Approve a QC check (with signature/name).
 */
export const approve = mutation({
  args: {
    id: v.id("kwaliteitsControles"),
    goedgekeurdDoor: v.string(),
    opmerkingen: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const controle = await ctx.db.get(args.id);

    if (!controle) {
      throw new Error("Kwaliteitscontrole niet gevonden");
    }

    // Verify ownership via project
    await getOwnedProject(ctx, controle.projectId);

    // Check if all items are checked
    const allChecked = controle.checklistItems.every((item) => item.isAfgevinkt);

    if (!allChecked) {
      throw new Error(
        "Niet alle checklist items zijn afgevinkt. Vink eerst alle items af voordat je goedkeurt."
      );
    }

    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: "goedgekeurd",
      goedgekeurdDoor: args.goedgekeurdDoor,
      goedgekeurdAt: now,
      opmerkingen: args.opmerkingen,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Reject a QC check (with reason).
 */
export const reject = mutation({
  args: {
    id: v.id("kwaliteitsControles"),
    reden: v.string(),
    afgekeurdDoor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const controle = await ctx.db.get(args.id);

    if (!controle) {
      throw new Error("Kwaliteitscontrole niet gevonden");
    }

    // Verify ownership via project
    await getOwnedProject(ctx, controle.projectId);

    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: "afgekeurd",
      opmerkingen: args.reden,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Add a custom checklist item to an existing QC check.
 */
export const addChecklistItem = mutation({
  args: {
    id: v.id("kwaliteitsControles"),
    omschrijving: v.string(),
  },
  handler: async (ctx, args) => {
    const controle = await ctx.db.get(args.id);

    if (!controle) {
      throw new Error("Kwaliteitscontrole niet gevonden");
    }

    // Verify ownership via project
    await getOwnedProject(ctx, controle.projectId);

    const now = Date.now();

    const newItem = {
      id: generateId(),
      omschrijving: args.omschrijving,
      isAfgevinkt: false,
    };

    await ctx.db.patch(args.id, {
      checklistItems: [...controle.checklistItems, newItem],
      updatedAt: now,
    });

    return newItem.id;
  },
});

/**
 * Remove a checklist item from a QC check.
 */
export const removeChecklistItem = mutation({
  args: {
    id: v.id("kwaliteitsControles"),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const controle = await ctx.db.get(args.id);

    if (!controle) {
      throw new Error("Kwaliteitscontrole niet gevonden");
    }

    // Verify ownership via project
    await getOwnedProject(ctx, controle.projectId);

    const now = Date.now();

    const updatedItems = controle.checklistItems.filter(
      (item) => item.id !== args.itemId
    );

    await ctx.db.patch(args.id, {
      checklistItems: updatedItems,
      updatedAt: now,
    });

    return args.id;
  },
});

/**
 * Delete a QC check.
 */
export const remove = mutation({
  args: { id: v.id("kwaliteitsControles") },
  handler: async (ctx, args) => {
    const controle = await ctx.db.get(args.id);

    if (!controle) {
      throw new Error("Kwaliteitscontrole niet gevonden");
    }

    // Verify ownership via project
    await getOwnedProject(ctx, controle.projectId);

    await ctx.db.delete(args.id);

    return args.id;
  },
});

/**
 * Get dashboard statistics for all QC checks (for admin dashboard widget).
 * Returns count of open checks and per-project breakdown.
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);

    // Get all QC checks for this user
    const controles = await ctx.db
      .query("kwaliteitsControles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Count open checks (open or in_uitvoering)
    const openChecks = controles.filter(
      (c) => c.status === "open" || c.status === "in_uitvoering"
    );

    // Group by project
    const perProject: Record<
      string,
      { projectId: Id<"projecten">; projectNaam: string; aantalOpen: number }
    > = {};

    for (const controle of openChecks) {
      const projectKey = controle.projectId.toString();
      if (!perProject[projectKey]) {
        const project = await ctx.db.get(controle.projectId);
        perProject[projectKey] = {
          projectId: controle.projectId,
          projectNaam: project?.naam || "Onbekend project",
          aantalOpen: 0,
        };
      }
      perProject[projectKey].aantalOpen++;
    }

    // Sort by aantalOpen descending
    const projecten = Object.values(perProject).sort(
      (a, b) => b.aantalOpen - a.aantalOpen
    );

    return {
      totaalOpen: openChecks.length,
      projecten,
      eersteProjectMetOpenCheck: projecten.length > 0 ? projecten[0].projectId : null,
    };
  },
});

/**
 * Get summary statistics for QC checks of a project.
 */
export const getProjectSummary = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    // Verify ownership of project
    await getOwnedProject(ctx, args.projectId);

    const controles = await ctx.db
      .query("kwaliteitsControles")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    const totaal = controles.length;
    const open = controles.filter((c) => c.status === "open").length;
    const inUitvoering = controles.filter(
      (c) => c.status === "in_uitvoering"
    ).length;
    const goedgekeurd = controles.filter(
      (c) => c.status === "goedgekeurd"
    ).length;
    const afgekeurd = controles.filter((c) => c.status === "afgekeurd").length;

    // Calculate overall progress
    let totaalItems = 0;
    let afgevinktItems = 0;

    for (const controle of controles) {
      totaalItems += controle.checklistItems.length;
      afgevinktItems += controle.checklistItems.filter(
        (i) => i.isAfgevinkt
      ).length;
    }

    const voortgangPercentage =
      totaalItems > 0 ? Math.round((afgevinktItems / totaalItems) * 100) : 0;

    return {
      totaal,
      open,
      inUitvoering,
      goedgekeurd,
      afgekeurd,
      totaalItems,
      afgevinktItems,
      voortgangPercentage,
      perScope: controles.map((c) => ({
        scope: c.scope,
        status: c.status,
        itemsAfgevinkt: c.checklistItems.filter((i) => i.isAfgevinkt).length,
        itemsTotaal: c.checklistItems.length,
      })),
    };
  },
});
