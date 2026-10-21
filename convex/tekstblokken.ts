/**
 * Tekstblokkenbibliotheek (PRD §2.5b, HERO-nabouw fase 2)
 *
 * "aanhef" heet in de UI Inleiding en "voorwaarden" Afsluiting: de tekst
 * boven en onder de regels van een document. Per documentsoort is één blok
 * per positie de standaard; die komt vanzelf op een nieuw document. De klant
 * beheert deze teksten zelf; placeholders → convex/lib/documentTekst.ts.
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
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOrgId } from "./auth";
import { requireKantoor, requireNotViewer } from "./roles";
import {
  DOCUMENT_SOORT_LABELS,
  onbekendePlaceholders,
  type DocumentSoort,
  type DocumentTeksten,
} from "./lib/documentTekst";
import { documentSoortValidator } from "./lib/documentTekstValidators";
import { STANDAARDTEKSTEN } from "./lib/standaardteksten";

// ─── Domeinconstanten (gedeeld met de UI) ────────────────────────────────────

export const TEKSTBLOK_CATEGORIEEN = [
  "aanhef",
  "voorwaarden",
  "standaardtekst",
  "email",
] as const;

export type TekstblokCategorie = (typeof TEKSTBLOK_CATEGORIEEN)[number];

export const TEKSTBLOK_CATEGORIE_LABELS: Record<TekstblokCategorie, string> = {
  aanhef: "Inleiding",
  voorwaarden: "Afsluiting",
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
  documentSoort?: DocumentSoort;
}

/** Categorieën die op een document komen en dus placeholders kennen. */
export function isDocumentTekst(categorie: string): boolean {
  return categorie === "aanhef" || categorie === "voorwaarden";
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
  if (isDocumentTekst(invoer.categorie)) {
    const onbekend = onbekendePlaceholders(invoer.inhoud, invoer.documentSoort);
    if (onbekend.length > 0) {
      const waar = invoer.documentSoort
        ? ` op een ${DOCUMENT_SOORT_LABELS[invoer.documentSoort].toLowerCase()}`
        : "";
      throw new ConvexError(
        `Onbekend veld${waar}: ${onbekend.map((o) => `{{${o}}}`).join(", ")}`
      );
    }
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Beheerlijst: alle blokken (ook inactieve), kantoor-only. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const blokken = await ctx.db
      .query("tekstblokken")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
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
    // Met soort: blokken van die soort plus de algemene (zonder soort)
    documentSoort: v.optional(documentSoortValidator),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);

    // by_categorie/by_actief zijn bedrijfsoverstijgend; de tenantgrens is
    // by_org, dus we filteren categorie/actief daarna in het geheugen — de
    // bibliotheek van één organisatie is klein.
    const eigen = await ctx.db
      .query("tekstblokken")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const blokken = eigen.filter(
      (b) =>
        b.actief &&
        (args.categorie ? b.categorie === args.categorie : true) &&
        (args.documentSoort
          ? b.documentSoort === undefined || b.documentSoort === args.documentSoort
          : true)
    );

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
    documentSoort: v.optional(documentSoortValidator),
    standaard: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    valideerTekstblok(args);
    assertStandaardMogelijk(args.categorie, args.documentSoort, args.standaard);

    // Zonder expliciete volgorde: achteraan in de categorie — binnen de eigen
    // organisatie, niet bedrijfsoverstijgend.
    let volgorde = args.volgorde;
    if (volgorde === undefined) {
      const inCategorie = (
        await ctx.db
          .query("tekstblokken")
          .withIndex("by_org", (q) => q.eq("orgId", orgId))
          .collect()
      ).filter((b) => b.categorie === args.categorie);
      volgorde =
        inCategorie.length === 0
          ? 0
          : Math.max(...inCategorie.map((b) => b.volgorde)) + 1;
    }

    const nu = Date.now();
    const id = await ctx.db.insert("tekstblokken", {
      orgId,
      naam: args.naam.trim(),
      categorie: args.categorie,
      inhoud: args.inhoud,
      documentSoort: args.documentSoort,
      standaard: args.standaard || undefined,
      actief: true,
      volgorde,
      createdAt: nu,
      updatedAt: nu,
    });
    if (args.standaard && args.documentSoort) {
      await maakEnigeStandaard(ctx, orgId, id, args.categorie, args.documentSoort);
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("tekstblokken"),
    naam: v.optional(v.string()),
    categorie: v.optional(categorieValidator),
    inhoud: v.optional(v.string()),
    volgorde: v.optional(v.number()),
    // null = voor alle soorten
    documentSoort: v.optional(v.union(documentSoortValidator, v.null())),
    standaard: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);

    const blok = await ctx.db.get(args.id);
    if (!blok || blok.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Tekstblok niet gevonden");
    }

    const categorie = args.categorie ?? blok.categorie;
    const documentSoort =
      args.documentSoort === null
        ? undefined
        : (args.documentSoort ?? blok.documentSoort);
    const standaard = args.standaard ?? blok.standaard ?? false;

    valideerTekstblok({
      naam: args.naam ?? blok.naam,
      categorie,
      inhoud: args.inhoud ?? blok.inhoud,
      volgorde: args.volgorde ?? blok.volgorde,
      documentSoort,
    });
    assertStandaardMogelijk(categorie, documentSoort, standaard);

    await ctx.db.patch(args.id, {
      ...(args.naam !== undefined ? { naam: args.naam.trim() } : {}),
      ...(args.categorie !== undefined ? { categorie: args.categorie } : {}),
      ...(args.inhoud !== undefined ? { inhoud: args.inhoud } : {}),
      ...(args.volgorde !== undefined ? { volgorde: args.volgorde } : {}),
      documentSoort,
      standaard: standaard || undefined,
      updatedAt: Date.now(),
    });
    if (standaard && documentSoort) {
      await maakEnigeStandaard(ctx, orgId, args.id, categorie, documentSoort);
    }
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
    const orgId = await requireOrgId(ctx);

    const blok = await ctx.db.get(args.id);
    if (!blok || blok.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Tekstblok niet gevonden");
    }

    await ctx.db.patch(args.id, {
      actief: args.actief,
      // Een uitgezet blok kan geen standaard meer zijn
      ...(args.actief ? {} : { standaard: undefined }),
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

// ─── Standaard per documentsoort ─────────────────────────────────────────────

function assertStandaardMogelijk(
  categorie: string,
  documentSoort: DocumentSoort | undefined,
  standaard: boolean | undefined
): void {
  if (!standaard) return;
  if (!isDocumentTekst(categorie)) {
    throw new ConvexError("Alleen een inleiding of afsluiting kan standaard zijn");
  }
  if (!documentSoort) {
    throw new ConvexError("Kies een documentsoort om dit blok standaard te maken");
  }
}

/** Zet `standaard` uit bij de andere blokken met dezelfde soort en positie. */
async function maakEnigeStandaard(
  ctx: MutationCtx,
  orgId: Id<"organisaties">,
  id: Id<"tekstblokken">,
  categorie: string,
  documentSoort: DocumentSoort
): Promise<void> {
  const eigen = await ctx.db
    .query("tekstblokken")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  for (const b of eigen) {
    if (
      b._id !== id &&
      b.standaard &&
      b.categorie === categorie &&
      b.documentSoort === documentSoort
    ) {
      await ctx.db.patch(b._id, { standaard: undefined, updatedAt: Date.now() });
    }
  }
}

/**
 * Standaard inleiding en afsluiting voor een nieuw document van deze soort
 * (met placeholders; vullen gebeurt bij het versturen). Geen standaard = leeg.
 */
export async function haalStandaardTeksten(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<"organisaties">,
  documentSoort: DocumentSoort
): Promise<DocumentTeksten> {
  const eigen = await ctx.db
    .query("tekstblokken")
    .withIndex("by_org", (q) => q.eq("orgId", orgId))
    .collect();
  const vind = (categorie: "aanhef" | "voorwaarden") =>
    eigen.find(
      (b) =>
        b.actief &&
        b.standaard &&
        b.categorie === categorie &&
        b.documentSoort === documentSoort
    )?.inhoud;
  return { inleiding: vind("aanhef"), afsluiting: vind("voorwaarden") };
}

/**
 * Laadt de startset (standaardteksten.md deel C). Voegt per soort en positie
 * alleen iets toe als daar nog geen actief blok staat; bestaande teksten van
 * de klant blijven altijd ongemoeid. Geeft het aantal toegevoegde blokken.
 */
export const laadStandaardteksten = mutation({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const eigen = await ctx.db
      .query("tekstblokken")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const nu = Date.now();
    let toegevoegd = 0;
    const toegevoegdeSoorten = new Set<string>();
    for (const [index, tekst] of STANDAARDTEKSTEN.entries()) {
      const categorie = tekst.positie === "inleiding" ? "aanhef" : "voorwaarden";
      // Standaard: alleen als er voor deze soort en positie nog niets staat.
      // Extra keuze (bv. prijsaanvraag): alleen als die naam er nog niet is.
      const bestaat =
        tekst.standaard === false
          ? eigen.some((b) => b.naam === tekst.naam && b.documentSoort === tekst.documentSoort)
          : eigen.some(
              (b) =>
                b.actief && b.categorie === categorie && b.documentSoort === tekst.documentSoort
            ) || toegevoegdeSoorten.has(`${categorie}|${tekst.documentSoort}`);
      if (bestaat) continue;
      if (tekst.standaard !== false) toegevoegdeSoorten.add(`${categorie}|${tekst.documentSoort}`);
      await ctx.db.insert("tekstblokken", {
        orgId,
        naam: tekst.naam,
        categorie,
        inhoud: tekst.inhoud,
        documentSoort: tekst.documentSoort,
        standaard: tekst.standaard === false ? undefined : true,
        actief: true,
        volgorde: index,
        createdAt: nu,
        updatedAt: nu,
      });
      toegevoegd += 1;
    }
    return { toegevoegd };
  },
});
