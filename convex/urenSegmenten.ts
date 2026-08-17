/**
 * Urensegmenten + dag indienen/heropenen + "Wie is achter" — veld-rol
 * (PRD §2.6 + bijlage C, fase 1 stap 9a; §8.5 rolchecks, §8.10 voorinvulling).
 *
 * Kernprincipes:
 * - Een werkdag per medewerker bestaat uit segmenten (categorie, begin/eind,
 *   optioneel werkitem). Urenregistratie kan op ELK werkitem (beurten incl.);
 *   de bestaande project-uren (urenRegistraties + exportUren) blijven
 *   ongemoeid ernaast bestaan.
 * - Voorinvulling (§8.10): de dagkaart-blokken van het team van de medewerker
 *   worden voorgestelde segmenten — AFGELEID tot bevestigd, geen dubbele
 *   opslag van de planning (zelfde pipeline als convex/dagkaart.ts).
 * - Dag indienen zet de dag op slot; alleen kantoor heropent/corrigeert,
 *   met audit-log in urenLogboek (wie/wat/wanneer).
 * - Rolchecks (§8.5): medewerker/voorman alleen de eigen dag; kantoor alles.
 */

import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./auth";
import {
  CANONIEKE_ROL_MAPPING,
  getCompanyUserId,
  getLinkedMedewerker,
  normalizeRole,
} from "./roles";
import {
  dagkaartStandaardenVoor,
  reistijdenUitCache,
  werkitemsVoorTeamDag,
} from "./dagkaart";
import {
  adresParenVoorDag,
  berekenDagkaart,
  stopDuurMinuten,
  type KlantStop,
} from "./dagkaartLogica";
import { werkitemOpDag } from "./planbordLogica";
import { getType, type WerkItem } from "./werkitems";
import {
  beoordeelBezoek,
  blokkenNaarVoorstellen,
  DEFAULT_AFWIJKING_DREMPELS,
  filterVoorstellen,
  isGeldigSegmentTijdvak,
  magDagHeropenen,
  magDagVanMedewerker,
  magUrenLoggen,
  overlapt,
  segmentMinuten,
  type AfwijkingDrempels,
  type VeldRol,
} from "./veldLogica";
import { logTijdlijnEvent } from "./tijdlijn";

// ============================================
// Gedeelde helpers
// ============================================

const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

export const segmentCategorieValidator = v.union(
  v.literal("werken"),
  v.literal("pauze"),
  v.literal("reistijd"),
  v.literal("teammeeting"),
  v.literal("onderhoud_materiaal"),
  v.literal("afvalverwerker_bes"),
  v.literal("anders")
);

export interface VeldContext {
  user: Doc<"users">;
  rol: VeldRol;
  companyUserId: Id<"users">;
  eigenMedewerker: Doc<"medewerkers"> | null;
}

/**
 * Auth + canonieke rol + bedrijfsscope + gekoppelde medewerker in één keer.
 * Geëxporteerd voor hergebruik door convex/urenControle.ts — de Controlekamer
 * moet exact dezelfde kantoor-/rolchecks doen als de veld-flows hieronder.
 */
export async function veldContext(
  ctx: QueryCtx | MutationCtx
): Promise<VeldContext> {
  const user = await requireAuth(ctx);
  const rol = CANONIEKE_ROL_MAPPING[normalizeRole(user.role)];
  const companyUserId = await getCompanyUserId(ctx);
  const eigenMedewerker = await getLinkedMedewerker(ctx);
  return { user, rol, companyUserId, eigenMedewerker };
}

/**
 * Doel-medewerker bepalen + rolcheck (§8.5): zonder expliciete medewerkerId
 * de eigen gekoppelde medewerker; een andere dag mag alleen kantoor.
 */
async function resolveDoelMedewerker(
  ctx: QueryCtx | MutationCtx,
  veld: VeldContext,
  medewerkerId: Id<"medewerkers"> | undefined
): Promise<Doc<"medewerkers">> {
  if (!magUrenLoggen(veld.rol)) {
    throw new ConvexError("Urenregistratie is niet beschikbaar voor deze rol");
  }
  const doelId = medewerkerId ?? veld.eigenMedewerker?._id;
  if (!doelId) {
    throw new ConvexError("Je account is niet gekoppeld aan een medewerker");
  }
  if (
    !magDagVanMedewerker(
      veld.rol,
      veld.eigenMedewerker?._id.toString() ?? null,
      doelId.toString()
    )
  ) {
    throw new ConvexError("Je mag alleen je eigen werkdag bekijken en bewerken");
  }
  const medewerker = await ctx.db.get(doelId);
  if (
    !medewerker ||
    medewerker.userId.toString() !== veld.companyUserId.toString()
  ) {
    throw new ConvexError("Medewerker niet gevonden");
  }
  return medewerker;
}

function assertGeldigeDatum(datum: string): void {
  if (!DATUM_PATROON.test(datum)) {
    throw new ConvexError("Ongeldige datum (verwacht YYYY-MM-DD)");
  }
}

/**
 * Segmenten van één medewerker-dag, binnen de bedrijfsscope.
 * Geëxporteerd voor convex/urenControle.ts (medewerker- en voorman-gezicht).
 */
export async function segmentenVoorDag(
  db: QueryCtx["db"],
  companyUserId: Id<"users">,
  medewerkerId: Id<"medewerkers">,
  datum: string
): Promise<Doc<"urenSegmenten">[]> {
  const rijen = await db
    .query("urenSegmenten")
    .withIndex("by_medewerker_datum", (q) =>
      q.eq("medewerkerId", medewerkerId).eq("datum", datum)
    )
    .collect();
  return rijen.filter(
    (r) => r.userId.toString() === companyUserId.toString()
  );
}

/** Dag-status (geen rij = open). Geëxporteerd voor convex/urenControle.ts. */
export async function dagStatusVoor(
  db: QueryCtx["db"],
  companyUserId: Id<"users">,
  medewerkerId: Id<"medewerkers">,
  datum: string
): Promise<Doc<"urenDagen"> | null> {
  const rij = await db
    .query("urenDagen")
    .withIndex("by_medewerker_datum", (q) =>
      q.eq("medewerkerId", medewerkerId).eq("datum", datum)
    )
    .unique();
  return rij && rij.userId.toString() === companyUserId.toString()
    ? rij
    : null;
}

/**
 * Team waar de medewerker die dag in zit (bemanning-afwijking wint van leden).
 * Geëxporteerd voor convex/urenControle.ts (voorman-gezicht: de eigen ploeg).
 */
export async function teamVanMedewerkerOpDag(
  db: QueryCtx["db"],
  companyUserId: Id<"users">,
  medewerkerId: Id<"medewerkers">,
  datum: string
): Promise<Doc<"teams"> | null> {
  const teams = await db
    .query("teams")
    .withIndex("by_user", (q) => q.eq("userId", companyUserId))
    .collect();
  for (const team of teams) {
    if (team.isActief === false) continue;
    const bemanningRijen = await db
      .query("teamBemanning")
      .withIndex("by_team_datum", (q) =>
        q.eq("teamId", team._id).eq("datum", datum)
      )
      .collect();
    const afwijking = bemanningRijen.find(
      (r) => r.userId.toString() === companyUserId.toString()
    );
    const leden = afwijking?.medewerkerIds ?? team.leden;
    if (leden.some((id) => id.toString() === medewerkerId.toString())) {
      return team;
    }
  }
  return null;
}

/** Drempels voor de "Wie is achter"-widget uit instellingen (met defaults). */
async function afwijkingDrempels(
  db: QueryCtx["db"],
  companyUserId: Id<"users">
): Promise<AfwijkingDrempels> {
  const instellingen = await db
    .query("instellingen")
    .withIndex("by_user", (q) => q.eq("userId", companyUserId))
    .unique();
  return {
    minuten:
      instellingen?.veldInstellingen?.afwijkingDrempelMinuten ??
      DEFAULT_AFWIJKING_DREMPELS.minuten,
    procent:
      instellingen?.veldInstellingen?.afwijkingDrempelProcent ??
      DEFAULT_AFWIJKING_DREMPELS.procent,
  };
}

export interface VeldStop {
  werkitemId: Id<"projecten">;
  naam: string;
  status: string;
  type: "project" | "onderhoudsbeurt";
  klantId: Id<"klanten"> | null;
  klantNaam: string | null;
  adres: string | null;
  geplandeMinuten: number;
  taken: {
    omschrijving: string;
    bouwsteenId: Id<"bouwstenen"> | null;
    code: string | null;
    normUren: number | null;
  }[];
  taakAfronding: WerkItem["taakAfronding"] | null;
  klaarVoorFacturatie: boolean;
}

/**
 * Dagkaart-afgeleide gegevens voor een team-dag: verrijkte stops + de
 * voorgestelde segmenten uit de blokken (§8.10). Zelfde pipeline als
 * convex/dagkaart.ts — de planning wordt nergens dubbel opgeslagen.
 * Geëxporteerd voor convex/urenControle.ts (ploegenfilm + voorman-gezicht).
 */
export async function dagkaartVoorstellen(
  db: QueryCtx["db"],
  companyUserId: Id<"users">,
  teamId: Id<"teams">,
  datum: string
) {
  const [items, config] = await Promise.all([
    werkitemsVoorTeamDag(db, companyUserId, teamId, datum),
    dagkaartStandaardenVoor(db, companyUserId, teamId, datum),
  ]);

  const klantCache = new Map<string, Doc<"klanten"> | null>();
  const bouwsteenCache = new Map<string, Doc<"bouwstenen"> | null>();
  const stops: (KlantStop & { item: WerkItem })[] = [];
  const veldStops: VeldStop[] = [];

  for (const item of items) {
    let klant: Doc<"klanten"> | null = null;
    if (item.klantId) {
      if (!klantCache.has(item.klantId)) {
        klantCache.set(item.klantId, await db.get(item.klantId));
      }
      klant = klantCache.get(item.klantId) ?? null;
    }
    const adres =
      item.adres ?? (klant ? `${klant.adres}, ${klant.plaats}` : null);

    // Taken: eigen bouwsteenregels, anders de contractwerkzaamheid als taak
    let regels = item.bouwsteenRegels ?? [];
    if (regels.length === 0 && item.contractWerkzaamheidId) {
      const werkzaamheid = await db.get(item.contractWerkzaamheidId);
      if (werkzaamheid) {
        regels = [
          {
            bouwsteenId: werkzaamheid.bouwsteenId,
            omschrijving: werkzaamheid.omschrijving,
          },
        ];
      }
    }
    const taken: VeldStop["taken"] = [];
    for (const regel of regels) {
      let bouwsteen: Doc<"bouwstenen"> | null = null;
      if (regel.bouwsteenId) {
        if (!bouwsteenCache.has(regel.bouwsteenId)) {
          bouwsteenCache.set(regel.bouwsteenId, await db.get(regel.bouwsteenId));
        }
        bouwsteen = bouwsteenCache.get(regel.bouwsteenId) ?? null;
      }
      taken.push({
        omschrijving: regel.omschrijving,
        bouwsteenId: regel.bouwsteenId ?? null,
        code: bouwsteen?.code ?? null,
        normUren:
          bouwsteen?.urenPerBeurt ?? bouwsteen?.normurenPerEenheid ?? null,
      });
    }

    stops.push({
      werkitemId: item._id,
      adres,
      duurMinuten: stopDuurMinuten(item),
      handmatigeStartTijd: item.geplandeStartTijd ?? null,
      item,
    });
    veldStops.push({
      werkitemId: item._id,
      naam: item.naam,
      status: item.status,
      type: getType(item),
      klantId: item.klantId ?? null,
      klantNaam: klant?.naam ?? null,
      adres,
      geplandeMinuten: stopDuurMinuten(item),
      taken,
      taakAfronding: item.taakAfronding ?? null,
      klaarVoorFacturatie: item.klaarVoorFacturatie === true,
    });
  }

  const paren = adresParenVoorDag(
    config.loodsAdres,
    stops.map((s) => s.adres)
  );
  const reistijden = await reistijdenUitCache(
    db,
    companyUserId,
    paren,
    config.standaarden.standaardReistijdMinuten
  );
  const blokken = berekenDagkaart(
    config.standaarden,
    stops,
    reistijden.map((r) => r.minuten)
  );

  return { stops: veldStops, blokken, voorstellen: blokkenNaarVoorstellen(blokken) };
}

// ============================================
// Query — de veld-dag (§8.10: loggen wordt bevestigen)
// ============================================

export const getVeldDag = query({
  args: {
    datum: v.string(), // YYYY-MM-DD
    medewerkerId: v.optional(v.id("medewerkers")), // kantoor: andermans dag
  },
  handler: async (ctx, args) => {
    assertGeldigeDatum(args.datum);
    const veld = await veldContext(ctx);
    // Kantoor zonder eigen medewerker-koppeling en zonder expliciete keuze:
    // geen fout maar null, zodat de UI de medewerker-keuze kan tonen in
    // plaats van te crashen (kantoor-accounts zijn niet altijd medewerker).
    if (!args.medewerkerId && veld.rol === "kantoor" && !veld.eigenMedewerker) {
      return null;
    }
    const medewerker = await resolveDoelMedewerker(ctx, veld, args.medewerkerId);

    const [segmenten, dagRij, team] = await Promise.all([
      segmentenVoorDag(ctx.db, veld.companyUserId, medewerker._id, args.datum),
      dagStatusVoor(ctx.db, veld.companyUserId, medewerker._id, args.datum),
      teamVanMedewerkerOpDag(
        ctx.db,
        veld.companyUserId,
        medewerker._id,
        args.datum
      ),
    ]);

    let stops: VeldStop[] = [];
    let voorstellen: ReturnType<typeof blokkenNaarVoorstellen> = [];
    if (team) {
      const afgeleid = await dagkaartVoorstellen(
        ctx.db,
        veld.companyUserId,
        team._id,
        args.datum
      );
      stops = afgeleid.stops;
      // Voorstel = afgeleid tot bevestigd: opgeslagen segmenten winnen (§8.10)
      voorstellen = filterVoorstellen(afgeleid.voorstellen, segmenten);
    }

    return {
      medewerker: { _id: medewerker._id, naam: medewerker.naam },
      datum: args.datum,
      dagStatus: dagRij?.status ?? ("open" as const),
      ingediendOp: dagRij?.ingediendOp ?? null,
      team: team ? { _id: team._id, naam: team.naam } : null,
      stops,
      segmenten: segmenten.sort((a, b) =>
        a.beginTijd.localeCompare(b.beginTijd)
      ),
      voorstellen,
      isEigenDag:
        veld.eigenMedewerker?._id.toString() === medewerker._id.toString(),
      rol: veld.rol,
    };
  },
});

// ============================================
// Mutations — segmenten bevestigen/corrigeren (§8.10)
// ============================================

/**
 * Gedeelde schrijf-check: op een ingediende dag mag alleen kantoor nog
 * schrijven (correctie, mét audit-log). Geeft terug of dit een
 * kantoor-correctie op een ingediende dag is.
 */
async function assertDagBewerkbaar(
  ctx: MutationCtx,
  veld: VeldContext,
  medewerkerId: Id<"medewerkers">,
  datum: string
): Promise<boolean> {
  const dagRij = await dagStatusVoor(
    ctx.db,
    veld.companyUserId,
    medewerkerId,
    datum
  );
  if (dagRij?.status === "ingediend") {
    if (!magDagHeropenen(veld.rol)) {
      throw new ConvexError(
        "Deze dag is ingediend en op slot; alleen kantoor kan corrigeren"
      );
    }
    return true;
  }
  return false;
}

async function logUrenActie(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    medewerkerId: Id<"medewerkers">;
    datum: string;
    actie: Doc<"urenLogboek">["actie"];
    details: string;
    door: Id<"users">;
  }
): Promise<void> {
  await ctx.db.insert("urenLogboek", {
    userId: args.userId,
    medewerkerId: args.medewerkerId,
    datum: args.datum,
    actie: args.actie,
    details: args.details,
    door: args.door,
    createdAt: Date.now(),
  });
}

/** Gedeelde validatie + insert van één segment. */
async function voegSegmentToe(
  ctx: MutationCtx,
  veld: VeldContext,
  medewerker: Doc<"medewerkers">,
  args: {
    datum: string;
    categorie: Doc<"urenSegmenten">["categorie"];
    beginTijd: string;
    eindTijd: string;
    werkitemId?: Id<"projecten">;
    klantId?: Id<"klanten">;
    notitie?: string;
    bron: "voorstel" | "handmatig";
  }
): Promise<Id<"urenSegmenten">> {
  if (!isGeldigSegmentTijdvak(args.beginTijd, args.eindTijd)) {
    throw new ConvexError(
      "Ongeldig tijdvak: begin- en eindtijd als HH:MM, begin vóór eind"
    );
  }
  // Bij "werken" is de werkitem-koppeling verplicht (PRD §2.6); bij BES is de
  // koppeling optioneel (anders indirecte tijd).
  if (args.categorie === "werken" && !args.werkitemId) {
    throw new ConvexError(
      'Een segment "werken" moet aan een werkitem gekoppeld zijn'
    );
  }
  if (args.werkitemId) {
    const werkitem = await ctx.db.get(args.werkitemId);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.userId.toString() !== veld.companyUserId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }
  }
  if (args.klantId) {
    const klant = await ctx.db.get(args.klantId);
    if (!klant || klant.userId.toString() !== veld.companyUserId.toString()) {
      throw new ConvexError("Klant niet gevonden");
    }
  }

  // Geen overlappende segmenten binnen dezelfde dag
  const bestaand = await segmentenVoorDag(
    ctx.db,
    veld.companyUserId,
    medewerker._id,
    args.datum
  );
  const nieuw = { beginTijd: args.beginTijd, eindTijd: args.eindTijd };
  if (bestaand.some((seg) => overlapt(seg, nieuw))) {
    throw new ConvexError("Dit tijdvak overlapt met een bestaand segment");
  }

  const kantoorCorrectie = await assertDagBewerkbaar(
    ctx,
    veld,
    medewerker._id,
    args.datum
  );

  const now = Date.now();
  const id = await ctx.db.insert("urenSegmenten", {
    userId: veld.companyUserId,
    medewerkerId: medewerker._id,
    datum: args.datum,
    categorie: args.categorie,
    beginTijd: args.beginTijd,
    eindTijd: args.eindTijd,
    werkitemId: args.werkitemId,
    klantId: args.klantId,
    // Op een ingediende dag schrijft kantoor direct als "ingediend"
    status: kantoorCorrectie ? "ingediend" : "bevestigd",
    bron: args.bron,
    notitie: args.notitie,
    createdAt: now,
    updatedAt: now,
  });

  if (kantoorCorrectie) {
    await logUrenActie(ctx, {
      userId: veld.companyUserId,
      medewerkerId: medewerker._id,
      datum: args.datum,
      actie: "segment_gecorrigeerd",
      details: `Segment toegevoegd op ingediende dag: ${args.categorie} ${args.beginTijd}–${args.eindTijd}`,
      door: veld.user._id,
    });
  }
  return id;
}

/**
 * Eén segment bevestigen of handmatig toevoegen ("loggen wordt bevestigen",
 * §8.10). Een voorstel bevestigen = dit met bron "voorstel" opslaan.
 */
export const bevestigSegment = mutation({
  args: {
    datum: v.string(),
    categorie: segmentCategorieValidator,
    beginTijd: v.string(), // HH:MM
    eindTijd: v.string(), // HH:MM
    werkitemId: v.optional(v.id("projecten")),
    klantId: v.optional(v.id("klanten")),
    notitie: v.optional(v.string()),
    bron: v.optional(v.union(v.literal("voorstel"), v.literal("handmatig"))),
    medewerkerId: v.optional(v.id("medewerkers")), // kantoor-correcties
  },
  handler: async (ctx, args) => {
    assertGeldigeDatum(args.datum);
    const veld = await veldContext(ctx);
    const medewerker = await resolveDoelMedewerker(ctx, veld, args.medewerkerId);
    return await voegSegmentToe(ctx, veld, medewerker, {
      datum: args.datum,
      categorie: args.categorie,
      beginTijd: args.beginTijd,
      eindTijd: args.eindTijd,
      werkitemId: args.werkitemId,
      klantId: args.klantId,
      notitie: args.notitie,
      bron: args.bron ?? "handmatig",
    });
  },
});

/**
 * Alle openstaande dagkaart-voorstellen van de dag in één keer bevestigen
 * (§8.10: de medewerker bevestigt, corrigeren kan daarna per segment).
 * Server-side herberekend — het voorstel blijft afgeleid van de planning.
 */
export const bevestigAlleVoorstellen = mutation({
  args: {
    datum: v.string(),
    medewerkerId: v.optional(v.id("medewerkers")),
  },
  handler: async (ctx, args) => {
    assertGeldigeDatum(args.datum);
    const veld = await veldContext(ctx);
    const medewerker = await resolveDoelMedewerker(ctx, veld, args.medewerkerId);

    const team = await teamVanMedewerkerOpDag(
      ctx.db,
      veld.companyUserId,
      medewerker._id,
      args.datum
    );
    if (!team) {
      throw new ConvexError("Geen geplande team-dag gevonden voor deze datum");
    }
    const [afgeleid, bestaand] = await Promise.all([
      dagkaartVoorstellen(ctx.db, veld.companyUserId, team._id, args.datum),
      segmentenVoorDag(ctx.db, veld.companyUserId, medewerker._id, args.datum),
    ]);
    const teBevestigen = filterVoorstellen(afgeleid.voorstellen, bestaand);

    const ids: Id<"urenSegmenten">[] = [];
    for (const voorstel of teBevestigen) {
      ids.push(
        await voegSegmentToe(ctx, veld, medewerker, {
          datum: args.datum,
          categorie: voorstel.categorie,
          beginTijd: voorstel.beginTijd,
          eindTijd: voorstel.eindTijd,
          werkitemId: (voorstel.werkitemId as Id<"projecten"> | null) ?? undefined,
          bron: "voorstel",
        })
      );
    }
    return { bevestigd: ids.length };
  },
});

/** Segment corrigeren (tijden/categorie/notitie/koppeling). */
export const updateSegment = mutation({
  args: {
    id: v.id("urenSegmenten"),
    categorie: v.optional(segmentCategorieValidator),
    beginTijd: v.optional(v.string()),
    eindTijd: v.optional(v.string()),
    werkitemId: v.optional(v.union(v.id("projecten"), v.null())),
    klantId: v.optional(v.union(v.id("klanten"), v.null())),
    notitie: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const veld = await veldContext(ctx);
    const segment = await ctx.db.get(args.id);
    if (
      !segment ||
      segment.userId.toString() !== veld.companyUserId.toString()
    ) {
      throw new ConvexError("Segment niet gevonden");
    }
    if (
      !magDagVanMedewerker(
        veld.rol,
        veld.eigenMedewerker?._id.toString() ?? null,
        segment.medewerkerId.toString()
      )
    ) {
      throw new ConvexError("Je mag alleen je eigen segmenten bewerken");
    }
    const kantoorCorrectie = await assertDagBewerkbaar(
      ctx,
      veld,
      segment.medewerkerId,
      segment.datum
    );

    const beginTijd = args.beginTijd ?? segment.beginTijd;
    const eindTijd = args.eindTijd ?? segment.eindTijd;
    if (!isGeldigSegmentTijdvak(beginTijd, eindTijd)) {
      throw new ConvexError(
        "Ongeldig tijdvak: begin- en eindtijd als HH:MM, begin vóór eind"
      );
    }
    const categorie = args.categorie ?? segment.categorie;
    const werkitemId =
      args.werkitemId === undefined
        ? segment.werkitemId
        : (args.werkitemId ?? undefined);
    if (categorie === "werken" && !werkitemId) {
      throw new ConvexError(
        'Een segment "werken" moet aan een werkitem gekoppeld zijn'
      );
    }
    if (werkitemId && werkitemId !== segment.werkitemId) {
      const werkitem = await ctx.db.get(werkitemId);
      if (
        !werkitem ||
        werkitem.deletedAt ||
        werkitem.userId.toString() !== veld.companyUserId.toString()
      ) {
        throw new ConvexError("Werkitem niet gevonden");
      }
    }

    // Overlap-check tegen de andere segmenten van die dag
    const andere = (
      await segmentenVoorDag(
        ctx.db,
        veld.companyUserId,
        segment.medewerkerId,
        segment.datum
      )
    ).filter((s) => s._id.toString() !== segment._id.toString());
    if (andere.some((s) => overlapt(s, { beginTijd, eindTijd }))) {
      throw new ConvexError("Dit tijdvak overlapt met een bestaand segment");
    }

    await ctx.db.patch(segment._id, {
      categorie,
      beginTijd,
      eindTijd,
      werkitemId,
      klantId:
        args.klantId === undefined
          ? segment.klantId
          : (args.klantId ?? undefined),
      notitie:
        args.notitie === undefined
          ? segment.notitie
          : (args.notitie ?? undefined),
      updatedAt: Date.now(),
    });

    if (kantoorCorrectie) {
      await logUrenActie(ctx, {
        userId: veld.companyUserId,
        medewerkerId: segment.medewerkerId,
        datum: segment.datum,
        actie: "segment_gecorrigeerd",
        details: `Segment gecorrigeerd: ${categorie} ${beginTijd}–${eindTijd} (was ${segment.categorie} ${segment.beginTijd}–${segment.eindTijd})`,
        door: veld.user._id,
      });
    }
    return segment._id;
  },
});

/** Segment verwijderen (eigen dag; kantoor ook op ingediende dagen, met log). */
export const verwijderSegment = mutation({
  args: { id: v.id("urenSegmenten") },
  handler: async (ctx, args) => {
    const veld = await veldContext(ctx);
    const segment = await ctx.db.get(args.id);
    if (
      !segment ||
      segment.userId.toString() !== veld.companyUserId.toString()
    ) {
      throw new ConvexError("Segment niet gevonden");
    }
    if (
      !magDagVanMedewerker(
        veld.rol,
        veld.eigenMedewerker?._id.toString() ?? null,
        segment.medewerkerId.toString()
      )
    ) {
      throw new ConvexError("Je mag alleen je eigen segmenten verwijderen");
    }
    const kantoorCorrectie = await assertDagBewerkbaar(
      ctx,
      veld,
      segment.medewerkerId,
      segment.datum
    );
    await ctx.db.delete(segment._id);
    if (kantoorCorrectie) {
      await logUrenActie(ctx, {
        userId: veld.companyUserId,
        medewerkerId: segment.medewerkerId,
        datum: segment.datum,
        actie: "segment_gecorrigeerd",
        details: `Segment verwijderd: ${segment.categorie} ${segment.beginTijd}–${segment.eindTijd}`,
        door: veld.user._id,
      });
    }
    return null;
  },
});

// ============================================
// Dag indienen + heropenen (§2.6, bestaande Hub-flow)
// ============================================

export const dienDagIn = mutation({
  args: {
    datum: v.string(),
    medewerkerId: v.optional(v.id("medewerkers")),
  },
  handler: async (ctx, args) => {
    assertGeldigeDatum(args.datum);
    const veld = await veldContext(ctx);
    const medewerker = await resolveDoelMedewerker(ctx, veld, args.medewerkerId);

    const dagRij = await dagStatusVoor(
      ctx.db,
      veld.companyUserId,
      medewerker._id,
      args.datum
    );
    if (dagRij?.status === "ingediend") {
      throw new ConvexError("Deze dag is al ingediend");
    }
    const segmenten = await segmentenVoorDag(
      ctx.db,
      veld.companyUserId,
      medewerker._id,
      args.datum
    );
    if (segmenten.length === 0) {
      throw new ConvexError(
        "Er zijn nog geen segmenten om in te dienen voor deze dag"
      );
    }

    const now = Date.now();
    for (const segment of segmenten) {
      await ctx.db.patch(segment._id, { status: "ingediend", updatedAt: now });
    }
    if (dagRij) {
      await ctx.db.patch(dagRij._id, {
        status: "ingediend",
        ingediendOp: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("urenDagen", {
        userId: veld.companyUserId,
        medewerkerId: medewerker._id,
        datum: args.datum,
        status: "ingediend",
        ingediendOp: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    await logUrenActie(ctx, {
      userId: veld.companyUserId,
      medewerkerId: medewerker._id,
      datum: args.datum,
      actie: "dag_ingediend",
      details: `Dag ${args.datum} ingediend (${segmenten.length} segmenten)`,
      door: veld.user._id,
    });
    return { ingediend: segmenten.length };
  },
});

/** Kantoor heropent een ingediende dag (audit-log, §2.6). */
export const heropenDag = mutation({
  args: {
    datum: v.string(),
    medewerkerId: v.id("medewerkers"),
  },
  handler: async (ctx, args) => {
    assertGeldigeDatum(args.datum);
    const veld = await veldContext(ctx);
    if (!magDagHeropenen(veld.rol)) {
      throw new ConvexError("Alleen kantoor kan een ingediende dag heropenen");
    }
    const medewerker = await ctx.db.get(args.medewerkerId);
    if (
      !medewerker ||
      medewerker.userId.toString() !== veld.companyUserId.toString()
    ) {
      throw new ConvexError("Medewerker niet gevonden");
    }
    const dagRij = await dagStatusVoor(
      ctx.db,
      veld.companyUserId,
      medewerker._id,
      args.datum
    );
    if (!dagRij || dagRij.status !== "ingediend") {
      throw new ConvexError("Deze dag is niet ingediend");
    }

    const now = Date.now();
    await ctx.db.patch(dagRij._id, { status: "open", updatedAt: now });
    const segmenten = await segmentenVoorDag(
      ctx.db,
      veld.companyUserId,
      medewerker._id,
      args.datum
    );
    for (const segment of segmenten) {
      if (segment.status === "ingediend") {
        await ctx.db.patch(segment._id, {
          status: "bevestigd",
          updatedAt: now,
        });
      }
    }
    await logUrenActie(ctx, {
      userId: veld.companyUserId,
      medewerkerId: medewerker._id,
      datum: args.datum,
      actie: "dag_heropend",
      details: `Dag ${args.datum} heropend door kantoor`,
      door: veld.user._id,
    });
    return null;
  },
});

/** Audit-log van de uren-flows (kantoor, wie/wat/wanneer). */
export const getUrenLogboek = query({
  args: {
    medewerkerId: v.optional(v.id("medewerkers")),
    datum: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const veld = await veldContext(ctx);
    if (!magDagHeropenen(veld.rol)) {
      throw new ConvexError("Het uren-logboek is alleen voor kantoor");
    }
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);
    let rijen: Doc<"urenLogboek">[];
    if (args.medewerkerId && args.datum) {
      rijen = await ctx.db
        .query("urenLogboek")
        .withIndex("by_medewerker_datum", (q) =>
          q
            .eq("medewerkerId", args.medewerkerId as Id<"medewerkers">)
            .eq("datum", args.datum as string)
        )
        .collect();
      rijen = rijen.filter(
        (r) => r.userId.toString() === veld.companyUserId.toString()
      );
    } else {
      rijen = await ctx.db
        .query("urenLogboek")
        .withIndex("by_user_createdAt", (q) =>
          q.eq("userId", veld.companyUserId)
        )
        .order("desc")
        .take(limit);
    }
    return rijen.slice(0, limit);
  },
});

// ============================================
// "Wie is achter" — kantoor-widget (§2.6)
// ============================================

const MAX_MEERDAAGS_DAGEN = 62;

function addDagenIso(datum: string, dagen: number): string {
  const d = new Date(`${datum}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dagen);
  return d.toISOString().slice(0, 10);
}

export const getWieIsAchter = query({
  args: { datum: v.string() },
  handler: async (ctx, args) => {
    assertGeldigeDatum(args.datum);
    const veld = await veldContext(ctx);
    if (!magDagHeropenen(veld.rol)) {
      throw new ConvexError('De widget "Wie is achter" is alleen voor kantoor');
    }

    // Geplande bezoeken van de dag: ingeplande werkitems (team + datum)
    const kandidaten = await ctx.db
      .query("projecten")
      .withIndex("by_user_geplandeStart", (q) =>
        q
          .eq("userId", veld.companyUserId)
          .gte("geplandeStart", addDagenIso(args.datum, -MAX_MEERDAAGS_DAGEN))
          .lte("geplandeStart", args.datum)
      )
      .collect();
    const gepland = kandidaten.filter(
      (item) =>
        !item.deletedAt &&
        item.isArchived !== true &&
        item.status !== "vervallen" &&
        item.teamId !== undefined &&
        werkitemOpDag(item, args.datum)
    );

    // Gelogde werken-minuten per werkitem op deze dag
    const segmenten = await ctx.db
      .query("urenSegmenten")
      .withIndex("by_user_datum", (q) =>
        q.eq("userId", veld.companyUserId).eq("datum", args.datum)
      )
      .collect();
    const minutenPerWerkitem = new Map<string, number>();
    for (const segment of segmenten) {
      if (segment.categorie !== "werken" || !segment.werkitemId) continue;
      const sleutel = segment.werkitemId.toString();
      minutenPerWerkitem.set(
        sleutel,
        (minutenPerWerkitem.get(sleutel) ?? 0) + segmentMinuten(segment)
      );
    }

    const drempels = await afwijkingDrempels(ctx.db, veld.companyUserId);
    const klantCache = new Map<string, Doc<"klanten"> | null>();
    const teamCache = new Map<string, Doc<"teams"> | null>();

    const achterstanden: {
      werkitemId: Id<"projecten">;
      naam: string;
      klantNaam: string | null;
      teamNaam: string | null;
      geplandeMinuten: number;
    }[] = [];
    const afwijkingen: {
      werkitemId: Id<"projecten">;
      naam: string;
      klantNaam: string | null;
      teamNaam: string | null;
      geplandeMinuten: number;
      gelogdeMinuten: number;
      verschilMinuten: number;
      verschilProcent: number;
    }[] = [];

    for (const item of gepland) {
      const beoordeling = beoordeelBezoek(
        {
          werkitemId: item._id.toString(),
          geplandeMinuten: stopDuurMinuten(item),
        },
        minutenPerWerkitem.get(item._id.toString()),
        drempels
      );
      if (beoordeling.soort === "ok") continue;

      let klantNaam: string | null = null;
      if (item.klantId) {
        if (!klantCache.has(item.klantId)) {
          klantCache.set(item.klantId, await ctx.db.get(item.klantId));
        }
        klantNaam = klantCache.get(item.klantId)?.naam ?? null;
      }
      let teamNaam: string | null = null;
      if (item.teamId) {
        if (!teamCache.has(item.teamId)) {
          teamCache.set(item.teamId, await ctx.db.get(item.teamId));
        }
        teamNaam = teamCache.get(item.teamId)?.naam ?? null;
      }

      if (beoordeling.soort === "achterstand") {
        achterstanden.push({
          werkitemId: item._id,
          naam: item.naam,
          klantNaam,
          teamNaam,
          geplandeMinuten: stopDuurMinuten(item),
        });
      } else {
        afwijkingen.push({
          werkitemId: item._id,
          naam: item.naam,
          klantNaam,
          teamNaam,
          geplandeMinuten: beoordeling.geplandeMinuten,
          gelogdeMinuten: beoordeling.gelogdeMinuten,
          verschilMinuten: beoordeling.verschilMinuten,
          verschilProcent: beoordeling.verschilProcent,
        });
      }
    }

    return { datum: args.datum, drempels, achterstanden, afwijkingen };
  },
});

// ============================================
// Foto's per opdracht → klanttijdlijn-bijlage (§2.6/§2.3)
// ============================================

export const voegVeldFotoToe = mutation({
  args: {
    werkitemId: v.id("projecten"),
    bijlagen: v.array(v.id("_storage")),
    tekst: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const veld = await veldContext(ctx);
    if (!magUrenLoggen(veld.rol)) {
      throw new ConvexError("Foto's toevoegen is niet beschikbaar voor deze rol");
    }
    if (args.bijlagen.length === 0) {
      throw new ConvexError("Geen foto's om toe te voegen");
    }
    const werkitem = await ctx.db.get(args.werkitemId);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.userId.toString() !== veld.companyUserId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }
    if (!werkitem.klantId) {
      throw new ConvexError(
        "Dit werkitem heeft geen klant; foto's landen op de klanttijdlijn"
      );
    }
    const entryId = await logTijdlijnEvent(ctx, {
      userId: veld.companyUserId,
      klantId: werkitem.klantId,
      eventType: "handmatig",
      tekst:
        args.tekst?.trim() ||
        `Foto's toegevoegd vanaf de dagkaart bij ${werkitem.naam} (${args.bijlagen.length})`,
      auteurId: veld.user._id,
      auteurNaam: veld.user.name,
      werkitemId: werkitem._id,
      bijlagen: args.bijlagen,
    });
    if (!entryId) {
      throw new ConvexError("Foto's opslaan op de tijdlijn is mislukt");
    }
    return entryId;
  },
});
