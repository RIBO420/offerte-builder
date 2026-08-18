import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth, requireOrgId } from "./auth";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getLinkedMedewerker,
  isKantoorRol,
  requireNotViewer,
} from "./roles";

/**
 * Tenant-scope sinds fase 3 van de org-migratie: de organisatie uit het
 * Clerk-JWT (`requireOrgId`), niet meer de bedrijfseigenaar-user. Voor de
 * veld-rollen (voorman/medewerker) is dat precies hetzelfde zicht als
 * `getCompanyUserId` gaf; de rolfilters (isKantoorRol) blijven ongewijzigd.
 *
 * De OUDE uren-engine: `urenRegistraties` = decimale uren per project. Blijft
 * bewust ongemoeid naast `urenSegmenten` (PRD §8.10) — deze tabel voedt
 * nacalculatie, project-uren en de Excel-export (`export.exportUren`). De
 * Controlekamer (`convex/urenControle.ts`) leest UITSLUITEND de segmenten; de
 * twee bronnen worden nooit bij elkaar opgeteld (§6: geen twee waarheden).
 */

/**
 * Project ophalen binnen de eigen organisatie. `projecten.orgId` is optioneel
 * zolang de migratie loopt; een project zonder org hoort bij niemand.
 */
async function getProjectVanOrg(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projecten">,
  orgId: Id<"organisaties">
): Promise<Doc<"projecten">> {
  const project = await ctx.db.get(projectId);
  if (!project || project.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Project niet gevonden of geen toegang");
  }
  return project;
}

/**
 * List all time entries globally (for global Uren page).
 * Kantoor (directie én projectleider) ziet alle uren van het bedrijf — zelfde
 * eis als `export.exportUren`, dat ook op `requireKantoor` staat. Voorheen was
 * dit `role !== "directie"`, waardoor een projectleider in de lijst alleen zijn
 * eigen uren zag maar in de export van dezelfde pagina álles.
 * Andere rollen zien alleen hun eigen uren.
 * Supports optional date range filtering.
 */
export const listGlobal = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const orgId = await requireOrgId(ctx);

    // Get all projects for the organisatie to filter uren
    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    // Get all uren from all projects
    const urenPromises = projects.map((project) =>
      ctx.db
        .query("urenRegistraties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
    );

    const urenArrays = await Promise.all(urenPromises);
    let allUren = urenArrays.flat();

    // Filter by date range if provided
    if (args.startDate) {
      allUren = allUren.filter((u) => u.datum >= args.startDate!);
    }
    if (args.endDate) {
      allUren = allUren.filter((u) => u.datum <= args.endDate!);
    }

    // Filter by role — kantoor bedrijfsbreed, de rest alleen de eigen uren
    if (!isKantoorRol(user.role)) {
      const medewerker = await getLinkedMedewerker(ctx);
      if (!medewerker) return [];

      // Filter to only this medewerker's uren
      allUren = allUren.filter((u) => u.medewerker === medewerker.naam);
    }

    // Add project info to each uren entry
    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]));

    return allUren.map((u) => ({
      ...u,
      projectNaam: projectMap.get(u.projectId.toString())?.naam ?? "Onbekend project",
    }));
  },
});

// List all time entries for a project
export const list = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    await getProjectVanOrg(ctx, args.projectId, orgId);

    return await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
  },
});

// List entries by date range
export const listByDateRange = query({
  args: {
    projectId: v.id("projecten"),
    startDate: v.string(), // YYYY-MM-DD
    endDate: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    await getProjectVanOrg(ctx, args.projectId, orgId);

    const entries = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Filter by date range
    return entries.filter(
      (entry) => entry.datum >= args.startDate && entry.datum <= args.endDate
    );
  },
});

// Get totals per project/scope/medewerker
export const getTotals = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    await getProjectVanOrg(ctx, args.projectId, orgId);

    const entries = await ctx.db
      .query("urenRegistraties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Calculate totals
    const totaalUren = entries.reduce((sum, entry) => sum + entry.uren, 0);

    // Per medewerker
    const perMedewerker: Record<string, number> = {};
    entries.forEach((entry) => {
      perMedewerker[entry.medewerker] =
        (perMedewerker[entry.medewerker] || 0) + entry.uren;
    });

    // Per scope
    const perScope: Record<string, number> = {};
    entries.forEach((entry) => {
      if (entry.scope) {
        perScope[entry.scope] = (perScope[entry.scope] || 0) + entry.uren;
      }
    });

    // Per datum
    const perDatum: Record<string, number> = {};
    entries.forEach((entry) => {
      perDatum[entry.datum] = (perDatum[entry.datum] || 0) + entry.uren;
    });

    return {
      totaalUren,
      perMedewerker,
      perScope,
      perDatum,
      aantalRegistraties: entries.length,
    };
  },
});

// Add single entry manually
export const add = mutation({
  args: {
    projectId: v.id("projecten"),
    datum: v.string(), // YYYY-MM-DD
    medewerker: v.string(),
    uren: v.number(),
    taakId: v.optional(v.id("planningTaken")),
    scope: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    await getProjectVanOrg(ctx, args.projectId, orgId); // org-eigendom afdwingen

    return await ctx.db.insert("urenRegistraties", {
      projectId: args.projectId,
      // Tenant-scope: overgenomen van het project.
      orgId,
      datum: args.datum,
      medewerker: args.medewerker,
      uren: args.uren,
      taakId: args.taakId,
      scope: args.scope,
      notities: args.notities,
      bron: "handmatig",
    });
  },
});

// Import multiple time entries (batch)
export const importBatch = mutation({
  args: {
    projectId: v.id("projecten"),
    entries: v.array(
      v.object({
        datum: v.string(), // YYYY-MM-DD
        medewerker: v.string(),
        uren: v.number(),
        scope: v.optional(v.string()),
        notities: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    await getProjectVanOrg(ctx, args.projectId, orgId); // org-eigendom afdwingen

    const insertedIds: string[] = [];

    for (const entry of args.entries) {
      const id = await ctx.db.insert("urenRegistraties", {
        projectId: args.projectId,
        // Tenant-scope: zie `add` — het project is hierboven al op
        // org-eigendom gecontroleerd.
        orgId,
        datum: entry.datum,
        medewerker: entry.medewerker,
        uren: entry.uren,
        scope: entry.scope,
        notities: entry.notities,
        bron: "import",
      });
      insertedIds.push(id);
    }

    return {
      count: insertedIds.length,
      ids: insertedIds,
    };
  },
});

// Update entry
export const update = mutation({
  args: {
    id: v.id("urenRegistraties"),
    datum: v.optional(v.string()),
    medewerker: v.optional(v.string()),
    uren: v.optional(v.number()),
    taakId: v.optional(v.id("planningTaken")),
    scope: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);

    // Get entry and verify org-ownership through project
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new ConvexError("Registratie niet gevonden");
    }

    const project = await ctx.db.get(entry.projectId);
    if (!project || project.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Geen toegang tot deze registratie");
    }

    const { id, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(id, filteredUpdates);
    return id;
  },
});

// Delete entry
export const remove = mutation({
  args: { id: v.id("urenRegistraties") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);

    // Get entry and verify org-ownership through project
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new ConvexError("Registratie niet gevonden");
    }

    const project = await ctx.db.get(entry.projectId);
    if (!project || project.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Geen toegang tot deze registratie");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

/**
 * Get global hours summary statistics.
 * Returns totals for this week, this month, per project, and per medewerker.
 * Kantoor ziet bedrijfsbreed, andere rollen alleen hun eigen uren (zelfde
 * rolmodel als `listGlobal` en `export.exportUren`).
 *
 * PERIODE-BEWUST (uren-controlekamer-plan §3, opruimronde 4): `startDate`/
 * `endDate` begrenzen `urenTotaal`, `perProject`, `perMedewerker` en
 * `aantalRegistraties`, zodat de kop van de pagina niet langer all-time-cijfers
 * toont naast een gefilterde lijst. `urenDezeWeek`/`urenDezeMaand` blijven per
 * definitie hun eigen venster (deze week / deze maand) — dat is hun betekenis.
 * Zonder argumenten is het gedrag exact als voorheen.
 */
export const getGlobalStats = query({
  args: {
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const orgId = await requireOrgId(ctx);
    const linkedMedewerker = await getLinkedMedewerker(ctx);

    // Calculate date ranges
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Start of current week (Monday)
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMonday);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    // Start of current month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split("T")[0];

    // Get all projects for the organisatie
    const projects = await ctx.db
      .query("projecten")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const projectMap = new Map(projects.map((p) => [p._id.toString(), p]));

    // Get all uren from all projects
    const urenPromises = projects.map((project) =>
      ctx.db
        .query("urenRegistraties")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect()
    );

    const urenArrays = await Promise.all(urenPromises);
    let allUren = urenArrays.flat();

    // Filter by role — kantoor bedrijfsbreed, de rest alleen de eigen uren
    if (!isKantoorRol(user.role)) {
      if (!linkedMedewerker) {
        return {
          urenDezeWeek: 0,
          urenDezeMaand: 0,
          urenTotaal: 0,
          perProject: [],
          perMedewerker: [],
          aantalRegistraties: 0,
        };
      }
      allUren = allUren.filter((u) => u.medewerker === linkedMedewerker.naam);
    }

    // Weekcijfer en maandcijfer houden hun eigen venster; de rest volgt de
    // gekozen periode.
    const urenDezeWeek = allUren
      .filter((u) => u.datum >= weekStartStr && u.datum <= todayStr)
      .reduce((sum, u) => sum + u.uren, 0);

    const urenDezeMaand = allUren
      .filter((u) => u.datum >= monthStartStr && u.datum <= todayStr)
      .reduce((sum, u) => sum + u.uren, 0);

    // Gekozen periode: alles hieronder rekent over hetzelfde venster als de
    // lijst op de pagina, niet over de hele historie.
    const periodeUren = allUren.filter(
      (u) =>
        (!args.startDate || u.datum >= args.startDate) &&
        (!args.endDate || u.datum <= args.endDate)
    );

    const urenTotaal = periodeUren.reduce((sum, u) => sum + u.uren, 0);

    // Per project breakdown
    const perProjectMap: Record<string, number> = {};
    periodeUren.forEach((u) => {
      const key = u.projectId.toString();
      perProjectMap[key] = (perProjectMap[key] || 0) + u.uren;
    });
    const perProject = Object.entries(perProjectMap)
      .map(([projectId, uren]) => {
        const project = projectMap.get(projectId);
        return {
          projectId,
          projectNaam: project?.naam || "Onbekend",
          uren: Math.round(uren * 10) / 10,
        };
      })
      .sort((a, b) => b.uren - a.uren);

    // Per medewerker breakdown
    const perMedewerkerMap: Record<string, number> = {};
    periodeUren.forEach((u) => {
      perMedewerkerMap[u.medewerker] = (perMedewerkerMap[u.medewerker] || 0) + u.uren;
    });
    const perMedewerker = Object.entries(perMedewerkerMap)
      .map(([naam, uren]) => ({ naam, uren: Math.round(uren * 10) / 10 }))
      .sort((a, b) => b.uren - a.uren);

    return {
      urenDezeWeek: Math.round(urenDezeWeek * 10) / 10,
      urenDezeMaand: Math.round(urenDezeMaand * 10) / 10,
      urenTotaal: Math.round(urenTotaal * 10) / 10,
      perProject,
      perMedewerker,
      aantalRegistraties: periodeUren.length,
    };
  },
});
