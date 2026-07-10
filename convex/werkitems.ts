/**
 * Werkitems — centrale abstractielaag over de fysieke tabel "projecten"
 * (PRD §1.1, B1-besluit optie C).
 *
 * De tabel "projecten" is dé werkitem-tabel: rijen met type "project" (aanleg)
 * of type "onderhoudsbeurt". Dit is de ENIGE module met werkitem-kennis:
 * type-invarianten, statusregels per type en generieke queries voor nieuwe
 * consumenten (planbord, wachtrij, facturatie-engine).
 *
 * LET OP (PRD §1.1): het woord "werkitem" is intern en verschijnt nooit in de
 * UI. UI-teksten: type "project" → "Project", type "onderhoudsbeurt" →
 * "Onderhoudsbeurt". Er bestaat bewust GEEN vrij notitieveld op het werkitem;
 * notities lopen via de klanttijdlijn (§2.3).
 */

import { v, ConvexError } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireAuthUserId } from "./auth";
import { requireKantoor, requireNotViewer } from "./roles";
import { Doc, Id } from "./_generated/dataModel";
import {
  addDagen,
  logPlanwijziging,
  seizoensvensterWaarschuwing,
  type Seizoensvenster,
} from "./planbordLogica";
import { logTijdlijnEvent } from "./tijdlijn";

// ============================================
// Types
// ============================================

export type WerkItemType = "project" | "onderhoudsbeurt";

/** Een werkitem is fysiek een rij in de tabel "projecten". */
export type WerkItem = Doc<"projecten">;

export type WerkItemStatus = WerkItem["status"];

/** Toegestane statussen per werkitem-type (B1-besluit, invariantentabel). */
const STATUSSEN_PER_TYPE: Record<WerkItemType, ReadonlyArray<WerkItemStatus>> = {
  project: [
    "voorcalculatie", // DEPRECATED legacy-status; alleen op bestaande rijen
    "gepland",
    "in_uitvoering",
    "afgerond",
    "nacalculatie_compleet",
    "gefactureerd",
  ],
  onderhoudsbeurt: ["gepland", "uitgevoerd", "gefactureerd", "vervallen"],
};

// ============================================
// Helpers (type-invarianten)
// ============================================

/**
 * Effectief type van een werkitem.
 * Semantiek tijdens migratie (B1 stap 1-2): undefined === "project".
 */
export function getType(werkitem: Pick<WerkItem, "type">): WerkItemType {
  return werkitem.type ?? "project";
}

/**
 * Dwingt af dat een status geldig is voor het werkitem-type.
 * Te gebruiken door ELKE status-mutation (B1-besluit).
 */
export function assertStatusVoorType(
  type: WerkItemType,
  status: WerkItemStatus
): void {
  if (!STATUSSEN_PER_TYPE[type].includes(status)) {
    const label = type === "project" ? "Project" : "Onderhoudsbeurt";
    throw new ConvexError(
      `Status "${status}" is niet toegestaan voor een ${label}. ` +
        `Toegestaan: ${STATUSSEN_PER_TYPE[type].join(", ")}.`
    );
  }
}

/**
 * Dwingt de veld-invarianten per type af (B1-besluit):
 * - contractId: alleen bij onderhoudsbeurten
 * - grondverzet-velden (ontgravenVolumeM3/mbaStatus/dsoReferentie): alleen bij projecten
 */
export function assertVeldenVoorType(
  type: WerkItemType,
  velden: {
    contractId?: Id<"onderhoudscontracten">;
    ontgravenVolumeM3?: number;
    mbaStatus?: string;
    dsoReferentie?: string;
  }
): void {
  if (type === "project" && velden.contractId !== undefined) {
    throw new ConvexError(
      "Een project kan niet aan een onderhoudscontract gekoppeld worden; " +
        "contractId is alleen toegestaan bij onderhoudsbeurten."
    );
  }
  if (
    type === "onderhoudsbeurt" &&
    (velden.ontgravenVolumeM3 !== undefined ||
      velden.mbaStatus !== undefined ||
      velden.dsoReferentie !== undefined)
  ) {
    throw new ConvexError(
      "Grondverzet-velden (ontgravenVolumeM3/mbaStatus/dsoReferentie) zijn " +
        "alleen toegestaan bij projecten."
    );
  }
}

/**
 * Adres van een werkitem: eigen adres wint, anders het klantadres (PRD §1.1:
 * default = klantadres, overschrijfbaar).
 */
export function resolveAdres(
  werkitem: Pick<WerkItem, "adres">,
  klant: Pick<Doc<"klanten">, "adres" | "postcode" | "plaats"> | null
): string | null {
  if (werkitem.adres) return werkitem.adres;
  if (!klant) return null;
  return `${klant.adres}, ${klant.postcode} ${klant.plaats}`;
}

/** Interne helper: werkitem ophalen + eigenaarschap verifiëren. */
async function getOwnedWerkitem(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  id: Id<"projecten">
): Promise<WerkItem> {
  const werkitem = await ctx.db.get(id);
  if (!werkitem || werkitem.deletedAt) {
    throw new ConvexError("Werkitem niet gevonden");
  }
  if (werkitem.userId.toString() !== userId.toString()) {
    throw new ConvexError("Je hebt geen toegang tot dit werkitem");
  }
  return werkitem;
}

// ============================================
// Queries
// ============================================

/** Eén werkitem op ID (met eigenaarschapscheck). */
export const getById = query({
  args: { id: v.id("projecten") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const werkitem = await ctx.db.get(args.id);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.userId.toString() !== userId.toString()
    ) {
      return null;
    }
    return werkitem;
  },
});

/**
 * Wachtrij voor het planbord (§2.2): geplande werkitems zonder geplandeStart.
 * Optioneel gefilterd op type.
 */
export const listVoorWachtrij = query({
  args: {
    type: v.optional(
      v.union(v.literal("project"), v.literal("onderhoudsbeurt"))
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const items = await ctx.db
      .query("projecten")
      .withIndex("by_user_geplandeStart", (q) =>
        q.eq("userId", userId).eq("geplandeStart", undefined)
      )
      .collect();
    return items.filter(
      (item) =>
        item.status === "gepland" &&
        !item.deletedAt &&
        item.isArchived !== true &&
        (args.type === undefined || getType(item) === args.type)
    );
  },
});

/**
 * Maximale duur (dagen) van een meerdaags werkitem waar het planbord
 * rekening mee houdt bij overlap-detectie aan de linkerrand van het venster.
 */
const MAX_MEERDAAGS_DAGEN = 62;

/**
 * Werkitems die overlappen met een datumrange voor het planbord (§2.2).
 * Ook meerdaagse items die vóór `start` beginnen maar in de range doorlopen
 * worden meegenomen. Datums als YYYY-MM-DD (lexicografisch sorteerbaar).
 */
export const listVoorPlanbord = query({
  args: {
    start: v.string(), // YYYY-MM-DD (inclusief)
    eind: v.string(), // YYYY-MM-DD (inclusief)
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const items = await ctx.db
      .query("projecten")
      .withIndex("by_user_geplandeStart", (q) =>
        q
          .eq("userId", userId)
          .gte("geplandeStart", addDagen(args.start, -MAX_MEERDAAGS_DAGEN))
          .lte("geplandeStart", args.eind)
      )
      .collect();
    return items.filter(
      (item) =>
        !item.deletedAt &&
        item.isArchived !== true &&
        // Overlap met [start..eind]: eind van het item (of de startdag zelf)
        // moet op of na de vensterstart liggen
        (item.geplandeEind ?? item.geplandeStart ?? "") >= args.start
    );
  },
});

// ============================================
// Mutations
// ============================================

/**
 * Generieke werkitem-create (B1-besluit).
 * klantId is verplicht voor ALLE nieuwe werkitems (PRD §1.1), ook al blijft
 * het veld in het schema optioneel zolang er legacy-rijen zonder klant bestaan.
 * Bestaande project-flows blijven via projecten.create lopen; deze mutation is
 * het fundament voor de beurtengenerator (§2.1) en losse beurten.
 */
export const createWerkitem = mutation({
  args: {
    type: v.union(v.literal("project"), v.literal("onderhoudsbeurt")),
    klantId: v.id("klanten"),
    naam: v.string(),
    offerteId: v.optional(v.id("offertes")),
    // Koppel-dialoog route 2 (PRD §2.5): toegewezen offerte-regel-id's
    offerteRegelIds: v.optional(v.array(v.string())),
    contractId: v.optional(v.id("onderhoudscontracten")),
    geplandeStart: v.optional(v.string()), // YYYY-MM-DD
    geplandeEind: v.optional(v.string()), // YYYY-MM-DD
    teamId: v.optional(v.id("teams")),
    geschatteUren: v.optional(v.number()),
    adres: v.optional(v.string()),
    // Grondverzet (alleen type "project")
    ontgravenVolumeM3: v.optional(v.number()),
    mbaStatus: v.optional(v.string()),
    dsoReferentie: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);

    // Type-invarianten (schema kan dit niet conditioneel afdwingen)
    assertVeldenVoorType(args.type, args);

    // Klant moet bestaan en van deze gebruiker zijn
    const klant = await ctx.db.get(args.klantId);
    if (!klant || klant.userId.toString() !== userId.toString()) {
      throw new ConvexError("Klant niet gevonden");
    }

    // Gekoppelde entiteiten verifiëren (eigenaarschap)
    if (args.offerteId) {
      const offerte = await ctx.db.get(args.offerteId);
      if (!offerte || offerte.userId.toString() !== userId.toString()) {
        throw new ConvexError("Offerte niet gevonden");
      }
    }
    if (args.contractId) {
      const contract = await ctx.db.get(args.contractId);
      if (!contract || contract.userId.toString() !== userId.toString()) {
        throw new ConvexError("Onderhoudscontract niet gevonden");
      }
    }

    const now = Date.now();
    return await ctx.db.insert("projecten", {
      userId,
      type: args.type,
      klantId: args.klantId,
      naam: args.naam,
      status: "gepland",
      offerteId: args.offerteId,
      offerteRegelIds: args.offerteRegelIds,
      contractId: args.contractId,
      geplandeStart: args.geplandeStart,
      geplandeEind: args.geplandeEind,
      teamId: args.teamId,
      geschatteUren: args.geschatteUren,
      adres: args.adres,
      ontgravenVolumeM3: args.ontgravenVolumeM3,
      mbaStatus: args.mbaStatus,
      dsoReferentie: args.dsoReferentie,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Seizoensvenster van een werkitem (voor de bewaking van §2.2):
 * - losse beurt: venster uit het eigen ritme;
 * - gegenereerde contractbeurt: venster van de contract-werkzaamheid;
 * - projecten/overig: geen venster.
 * Geëxporteerd voor hergebruik door convex/planbord.ts (dupliceren/splitsen).
 */
export async function seizoensvensterVoorWerkitem(
  ctx: QueryCtx | MutationCtx,
  werkitem: Pick<WerkItem, "ritme" | "contractWerkzaamheidId">
): Promise<Seizoensvenster | null> {
  if (
    werkitem.ritme &&
    (werkitem.ritme.vensterVanMaand !== undefined ||
      werkitem.ritme.vensterTotMaand !== undefined)
  ) {
    return werkitem.ritme;
  }
  if (werkitem.contractWerkzaamheidId) {
    const werkzaamheid = await ctx.db.get(werkitem.contractWerkzaamheidId);
    if (
      werkzaamheid &&
      (werkzaamheid.vensterVanMaand !== undefined ||
        werkzaamheid.vensterTotMaand !== undefined)
    ) {
      return {
        vensterVanMaand: werkzaamheid.vensterVanMaand,
        vensterTotMaand: werkzaamheid.vensterTotMaand,
      };
    }
  }
  return null;
}

/**
 * Planning van een werkitem zetten/wijzigen (planbord §2.2, ENIGE schrijfpad
 * van het weekbord): teamId + geplandeStart/geplandeEind + volgordeBinnenDag +
 * geplande tijden. `null` wist een veld; ontplannen (geplandeStart: null) wist
 * automatisch ook volgorde en tijden (terug in de bak).
 *
 * Rolcheck: alleen kantoor plant (PRD §2.2: kantoor plant, voorman leest).
 * Logt een audit-event (wie/wat/wanneer) in planbordLogboek en geeft naast
 * het id een eventuele seizoensvenster-WAARSCHUWING terug (geen blokkade).
 */
export const updatePlanning = mutation({
  args: {
    id: v.id("projecten"),
    geplandeStart: v.optional(v.union(v.string(), v.null())),
    geplandeEind: v.optional(v.union(v.string(), v.null())),
    teamId: v.optional(v.union(v.id("teams"), v.null())),
    volgordeBinnenDag: v.optional(v.union(v.number(), v.null())),
    geplandeStartTijd: v.optional(v.union(v.string(), v.null())), // HH:MM
    geplandeEindTijd: v.optional(v.union(v.string(), v.null())), // HH:MM
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const userId = await requireAuthUserId(ctx);
    const werkitem = await getOwnedWerkitem(ctx, userId, args.id);

    if (
      args.geplandeStart &&
      args.geplandeEind &&
      args.geplandeEind < args.geplandeStart
    ) {
      throw new ConvexError("Geplande einddatum ligt vóór de startdatum");
    }

    let teamNaam: string | null = null;
    if (args.teamId) {
      const team = await ctx.db.get(args.teamId);
      if (!team || team.userId.toString() !== userId.toString()) {
        throw new ConvexError("Team niet gevonden");
      }
      teamNaam = team.naam;
    }

    const patch: Partial<WerkItem> = { updatedAt: Date.now() };
    if (args.geplandeStart !== undefined) {
      patch.geplandeStart = args.geplandeStart ?? undefined;
    }
    if (args.geplandeEind !== undefined) {
      patch.geplandeEind = args.geplandeEind ?? undefined;
    }
    if (args.teamId !== undefined) {
      patch.teamId = args.teamId ?? undefined;
    }
    if (args.volgordeBinnenDag !== undefined) {
      patch.volgordeBinnenDag = args.volgordeBinnenDag ?? undefined;
    }
    if (args.geplandeStartTijd !== undefined) {
      patch.geplandeStartTijd = args.geplandeStartTijd ?? undefined;
    }
    if (args.geplandeEindTijd !== undefined) {
      patch.geplandeEindTijd = args.geplandeEindTijd ?? undefined;
    }

    const wasGepland = werkitem.geplandeStart !== undefined;
    const nieuweStart =
      args.geplandeStart === undefined
        ? werkitem.geplandeStart
        : (args.geplandeStart ?? undefined);

    // Ontplannen wist ook volgorde en tijden (het item gaat terug in de bak)
    if (wasGepland && nieuweStart === undefined) {
      patch.volgordeBinnenDag = undefined;
      patch.geplandeStartTijd = undefined;
      patch.geplandeEindTijd = undefined;
    }

    await ctx.db.patch(werkitem._id, patch);

    // — Audit-event (PRD §2.2: audit-logging hoort meteen bij het bord) —
    const doelTeam =
      args.teamId === undefined
        ? undefined
        : (teamNaam ?? "geen team");
    let actie: Doc<"planbordLogboek">["actie"];
    let details: string;
    if (!wasGepland && nieuweStart !== undefined) {
      actie = "gepland";
      details = `Ingepland: ${doelTeam ?? "geen team"}, ${nieuweStart}`;
    } else if (wasGepland && nieuweStart === undefined) {
      actie = "ontpland";
      details = `Uit de planning gehaald (terug in de bak), was ${werkitem.geplandeStart}`;
    } else if (
      args.geplandeStart === undefined &&
      args.geplandeEind !== undefined &&
      args.teamId === undefined
    ) {
      actie = "duur_aangepast";
      details = `Duur aangepast: t/m ${args.geplandeEind ?? "eind gewist"}`;
    } else {
      actie = "verplaatst";
      details = `Planning gewijzigd: ${nieuweStart ?? "-"}${doelTeam ? `, ${doelTeam}` : ""}`;
    }
    await logPlanwijziging(ctx, {
      userId,
      door: kantoorUser._id,
      actie,
      details: `${werkitem.naam} — ${details}`,
      werkitemId: werkitem._id,
      teamId: args.teamId ?? werkitem.teamId ?? undefined,
    });

    // — Klanttijdlijn (PRD §2.3): "Ingepland: team X, datum" — naast (niet
    // in plaats van) het planbordLogboek. Alleen het inplannen zelf is
    // klantdossier-relevant; interne verschuivingen blijven planbord-audit.
    // Additief en niet-blokkerend (logTijdlijnEvent vangt fouten zelf af).
    if (actie === "gepland" && werkitem.klantId) {
      await logTijdlijnEvent(ctx, {
        userId,
        klantId: werkitem.klantId,
        eventType: "werkitem_ingepland",
        werkitemId: werkitem._id,
        auteurId: kantoorUser._id,
        auteurNaam: kantoorUser.name,
        tekst: `${werkitem.naam} — ${details}`,
      });
    }

    // — Seizoensvenster-bewaking: waarschuwing, geen blokkade —
    const venster = await seizoensvensterVoorWerkitem(ctx, werkitem);
    const waarschuwing = seizoensvensterWaarschuwing(
      venster,
      nieuweStart,
      werkitem.naam
    );

    return { id: werkitem._id, waarschuwing };
  },
});

/**
 * Statuswijziging met type-invariant (assertStatusVoorType).
 * Bestaande project-statusflows (met KLIC-check e.d.) blijven via
 * projecten.updateStatus lopen; deze mutation is voor beurt-statussen
 * (gepland → uitgevoerd → gefactureerd / vervallen).
 */
export const updateStatus = mutation({
  args: {
    id: v.id("projecten"),
    status: v.union(
      v.literal("gepland"),
      v.literal("in_uitvoering"),
      v.literal("afgerond"),
      v.literal("nacalculatie_compleet"),
      v.literal("gefactureerd"),
      v.literal("uitgevoerd"),
      v.literal("vervallen")
    ),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const userId = await requireAuthUserId(ctx);
    const werkitem = await getOwnedWerkitem(ctx, userId, args.id);

    assertStatusVoorType(getType(werkitem), args.status);

    await ctx.db.patch(werkitem._id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return werkitem._id;
  },
});
