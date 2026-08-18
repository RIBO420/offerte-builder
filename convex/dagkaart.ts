/**
 * Route-dagkaart — backend (PRD §2.2 weergave 2, fase 1 stap 5b).
 *
 * Eén team, één dag, chronologisch: vertrek loods → reistijd → klantblokken
 * (in volgordeBinnenDag) → pauze op vaste tijd → terugreis → loods-afronding
 * → einde-dag-check. Blokken zijn AFGELEID (convex/dagkaartLogica.ts);
 * alleen afwijkingen worden opgeslagen.
 *
 * Route-intelligentie fase 1 (bewust): reistijdberekening + tijdcascade +
 * handmatig ordenen. GEEN volgorde-optimalisatie (fase 2 = suggestieknop,
 * fase 4 = automatisch, §4.4).
 *
 * Rollen: kantoor muteert (requireKantoor), voorman/medewerker leest.
 * Naamconflict-waarschuwing: de tabel `routes` is GPS-tracking; dit concept
 * heet in het datamodel nooit "route" (UI-label: "Dagkaart").
 */

import { v, ConvexError } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { requireOrg, requireOrgId } from "./auth";
import { requireKantoor, requireNotViewer } from "./roles";
import { logPlanwijziging, werkitemOpDag } from "./planbordLogica";
import {
  adresParenVoorDag,
  berekenDagkaart,
  effectieveStandaarden,
  isGeldigeTijd,
  naarMinuten,
  splitsTaakUit,
  stelVolgordeVoor,
  stopDuurMinuten,
  type AdresPaar,
  type KlantStop,
} from "./dagkaartLogica";
import { kiesReistijdProvider } from "./reistijdLogica";
import { checkReistijdRateLimit } from "./security";
import { getType, type WerkItem } from "./werkitems";

/**
 * Maximaal aantal betaalde Google Maps-calls per aanroep van
 * `berekenReistijdenVoorDag`. Ruim boven een realistische team-dag (een
 * handvol stops), zodat het plafond alleen misbruik raakt.
 */
const MAX_MAPS_CALLS_PER_AANROEP = 25;

// ============================================
// Gedeelde helpers
// ============================================

const MAX_DUUR_MINUTEN = 24 * 60;

async function requireTeamVanOrg(
  ctx: { db: { get: (id: Id<"teams">) => Promise<Doc<"teams"> | null> } },
  teamId: Id<"teams">,
  orgId: Id<"organisaties">
): Promise<Doc<"teams">> {
  const team = await ctx.db.get(teamId);
  if (!team || team.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Team niet gevonden");
  }
  return team;
}

type QueryDb = QueryCtx["db"];

/**
 * Werkitems van één team op één dag, gesorteerd op volgordeBinnenDag.
 * Geëxporteerd voor hergebruik door de veld-voorinvulling (§8.10,
 * convex/urenSegmenten.ts): voorgestelde segmenten zijn AFGELEID van
 * dezelfde dagkaart-pipeline — geen dubbele opslag van de planning.
 */
export async function werkitemsVoorTeamDag(
  db: QueryDb,
  orgId: Id<"organisaties">,
  teamId: Id<"teams">,
  datum: string
): Promise<WerkItem[]> {
  const kandidaten = await db
    .query("projecten")
    .withIndex("by_team_geplandeStart", (q) =>
      q.eq("teamId", teamId).lte("geplandeStart", datum)
    )
    .collect();
  return kandidaten
    .filter(
      (item) =>
        !item.deletedAt &&
        item.isArchived !== true &&
        item.status !== "vervallen" &&
        item.orgId?.toString() === orgId.toString() &&
        // Belt & braces bovenop de indexquery: team-scope expliciet
        item.teamId?.toString() === teamId.toString() &&
        werkitemOpDag(item, datum)
    )
    .sort(
      (a, b) =>
        (a.volgordeBinnenDag ?? 999) - (b.volgordeBinnenDag ?? 999) ||
        a.naam.localeCompare(b.naam)
    );
}

/** Geëxporteerd voor hergebruik door convex/urenSegmenten.ts (§8.10). */
export async function dagkaartStandaardenVoor(
  db: QueryDb,
  orgId: Id<"organisaties">,
  teamId: Id<"teams">,
  datum: string
) {
  const [instellingen, afwijking] = await Promise.all([
    db
      .query("instellingen")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .unique(),
    db
      .query("dagkaartAfwijkingen")
      .withIndex("by_team_datum", (q) =>
        q.eq("teamId", teamId).eq("datum", datum)
      )
      .unique(),
  ]);
  const geldigeAfwijking =
    afwijking && afwijking.orgId?.toString() === orgId.toString()
      ? afwijking
      : null;
  return {
    standaarden: effectieveStandaarden(
      instellingen?.dagkaartInstellingen,
      geldigeAfwijking
    ),
    afwijking: geldigeAfwijking,
    loodsAdres: instellingen
      ? `${instellingen.bedrijfsgegevens.adres}, ${instellingen.bedrijfsgegevens.plaats}`
      : null,
  };
}

/**
 * Reistijd per adrespaar: cache (Google Maps) → standaard-reistijd.
 * Geëxporteerd voor hergebruik door convex/urenSegmenten.ts (§8.10).
 */
export async function reistijdenUitCache(
  db: QueryDb,
  orgId: Id<"organisaties">,
  paren: (AdresPaar | null)[],
  standaardMinuten: number
): Promise<{ minuten: number; bron: "standaard" | "google_maps" }[]> {
  const resultaat: { minuten: number; bron: "standaard" | "google_maps" }[] =
    [];
  const cache = new Map<
    string,
    { minuten: number; bron: "standaard" | "google_maps" } | null
  >();
  for (const paar of paren) {
    if (!paar) {
      resultaat.push({ minuten: standaardMinuten, bron: "standaard" });
      continue;
    }
    if (!cache.has(paar.sleutel)) {
      const rij = await db
        .query("reistijdCache")
        .withIndex("by_org_sleutel", (q) =>
          q.eq("orgId", orgId).eq("sleutel", paar.sleutel)
        )
        .unique();
      cache.set(
        paar.sleutel,
        rij ? { minuten: rij.minuten, bron: rij.bron } : null
      );
    }
    const gevonden = cache.get(paar.sleutel);
    resultaat.push(gevonden ?? { minuten: standaardMinuten, bron: "standaard" });
  }
  return resultaat;
}

// ============================================
// Query — de dagkaart zelf (leesbaar voor alle stafrollen, ook voorman)
// ============================================

export interface DagkaartTaak {
  omschrijving: string;
  bouwsteenId: Id<"bouwstenen"> | null;
  code: string | null;
  normUren: number | null;
}

export interface DagkaartVeldtaak {
  veldtaakId: Id<"veldtaken">;
  meldingId: Id<"servicemeldingen">;
  medewerkerId: Id<"medewerkers">;
  medewerkerNaam: string;
  tekst: string;
}

/**
 * Veldtaken-matching (PRD §2.4, case-test §8.6): een veldtaak (uit een @tag
 * in de case-thread) verschijnt op de dagkaart zodra (a) de getagde
 * medewerker DIE dag in de bemanning van dit team zit (teamBemanning-
 * afwijking, anders teams.leden) én (b) een werkitem van die klant op deze
 * team-dag staat. Niet eerder, en niet bij een ander team. De dagkaart
 * toont ze als eigen regel in het klantblok.
 */
async function veldtakenVoorTeamDag(
  db: QueryDb,
  orgId: Id<"organisaties">,
  team: Doc<"teams">,
  datum: string,
  items: WerkItem[]
): Promise<Map<string, DagkaartVeldtaak[]>> {
  const result = new Map<string, DagkaartVeldtaak[]>();
  const klantIds = new Set(
    items
      .map((i) => i.klantId?.toString())
      .filter((k): k is string => k !== undefined)
  );
  if (klantIds.size === 0) return result;

  // Bemanning van de dag: een teamBemanning-afwijking wint van teams.leden
  const bemanningRijen = await db
    .query("teamBemanning")
    .withIndex("by_team_datum", (q) =>
      q.eq("teamId", team._id).eq("datum", datum)
    )
    .collect();
  const afwijking = bemanningRijen.find(
    (r) =>
      r.teamId.toString() === team._id.toString() &&
      r.datum === datum &&
      r.orgId?.toString() === orgId.toString()
  );
  const bemanning = afwijking?.medewerkerIds ?? team.leden;

  for (const medewerkerId of bemanning) {
    const taken = await db
      .query("veldtaken")
      .withIndex("by_medewerker", (q) =>
        q.eq("medewerkerId", medewerkerId).eq("status", "open")
      )
      .collect();
    for (const taak of taken) {
      // Belt & braces bovenop de indexquery
      if (taak.status !== "open") continue;
      if (taak.medewerkerId.toString() !== medewerkerId.toString()) continue;
      // Belt & braces bovenop de indexquery: `orgId` is sinds fase 6 verplicht
      // op veldtaken, dus een rij van een andere tenant valt hier hard af.
      if (taak.orgId.toString() !== orgId.toString()) continue;
      if (!klantIds.has(taak.klantId.toString())) continue;
      const key = taak.klantId.toString();
      const lijst = result.get(key) ?? [];
      lijst.push({
        veldtaakId: taak._id,
        meldingId: taak.meldingId,
        medewerkerId: taak.medewerkerId,
        medewerkerNaam: taak.medewerkerNaam,
        tekst: taak.tekst,
      });
      result.set(key, lijst);
    }
  }
  return result;
}

export const getDagkaart = query({
  args: {
    teamId: v.id("teams"),
    datum: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const team = await requireTeamVanOrg(ctx, args.teamId, orgId);

    const [items, config] = await Promise.all([
      werkitemsVoorTeamDag(ctx.db, orgId, args.teamId, args.datum),
      dagkaartStandaardenVoor(ctx.db, orgId, args.teamId, args.datum),
    ]);
    const { standaarden, afwijking, loodsAdres } = config;

    // Verrijking per stop: klant, adres, bijzonderheden, taken (bouwstenen
    // met code + normtijd). Memoisatie per id — geen N+1 op dezelfde klant.
    const klantCache = new Map<string, Doc<"klanten"> | null>();
    const bouwsteenCache = new Map<string, Doc<"bouwstenen"> | null>();
    const haalKlant = async (id: Id<"klanten">) => {
      if (!klantCache.has(id)) klantCache.set(id, await ctx.db.get(id));
      return klantCache.get(id) ?? null;
    };
    const haalBouwsteen = async (id: Id<"bouwstenen">) => {
      if (!bouwsteenCache.has(id)) bouwsteenCache.set(id, await ctx.db.get(id));
      return bouwsteenCache.get(id) ?? null;
    };

    // Veldtaken uit meldingen (§2.4/§8.6) per klant op deze team-dag
    const veldtakenPerKlant = await veldtakenVoorTeamDag(
      ctx.db,
      orgId,
      team,
      args.datum,
      items
    );

    const stops: (KlantStop & {
      naam: string;
      status: string;
      type: "project" | "onderhoudsbeurt";
      klantNaam: string | null;
      bijzonderheden: string | null;
      taken: DagkaartTaak[];
      veldtaken: DagkaartVeldtaak[];
      handmatigeStartTijd: string | null;
      duurOverrideMinuten: number | null;
      geschatteUren: number | null;
    })[] = [];

    for (const item of items) {
      const klant = item.klantId ? await haalKlant(item.klantId) : null;
      const adres =
        item.adres ?? (klant ? `${klant.adres}, ${klant.plaats}` : null);

      // Taken: eigen bouwsteenregels, anders de contractwerkzaamheid als taak
      let regels = item.bouwsteenRegels ?? [];
      if (regels.length === 0 && item.contractWerkzaamheidId) {
        const werkzaamheid = await ctx.db.get(item.contractWerkzaamheidId);
        if (werkzaamheid) {
          regels = [
            {
              bouwsteenId: werkzaamheid.bouwsteenId,
              omschrijving: werkzaamheid.omschrijving,
            },
          ];
        }
      }
      const taken: DagkaartTaak[] = [];
      for (const regel of regels) {
        const bouwsteen = regel.bouwsteenId
          ? await haalBouwsteen(regel.bouwsteenId)
          : null;
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
        duurOverrideMinuten: item.duurOverrideMinuten ?? null,
        geschatteUren: item.geschatteUren ?? null,
        naam: item.naam,
        status: item.status,
        type: getType(item),
        klantNaam: klant?.naam ?? null,
        bijzonderheden: klant?.notities ?? null,
        taken,
        veldtaken: item.klantId
          ? (veldtakenPerKlant.get(item.klantId.toString()) ?? [])
          : [],
      });
    }

    const paren = adresParenVoorDag(
      loodsAdres,
      stops.map((s) => s.adres)
    );
    const reistijden = await reistijdenUitCache(
      ctx.db,
      orgId,
      paren,
      standaarden.standaardReistijdMinuten
    );

    const blokken = berekenDagkaart(
      standaarden,
      stops,
      reistijden.map((r) => r.minuten)
    );

    return {
      team: { _id: team._id, naam: team.naam },
      datum: args.datum,
      standaarden,
      heeftDagAfwijking: afwijking !== null,
      loodsAdres,
      reistijdBron: reistijden.some((r) => r.bron === "google_maps")
        ? ("google_maps" as const)
        : ("standaard" as const),
      blokken,
      stops: stops.map((s) => ({
        werkitemId: s.werkitemId as Id<"projecten">,
        naam: s.naam,
        status: s.status,
        type: s.type,
        klantNaam: s.klantNaam,
        adres: s.adres,
        bijzonderheden: s.bijzonderheden,
        taken: s.taken,
        veldtaken: s.veldtaken,
        duurMinuten: s.duurMinuten,
        handmatigeStartTijd: s.handmatigeStartTijd,
        duurOverrideMinuten: s.duurOverrideMinuten,
        geschatteUren: s.geschatteUren,
      })),
    };
  },
});

// ============================================
// "Stel volgorde voor" (bijlage B, fase 2 — route-intelligentie stap 2)
// ============================================

/** Adres van een werkitem: eigen adres, anders klantadres (memoized). */
async function adresVanWerkitem(
  db: QueryDb,
  item: WerkItem,
  klantCache: Map<string, Doc<"klanten"> | null>
): Promise<string | null> {
  if (item.adres) return item.adres;
  if (!item.klantId) return null;
  const key = item.klantId.toString();
  if (!klantCache.has(key)) {
    klantCache.set(key, await db.get(item.klantId));
  }
  const klant = klantCache.get(key) ?? null;
  return klant ? `${klant.adres}, ${klant.plaats}` : null;
}

/**
 * Volgordevoorstel voor één team-dag: eenvoudige nearest-neighbour-heuristiek
 * op de reistijden uit de bestaande cache (onbekende paren → standaard-
 * reistijd), startend vanaf de loods. Het voorstel is een PREVIEW (volgorde +
 * geschatte tijdwinst); de planner beslist — overnemen loopt via de bestaande
 * herordenDag, verwerpen is niets doen. Stops met handmatige starttijd worden
 * niet verplaatst (§8.9). GEEN automatische herplanning (fase 4, §4.4).
 * Kantoor-only: het is een plannergereedschap, net als de orden-mutaties.
 */
export const getVolgordeVoorstel = query({
  args: {
    teamId: v.id("teams"),
    datum: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    await requireTeamVanOrg(ctx, args.teamId, orgId);

    const [items, config] = await Promise.all([
      werkitemsVoorTeamDag(ctx.db, orgId, args.teamId, args.datum),
      dagkaartStandaardenVoor(ctx.db, orgId, args.teamId, args.datum),
    ]);

    const klantCache = new Map<string, Doc<"klanten"> | null>();
    const stops = [];
    for (const item of items) {
      stops.push({
        werkitemId: item._id.toString(),
        adres: await adresVanWerkitem(ctx.db, item, klantCache),
        handmatigeStartTijd: item.geplandeStartTijd ?? null,
        naam: item.naam,
      });
    }

    // Alle bekende reistijden van dit bedrijf (alleen echt berekende paren
    // staan in de cache; klein — één rij per adrespaar)
    const cacheRijen = await ctx.db
      .query("reistijdCache")
      .withIndex("by_org_sleutel", (q) => q.eq("orgId", orgId))
      .collect();
    const reistijden = new Map<string, number>();
    for (const rij of cacheRijen) {
      if (rij.orgId?.toString() !== orgId.toString()) continue;
      reistijden.set(rij.sleutel, rij.minuten);
    }

    const voorstel = stelVolgordeVoor(
      config.loodsAdres,
      stops,
      reistijden,
      config.standaarden.standaardReistijdMinuten
    );
    if (!voorstel) return null;

    const naamPerId = new Map(stops.map((s) => [s.werkitemId, s.naam]));
    return {
      ...voorstel,
      volgorde: voorstel.volgorde.map((id) => ({
        werkitemId: id as unknown as Id<"projecten">,
        naam: naamPerId.get(id) ?? "",
      })),
      reistijdBron: reistijden.size > 0 ? ("google_maps" as const) : ("standaard" as const),
    };
  },
});

// ============================================
// Mutations — handmatig ordenen, tijd/duur-overrides (kantoor)
// ============================================

/**
 * Herordenen van de klantblokken van een team-dag (slepen, §2.2 fase 1:
 * handmatig ordenen). Het blok reist als geheel; taken zitten op het
 * werkitem, reistijden volgen de nieuwe adresvolgorde vanzelf (afgeleid).
 */
export const herordenDag = mutation({
  args: {
    teamId: v.id("teams"),
    datum: v.string(),
    werkitemIds: v.array(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const team = await requireTeamVanOrg(ctx, args.teamId, orgId);

    const huidig = await werkitemsVoorTeamDag(
      ctx.db,
      orgId,
      args.teamId,
      args.datum
    );
    const huidigeIds = new Set(huidig.map((i) => i._id.toString()));
    if (
      args.werkitemIds.length !== huidig.length ||
      args.werkitemIds.some((id) => !huidigeIds.has(id.toString()))
    ) {
      throw new ConvexError(
        "Volgorde komt niet overeen met de werkitems van deze team-dag"
      );
    }

    const now = Date.now();
    for (let i = 0; i < args.werkitemIds.length; i++) {
      await ctx.db.patch(args.werkitemIds[i], {
        volgordeBinnenDag: i + 1,
        updatedAt: now,
      });
    }
    await logPlanwijziging(ctx, {
      orgId,
      door: kantoorUser._id,
      actie: "volgorde_gewijzigd",
      details: `Dagkaart ${team.naam} ${args.datum}: volgorde gewijzigd (${args.werkitemIds.length} stops)`,
      teamId: args.teamId,
    });
    return null;
  },
});

/**
 * Handmatige tijd/duur-override op een klantblok. Handmatige waarden blijven
 * ALTIJD leidend (§8.9); `null` wist een override (terug naar afgeleid).
 * Duur wijzigen pint de starttijd bewust niet: het blok schuift mee, alles
 * erná cascadeert door.
 */
export const setTijdOverride = mutation({
  args: {
    id: v.id("projecten"),
    geplandeStartTijd: v.optional(v.union(v.string(), v.null())),
    duurOverrideMinuten: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.deletedAt || item.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Werkitem niet gevonden");
    }

    const patch: Partial<WerkItem> = { updatedAt: Date.now() };
    const wijzigingen: string[] = [];
    if (args.geplandeStartTijd !== undefined) {
      if (args.geplandeStartTijd !== null && !isGeldigeTijd(args.geplandeStartTijd)) {
        throw new ConvexError("Ongeldige starttijd (verwacht HH:MM)");
      }
      patch.geplandeStartTijd = args.geplandeStartTijd ?? undefined;
      wijzigingen.push(
        args.geplandeStartTijd === null
          ? "starttijd terug naar berekend"
          : `starttijd handmatig ${args.geplandeStartTijd}`
      );
    }
    if (args.duurOverrideMinuten !== undefined) {
      if (
        args.duurOverrideMinuten !== null &&
        (!Number.isFinite(args.duurOverrideMinuten) ||
          args.duurOverrideMinuten <= 0 ||
          args.duurOverrideMinuten > MAX_DUUR_MINUTEN)
      ) {
        throw new ConvexError("Ongeldige duur (1 t/m 1440 minuten)");
      }
      patch.duurOverrideMinuten = args.duurOverrideMinuten ?? undefined;
      wijzigingen.push(
        args.duurOverrideMinuten === null
          ? "duur terug naar geschat"
          : `duur handmatig ${args.duurOverrideMinuten} min`
      );
    }
    if (wijzigingen.length === 0) return null;

    await ctx.db.patch(args.id, patch);
    await logPlanwijziging(ctx, {
      orgId,
      door: kantoorUser._id,
      actie: "tijd_aangepast",
      details: `${item.naam}: ${wijzigingen.join(", ")} (cascade schuift door)`,
      werkitemId: args.id,
      teamId: item.teamId,
    });
    return null;
  },
});

/**
 * Dag-specifieke afwijking van de standaardblokken (vertrek/pauze/afronding)
 * voor één team-dag. `herstel: true` wist de afwijking (terug naar de
 * bedrijfsinstelling — alleen afwijkingen worden opgeslagen).
 */
export const setDagAfwijking = mutation({
  args: {
    teamId: v.id("teams"),
    datum: v.string(),
    vertrekTijd: v.optional(v.string()),
    pauzeStart: v.optional(v.string()),
    pauzeEind: v.optional(v.string()),
    loodsAfrondingMinuten: v.optional(v.number()),
    herstel: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const org = await requireOrg(ctx);
    const team = await requireTeamVanOrg(ctx, args.teamId, org._id);

    const bestaand = await ctx.db
      .query("dagkaartAfwijkingen")
      .withIndex("by_team_datum", (q) =>
        q.eq("teamId", args.teamId).eq("datum", args.datum)
      )
      .unique();

    if (args.herstel) {
      if (bestaand) await ctx.db.delete(bestaand._id);
      await logPlanwijziging(ctx, {
        orgId: org._id,
        door: kantoorUser._id,
        actie: "dagblokken_aangepast",
        details: `Dagkaart ${team.naam} ${args.datum}: standaardblokken hersteld`,
        teamId: args.teamId,
      });
      return null;
    }

    for (const tijd of [args.vertrekTijd, args.pauzeStart, args.pauzeEind]) {
      if (tijd !== undefined && !isGeldigeTijd(tijd)) {
        throw new ConvexError("Ongeldige tijd (verwacht HH:MM)");
      }
    }
    const pauzeStart = args.pauzeStart ?? bestaand?.pauzeStart;
    const pauzeEind = args.pauzeEind ?? bestaand?.pauzeEind;
    if (pauzeStart && pauzeEind && naarMinuten(pauzeEind) < naarMinuten(pauzeStart)) {
      throw new ConvexError("Pauze-einde ligt vóór de pauzestart");
    }
    if (
      args.loodsAfrondingMinuten !== undefined &&
      (!Number.isFinite(args.loodsAfrondingMinuten) ||
        args.loodsAfrondingMinuten < 0 ||
        args.loodsAfrondingMinuten > MAX_DUUR_MINUTEN)
    ) {
      throw new ConvexError("Ongeldige loods-afronding (0 t/m 1440 minuten)");
    }

    const now = Date.now();
    if (bestaand) {
      await ctx.db.patch(bestaand._id, {
        vertrekTijd: args.vertrekTijd ?? bestaand.vertrekTijd,
        pauzeStart: args.pauzeStart ?? bestaand.pauzeStart,
        pauzeEind: args.pauzeEind ?? bestaand.pauzeEind,
        loodsAfrondingMinuten:
          args.loodsAfrondingMinuten ?? bestaand.loodsAfrondingMinuten,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("dagkaartAfwijkingen", {
        orgId: org._id,
        teamId: args.teamId,
        datum: args.datum,
        vertrekTijd: args.vertrekTijd,
        pauzeStart: args.pauzeStart,
        pauzeEind: args.pauzeEind,
        loodsAfrondingMinuten: args.loodsAfrondingMinuten,
        createdAt: now,
        updatedAt: now,
      });
    }
    await logPlanwijziging(ctx, {
      orgId: org._id,
      door: kantoorUser._id,
      actie: "dagblokken_aangepast",
      details: `Dagkaart ${team.naam} ${args.datum}: standaardblokken afwijkend ingesteld`,
      teamId: args.teamId,
    });
    return null;
  },
});

/**
 * Eén taak uit een klantblok losmaken → aparte rest-opdracht terug in de
 * opdrachtenbak (§2.2). De laatste taak kan niet los (haal dan het hele
 * werkitem uit het bord). Idempotentie-gevoelige velden (generatieSleutel,
 * offerte-/factuurkoppeling) gaan bewust NIET mee naar de rest-opdracht.
 */
export const maakTaakLos = mutation({
  args: {
    id: v.id("projecten"),
    taakIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const item = await ctx.db.get(args.id);
    if (!item || item.deletedAt || item.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Werkitem niet gevonden");
    }

    const splitsing = splitsTaakUit(item.bouwsteenRegels, args.taakIndex);
    if (!splitsing) {
      throw new ConvexError(
        "Deze taak kan niet worden losgemaakt: een klantblok houdt minimaal één taak (haal anders het hele werkitem terug in de bak)"
      );
    }
    const { losgemaakt, overgebleven } = splitsing;

    // Normtijd van de losgemaakte taak → geschatte uren van de rest-opdracht
    let taakUren: number | null = null;
    if (losgemaakt.bouwsteenId) {
      const bouwsteen = await ctx.db.get(losgemaakt.bouwsteenId);
      taakUren =
        bouwsteen?.urenPerBeurt ?? bouwsteen?.normurenPerEenheid ?? null;
    }

    const now = Date.now();
    await ctx.db.patch(item._id, {
      bouwsteenRegels: overgebleven,
      geschatteUren:
        item.geschatteUren !== undefined && taakUren !== null
          ? Math.max(0, item.geschatteUren - taakUren)
          : item.geschatteUren,
      updatedAt: now,
    });

    // Rest-opdracht: ongepland (geen geplandeStart) → verschijnt in de bak
    const restId = await ctx.db.insert("projecten", {
      orgId,
      type: getType(item),
      klantId: item.klantId,
      status: "gepland",
      naam: `${item.naam} (rest: ${losgemaakt.omschrijving})`,
      isRestOpdracht: true, // rest-label in de wachtrij (§2.2/§8.8)
      bouwsteenRegels: [losgemaakt],
      geschatteUren: taakUren ?? undefined,
      adres: item.adres,
      contractId: item.contractId,
      voorkeursTeamId: item.voorkeursTeamId ?? item.teamId,
      beschikbaarheidsVenster: item.beschikbaarheidsVenster,
      createdAt: now,
      updatedAt: now,
    });

    await logPlanwijziging(ctx, {
      orgId,
      door: kantoorUser._id,
      actie: "taak_losgemaakt",
      details: `Taak "${losgemaakt.omschrijving}" losgemaakt uit ${item.naam} → rest-opdracht in de bak`,
      werkitemId: item._id,
      teamId: item.teamId,
    });
    return { restId };
  },
});

// ============================================
// Reistijdberekening (action) + cache — Maps-key ontbreekt bewust
// ============================================

/** Adresparen van een team-dag die nog niet in de cache staan (intern). */
export const getOntbrekendeAdresParen = internalQuery({
  args: {
    teamId: v.id("teams"),
    datum: v.string(),
  },
  handler: async (ctx, args) => {
    // De rol-/eigendomscheck van de reistijdberekening staat hier en niet in de
    // aanroepende action: alleen deze ctx heeft db-toegang. Niveau = *lezen*
    // van de dagkaart (zoals getDagkaart), niet muteren (requireKantoor):
    // voorman en medewerker openen de dagkaart ook en hebben de reistijden
    // nodig. Klanten hebben hier niets te zoeken en mogen dus ook geen
    // (betaalde) Maps-calls kunnen uitlokken.
    await requireNotViewer(ctx);
    const orgId = await requireOrgId(ctx);
    await requireTeamVanOrg(ctx, args.teamId, orgId);
    const [items, config] = await Promise.all([
      werkitemsVoorTeamDag(ctx.db, orgId, args.teamId, args.datum),
      dagkaartStandaardenVoor(ctx.db, orgId, args.teamId, args.datum),
    ]);
    const klantCache = new Map<string, Doc<"klanten"> | null>();
    const adressen: (string | null)[] = [];
    for (const item of items) {
      if (item.adres) {
        adressen.push(item.adres);
        continue;
      }
      if (!item.klantId) {
        adressen.push(null);
        continue;
      }
      if (!klantCache.has(item.klantId)) {
        klantCache.set(item.klantId, await ctx.db.get(item.klantId));
      }
      const klant = klantCache.get(item.klantId) ?? null;
      adressen.push(klant ? `${klant.adres}, ${klant.plaats}` : null);
    }
    const paren = adresParenVoorDag(config.loodsAdres, adressen);

    const ontbrekend: AdresPaar[] = [];
    const gezien = new Set<string>();
    for (const paar of paren) {
      if (!paar || gezien.has(paar.sleutel)) continue;
      gezien.add(paar.sleutel);
      const rij = await ctx.db
        .query("reistijdCache")
        .withIndex("by_org_sleutel", (q) =>
          q.eq("orgId", orgId).eq("sleutel", paar.sleutel)
        )
        .unique();
      if (!rij) ontbrekend.push(paar);
    }
    return {
      ontbrekend,
      standaardMinuten: config.standaarden.standaardReistijdMinuten,
    };
  },
});

/** Berekende reistijd per adrespaar opslaan (upsert, intern). */
export const slaReistijdOp = internalMutation({
  args: {
    sleutel: v.string(),
    vanAdres: v.string(),
    naarAdres: v.string(),
    minuten: v.number(),
    bron: v.union(v.literal("standaard"), v.literal("google_maps")),
  },
  handler: async (ctx, args) => {
    const org = await requireOrg(ctx);
    const bestaand = await ctx.db
      .query("reistijdCache")
      .withIndex("by_org_sleutel", (q) =>
        q.eq("orgId", org._id).eq("sleutel", args.sleutel)
      )
      .unique();
    const now = Date.now();
    if (bestaand) {
      await ctx.db.patch(bestaand._id, {
        minuten: args.minuten,
        bron: args.bron,
        berekendOp: now,
      });
    } else {
      await ctx.db.insert("reistijdCache", {
        orgId: org._id,
        sleutel: args.sleutel,
        vanAdres: args.vanAdres,
        naarAdres: args.naarAdres,
        minuten: args.minuten,
        bron: args.bron,
        berekendOp: now,
      });
    }
    return null;
  },
});

/**
 * Reistijden van een team-dag (bij)berekenen en cachen. Zonder
 * GOOGLE_MAPS_API_KEY op de deployment is dit bewust een no-op: de dagkaart
 * valt dan fail-closed terug op de standaard-reistijd (fase 1-gedrag).
 */
export const berekenReistijdenVoorDag = action({
  args: {
    teamId: v.id("teams"),
    datum: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ berekend: number; bron: "standaard" | "google_maps" }> => {
    // Deze action belt (met Maps-key) een betaalde Google-API; ongeguard is dat
    // een open kostenkraan voor iedereen die de deployment-URL kent. In een
    // action bestaat ctx.db niet, dus de auth-helpers (QueryCtx) kunnen hier
    // niet draaien. Daarom: hier een goedkope identiteitscheck die faalt vóór
    // er ook maar iets gebeurt, en de rol- en teameigendomscheck in de
    // internalQuery getOntbrekendeAdresParen hieronder — die heeft wél db.
    // Convex geeft de identiteit door aan runQuery/runMutation, dus die guard
    // dekt dezelfde aanroeper af.
    const identiteit = await ctx.auth.getUserIdentity();
    if (!identiteit) {
      throw new ConvexError("Je moet ingelogd zijn om reistijden te berekenen");
    }

    // De guard hierboven sluit de kraan voor buitenstaanders, maar niet voor een
    // ingelogde tenant die adressen blijft wijzigen: elke wijziging mint een
    // nieuwe cachesleutel en dus nieuwe betaalde Maps-calls, in een lus zonder
    // bovengrens. Vandaar een rem per gebruiker én een plafond per aanroep.
    const limiet = checkReistijdRateLimit(identiteit.subject);
    if (!limiet.allowed) {
      throw new ConvexError(
        "Te veel reistijdberekeningen achter elkaar. Probeer het over een minuut opnieuw."
      );
    }

    const { ontbrekend, standaardMinuten } = await ctx.runQuery(
      internal.dagkaart.getOntbrekendeAdresParen,
      { teamId: args.teamId, datum: args.datum }
    );
    const provider = kiesReistijdProvider({
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
      standaardMinuten,
    });
    if (provider.bron === "standaard") {
      // Geen Maps-key: niets cachen — de query levert de standaard-reistijd
      return { berekend: 0, bron: "standaard" };
    }
    let berekend = 0;
    for (const paar of ontbrekend) {
      // Harde bovengrens per aanroep: een team-dag heeft in de praktijk een
      // handvol stops, dus dit raakt geen echte planning, maar het voorkomt dat
      // één aanroep een onbeperkt aantal betaalde calls afvuurt. De rest wordt
      // bij een volgende aanroep alsnog berekend.
      if (berekend >= MAX_MAPS_CALLS_PER_AANROEP) break;
      const minuten = await provider.berekenMinuten(
        paar.vanAdres,
        paar.naarAdres
      );
      await ctx.runMutation(internal.dagkaart.slaReistijdOp, {
        sleutel: paar.sleutel,
        vanAdres: paar.vanAdres,
        naarAdres: paar.naarAdres,
        minuten,
        bron: provider.bron,
      });
      berekend++;
    }
    return { berekend, bron: provider.bron };
  },
});
