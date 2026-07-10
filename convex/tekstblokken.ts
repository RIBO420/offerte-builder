/**
 * Tekstblokkenbibliotheek (PRD §2.5b)
 *
 * Bedrijfsbrede bibliotheek van herbruikbare tekstblokken voor de vrije
 * offerte-builder: aanhef, voorwaarden, standaardteksten en e-mailteksten.
 * Inhoud is bewust PLATTE tekst zonder opmaak (principe 3: de huisstijl
 * zit in de template, niet in de tekst).
 *
 * Beheer (CRUD) is kantoor-only via requireKantoor; de builder leest
 * actieve blokken per categorie.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireKantoor, requireNotViewer } from "./roles";

// ─── Domeinconstanten (gedeeld met de UI) ────────────────────────────────────

export const TEKSTBLOK_CATEGORIEEN = [
  "aanhef",
  "voorwaarden",
  "standaardtekst",
  "email",
] as const;

export type TekstblokCategorie = (typeof TEKSTBLOK_CATEGORIEEN)[number];

export const TEKSTBLOK_CATEGORIE_LABELS: Record<TekstblokCategorie, string> = {
  aanhef: "Aanhef",
  voorwaarden: "Voorwaarden",
  standaardtekst: "Standaardtekst",
  email: "E-mail",
};

const categorieValidator = v.union(
  v.literal("aanhef"),
  v.literal("voorwaarden"),
  v.literal("standaardtekst"),
  v.literal("email")
);

// ─── Pure validatie ──────────────────────────────────────────────────────────

export interface TekstblokInvoer {
  naam: string;
  categorie: string;
  inhoud: string;
  volgorde?: number;
}

/**
 * Valideer tekstblok-invoer: naam en inhoud verplicht (platte tekst),
 * categorie moet bestaan, volgorde niet negatief.
 */
export function valideerTekstblok(invoer: TekstblokInvoer): void {
  if (invoer.naam.trim().length === 0) {
    throw new ConvexError("Naam is verplicht");
  }
  if (invoer.inhoud.trim().length === 0) {
    throw new ConvexError("Inhoud is verplicht");
  }
  if (
    !(TEKSTBLOK_CATEGORIEEN as readonly string[]).includes(invoer.categorie)
  ) {
    throw new ConvexError("Onbekende categorie");
  }
  if (invoer.volgorde !== undefined && invoer.volgorde < 0) {
    throw new ConvexError("Volgorde kan niet negatief zijn");
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Beheerlijst: alle blokken (ook inactieve), kantoor-only. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const blokken = await ctx.db.query("tekstblokken").collect();
    return blokken.sort(
      (a, b) =>
        a.categorie.localeCompare(b.categorie) || a.volgorde - b.volgorde
    );
  },
});

/**
 * Query voor de offerte-builder: actieve blokken, optioneel gefilterd op
 * categorie, gesorteerd op volgorde. Voor alle stafrollen (niet klant).
 */
export const actief = query({
  args: {
    categorie: v.optional(categorieValidator),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const blokken = args.categorie
      ? await ctx.db
          .query("tekstblokken")
          .withIndex("by_categorie", (q) =>
            q.eq("categorie", args.categorie!).eq("actief", true)
          )
          .collect()
      : (
          await ctx.db
            .query("tekstblokken")
            .withIndex("by_actief", (q) => q.eq("actief", true))
            .collect()
        ).sort((a, b) => a.categorie.localeCompare(b.categorie));

    return [...blokken].sort(
      (a, b) =>
        a.categorie.localeCompare(b.categorie) || a.volgorde - b.volgorde
    );
  },
});

// ─── Mutations (kantoor-only) ────────────────────────────────────────────────

export const create = mutation({
  args: {
    naam: v.string(),
    categorie: categorieValidator,
    inhoud: v.string(),
    volgorde: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    valideerTekstblok(args);

    // Zonder expliciete volgorde: achteraan in de categorie
    let volgorde = args.volgorde;
    if (volgorde === undefined) {
      const inCategorie = await ctx.db
        .query("tekstblokken")
        .withIndex("by_categorie", (q) => q.eq("categorie", args.categorie))
        .collect();
      volgorde =
        inCategorie.length === 0
          ? 0
          : Math.max(...inCategorie.map((b) => b.volgorde)) + 1;
    }

    const nu = Date.now();
    return await ctx.db.insert("tekstblokken", {
      naam: args.naam.trim(),
      categorie: args.categorie,
      inhoud: args.inhoud,
      actief: true,
      volgorde,
      createdAt: nu,
      updatedAt: nu,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("tekstblokken"),
    naam: v.optional(v.string()),
    categorie: v.optional(categorieValidator),
    inhoud: v.optional(v.string()),
    volgorde: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);

    const blok = await ctx.db.get(args.id);
    if (!blok) {
      throw new ConvexError("Tekstblok niet gevonden");
    }

    valideerTekstblok({
      naam: args.naam ?? blok.naam,
      categorie: args.categorie ?? blok.categorie,
      inhoud: args.inhoud ?? blok.inhoud,
      volgorde: args.volgorde ?? blok.volgorde,
    });

    await ctx.db.patch(args.id, {
      ...(args.naam !== undefined ? { naam: args.naam.trim() } : {}),
      ...(args.categorie !== undefined ? { categorie: args.categorie } : {}),
      ...(args.inhoud !== undefined ? { inhoud: args.inhoud } : {}),
      ...(args.volgorde !== undefined ? { volgorde: args.volgorde } : {}),
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

/** Verwijderen = deactiveren; heractiveren kan altijd (zelfde patroon als catalogus). */
export const setActief = mutation({
  args: {
    id: v.id("tekstblokken"),
    actief: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);

    const blok = await ctx.db.get(args.id);
    if (!blok) {
      throw new ConvexError("Tekstblok niet gevonden");
    }

    await ctx.db.patch(args.id, {
      actief: args.actief,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});
