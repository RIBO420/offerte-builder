import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId, requireAuth } from "./auth";

// Get voorcalculatie by ID
export const get = query({
  args: { id: v.id("voorcalculaties") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const voorcalculatie = await ctx.db.get(args.id);

    if (!voorcalculatie) return null;

    // Verify ownership through project or offerte
    if (voorcalculatie.projectId) {
      const project = await ctx.db.get(voorcalculatie.projectId);
      if (!project || project.userId.toString() !== userId.toString()) {
        return null;
      }
    } else if (voorcalculatie.offerteId) {
      const offerte = await ctx.db.get(voorcalculatie.offerteId);
      if (!offerte || offerte.userId.toString() !== userId.toString()) {
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
    const userId = await requireAuthUserId(ctx);

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId.toString() !== userId.toString()) {
      return null;
    }

    return await ctx.db
      .query("voorcalculaties")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .unique();
  },
});

// Get voorcalculatie by offerte ID
export const getByOfferte = query({
  args: { offerteId: v.id("offertes") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);

    // Verify offerte ownership
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte || offerte.userId.toString() !== userId.toString()) {
      return null;
    }

    return await ctx.db
      .query("voorcalculaties")
      .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
      .unique();
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
    const userId = await requireAuthUserId(ctx);

    // Validate that at least one of projectId or offerteId is provided
    if (!args.projectId && !args.offerteId) {
      throw new Error("projectId of offerteId is verplicht");
    }

    // Verify ownership based on what's provided
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId.toString() !== userId.toString()) {
        throw new Error("Project niet gevonden of geen toegang");
      }

      // Check if voorcalculatie already exists for project
      const existingByProject = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
        .unique();

      if (existingByProject) {
        throw new Error("Voorcalculatie bestaat al voor dit project");
      }
    }

    if (args.offerteId) {
      const offerte = await ctx.db.get(args.offerteId);
      if (!offerte || offerte.userId.toString() !== userId.toString()) {
        throw new Error("Offerte niet gevonden of geen toegang");
      }

      // Check if voorcalculatie already exists for offerte
      const existingByOfferte = await ctx.db
        .query("voorcalculaties")
        .withIndex("by_offerte", (q) => q.eq("offerteId", args.offerteId))
        .unique();

      if (existingByOfferte) {
        throw new Error("Voorcalculatie bestaat al voor deze offerte");
      }
    }

    const voorcalculatieId = await ctx.db.insert("voorcalculaties", {
      projectId: args.projectId,
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
    const userId = await requireAuthUserId(ctx);
    const voorcalculatie = await ctx.db.get(args.id);

    if (!voorcalculatie) {
      throw new Error("Voorcalculatie niet gevonden");
    }

    // Verify ownership through project or offerte
    let hasAccess = false;
    if (voorcalculatie.projectId) {
      const project = await ctx.db.get(voorcalculatie.projectId);
      if (project && project.userId.toString() === userId.toString()) {
        hasAccess = true;
      }
    }
    if (!hasAccess && voorcalculatie.offerteId) {
      const offerte = await ctx.db.get(voorcalculatie.offerteId);
      if (offerte && offerte.userId.toString() === userId.toString()) {
        hasAccess = true;
      }
    }
    if (!hasAccess) {
      throw new Error("Geen toegang tot deze voorcalculatie");
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

// Calculate normuren from offerte data
// This is a query that calculates hours based on offerte scopes
export const calculate = query({
  args: {
    offerteId: v.id("offertes"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const userId = user._id;

    // Get offerte
    const offerte = await ctx.db.get(args.offerteId);
    if (!offerte || offerte.userId.toString() !== userId.toString()) {
      throw new Error("Offerte niet gevonden of geen toegang");
    }

    // Get normuren for user
    const normuren = await ctx.db
      .query("normuren")
      .withIndex("by_user_scope", (q) => q.eq("userId", userId))
      .collect();

    // Get correctiefactoren
    const systemDefaults = await ctx.db
      .query("correctiefactoren")
      .filter((q) => q.eq(q.field("userId"), undefined))
      .collect();

    const userOverrides = await ctx.db
      .query("correctiefactoren")
      .withIndex("by_user_type", (q) => q.eq("userId", userId))
      .collect();

    // Merge factors
    const overrideMap = new Map(
      userOverrides.map((f) => [`${f.type}-${f.waarde}`, f])
    );
    const factoren = systemDefaults.map((f) => {
      const override = overrideMap.get(`${f.type}-${f.waarde}`);
      return override || f;
    });

    // Get correction factor by type and value
    const getFactor = (type: string, waarde: string): number => {
      const factor = factoren.find((f) => f.type === type && f.waarde === waarde);
      return factor?.factor ?? 1.0;
    };

    // Calculate normuren per scope based on offerte data
    const normUrenPerScope: Record<string, number> = {};
    const scopes = offerte.scopes || [];
    const scopeData = offerte.scopeData as Record<string, Record<string, unknown>> | undefined;

    // Get bereikbaarheid factor
    const bereikbaarheidFactor = getFactor("bereikbaarheid", offerte.algemeenParams.bereikbaarheid);

    // Get achterstalligheid factor if applicable
    const achterstallijkheidFactor = offerte.algemeenParams.achterstalligheid
      ? getFactor("achterstalligheid", offerte.algemeenParams.achterstalligheid)
      : 1.0;

    for (const scope of scopes) {
      const scopeNormuren = normuren.filter((n) => n.scope === scope);
      const data = scopeData?.[scope];

      let scopeUren = 0;

      // Calculate based on scope type
      switch (scope) {
        case "grondwerk": {
          const oppervlakte = (data?.oppervlakte as number) || 0;
          const diepte = (data?.diepte as string) || "standaard";
          const afvoerGrond = (data?.afvoerGrond as boolean) || false;

          const diepteFactor = getFactor("diepte", diepte);

          // Get normuur for ontgraven
          const ontgravenNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes("ontgraven")
          );
          scopeUren += oppervlakte * (ontgravenNormuur?.normuurPerEenheid || 0.25) * diepteFactor;

          // Add afvoer if needed
          if (afvoerGrond) {
            const afvoerNormuur = scopeNormuren.find((n) =>
              n.activiteit.toLowerCase().includes("afvoer")
            );
            // Estimate m3 from m2 * average depth factor
            const volume = oppervlakte * (diepte === "licht" ? 0.15 : diepte === "zwaar" ? 0.5 : 0.3);
            scopeUren += volume * (afvoerNormuur?.normuurPerEenheid || 0.1);
          }
          break;
        }

        case "bestrating": {
          const oppervlakte = (data?.oppervlakte as number) || 0;
          const typeBestrating = (data?.typeBestrating as string) || "tegel";
          const snijwerk = (data?.snijwerk as string) || "laag";

          const snijwerkFactor = getFactor("snijwerk", snijwerk);

          // Find matching normuur for type
          const bestratingNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes(typeBestrating)
          ) || scopeNormuren.find((n) => n.activiteit.toLowerCase().includes("leggen"));

          scopeUren += oppervlakte * (bestratingNormuur?.normuurPerEenheid || 0.4) * snijwerkFactor;

          // Add zandbed
          const zandbedNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes("zandbed")
          );
          scopeUren += oppervlakte * (zandbedNormuur?.normuurPerEenheid || 0.1);
          break;
        }

        case "borders": {
          const oppervlakte = (data?.oppervlakte as number) || 0;
          const intensiteit = (data?.beplantingsintensiteit as string) || "gemiddeld";

          const intensiteitFactor = getFactor("intensiteit", intensiteit);

          // Grondbewerking
          const grondNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes("grondbewerking")
          );
          scopeUren += oppervlakte * (grondNormuur?.normuurPerEenheid || 0.2);

          // Planten based on intensity
          const plantenNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes(intensiteit)
          ) || scopeNormuren.find((n) => n.activiteit.toLowerCase().includes("planten"));
          scopeUren += oppervlakte * (plantenNormuur?.normuurPerEenheid || 0.25) * intensiteitFactor;
          break;
        }

        case "gras": {
          const oppervlakte = (data?.oppervlakte as number) || 0;
          const type = (data?.type as string) || "graszoden";

          const grassNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes(type)
          );
          scopeUren += oppervlakte * (grassNormuur?.normuurPerEenheid || (type === "graszoden" ? 0.12 : 0.05));
          break;
        }

        case "houtwerk": {
          const afmeting = (data?.afmeting as number) || 0;
          const typeHoutwerk = (data?.typeHoutwerk as string) || "schutting";
          const fundering = (data?.fundering as string) || "standaard";

          const houtwerkNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes(typeHoutwerk)
          );
          scopeUren += afmeting * (houtwerkNormuur?.normuurPerEenheid || 0.8);

          // Add fundering (estimate 1 per 2m for schutting)
          const funderingNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes("fundering") &&
            n.activiteit.toLowerCase().includes(fundering)
          );
          const aantalPalen = typeHoutwerk === "schutting" ? Math.ceil(afmeting / 2) : 4;
          scopeUren += aantalPalen * (funderingNormuur?.normuurPerEenheid || 0.5);
          break;
        }

        case "water_elektra": {
          const aantalPunten = (data?.aantalPunten as number) || 0;
          const sleuvenNodig = (data?.sleuvenNodig as boolean) || false;

          // Armaturen plaatsen
          const armatuurNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes("armatuur")
          );
          scopeUren += aantalPunten * (armatuurNormuur?.normuurPerEenheid || 0.5);

          if (sleuvenNodig) {
            // Estimate 3m sleuf per punt
            const sleufNormuur = scopeNormuren.find((n) =>
              n.activiteit.toLowerCase().includes("sleuf graven")
            );
            scopeUren += (aantalPunten * 3) * (sleufNormuur?.normuurPerEenheid || 0.3);
          }
          break;
        }

        // Onderhoud scopes
        case "gras_onderhoud": {
          const oppervlakte = (data?.grasOppervlakte as number) || 0;
          const maaien = (data?.maaien as boolean) || false;

          if (maaien) {
            const maaienNormuur = scopeNormuren.find((n) =>
              n.activiteit.toLowerCase().includes("maaien")
            );
            scopeUren += oppervlakte * (maaienNormuur?.normuurPerEenheid || 0.02);
          }
          break;
        }

        case "borders_onderhoud": {
          const oppervlakte = (data?.borderOppervlakte as number) || 0;
          const intensiteit = (data?.onderhoudsintensiteit as string) || "gemiddeld";

          const wiedenNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes(intensiteit)
          ) || scopeNormuren.find((n) => n.activiteit.toLowerCase().includes("wieden"));

          scopeUren += oppervlakte * (wiedenNormuur?.normuurPerEenheid || 0.15);
          break;
        }

        case "heggen": {
          const lengte = (data?.lengte as number) || 0;
          const hoogte = (data?.hoogte as number) || 1;
          const breedte = (data?.breedte as number) || 0.5;

          // Calculate volume
          const volume = lengte * hoogte * breedte;

          const hegNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes("heg snoeien")
          );
          scopeUren += volume * (hegNormuur?.normuurPerEenheid || 0.15);
          break;
        }

        case "bomen": {
          const aantalBomen = (data?.aantalBomen as number) || 0;
          const snoei = (data?.snoei as string) || "licht";

          const boomNormuur = scopeNormuren.find((n) =>
            n.activiteit.toLowerCase().includes(snoei)
          ) || scopeNormuren.find((n) => n.activiteit.toLowerCase().includes("boom"));

          scopeUren += aantalBomen * (boomNormuur?.normuurPerEenheid || (snoei === "zwaar" ? 1.5 : 0.5));
          break;
        }

        default: {
          // For unknown scopes, estimate based on regels
          const scopeRegels = offerte.regels.filter((r) => r.scope === scope && r.type === "arbeid");
          for (const regel of scopeRegels) {
            scopeUren += regel.hoeveelheid; // Use hours from arbeid regels
          }
        }
      }

      // Apply bereikbaarheid and achterstalligheid factors
      scopeUren *= bereikbaarheidFactor * achterstallijkheidFactor;

      normUrenPerScope[scope] = Math.round(scopeUren * 100) / 100;
    }

    // Calculate total
    const normUrenTotaal = Object.values(normUrenPerScope).reduce((a, b) => a + b, 0);

    return {
      normUrenPerScope,
      normUrenTotaal: Math.round(normUrenTotaal * 100) / 100,
      bereikbaarheidFactor,
      achterstallijkheidFactor,
    };
  },
});

// Delete voorcalculatie
export const remove = mutation({
  args: { id: v.id("voorcalculaties") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const voorcalculatie = await ctx.db.get(args.id);

    if (!voorcalculatie) {
      throw new Error("Voorcalculatie niet gevonden");
    }

    // Verify ownership through project or offerte
    let hasAccess = false;
    if (voorcalculatie.projectId) {
      const project = await ctx.db.get(voorcalculatie.projectId);
      if (project && project.userId.toString() === userId.toString()) {
        hasAccess = true;
      }
    }
    if (!hasAccess && voorcalculatie.offerteId) {
      const offerte = await ctx.db.get(voorcalculatie.offerteId);
      if (offerte && offerte.userId.toString() === userId.toString()) {
        hasAccess = true;
      }
    }
    if (!hasAccess) {
      throw new Error("Geen toegang tot deze voorcalculatie");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
