import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all normuren for user
export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("normuren")
      .withIndex("by_user_scope", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// List normuren by scope
export const listByScope = query({
  args: {
    userId: v.id("users"),
    scope: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("normuren")
      .withIndex("by_user_scope", (q) =>
        q.eq("userId", args.userId).eq("scope", args.scope)
      )
      .collect();
  },
});

// Get single normuur
export const get = query({
  args: { id: v.id("normuren") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create normuur
export const create = mutation({
  args: {
    userId: v.id("users"),
    activiteit: v.string(),
    scope: v.string(),
    normuurPerEenheid: v.number(),
    eenheid: v.string(),
    omschrijving: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("normuren", {
      userId: args.userId,
      activiteit: args.activiteit,
      scope: args.scope,
      normuurPerEenheid: args.normuurPerEenheid,
      eenheid: args.eenheid,
      omschrijving: args.omschrijving,
    });
  },
});

// Update normuur
export const update = mutation({
  args: {
    id: v.id("normuren"),
    activiteit: v.optional(v.string()),
    scope: v.optional(v.string()),
    normuurPerEenheid: v.optional(v.number()),
    eenheid: v.optional(v.string()),
    omschrijving: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

// Delete normuur
export const remove = mutation({
  args: { id: v.id("normuren") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Create default normuren for new user
export const createDefaults = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const defaultNormuren = [
      // Grondwerk
      { activiteit: "Ontgraven licht", scope: "grondwerk", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Licht ontgraven tot 20cm diep" },
      { activiteit: "Ontgraven standaard", scope: "grondwerk", normuurPerEenheid: 0.25, eenheid: "m²", omschrijving: "Standaard ontgraven 20-40cm diep" },
      { activiteit: "Ontgraven zwaar", scope: "grondwerk", normuurPerEenheid: 0.4, eenheid: "m²", omschrijving: "Zwaar ontgraven >40cm diep" },
      { activiteit: "Grond afvoeren", scope: "grondwerk", normuurPerEenheid: 0.1, eenheid: "m³", omschrijving: "Laden en afvoeren grond" },

      // Bestrating
      { activiteit: "Tegels leggen", scope: "bestrating", normuurPerEenheid: 0.35, eenheid: "m²", omschrijving: "Leggen standaard tegels" },
      { activiteit: "Klinkers leggen", scope: "bestrating", normuurPerEenheid: 0.45, eenheid: "m²", omschrijving: "Leggen klinkers" },
      { activiteit: "Natuursteen leggen", scope: "bestrating", normuurPerEenheid: 0.55, eenheid: "m²", omschrijving: "Leggen natuursteen" },
      { activiteit: "Zandbed aanbrengen", scope: "bestrating", normuurPerEenheid: 0.1, eenheid: "m²", omschrijving: "Aanbrengen en egaliseren zandbed" },
      { activiteit: "Opsluitbanden plaatsen", scope: "bestrating", normuurPerEenheid: 0.25, eenheid: "m", omschrijving: "Plaatsen opsluitbanden" },

      // Borders
      { activiteit: "Grondbewerking border", scope: "borders", normuurPerEenheid: 0.2, eenheid: "m²", omschrijving: "Spitten en losmaken grond" },
      { activiteit: "Planten laag", scope: "borders", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Aanplanten lage intensiteit" },
      { activiteit: "Planten gemiddeld", scope: "borders", normuurPerEenheid: 0.25, eenheid: "m²", omschrijving: "Aanplanten gemiddelde intensiteit" },
      { activiteit: "Planten hoog", scope: "borders", normuurPerEenheid: 0.4, eenheid: "m²", omschrijving: "Aanplanten hoge intensiteit" },
      { activiteit: "Schors aanbrengen", scope: "borders", normuurPerEenheid: 0.08, eenheid: "m²", omschrijving: "Aanbrengen bodembedekking schors" },

      // Gras
      { activiteit: "Graszoden leggen", scope: "gras", normuurPerEenheid: 0.12, eenheid: "m²", omschrijving: "Leggen graszoden" },
      { activiteit: "Gras zaaien", scope: "gras", normuurPerEenheid: 0.05, eenheid: "m²", omschrijving: "Inzaaien gazon" },
      { activiteit: "Ondergrond bewerken", scope: "gras", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Voorbereiden ondergrond gazon" },

      // Houtwerk
      { activiteit: "Schutting plaatsen", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "m", omschrijving: "Plaatsen schutting per strekkende meter" },
      { activiteit: "Vlonder leggen", scope: "houtwerk", normuurPerEenheid: 0.6, eenheid: "m²", omschrijving: "Leggen vlonder" },
      { activiteit: "Pergola bouwen", scope: "houtwerk", normuurPerEenheid: 4.0, eenheid: "stuk", omschrijving: "Bouwen pergola" },
      { activiteit: "Fundering standaard", scope: "houtwerk", normuurPerEenheid: 0.5, eenheid: "stuk", omschrijving: "Plaatsen funderingspaal/voet standaard" },
      { activiteit: "Fundering zwaar", scope: "houtwerk", normuurPerEenheid: 0.8, eenheid: "stuk", omschrijving: "Plaatsen funderingspaal/voet zwaar" },

      // Water/Elektra
      { activiteit: "Sleuf graven", scope: "water_elektra", normuurPerEenheid: 0.3, eenheid: "m", omschrijving: "Graven kabelsleuven" },
      { activiteit: "Kabel leggen", scope: "water_elektra", normuurPerEenheid: 0.1, eenheid: "m", omschrijving: "Leggen bekabeling" },
      { activiteit: "Armatuur plaatsen", scope: "water_elektra", normuurPerEenheid: 0.5, eenheid: "stuk", omschrijving: "Plaatsen verlichtingsarmatuur" },
      { activiteit: "Sleuf herstellen", scope: "water_elektra", normuurPerEenheid: 0.2, eenheid: "m", omschrijving: "Dichten en herstellen sleuf" },

      // Onderhoud - Gras
      { activiteit: "Maaien", scope: "gras_onderhoud", normuurPerEenheid: 0.02, eenheid: "m²", omschrijving: "Gras maaien" },
      { activiteit: "Kanten steken", scope: "gras_onderhoud", normuurPerEenheid: 0.05, eenheid: "m", omschrijving: "Graskanten steken" },
      { activiteit: "Verticuteren", scope: "gras_onderhoud", normuurPerEenheid: 0.03, eenheid: "m²", omschrijving: "Gazon verticuteren" },

      // Onderhoud - Borders
      { activiteit: "Wieden weinig", scope: "borders_onderhoud", normuurPerEenheid: 0.08, eenheid: "m²", omschrijving: "Onkruid verwijderen - weinig intensief" },
      { activiteit: "Wieden gemiddeld", scope: "borders_onderhoud", normuurPerEenheid: 0.15, eenheid: "m²", omschrijving: "Onkruid verwijderen - gemiddeld intensief" },
      { activiteit: "Wieden veel", scope: "borders_onderhoud", normuurPerEenheid: 0.25, eenheid: "m²", omschrijving: "Onkruid verwijderen - intensief" },
      { activiteit: "Snoei licht", scope: "borders_onderhoud", normuurPerEenheid: 0.1, eenheid: "m²", omschrijving: "Lichte snoei in borders" },
      { activiteit: "Snoei zwaar", scope: "borders_onderhoud", normuurPerEenheid: 0.2, eenheid: "m²", omschrijving: "Zware snoei in borders" },

      // Onderhoud - Heggen
      { activiteit: "Heg snoeien", scope: "heggen_onderhoud", normuurPerEenheid: 0.15, eenheid: "m³", omschrijving: "Snoeien heg per m³ volume" },
      { activiteit: "Snoeisel afvoeren", scope: "heggen_onderhoud", normuurPerEenheid: 0.1, eenheid: "m³", omschrijving: "Afvoeren snoeisel" },

      // Onderhoud - Bomen
      { activiteit: "Boom snoeien licht", scope: "bomen_onderhoud", normuurPerEenheid: 0.5, eenheid: "stuk", omschrijving: "Lichte snoei boom" },
      { activiteit: "Boom snoeien zwaar", scope: "bomen_onderhoud", normuurPerEenheid: 1.5, eenheid: "stuk", omschrijving: "Zware snoei boom" },
    ];

    const insertedIds: string[] = [];
    for (const normuur of defaultNormuren) {
      const id = await ctx.db.insert("normuren", {
        userId: args.userId,
        ...normuur,
      });
      insertedIds.push(id);
    }

    return insertedIds.length;
  },
});
