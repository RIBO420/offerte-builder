import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./auth";

// ============================================
// Queries
// ============================================

/**
 * Haal alle aanvragen op (authenticated, voor admin).
 * Gesorteerd op aanmaakdatum aflopend.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthUserId(ctx);
    return await ctx.db
      .query("configuratorAanvragen")
      .order("desc")
      .collect();
  },
});

/**
 * Haal aanvragen op gefilterd op status (authenticated, voor admin).
 */
export const listByStatus = query({
  args: {
    status: v.union(
      v.literal("nieuw"),
      v.literal("in_behandeling"),
      v.literal("goedgekeurd"),
      v.literal("afgekeurd"),
      v.literal("voltooid")
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);
    return await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .collect();
  },
});

/**
 * Haal een enkele aanvraag op via ID (authenticated).
 */
export const getById = query({
  args: { id: v.id("configuratorAanvragen") },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);
    return await ctx.db.get(args.id);
  },
});

/**
 * Zoek een aanvraag op referentienummer (public, voor klant).
 * Klanten kunnen hun eigen aanvraag opzoeken zonder in te loggen.
 */
export const getByReferentie = query({
  args: { referentie: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_referentie", (q) => q.eq("referentie", args.referentie))
      .unique();
  },
});

/**
 * Haal het aantal aanvragen per status op (authenticated, voor badges in navigatie).
 */
export const countByStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthUserId(ctx);
    const nieuw = await ctx.db
      .query("configuratorAanvragen")
      .withIndex("by_status", (q) => q.eq("status", "nieuw"))
      .collect();
    return nieuw.length;
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Maak een nieuwe aanvraag aan (public, geen authenticatie vereist).
 * Genereert automatisch een uniek referentienummer.
 */
export const create = mutation({
  args: {
    type: v.union(
      v.literal("gazon"),
      v.literal("boomschors"),
      v.literal("verticuteren")
    ),
    klantNaam: v.string(),
    klantEmail: v.string(),
    klantTelefoon: v.string(),
    klantAdres: v.string(),
    klantPostcode: v.string(),
    klantPlaats: v.string(),
    specificaties: v.any(),
    indicatiePrijs: v.number(),
  },
  handler: async (ctx, args) => {
    // Valideer verplichte velden
    if (!args.klantNaam.trim()) {
      throw new Error("Naam is verplicht");
    }
    if (!args.klantEmail.trim()) {
      throw new Error("E-mailadres is verplicht");
    }
    if (!args.klantTelefoon.trim()) {
      throw new Error("Telefoonnummer is verplicht");
    }
    if (!args.klantAdres.trim()) {
      throw new Error("Adres is verplicht");
    }
    if (!args.klantPostcode.trim()) {
      throw new Error("Postcode is verplicht");
    }
    if (!args.klantPlaats.trim()) {
      throw new Error("Plaats is verplicht");
    }
    if (args.indicatiePrijs < 0) {
      throw new Error("Indicatieprijs mag niet negatief zijn");
    }

    // Genereer uniek referentienummer: CFG-YYYYMMDD-XXXX
    const now = Date.now();
    const datum = new Date(now);
    const jaar = datum.getFullYear();
    const maand = String(datum.getMonth() + 1).padStart(2, "0");
    const dag = String(datum.getDate()).padStart(2, "0");
    const willekeurig = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const referentie = `CFG-${jaar}${maand}${dag}-${willekeurig}`;

    return await ctx.db.insert("configuratorAanvragen", {
      type: args.type,
      status: "nieuw",
      referentie,
      klantNaam: args.klantNaam.trim(),
      klantEmail: args.klantEmail.trim().toLowerCase(),
      klantTelefoon: args.klantTelefoon.trim(),
      klantAdres: args.klantAdres.trim(),
      klantPostcode: args.klantPostcode.trim().toUpperCase(),
      klantPlaats: args.klantPlaats.trim(),
      specificaties: args.specificaties,
      indicatiePrijs: args.indicatiePrijs,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Wijzig de status van een aanvraag (authenticated).
 */
export const updateStatus = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    status: v.union(
      v.literal("nieuw"),
      v.literal("in_behandeling"),
      v.literal("goedgekeurd"),
      v.literal("afgekeurd"),
      v.literal("voltooid")
    ),
    verificatieNotities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) {
      throw new Error("Aanvraag niet gevonden");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      verificatieNotities:
        args.verificatieNotities !== undefined
          ? args.verificatieNotities
          : aanvraag.verificatieNotities,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Wijs een aanvraag toe aan een medewerker (authenticated).
 */
export const toewijzen = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    toegewezenAan: v.id("users"),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) {
      throw new Error("Aanvraag niet gevonden");
    }

    // Controleer of de gebruiker bestaat
    const medewerker = await ctx.db.get(args.toegewezenAan);
    if (!medewerker) {
      throw new Error("Medewerker niet gevonden");
    }

    await ctx.db.patch(args.id, {
      toegewezenAan: args.toegewezenAan,
      // Zet automatisch op "in_behandeling" als de aanvraag nog "nieuw" is
      status: aanvraag.status === "nieuw" ? "in_behandeling" : aanvraag.status,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Voeg een verificatienotitie toe aan een aanvraag (authenticated).
 */
export const addNotitie = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    notitie: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) {
      throw new Error("Aanvraag niet gevonden");
    }

    if (!args.notitie.trim()) {
      throw new Error("Notitie mag niet leeg zijn");
    }

    await ctx.db.patch(args.id, {
      verificatieNotities: args.notitie.trim(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Stel de definitieve prijs in voor een aanvraag (authenticated).
 */
export const setPrijs = mutation({
  args: {
    id: v.id("configuratorAanvragen"),
    definitievePrijs: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuthUserId(ctx);

    const aanvraag = await ctx.db.get(args.id);
    if (!aanvraag) {
      throw new Error("Aanvraag niet gevonden");
    }

    if (args.definitievePrijs < 0) {
      throw new Error("Definitieve prijs mag niet negatief zijn");
    }

    await ctx.db.patch(args.id, {
      definitievePrijs: args.definitievePrijs,
      updatedAt: Date.now(),
    });
  },
});
