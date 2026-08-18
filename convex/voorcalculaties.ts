import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOrgContext, requireOrgId } from "./auth";
import { requireNotViewer } from "./roles";
import { voorcalculatieVanProject, voorcalculatieVanOfferte } from "./lib/voorcalculatieLookup";
import { normurenUitRegels } from "./lib/normuren";

// Get voorcalculatie by ID
export const get = query({
  args: { id: v.id("voorcalculaties") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const voorcalculatie = await ctx.db.get(args.id);

    if (!voorcalculatie) return null;

    // Verify ownership through project or offerte
    if (voorcalculatie.projectId) {
      const project = await ctx.db.get(voorcalculatie.projectId);
      if (!project || project.orgId?.toString() !== orgId.toString()) {
        return null;
      }
    } else if (voorcalculatie.offerteId) {
      const offerte = await ctx.db.get(voorcalculatie.offerteId);
      if (!offerte || offerte.orgId?.toString() !== orgId.toString()) {
        return null;
      }
    } else {
      // No project or offerte linked - should not happen
      return null;
    }

    return voorcalculatie;
  },
});

// Get voorcalculatie by project ID
export const getByProject = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId?.toString() !== orgId.toString()) {
      return null;
    }

    return await voorcalculatieVanProject(ctx, args.projectId);
  },
});

// Get voorcalculatie by offerte ID
export const getByOfferte = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    // Verify offerte ownership
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte || offerte.orgId?.toString() !== orgId.toString()) {
      return null;
    }

    return await voorcalculatieVanOfferte(ctx, args.offerteId);
  },
});

// Create voorcalculatie for a project or offerte
export const create = mutation({
  args: {
    projectId: v.optional(v.id("projecten")),
    offerteId: v.optional(v.id("offertes")),
    teamGrootte: v.union(v.literal(2), v.literal(3), v.literal(4)),
    teamleden: v.optional(v.array(v.string())),
    effectieveUrenPerDag: v.number(),
    normUrenTotaal: v.number(),
    geschatteDagen: v.number(),
    normUrenPerScope: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const { org, user } = await requireOrgContext(ctx);

    // Validate that at least one of projectId or offerteId is provided
    if (!args.projectId && !args.offerteId) {
      throw new ConvexError("projectId of offerteId is verplicht");
    }

    // Verify ownership based on what's provided
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.orgId?.toString() !== org._id.toString()) {
        throw new ConvexError("Project niet gevonden of geen toegang");
      }

      // Check if voorcalculatie already exists for project
      const existingByProject = await voorcalculatieVanProject(ctx, args.projectId);

      if (existingByProject) {
        throw new ConvexError("Voorcalculatie bestaat al voor dit project");
      }
    }

    if (args.offerteId) {
      const offerte = await ctx.db.get(args.offerteId);
      if (!offerte || offerte.orgId?.toString() !== org._id.toString()) {
        throw new ConvexError("Offerte niet gevonden of geen toegang");
      }

      // Check if voorcalculatie already exists for offerte
      const existingByOfferte = await voorcalculatieVanOfferte(ctx, args.offerteId);

      if (existingByOfferte) {
        throw new ConvexError("Voorcalculatie bestaat al voor deze offerte");
      }
    }

    const voorcalculatieId = await ctx.db.insert("voorcalculaties", {
      projectId: args.projectId,
      // Tenant-scope (audit §2): project én offerte zijn hierboven op
      // eigenaarschap gecontroleerd tegen deze organisatie, dus die is de
      // tenant. `userId` schrijven we mee tot fase 6.
      orgId: org._id,
      userId: user._id,
      offerteId: args.offerteId,
      teamGrootte: args.teamGrootte,
      teamleden: args.teamleden,
      effectieveUrenPerDag: args.effectieveUrenPerDag,
      normUrenTotaal: args.normUrenTotaal,
      geschatteDagen: args.geschatteDagen,
      normUrenPerScope: args.normUrenPerScope,
      createdAt: Date.now(),
    });

    return voorcalculatieId;
  },
});

// Update voorcalculatie
export const update = mutation({
  args: {
    id: v.id("voorcalculaties"),
    teamGrootte: v.optional(v.union(v.literal(2), v.literal(3), v.literal(4))),
    teamleden: v.optional(v.array(v.string())),
    effectieveUrenPerDag: v.optional(v.number()),
    normUrenTotaal: v.optional(v.number()),
    geschatteDagen: v.optional(v.number()),
    normUrenPerScope: v.optional(v.record(v.string(), v.number())),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    const voorcalculatie = await ctx.db.get(args.id);

    if (!voorcalculatie) {
      throw new ConvexError("Voorcalculatie niet gevonden");
    }

    // Verify ownership through project or offerte
    let hasAccess = false;
    if (voorcalculatie.projectId) {
      const project = await ctx.db.get(voorcalculatie.projectId);
      if (project && project.orgId?.toString() === orgId.toString()) {
        hasAccess = true;
      }
    }
    if (!hasAccess && voorcalculatie.offerteId) {
      const offerte = await ctx.db.get(voorcalculatie.offerteId);
      if (offerte && offerte.orgId?.toString() === orgId.toString()) {
        hasAccess = true;
      }
    }
    if (!hasAccess) {
      throw new ConvexError("Geen toegang tot deze voorcalculatie");
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

/**
 * De normuren van een offerte.
 *
 * Rekent bewust niets zelf uit: de uren staan al als arbeidsregels op de
 * offerte (gezet door `calculateOfferteRegels`, inclusief bereikbaarheid,
 * achterstalligheid, snijwerk en diepte). Deze query telt ze alleen op via de
 * gedeelde normbron, zodat het werkblad en de voorcalculatie hetzelfde getal
 * tonen. De definitie staat in `convex/lib/normuren.ts`.
 *
 * De correctiefactoren komen mee als verantwoording — ze zijn al in de uren
 * verwerkt en worden hier dus niet nog eens toegepast.
 */
export const calculate = query({
  args: {
    offerteId: v.id("offertes"),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte || offerte.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Offerte niet gevonden of geen toegang");
    }

    // Correctiefactoren: systeemwaarden met de overrides van deze organisatie
    // eroverheen. Beide via de index — nooit een full table scan. De
    // systeemrijen hebben bewust géén userId (en dus ook geen orgId); die
    // undefined-match is hier de bedoeling (CLAUDE.md regel 4).
    const [systemDefaults, orgOverrides] = await Promise.all([
      ctx.db
        .query("correctiefactoren")
        .withIndex("by_user_type", (q) => q.eq("userId", undefined))
        .collect(),
      ctx.db
        .query("correctiefactoren")
        .withIndex("by_org_type", (q) => q.eq("orgId", orgId))
        .collect(),
    ]);

    const overrideMap = new Map(
      orgOverrides.map((f) => [`${f.type}-${f.waarde}`, f])
    );
    const factoren = systemDefaults.map((f) => {
      const override = overrideMap.get(`${f.type}-${f.waarde}`);
      return override || f;
    });

    const getFactor = (type: string, waarde: string): number => {
      const factor = factoren.find(
        (f) => f.type === type && f.waarde === waarde
      );
      return factor?.factor ?? 1.0;
    };

    const bereikbaarheidFactor = getFactor(
      "bereikbaarheid",
      offerte.algemeenParams.bereikbaarheid
    );
    const achterstallijkheidFactor = offerte.algemeenParams.achterstalligheid
      ? getFactor("achterstalligheid", offerte.algemeenParams.achterstalligheid)
      : 1.0;

    const { normUrenPerScope, normUrenTotaal } = normurenUitRegels(
      offerte.regels,
      offerte.scopes ?? []
    );

    return {
      normUrenPerScope,
      normUrenTotaal,
      bereikbaarheidFactor,
      achterstallijkheidFactor,
    };
  },
});

// Delete voorcalculatie
export const remove = mutation({
  args: { id: v.id("voorcalculaties") },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    const voorcalculatie = await ctx.db.get(args.id);

    if (!voorcalculatie) {
      throw new ConvexError("Voorcalculatie niet gevonden");
    }

    // Verify ownership through project or offerte
    let hasAccess = false;
    if (voorcalculatie.projectId) {
      const project = await ctx.db.get(voorcalculatie.projectId);
      if (project && project.orgId?.toString() === orgId.toString()) {
        hasAccess = true;
      }
    }
    if (!hasAccess && voorcalculatie.offerteId) {
      const offerte = await ctx.db.get(voorcalculatie.offerteId);
      if (offerte && offerte.orgId?.toString() === orgId.toString()) {
        hasAccess = true;
      }
    }
    if (!hasAccess) {
      throw new ConvexError("Geen toegang tot deze voorcalculatie");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
