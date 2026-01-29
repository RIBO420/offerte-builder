import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// System default templates
const SYSTEM_TEMPLATES = {
  aanleg: [
    {
      naam: "Kleine stadstuin",
      omschrijving: "Compacte tuin tot 50m² met bestrating, borders en gazon",
      scopes: ["grondwerk", "bestrating", "borders", "gras"],
      defaultWaarden: {
        grondwerk: {
          oppervlakte: 40,
          diepte: "licht",
          afvoerGrond: true,
        },
        bestrating: {
          oppervlakte: 15,
          typeBestrating: "tegel",
          snijwerk: "gemiddeld",
          onderbouw: {
            type: "zandbed",
            dikteOnderlaag: 5,
            opsluitbanden: true,
          },
        },
        borders: {
          oppervlakte: 10,
          beplantingsintensiteit: "gemiddeld",
          bodemverbetering: true,
          afwerking: "schors",
        },
        gras: {
          oppervlakte: 15,
          type: "graszoden",
          ondergrond: "nieuw",
          afwateringNodig: false,
        },
      },
    },
    {
      naam: "Middelgrote familietuin",
      omschrijving: "Gezinstuin 100-150m² met terras, gazon, borders en schutting",
      scopes: ["grondwerk", "bestrating", "borders", "gras", "houtwerk"],
      defaultWaarden: {
        grondwerk: {
          oppervlakte: 120,
          diepte: "standaard",
          afvoerGrond: true,
        },
        bestrating: {
          oppervlakte: 35,
          typeBestrating: "klinker",
          snijwerk: "gemiddeld",
          onderbouw: {
            type: "zand_fundering",
            dikteOnderlaag: 10,
            opsluitbanden: true,
          },
        },
        borders: {
          oppervlakte: 25,
          beplantingsintensiteit: "gemiddeld",
          bodemverbetering: true,
          afwerking: "schors",
        },
        gras: {
          oppervlakte: 50,
          type: "graszoden",
          ondergrond: "nieuw",
          afwateringNodig: false,
        },
        houtwerk: {
          typeHoutwerk: "schutting",
          afmeting: 20,
          fundering: "standaard",
        },
      },
    },
    {
      naam: "Luxe tuin met verlichting",
      omschrijving: "Ruime tuin 200m²+ met alle voorzieningen incl. verlichting",
      scopes: ["grondwerk", "bestrating", "borders", "gras", "houtwerk", "water_elektra"],
      defaultWaarden: {
        grondwerk: {
          oppervlakte: 180,
          diepte: "standaard",
          afvoerGrond: true,
        },
        bestrating: {
          oppervlakte: 60,
          typeBestrating: "natuursteen",
          snijwerk: "hoog",
          onderbouw: {
            type: "zand_fundering",
            dikteOnderlaag: 15,
            opsluitbanden: true,
          },
        },
        borders: {
          oppervlakte: 40,
          beplantingsintensiteit: "veel",
          bodemverbetering: true,
          afwerking: "grind",
        },
        gras: {
          oppervlakte: 60,
          type: "graszoden",
          ondergrond: "nieuw",
          afwateringNodig: true,
        },
        houtwerk: {
          typeHoutwerk: "vlonder",
          afmeting: 20,
          fundering: "zwaar",
        },
        water_elektra: {
          verlichting: "uitgebreid",
          aantalPunten: 4,
          sleuvenNodig: true,
        },
      },
    },
  ],
  onderhoud: [
    {
      naam: "Basis tuinonderhoud",
      omschrijving: "Standaard onderhoud: gras maaien, borders wieden",
      scopes: ["gras", "borders"],
      defaultWaarden: {
        gras: {
          grasAanwezig: true,
          grasOppervlakte: 50,
          maaien: true,
          kantenSteken: true,
          verticuteren: false,
          afvoerGras: false,
        },
        borders: {
          borderOppervlakte: 20,
          onderhoudsintensiteit: "gemiddeld",
          onkruidVerwijderen: true,
          snoeiInBorders: "licht",
          bodem: "bedekt",
          afvoerGroenafval: false,
        },
      },
    },
    {
      naam: "Compleet tuinonderhoud",
      omschrijving: "Volledig onderhoud incl. heggen en bomen",
      scopes: ["gras", "borders", "heggen", "bomen"],
      defaultWaarden: {
        gras: {
          grasAanwezig: true,
          grasOppervlakte: 80,
          maaien: true,
          kantenSteken: true,
          verticuteren: true,
          afvoerGras: true,
        },
        borders: {
          borderOppervlakte: 30,
          onderhoudsintensiteit: "veel",
          onkruidVerwijderen: true,
          snoeiInBorders: "zwaar",
          bodem: "open",
          afvoerGroenafval: true,
        },
        heggen: {
          lengte: 15,
          hoogte: 1.8,
          breedte: 0.6,
          snoei: "beide",
          afvoerSnoeisel: true,
        },
        bomen: {
          aantalBomen: 3,
          snoei: "licht",
          hoogteklasse: "middel",
          afvoer: true,
        },
      },
    },
    {
      naam: "Uitgebreid tuinonderhoud",
      omschrijving: "Alles inclusief overige werkzaamheden",
      scopes: ["gras", "borders", "heggen", "bomen", "overig"],
      defaultWaarden: {
        gras: {
          grasAanwezig: true,
          grasOppervlakte: 100,
          maaien: true,
          kantenSteken: true,
          verticuteren: true,
          afvoerGras: true,
        },
        borders: {
          borderOppervlakte: 40,
          onderhoudsintensiteit: "veel",
          onkruidVerwijderen: true,
          snoeiInBorders: "zwaar",
          bodem: "open",
          afvoerGroenafval: true,
        },
        heggen: {
          lengte: 25,
          hoogte: 2,
          breedte: 0.8,
          snoei: "beide",
          afvoerSnoeisel: true,
        },
        bomen: {
          aantalBomen: 5,
          snoei: "licht",
          hoogteklasse: "middel",
          afvoer: true,
        },
        overig: {
          bladruimen: true,
          terrasReinigen: true,
          terrasOppervlakte: 30,
          onkruidBestrating: true,
          bestratingOppervlakte: 40,
          afwateringControleren: true,
          aantalAfwateringspunten: 3,
        },
      },
    },
  ],
};

// Initialize system templates if they don't exist
export const initializeSystemTemplates = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if system templates exist
    const existing = await ctx.db
      .query("standaardtuinen")
      .filter((q) => q.eq(q.field("userId"), undefined))
      .collect();

    if (existing.length > 0) {
      return { created: 0, message: "System templates already exist" };
    }

    // Create aanleg templates
    for (const template of SYSTEM_TEMPLATES.aanleg) {
      await ctx.db.insert("standaardtuinen", {
        userId: undefined,
        naam: template.naam,
        omschrijving: template.omschrijving,
        type: "aanleg",
        scopes: template.scopes,
        defaultWaarden: template.defaultWaarden,
      });
    }

    // Create onderhoud templates
    for (const template of SYSTEM_TEMPLATES.onderhoud) {
      await ctx.db.insert("standaardtuinen", {
        userId: undefined,
        naam: template.naam,
        omschrijving: template.omschrijving,
        type: "onderhoud",
        scopes: template.scopes,
        defaultWaarden: template.defaultWaarden,
      });
    }

    return {
      created: SYSTEM_TEMPLATES.aanleg.length + SYSTEM_TEMPLATES.onderhoud.length,
      message: "System templates created",
    };
  },
});

// List all templates (system + user)
export const list = query({
  args: {
    userId: v.id("users"),
    type: v.optional(v.union(v.literal("aanleg"), v.literal("onderhoud"))),
  },
  handler: async (ctx, { userId, type }) => {
    // Get system templates
    let systemQuery = ctx.db
      .query("standaardtuinen")
      .filter((q) => q.eq(q.field("userId"), undefined));

    if (type) {
      systemQuery = systemQuery.filter((q) => q.eq(q.field("type"), type));
    }

    const systemTemplates = await systemQuery.collect();

    // Get user templates
    let userQuery = ctx.db
      .query("standaardtuinen")
      .withIndex("by_user", (q) => q.eq("userId", userId));

    if (type) {
      userQuery = userQuery.filter((q) => q.eq(q.field("type"), type));
    }

    const userTemplates = await userQuery.collect();

    // Mark templates with isSystem flag
    return [
      ...systemTemplates.map((t) => ({ ...t, isSystem: true })),
      ...userTemplates.map((t) => ({ ...t, isSystem: false })),
    ];
  },
});

// Get a single template
export const get = query({
  args: { id: v.id("standaardtuinen") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

// Create user template
export const create = mutation({
  args: {
    userId: v.id("users"),
    naam: v.string(),
    omschrijving: v.optional(v.string()),
    type: v.union(v.literal("aanleg"), v.literal("onderhoud")),
    scopes: v.array(v.string()),
    defaultWaarden: v.any(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("standaardtuinen", args);
  },
});

// Update user template
export const update = mutation({
  args: {
    id: v.id("standaardtuinen"),
    naam: v.optional(v.string()),
    omschrijving: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    defaultWaarden: v.optional(v.any()),
  },
  handler: async (ctx, { id, ...updates }) => {
    const template = await ctx.db.get(id);
    if (!template) throw new Error("Template not found");
    if (!template.userId) throw new Error("Cannot edit system templates");

    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    return await ctx.db.patch(id, filteredUpdates);
  },
});

// Delete user template
export const remove = mutation({
  args: { id: v.id("standaardtuinen") },
  handler: async (ctx, { id }) => {
    const template = await ctx.db.get(id);
    if (!template) throw new Error("Template not found");
    if (!template.userId) throw new Error("Cannot delete system templates");

    return await ctx.db.delete(id);
  },
});

// Create offerte from template
export const createOfferteFromTemplate = mutation({
  args: {
    templateId: v.id("standaardtuinen"),
    userId: v.id("users"),
    offerteNummer: v.string(),
    klant: v.object({
      naam: v.string(),
      adres: v.string(),
      postcode: v.string(),
      plaats: v.string(),
      email: v.optional(v.string()),
      telefoon: v.optional(v.string()),
    }),
    bereikbaarheid: v.union(
      v.literal("goed"),
      v.literal("beperkt"),
      v.literal("slecht")
    ),
    achterstalligheid: v.optional(
      v.union(v.literal("laag"), v.literal("gemiddeld"), v.literal("hoog"))
    ),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found");

    const now = Date.now();

    return await ctx.db.insert("offertes", {
      userId: args.userId,
      type: template.type,
      status: "concept",
      offerteNummer: args.offerteNummer,
      klant: args.klant,
      algemeenParams: {
        bereikbaarheid: args.bereikbaarheid,
        achterstalligheid: args.achterstalligheid,
      },
      scopes: template.scopes,
      scopeData: template.defaultWaarden,
      totalen: {
        materiaalkosten: 0,
        arbeidskosten: 0,
        totaalUren: 0,
        subtotaal: 0,
        marge: 0,
        margePercentage: 0,
        totaalExBtw: 0,
        btw: 0,
        totaalInclBtw: 0,
      },
      regels: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});
