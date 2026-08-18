/**
 * Bouwstenencatalogus (PRD §2.5f + bijlage A)
 *
 * Bedrijfsbrede catalogus van onderhoud-bouwstenen. De catalogus is data
 * (principe 2): een nieuwe bouwsteen toevoegen = record aanmaken, geen code.
 *
 * Alle CRUD-functies zijn kantoor-only (requireKantoor, PRD §2.5f).
 * Verwijderen = deactiveren (actief=false) — geen hard delete, zodat
 * historische documenten die naar een bouwsteen verwijzen intact blijven.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireOrgId } from "./auth";
import { requireKantoor } from "./roles";

// ─── Domeinconstanten (gedeeld met de UI) ────────────────────────────────────

export const BOUWSTEEN_CATEGORIEEN = [
  "gras_gazon",
  "borders_beplanting",
  "heggen_bomen",
  "bestrating_terras",
  "reiniging",
  "seizoen",
  "kosten_regels",
] as const;

export type BouwsteenCategorie = (typeof BOUWSTEEN_CATEGORIEEN)[number];

export const CATEGORIE_LABELS: Record<BouwsteenCategorie, string> = {
  gras_gazon: "Gras & Gazon",
  borders_beplanting: "Borders & Beplanting",
  heggen_bomen: "Heggen & Bomen",
  bestrating_terras: "Bestrating & Terras",
  reiniging: "Reiniging",
  seizoen: "Seizoen",
  kosten_regels: "Kosten & regels",
};

export const BOUWSTEEN_SOORTEN = [
  "terugkerend",
  "eenmalig",
  "op_afroep",
  "kostenregel",
  "keuzeregel",
  "bundel",
] as const;

export type BouwsteenSoort = (typeof BOUWSTEEN_SOORTEN)[number];

export const SOORT_LABELS: Record<BouwsteenSoort, string> = {
  terugkerend: "Terugkerend",
  eenmalig: "Eenmalig",
  op_afroep: "Op afroep",
  kostenregel: "Kostenregel",
  keuzeregel: "Keuzeregel",
  bundel: "Bundel",
};

// ─── Pure validatiehelpers (unit-testbaar zonder ctx) ────────────────────────

/** Normaliseer een bouwsteencode: trim + hoofdletters (bv. " hs " → "HS"). */
export function normaliseerCode(code: string): string {
  return code.trim().toUpperCase();
}

export interface BouwsteenInvoer {
  naam: string;
  code: string;
  defaultFrequentiePerJaar?: number;
  seizoensvensterVan?: number;
  seizoensvensterTot?: number;
  receptuurstappen?: { volgorde: number; omschrijving: string }[];
  normurenPerEenheid?: number;
  prijsmodel: "uren" | "vast";
  urenPerBeurt?: number;
  vastBedragPerBeurt?: number;
  optiePrijsVoegzand?: number;
  optiePrijsStraatzand?: number;
}

/**
 * Valideer bouwsteen-invoer. Gooit ConvexError met Nederlandse melding.
 * Prijzen/uren/frequenties mógen leeg zijn (Mickey vult ze in de app, §7.1) —
 * maar als ze zijn ingevuld, moeten ze geldig zijn.
 */
export function valideerBouwsteen(invoer: BouwsteenInvoer): void {
  if (!invoer.naam.trim()) {
    throw new ConvexError("Naam is verplicht");
  }
  const code = normaliseerCode(invoer.code);
  if (!/^[A-Z0-9]{1,6}$/.test(code)) {
    throw new ConvexError(
      "Code is verplicht: 1-6 letters of cijfers (bv. HS)"
    );
  }
  if (
    invoer.defaultFrequentiePerJaar !== undefined &&
    (invoer.defaultFrequentiePerJaar <= 0 ||
      !Number.isFinite(invoer.defaultFrequentiePerJaar))
  ) {
    throw new ConvexError("Frequentie per jaar moet groter dan 0 zijn");
  }
  const vensterDelen = [invoer.seizoensvensterVan, invoer.seizoensvensterTot];
  const ingevuld = vensterDelen.filter((m) => m !== undefined);
  if (ingevuld.length === 1) {
    throw new ConvexError(
      "Seizoensvenster: vul zowel van- als tot-maand in, of laat beide leeg"
    );
  }
  for (const maand of ingevuld) {
    if (!Number.isInteger(maand) || maand! < 1 || maand! > 12) {
      throw new ConvexError("Seizoensvenster: maand moet 1 t/m 12 zijn");
    }
  }
  if (invoer.receptuurstappen !== undefined) {
    if (invoer.receptuurstappen.length === 0) {
      throw new ConvexError(
        "Receptuur: voeg minimaal één stap toe of laat het veld leeg"
      );
    }
    for (const stap of invoer.receptuurstappen) {
      if (!stap.omschrijving.trim()) {
        throw new ConvexError("Receptuur: elke stap heeft een omschrijving nodig");
      }
      if (!Number.isInteger(stap.volgorde) || stap.volgorde < 1) {
        throw new ConvexError("Receptuur: volgorde moet 1 of hoger zijn");
      }
    }
  }
  if (
    invoer.normurenPerEenheid !== undefined &&
    (invoer.normurenPerEenheid <= 0 || !Number.isFinite(invoer.normurenPerEenheid))
  ) {
    throw new ConvexError("Normuren per eenheid moet groter dan 0 zijn");
  }
  if (
    invoer.urenPerBeurt !== undefined &&
    (invoer.urenPerBeurt <= 0 || !Number.isFinite(invoer.urenPerBeurt))
  ) {
    throw new ConvexError("Uren per beurt moet groter dan 0 zijn");
  }
  if (
    invoer.vastBedragPerBeurt !== undefined &&
    (invoer.vastBedragPerBeurt < 0 || !Number.isFinite(invoer.vastBedragPerBeurt))
  ) {
    throw new ConvexError("Vast bedrag per beurt kan niet negatief zijn");
  }
  for (const optiePrijs of [
    invoer.optiePrijsVoegzand,
    invoer.optiePrijsStraatzand,
  ]) {
    if (
      optiePrijs !== undefined &&
      (optiePrijs < 0 || !Number.isFinite(optiePrijs))
    ) {
      throw new ConvexError("Optieprijs kan niet negatief zijn");
    }
  }
}

/**
 * Prijsindicatie per beurt (leermodus, principe 6): bij prijsmodel "uren" is
 * dat uren × uurtarief; bij "vast" het vaste bedrag. Null = nog niet ingevuld.
 */
export function berekenPrijsPerBeurt(
  bouwsteen: {
    prijsmodel: "uren" | "vast";
    urenPerBeurt?: number;
    vastBedragPerBeurt?: number;
  },
  uurtarief: number
): number | null {
  if (bouwsteen.prijsmodel === "vast") {
    return bouwsteen.vastBedragPerBeurt ?? null;
  }
  if (bouwsteen.urenPerBeurt === undefined) return null;
  return bouwsteen.urenPerBeurt * uurtarief;
}

// ─── Gedeelde validators voor create/update ──────────────────────────────────

const categorieValidator = v.union(
  v.literal("gras_gazon"),
  v.literal("borders_beplanting"),
  v.literal("heggen_bomen"),
  v.literal("bestrating_terras"),
  v.literal("reiniging"),
  v.literal("seizoen"),
  v.literal("kosten_regels")
);

const soortValidator = v.union(
  v.literal("terugkerend"),
  v.literal("eenmalig"),
  v.literal("op_afroep"),
  v.literal("kostenregel"),
  v.literal("keuzeregel"),
  v.literal("bundel")
);

const receptuurValidator = v.array(
  v.object({
    volgorde: v.number(),
    omschrijving: v.string(),
  })
);

const bouwsteenVelden = {
  naam: v.string(),
  code: v.string(),
  categorie: categorieValidator,
  soort: soortValidator,
  defaultFrequentiePerJaar: v.optional(v.number()),
  seizoensvensterVan: v.optional(v.number()),
  seizoensvensterTot: v.optional(v.number()),
  receptuurstappen: v.optional(receptuurValidator),
  normurenPerEenheid: v.optional(v.number()),
  eenheid: v.optional(v.string()),
  prijsmodel: v.union(v.literal("uren"), v.literal("vast")),
  urenPerBeurt: v.optional(v.number()),
  vastBedragPerBeurt: v.optional(v.number()),
  // Keuzeregel-optieprijzen (bijlage A #17, zand): default prijs per optie;
  // de wizard gebruikt deze als voorzet i.p.v. het enkele prijsveld.
  optiePrijsVoegzand: v.optional(v.number()),
  optiePrijsStraatzand: v.optional(v.number()),
  btwCode: v.union(v.literal(9), v.literal(21)),
  opmerking: v.optional(v.string()),
  productIds: v.optional(v.array(v.id("producten"))),
  machineIds: v.optional(v.array(v.id("machines"))),
};

/**
 * Bouwsteen met deze code binnen de eigen organisatie.
 *
 * De by_code-index is bedrijfsoverstijgend, dus `.unique()` erop zou omvallen
 * zodra twee organisaties dezelfde code gebruiken (en dat mag: codes zijn per
 * catalogus uniek, niet per systeem). We halen daarom alle treffers op en
 * kiezen die van de eigen organisatie.
 */
async function vindBouwsteenMetCode(
  ctx: QueryCtx,
  orgId: Id<"organisaties">,
  code: string
): Promise<Doc<"bouwstenen"> | null> {
  const treffers = await ctx.db
    .query("bouwstenen")
    .withIndex("by_code", (q) => q.eq("code", code))
    .collect();
  return (
    treffers.find((b) => b.orgId?.toString() === orgId.toString()) ?? null
  );
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Volledige catalogus voor het beheerscherm (kantoor-only), inclusief
 * inactieve bouwstenen zodat kantoor ze kan heractiveren.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const bouwstenen = await ctx.db
      .query("bouwstenen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    // Sorteer op categorie (volgorde bijlage A) en daarbinnen op naam
    const categorieVolgorde = new Map(
      BOUWSTEEN_CATEGORIEEN.map((c, i) => [c, i] as const)
    );
    return bouwstenen.sort((a, b) => {
      const catDiff =
        (categorieVolgorde.get(a.categorie) ?? 99) -
        (categorieVolgorde.get(b.categorie) ?? 99);
      if (catDiff !== 0) return catDiff;
      return a.naam.localeCompare(b.naam, "nl");
    });
  },
});

/** Eén bouwsteen ophalen (kantoor-only, voor het bewerkformulier). */
export const getById = query({
  args: { id: v.id("bouwstenen") },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const bouwsteen = await ctx.db.get(args.id);
    if (!bouwsteen || bouwsteen.orgId?.toString() !== orgId.toString()) {
      return null;
    }
    return bouwsteen;
  },
});

// ─── Mutations (kantoor-only) ────────────────────────────────────────────────

/** Nieuwe bouwsteen aanmaken. Code wordt genormaliseerd en moet uniek zijn. */
export const create = mutation({
  args: bouwsteenVelden,
  handler: async (ctx, args): Promise<Id<"bouwstenen">> => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    valideerBouwsteen(args);

    const code = normaliseerCode(args.code);
    const bestaand = await vindBouwsteenMetCode(ctx, orgId, code);
    if (bestaand) {
      throw new ConvexError(
        `Code "${code}" is al in gebruik door "${bestaand.naam}"`
      );
    }

    const nu = Date.now();
    return await ctx.db.insert("bouwstenen", {
      ...args,
      orgId,
      naam: args.naam.trim(),
      code,
      actief: true,
      createdAt: nu,
      updatedAt: nu,
    });
  },
});

/** Bestaande bouwsteen bijwerken. */
export const update = mutation({
  args: {
    id: v.id("bouwstenen"),
    ...bouwsteenVelden,
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const { id, ...velden } = args;

    const huidige = await ctx.db.get(id);
    if (!huidige || huidige.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Bouwsteen niet gevonden");
    }

    valideerBouwsteen(velden);

    const code = normaliseerCode(velden.code);
    const bestaand = await vindBouwsteenMetCode(ctx, orgId, code);
    if (bestaand && bestaand._id !== id) {
      throw new ConvexError(
        `Code "${code}" is al in gebruik door "${bestaand.naam}"`
      );
    }

    // Expliciete patch zodat leeggemaakte optionele velden ook echt
    // verwijderd worden (undefined = veld wissen in Convex patch).
    await ctx.db.patch(id, {
      naam: velden.naam.trim(),
      code,
      categorie: velden.categorie,
      soort: velden.soort,
      defaultFrequentiePerJaar: velden.defaultFrequentiePerJaar,
      seizoensvensterVan: velden.seizoensvensterVan,
      seizoensvensterTot: velden.seizoensvensterTot,
      receptuurstappen: velden.receptuurstappen,
      normurenPerEenheid: velden.normurenPerEenheid,
      eenheid: velden.eenheid,
      prijsmodel: velden.prijsmodel,
      urenPerBeurt: velden.urenPerBeurt,
      vastBedragPerBeurt: velden.vastBedragPerBeurt,
      optiePrijsVoegzand: velden.optiePrijsVoegzand,
      optiePrijsStraatzand: velden.optiePrijsStraatzand,
      btwCode: velden.btwCode,
      opmerking: velden.opmerking,
      productIds: velden.productIds,
      machineIds: velden.machineIds,
      updatedAt: Date.now(),
    });
    return id;
  },
});

/**
 * Activeren/deactiveren. Deactiveren is het "verwijderen" van de catalogus
 * (PRD-principe: historie blijft intact, geen hard delete).
 */
export const setActief = mutation({
  args: {
    id: v.id("bouwstenen"),
    actief: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const bouwsteen = await ctx.db.get(args.id);
    if (!bouwsteen || bouwsteen.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Bouwsteen niet gevonden");
    }
    await ctx.db.patch(args.id, {
      actief: args.actief,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});
