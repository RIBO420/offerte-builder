import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { requireNotViewer } from "./roles";
import { reserveerOfferteNummer } from "./lib/offerteNummer";

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

/**
 * Offerte uit een sjabloon — de "Templates"-ingang van de offerte-entree.
 *
 * Alles wat niet strikt nodig is, is optioneel: `createOfferteFromTemplate({
 * templateId })` levert een concept met de scopes en defaultwaarden van het
 * sjabloon, zonder klant en met een server-side gereserveerd nummer. De klant
 * kan daarna met `offertes.koppelKlant` worden gekoppeld; vóór de eerste
 * statusovergang is hij verplicht (convex/lib/offerteKlant.ts).
 */
export const createOfferteFromTemplate = mutation({
  args: {
    templateId: v.id("standaardtuinen"),
    // Laat weg: dan reserveert deze mutation het nummer zelf (race-vrij).
    offerteNummer: v.optional(v.string()),
    // Optioneel bij concept — losse klantgegevens of een dossier-koppeling.
    klant: v.optional(
      v.object({
        naam: v.string(),
        adres: v.string(),
        postcode: v.string(),
        plaats: v.string(),
        email: v.optional(v.string()),
        telefoon: v.optional(v.string()),
      })
    ),
    klantId: v.optional(v.id("klanten")),
    bereikbaarheid: v.optional(
      v.union(v.literal("goed"), v.literal("beperkt"), v.literal("slecht"))
    ),
    achterstalligheid: v.optional(
      v.union(v.literal("laag"), v.literal("gemiddeld"), v.literal("hoog"))
    ),
    // TT-004 blijft: `type` komt uit het sjabloon, hier alleen de aanmaakroute.
    bron: v.optional(v.union(v.literal("wizard"), v.literal("vrij"))),
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

    // Klant uit het dossier wint van losse velden (zelfde regel als
    // offertes.create), zodat klantId en klantgegevens nooit uiteenlopen.
    let klant = args.klant;
    if (args.klantId) {
      const klantDoc = await ctx.db.get(args.klantId);
      if (klantDoc && klantDoc.userId.toString() === userId.toString()) {
        klant = klant ?? {
          naam: klantDoc.naam,
          adres: klantDoc.adres,
          postcode: klantDoc.postcode,
          plaats: klantDoc.plaats,
          email: klantDoc.email,
          telefoon: klantDoc.telefoon,
        };
      }
    }

    const offerteNummer =
      args.offerteNummer ?? (await reserveerOfferteNummer(ctx, userId));

    const totalen = {
      materiaalkosten: 0,
      arbeidskosten: 0,
      totaalUren: 0,
      subtotaal: 0,
      marge: 0,
      margePercentage: 0,
      totaalExBtw: 0,
      btw: 0,
      totaalInclBtw: 0,
    };

    const offerteId = await ctx.db.insert("offertes", {
      userId,
      type: template.type,
      status: "concept",
      // Sjabloon-offertes zijn scope-offertes: dezelfde bewerkroute als de
      // wizard (PRD §2.5b onderscheidt alleen wizard vs. vrij).
      bron: args.bron ?? "wizard",
      offerteNummer,
      klant,
      klantId: args.klantId,
      algemeenParams: {
        bereikbaarheid: args.bereikbaarheid ?? "goed",
        achterstalligheid: args.achterstalligheid,
      },
      scopes: template.scopes,
      scopeData: template.defaultWaarden,
      totalen,
      regels: [],
      createdAt: now,
      updatedAt: now,
    });

    // Versie 1, net als bij offertes.create — anders begint de historie van een
    // sjabloon-offerte pas bij haar eerste wijziging.
    await ctx.db.insert("offerte_versions", {
      offerteId,
      userId,
      versieNummer: 1,
      snapshot: {
        status: "concept",
        klant,
        algemeenParams: {
          bereikbaarheid: args.bereikbaarheid ?? "goed",
          achterstalligheid: args.achterstalligheid,
        },
        scopes: template.scopes,
        scopeData: template.defaultWaarden,
        totalen,
        regels: [],
      },
      actie: "aangemaakt",
      omschrijving: `Offerte ${offerteNummer} aangemaakt vanuit sjabloon "${template.naam}"`,
      createdAt: now,
    });

    return offerteId;
  },
});
