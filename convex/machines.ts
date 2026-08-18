import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrg, requireOrgId, verifyOrgOwnership } from "./auth";
import { requireNotViewer } from "./roles";
import { laadDocsMap } from "./lib/batchLoad";
import { klantNaam } from "./lib/offerteKlant";

// Alle machines van de eigen organisatie
export const list = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    return await ctx.db
      .query("machines")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
  },
});

// Get single machine (with ownership verification)
export const get = query({
  args: { id: v.id("machines") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const machine = await ctx.db.get(args.id);

    if (!machine) return null;
    if (machine.orgId?.toString() !== orgId.toString()) {
      return null;
    }

    return machine;
  },
});

// Get machines linked to specific scopes
export const getByScopes = query({
  args: { scopes: v.array(v.string()) },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    // by_org_actief i.p.v. .filter (audit §5): de index selecteert de actieve
    // machines meteen, in plaats van alle machines lezen en daarna weggooien.
    const allMachines = await ctx.db
      .query("machines")
      .withIndex("by_org_actief", (q) =>
        q.eq("orgId", orgId).eq("isActief", true)
      )
      .collect();

    // Filter machines that have at least one matching scope
    return allMachines.filter((machine) =>
      machine.gekoppeldeScopes.some((scope) => args.scopes.includes(scope))
    );
  },
});

// Create machine for authenticated user
export const create = mutation({
  args: {
    naam: v.string(),
    type: v.union(v.literal("intern"), v.literal("extern")),
    tarief: v.number(),
    tariefType: v.union(v.literal("uur"), v.literal("dag")),
    gekoppeldeScopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);
    return await ctx.db.insert("machines", {
      orgId: org._id,
      naam: args.naam,
      type: args.type,
      tarief: args.tarief,
      tariefType: args.tariefType,
      gekoppeldeScopes: args.gekoppeldeScopes,
      isActief: true,
    });
  },
});

// Update machine (with ownership verification)
export const update = mutation({
  args: {
    id: v.id("machines"),
    naam: v.optional(v.string()),
    type: v.optional(v.union(v.literal("intern"), v.literal("extern"))),
    tarief: v.optional(v.number()),
    tariefType: v.optional(v.union(v.literal("uur"), v.literal("dag"))),
    gekoppeldeScopes: v.optional(v.array(v.string())),
    isActief: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    // Eigendom = zelfde organisatie
    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "machine");

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

// Delete machine (soft delete, with ownership verification)
export const remove = mutation({
  args: { id: v.id("machines") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "machine");

    await ctx.db.patch(args.id, {
      isActief: false,
    });
    return args.id;
  },
});

// Hard delete machine (with ownership verification)
export const hardDelete = mutation({
  args: { id: v.id("machines") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    await verifyOrgOwnership(ctx, await ctx.db.get(args.id), "machine");

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Get machine usage statistics for all machines
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);

    // Actieve machines van de organisatie — by_org_actief i.p.v. .filter (audit §5)
    const machines = await ctx.db
      .query("machines")
      .withIndex("by_org_actief", (q) =>
        q.eq("orgId", orgId).eq("isActief", true)
      )
      .collect();

    // Gebruiksregels per machine (geïndexeerd, parallel)
    const gebruikPerMachine = await Promise.all(
      machines.map((machine) =>
        ctx.db
          .query("machineGebruik")
          .withIndex("by_machine", (q) => q.eq("machineId", machine._id))
          .collect()
      )
    );

    // N+1 weg (audit §5): projecten en offertes één keer voor álle machines
    // ophalen. Dezelfde klus staat vaak bij meerdere machines in het gebruik,
    // en die haalde voorheen elk zijn eigen project + offerte op.
    const alleProjectIds = gebruikPerMachine.flatMap((usage) =>
      usage.map((u) => u.projectId)
    );
    const projectMap = await laadDocsMap(ctx, alleProjectIds);
    // offerteId is optioneel sinds werkitem-generalisatie
    const offerteMap = await laadDocsMap(
      ctx,
      [...projectMap.values()].map((p) => p.offerteId)
    );

    return machines.map((machine, i) => {
      const usage = gebruikPerMachine[i];

      // Get unique projects
      const projectIds = [...new Set(usage.map((u) => u.projectId))];
      const projects = projectIds.map((projectId) => {
        const project = projectMap.get(projectId.toString());
        if (!project) return null;
        const offerte = project.offerteId
          ? offerteMap.get(project.offerteId.toString())
          : null;
        return {
          _id: project._id,
          naam: project.naam,
          status: project.status,
          klantNaam: klantNaam(offerte?.klant, "Onbekend"),
        };
      });

      const totaalUren = usage.reduce((sum, u) => sum + u.uren, 0);
      const totaalKosten = usage.reduce((sum, u) => sum + u.kosten, 0);
      const aantalDagen = usage.length;

      return {
        ...machine,
        usage: {
          totaalUren,
          totaalKosten,
          aantalDagen,
          aantalProjecten: projectIds.length,
          projecten: projects.filter(Boolean),
        },
      };
    });
  },
});

// Create default machine templates for authenticated user (idempotent)
export const createDefaults = mutation({
  args: {},
  handler: async (ctx) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);

    // Idempotent: heeft deze organisatie al machines?
    const existing = await ctx.db
      .query("machines")
      .withIndex("by_org", (q) => q.eq("orgId", org._id))
      .first();

    if (existing) {
      return { message: "User already has machines", count: 0 };
    }

    const defaultMachines = [
      {
        naam: "Minikraan",
        type: "intern" as const,
        tarief: 150,
        tariefType: "dag" as const,
        gekoppeldeScopes: ["grondwerk"],
      },
      {
        naam: "Trilplaat",
        type: "intern" as const,
        tarief: 35,
        tariefType: "dag" as const,
        gekoppeldeScopes: ["bestrating", "grondwerk"],
      },
      {
        naam: "Hoogwerker",
        type: "extern" as const,
        tarief: 250,
        tariefType: "dag" as const,
        gekoppeldeScopes: ["bomen", "houtwerk"],
      },
      {
        naam: "Tuinfrees",
        type: "intern" as const,
        tarief: 25,
        tariefType: "dag" as const,
        gekoppeldeScopes: ["grondwerk", "gras"],
      },
      {
        naam: "Grasmaaier (groot)",
        type: "intern" as const,
        tarief: 15,
        tariefType: "uur" as const,
        gekoppeldeScopes: ["gras_onderhoud", "gras"],
      },
      {
        naam: "Heggenschaar (benzine)",
        type: "intern" as const,
        tarief: 20,
        tariefType: "dag" as const,
        gekoppeldeScopes: ["heggen"],
      },
    ];

    let count = 0;

    for (const machine of defaultMachines) {
      await ctx.db.insert("machines", {
        orgId: org._id,
        ...machine,
        isActief: true,
      });
      count++;
    }

    return { message: "Default machines created", count };
  },
});
