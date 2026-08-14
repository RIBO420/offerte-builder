import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { requireNotViewer } from "./roles";

/**
 * Pakketten ("standaardtuinen") zijn sjablonen waarmee je een offerte voorgevuld
 * begint. Er stonden zes hardgecodeerde pakketten in dit bestand die zichzelf
 * opnieuw aanmaakten zodra de lijst leeg was — met verzonnen oppervlaktes en
 * aantallen (50 m² gras, 3 bomen, 20 m schutting). Die vertekenden elke offerte
 * die er per ongeluk mee begon.
 *
 * Top Tuinen stelt zijn eigen pakketten samen. Tot die er zijn, begin je blanco;
 * alle scope-formulieren starten op 0. Het samenstellen zelf blijft gewoon
 * bestaan: `create` hieronder en "Opslaan als sjabloon" op een offerte.
 */

// List all templates (system + user) for authenticated user
export const list = query({
  args: {
    type: v.optional(v.union(v.literal("aanleg"), v.literal("onderhoud"))),
  },
  handler: async (ctx, { type }) => {
    const userId = await requireAuthUserId(ctx);

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

// Get a single template (systeemtemplate of eigen template)
export const get = query({
  args: { id: v.id("standaardtuinen") },
  handler: async (ctx, { id }) => {
    // Zelfde scoping als `list`: systeemtemplates (userId === undefined) zijn
    // voor elke ingelogde gebruiker zichtbaar, eigen templates alleen voor de
    // eigenaar. Zonder deze guard was elk template-id van elk bedrijf leesbaar
    // voor willekeurige (ook uitgelogde) aanroepers van dit publieke endpoint.
    const userId = await requireAuthUserId(ctx);

    const template = await ctx.db.get(id);
    if (!template) return null;

    // template.userId leeg => systeemtemplate, altijd toegestaan.
    // Een template van een ander bedrijf levert net als een onbekend id `null`
    // op — geen aparte foutmelding, want het verschil tussen "bestaat niet" en
    // "geen toegang" is zelf al een bestaans-orakel.
    if (template.userId && template.userId.toString() !== userId.toString()) {
      return null;
    }

    return template;
  },
});

// Create user template
export const create = mutation({
  args: {
    naam: v.string(),
    omschrijving: v.optional(v.string()),
    type: v.union(v.literal("aanleg"), v.literal("onderhoud")),
    scopes: v.array(v.string()),
    defaultWaarden: v.any(),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    return await ctx.db.insert("standaardtuinen", {
      userId,
      naam: args.naam,
      omschrijving: args.omschrijving,
      type: args.type,
      scopes: args.scopes,
      defaultWaarden: args.defaultWaarden,
    });
  },
});

// Update user template (with ownership verification)
export const update = mutation({
  args: {
    id: v.id("standaardtuinen"),
    naam: v.optional(v.string()),
    omschrijving: v.optional(v.string()),
    scopes: v.optional(v.array(v.string())),
    defaultWaarden: v.optional(v.any()),
  },
  handler: async (ctx, { id, ...updates }) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const template = await ctx.db.get(id);
    if (!template) throw new ConvexError("Template niet gevonden");
    if (!template.userId) throw new ConvexError("Systeemtemplates kunnen niet worden bewerkt");
    if (template.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot dit template");
    }

    const filteredUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    return await ctx.db.patch(id, filteredUpdates);
  },
});

// Delete user template (with ownership verification)
export const remove = mutation({
  args: { id: v.id("standaardtuinen") },
  handler: async (ctx, { id }) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    const template = await ctx.db.get(id);
    if (!template) throw new ConvexError("Template niet gevonden");
    if (!template.userId) throw new ConvexError("Systeemtemplates kunnen niet worden verwijderd");
    if (template.userId.toString() !== userId.toString()) {
      throw new ConvexError("Geen toegang tot dit template");
    }

    return await ctx.db.delete(id);
  },
});

// Create offerte from template
export const createOfferteFromTemplate = mutation({
  args: {
    templateId: v.id("standaardtuinen"),
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
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Dezelfde eigendomscheck als in `get`/`update`/`remove`. Zonder deze regel
    // omzeilde deze mutation de guard in `get` volledig: met alleen een
    // template-id kopieerde elke ingelogde niet-klant `scopes` en
    // `defaultWaarden` van een ander bedrijf in een offerte op zijn eigen naam,
    // en las die inhoud daarna gewoon via zijn eigen offerte-queries uit.
    // Beide foutpaden geven dezelfde melding: het verschil tussen "bestaat
    // niet" en "van iemand anders" is zelf al een bestaans-orakel.
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new ConvexError("Template niet gevonden");
    if (template.userId && template.userId.toString() !== userId.toString()) {
      throw new ConvexError("Template niet gevonden");
    }

    const now = Date.now();

    return await ctx.db.insert("offertes", {
      userId,
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
