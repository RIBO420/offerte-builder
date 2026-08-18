/**
 * Planbord — weekbord-backend (PRD §2.2, fase 1 stap 5a).
 *
 * Principes:
 * - Het WERKITEM (tabel "projecten") is de enige waarheid voor planning;
 *   dit bestand schrijft planvelden UITSLUITEND via patches op werkitems
 *   (en via werkitems.updatePlanning vanuit de UI). weekPlanning en
 *   planningTaken zijn voor planning DEPRECATED (zie schema-comments).
 * - Team ≠ kleurlabel (bijlage B): bemanning per team-dag via teamBemanning,
 *   default = vaste teamleden.
 * - Afwezigheidsblokken (verlof/ziekte/feestdag) zijn niet-klant-blokken;
 *   fase 1 handmatig, GEEN koppeling met verlofaanvragen/HR (fase 3).
 * - Elke planwijziging logt een audit-event (wie/wat/wanneer).
 * - Rollen: kantoor plant (requireKantoor), voorman/medewerker leest.
 *
 * Naamconflict-waarschuwing: de tabel `routes` is GPS-tracking; planbord-
 * concepten heten hier nooit "route".
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireOrgContext, requireOrgId } from "./auth";
import { requireKantoor } from "./roles";
import { beschikbaarheidsVensterValidator } from "./validators";
import {
  addDagen,
  berekenDuplicaatPlanning,
  effectievePlanvoorkeuren,
  isRelevantVoorWachtrij,
  logPlanwijziging,
  overlaptPeriode,
  seizoensvensterWaarschuwing,
  valideerSplitsDelen,
  werkitemOpDag,
} from "./planbordLogica";
import {
  berekenMaterieelWaarschuwingen,
  machineStatusNaarMiddelStatus,
  maakMiddelSleutel,
  voertuigStatusNaarMiddelStatus,
  type MiddelStatus,
} from "./machineparkLogica";
import { getType, seizoensvensterVoorWerkitem, type WerkItem } from "./werkitems";

// ============================================
// Queries
// ============================================

/**
 * Bordcontext voor een datumrange: teams (rijen), bemanning per team-dag
 * (default = vaste leden, override via teamBemanning), afwezigheidsblokken,
 * een naam-map van medewerkers en materieel-waarschuwingen (PRD §3.3:
 * kapotte bus/machine op gekoppelde team-dagen + dubbel geclaimd schaars
 * materieel). Leesbaar voor alle stafrollen.
 */
export const getBordContext = query({
  args: {
    start: v.string(), // YYYY-MM-DD (inclusief)
    eind: v.string(), // YYYY-MM-DD (inclusief)
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);

    const [
      teams,
      bemanningRijen,
      blokken,
      medewerkers,
      busOverrides,
      reserveringen,
      voertuigen,
      machines,
    ] = await Promise.all([
      ctx.db
        .query("teams")
        .withIndex("by_org_actief", (q) =>
          q.eq("orgId", orgId).eq("isActief", true)
        )
        .collect(),
      ctx.db
        .query("teamBemanning")
        .withIndex("by_org_datum", (q) =>
          q.eq("orgId", orgId).gte("datum", args.start).lte("datum", args.eind)
        )
        .collect(),
      ctx.db
        .query("afwezigheidsblokken")
        .withIndex("by_org_start", (q) =>
          q.eq("orgId", orgId).lte("startDatum", args.eind)
        )
        .collect(),
      ctx.db
        .query("medewerkers")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
      ctx.db
        .query("teamBusOverrides")
        .withIndex("by_org_datum", (q) =>
          q.eq("orgId", orgId).gte("datum", args.start).lte("datum", args.eind)
        )
        .collect(),
      ctx.db
        .query("middelReserveringen")
        .withIndex("by_org_datum", (q) =>
          q.eq("orgId", orgId).gte("datum", args.start).lte("datum", args.eind)
        )
        .collect(),
      ctx.db
        .query("voertuigen")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
      ctx.db
        .query("machines")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
    ]);

    const medewerkerNamen: Record<string, string> = {};
    for (const m of medewerkers) medewerkerNamen[m._id] = m.naam;

    // — Materieel-waarschuwingen (§3.3): kapot + dubbel geclaimd —
    const datums: string[] = [];
    for (
      let d = args.start;
      d <= args.eind && datums.length < 62;
      d = addDagen(d, 1)
    ) {
      datums.push(d);
    }
    const middelen = new Map<
      string,
      { naam: string; status: MiddelStatus }
    >();
    for (const vt of voertuigen) {
      middelen.set(maakMiddelSleutel("voertuig", vt._id.toString()), {
        naam: `${vt.merk} ${vt.model} (${vt.kenteken})`,
        status: voertuigStatusNaarMiddelStatus(vt.status),
      });
    }
    for (const m of machines) {
      middelen.set(maakMiddelSleutel("machine", m._id.toString()), {
        naam: m.naam,
        status: machineStatusNaarMiddelStatus(m.status, m.isActief),
      });
    }
    const werkitemCache = new Map<string, Doc<"projecten"> | null>();
    const reserveringenVerrijkt = [];
    for (const r of reserveringen) {
      const key = r.werkitemId.toString();
      if (!werkitemCache.has(key)) {
        werkitemCache.set(key, await ctx.db.get(r.werkitemId));
      }
      const werkitem = werkitemCache.get(key) ?? null;
      if (!werkitem || werkitem.deletedAt) continue;
      reserveringenVerrijkt.push({
        middelSleutel: r.middelSleutel,
        datum: r.datum,
        werkitemId: key,
        teamId: werkitem.teamId?.toString() ?? null,
        werkitemNaam: werkitem.naam,
      });
    }
    const materieelWaarschuwingen = berekenMaterieelWaarschuwingen({
      datums,
      teams: teams.map((t) => ({
        teamId: t._id.toString(),
        naam: t.naam,
        standaardVoertuigId: t.standaardVoertuigId?.toString() ?? null,
      })),
      busOverrides: busOverrides.map((o) => ({
        teamId: o.teamId.toString(),
        datum: o.datum,
        voertuigId: o.voertuigId.toString(),
      })),
      middelen,
      reserveringen: reserveringenVerrijkt,
    });

    return {
      teams: teams.map((t) => ({
        _id: t._id,
        naam: t.naam,
        leden: t.leden,
        kleur: t.kleur ?? null,
        standaardVoertuigId: t.standaardVoertuigId ?? null,
      })),
      // Alleen afwijkende bemanning; default = teams.leden (client combineert
      // via bemanningVoorDag uit planbordLogica)
      bemanning: bemanningRijen.map((r) => ({
        teamId: r.teamId,
        datum: r.datum,
        medewerkerIds: r.medewerkerIds,
      })),
      afwezigheid: blokken.filter((b) =>
        overlaptPeriode(b.startDatum, b.eindDatum, args.start, args.eind)
      ),
      medewerkerNamen,
      materieelWaarschuwingen,
    };
  },
});

/**
 * Wachtrij ("opdrachtenbak", §2.2): ongeplande werkitems, verrijkt met
 * klantnaam en planvoorkeuren (voorkeursteam + beschikbaarheidsvenster).
 * Terugkerende beurten alleen in de weken waarin ze relevant zijn
 * (voorzieneDatum ± marge; achterstallig blijft zichtbaar).
 */
export const getWachtrij = query({
  args: {
    start: v.string(), // YYYY-MM-DD — zichtbare bordperiode
    eind: v.string(),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const items = await ctx.db
      .query("projecten")
      .withIndex("by_org_geplandeStart", (q) =>
        q.eq("orgId", orgId).eq("geplandeStart", undefined)
      )
      .collect();

    const relevant = items.filter(
      (item) =>
        item.status === "gepland" &&
        !item.deletedAt &&
        item.isArchived !== true &&
        // Ritme-moederbeurten mét attendering (§2.1/§8.12): de beurt komt
        // pas in de wachtrij nadat kantoor hem vanuit de plantaak vrijgeeft
        // (planningsattendering.geefBeurtVrij maakt de concrete beurt aan).
        // Met attendering uit blijft de moeder gewoon zichtbaar (oud gedrag).
        !(item.ritme && item.attenderingNodig !== false) &&
        isRelevantVoorWachtrij(item, args.start, args.eind)
    );

    // Klant- en teamgegevens voor hints (kleine aantallen; geen N+1 op
    // dezelfde klant dankzij memoisatie per id)
    const klantCache = new Map<string, Doc<"klanten"> | null>();
    const teamNaamCache = new Map<string, string | null>();

    const verrijkt = [];
    for (const item of relevant) {
      let klant: Doc<"klanten"> | null = null;
      if (item.klantId) {
        if (!klantCache.has(item.klantId)) {
          klantCache.set(item.klantId, await ctx.db.get(item.klantId));
        }
        klant = klantCache.get(item.klantId) ?? null;
      }
      const voorkeuren = effectievePlanvoorkeuren(item, klant);
      let voorkeursTeamNaam: string | null = null;
      if (voorkeuren.voorkeursTeamId) {
        if (!teamNaamCache.has(voorkeuren.voorkeursTeamId)) {
          const team = await ctx.db.get(voorkeuren.voorkeursTeamId);
          teamNaamCache.set(voorkeuren.voorkeursTeamId, team?.naam ?? null);
        }
        voorkeursTeamNaam = teamNaamCache.get(voorkeuren.voorkeursTeamId) ?? null;
      }
      verrijkt.push({
        _id: item._id,
        naam: item.naam,
        type: getType(item),
        klantNaam: klant?.naam ?? null,
        adres: item.adres ?? (klant ? `${klant.adres}, ${klant.plaats}` : null),
        geschatteUren: item.geschatteUren ?? null,
        voorzieneDatum: item.voorzieneDatum ?? null,
        voorkeursTeamId: voorkeuren.voorkeursTeamId ?? null,
        voorkeursTeamNaam,
        beschikbaarheidsVenster: voorkeuren.beschikbaarheidsVenster ?? null,
      });
    }
    // Voorziene datum eerst (meest urgent bovenaan), daarna projecten op naam
    return verrijkt.sort((a, b) =>
      (a.voorzieneDatum ?? "9999").localeCompare(b.voorzieneDatum ?? "9999") ||
      a.naam.localeCompare(b.naam)
    );
  },
});

/** Recente planwijzigingen (audit-log), nieuwste eerst. */
export const getLogboek = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    return await ctx.db
      .query("planbordLogboek")
      .withIndex("by_org_createdAt", (q) => q.eq("orgId", orgId))
      .order("desc")
      .take(Math.min(args.limit ?? 50, 200));
  },
});

// ============================================
// Mutations — bemanning & afwezigheid
// ============================================

/**
 * Bemanning van een team-dag zetten (upsert, idempotent). Een lege lijst is
 * toegestaan (team die dag zonder bemanning); default herstellen = rij wissen
 * via `herstelBemanning`.
 */
export const setBemanning = mutation({
  args: {
    teamId: v.id("teams"),
    datum: v.string(), // YYYY-MM-DD
    medewerkerIds: v.array(v.id("medewerkers")),
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const { org, user } = await requireOrgContext(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team || team.orgId?.toString() !== org._id.toString()) {
      throw new ConvexError("Team niet gevonden");
    }
    const bestaand = await ctx.db
      .query("teamBemanning")
      .withIndex("by_team_datum", (q) =>
        q.eq("teamId", args.teamId).eq("datum", args.datum)
      )
      .unique();
    const now = Date.now();
    if (bestaand) {
      await ctx.db.patch(bestaand._id, {
        medewerkerIds: args.medewerkerIds,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("teamBemanning", {
        orgId: org._id,
        userId: user._id,
        teamId: args.teamId,
        datum: args.datum,
        medewerkerIds: args.medewerkerIds,
        createdAt: now,
        updatedAt: now,
      });
    }
    await logPlanwijziging(ctx, {
      orgId: org._id,
      userId: user._id,
      door: kantoorUser._id,
      actie: "bemanning_gewijzigd",
      details: `Bemanning ${team.naam} op ${args.datum}: ${args.medewerkerIds.length} medewerker(s)`,
      teamId: args.teamId,
    });
    return null;
  },
});

/** Bemanning-afwijking van een team-dag wissen (terug naar vaste leden). */
export const herstelBemanning = mutation({
  args: { teamId: v.id("teams"), datum: v.string() },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const { org, user } = await requireOrgContext(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team || team.orgId?.toString() !== org._id.toString()) {
      throw new ConvexError("Team niet gevonden");
    }
    const bestaand = await ctx.db
      .query("teamBemanning")
      .withIndex("by_team_datum", (q) =>
        q.eq("teamId", args.teamId).eq("datum", args.datum)
      )
      .unique();
    if (bestaand) {
      await ctx.db.delete(bestaand._id);
      await logPlanwijziging(ctx, {
        orgId: org._id,
        userId: user._id,
        door: kantoorUser._id,
        actie: "bemanning_gewijzigd",
        details: `Bemanning ${team.naam} op ${args.datum} teruggezet naar vaste teamleden`,
        teamId: args.teamId,
      });
    }
    return null;
  },
});

/**
 * Afwezigheidsblok plaatsen (fase 1: handmatig via het bord). Scope is óf
 * één medewerker, óf een heel team — precies één van beide.
 */
export const createAfwezigheid = mutation({
  args: {
    medewerkerId: v.optional(v.id("medewerkers")),
    teamId: v.optional(v.id("teams")),
    startDatum: v.string(),
    eindDatum: v.string(),
    reden: v.union(
      v.literal("verlof"),
      v.literal("ziekte"),
      v.literal("feestdag"),
      v.literal("overig")
    ),
    omschrijving: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const { org, user } = await requireOrgContext(ctx);
    if (!args.medewerkerId === !args.teamId) {
      throw new ConvexError(
        "Kies precies één scope: een medewerker óf een heel team"
      );
    }
    if (args.eindDatum < args.startDatum) {
      throw new ConvexError("Einddatum ligt vóór de startdatum");
    }
    let scopeNaam = "";
    if (args.medewerkerId) {
      const m = await ctx.db.get(args.medewerkerId);
      if (!m || m.orgId?.toString() !== org._id.toString()) {
        throw new ConvexError("Medewerker niet gevonden");
      }
      scopeNaam = m.naam;
    }
    if (args.teamId) {
      const t = await ctx.db.get(args.teamId);
      if (!t || t.orgId?.toString() !== org._id.toString()) {
        throw new ConvexError("Team niet gevonden");
      }
      scopeNaam = `team ${t.naam}`;
    }
    const now = Date.now();
    const id = await ctx.db.insert("afwezigheidsblokken", {
      orgId: org._id,
      userId: user._id,
      medewerkerId: args.medewerkerId,
      teamId: args.teamId,
      startDatum: args.startDatum,
      eindDatum: args.eindDatum,
      reden: args.reden,
      omschrijving: args.omschrijving,
      createdAt: now,
      updatedAt: now,
    });
    await logPlanwijziging(ctx, {
      orgId: org._id,
      userId: user._id,
      door: kantoorUser._id,
      actie: "afwezigheid_toegevoegd",
      details: `Afwezigheid (${args.reden}) voor ${scopeNaam}: ${args.startDatum} t/m ${args.eindDatum}`,
      teamId: args.teamId,
    });
    return id;
  },
});

export const verwijderAfwezigheid = mutation({
  args: { id: v.id("afwezigheidsblokken") },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const blok = await ctx.db.get(args.id);
    if (!blok || blok.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Afwezigheidsblok niet gevonden");
    }
    await ctx.db.delete(args.id);
    await logPlanwijziging(ctx, {
      orgId,
      userId: kantoorUser._id,
      door: kantoorUser._id,
      actie: "afwezigheid_verwijderd",
      details: `Afwezigheid (${blok.reden}) verwijderd: ${blok.startDatum} t/m ${blok.eindDatum}`,
      teamId: blok.teamId,
    });
    return null;
  },
});

// ============================================
// Mutations — ziekte/uitval, dupliceren, splitsen
// ============================================

/**
 * Ziekte/uitval-scenario (§2.2): team van een dag loskoppelen — alle
 * werkitems van dat team op die dag gaan in één keer terug in de bak.
 * Meerdaagse items die die dag raken worden volledig ontpland (fase 1;
 * gedeeltelijk herplannen kan daarna via splitsen).
 */
export const koppelTeamLos = mutation({
  args: {
    teamId: v.id("teams"),
    datum: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team || team.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Team niet gevonden");
    }
    const kandidaten = await ctx.db
      .query("projecten")
      .withIndex("by_team_geplandeStart", (q) =>
        q.eq("teamId", args.teamId).lte("geplandeStart", args.datum)
      )
      .collect();
    const geraakt = kandidaten.filter(
      (item) =>
        !item.deletedAt &&
        item.isArchived !== true &&
        item.orgId?.toString() === orgId.toString() &&
        werkitemOpDag(item, args.datum)
    );
    for (const item of geraakt) {
      await ctx.db.patch(item._id, {
        geplandeStart: undefined,
        geplandeEind: undefined,
        teamId: undefined,
        volgordeBinnenDag: undefined,
        geplandeStartTijd: undefined,
        geplandeEindTijd: undefined,
        updatedAt: Date.now(),
      });
    }
    await logPlanwijziging(ctx, {
      orgId,
      userId: kantoorUser._id,
      door: kantoorUser._id,
      actie: "team_losgekoppeld",
      details: `Team ${team.naam} losgekoppeld van ${args.datum}: ${geraakt.length} werkitem(s) terug in de bak`,
      teamId: args.teamId,
    });
    return { aantalTerugInBak: geraakt.length };
  },
});

/**
 * Velden die bij dupliceren/splitsen meegaan naar de nieuwe rij.
 * Bewust NIET gekopieerd: offerteId/offerteRegelIds (facturatie-koppeling),
 * generatieSleutel (idempotentie beurtengenerator), factuurId, status-historie.
 */
function kopieerbareVelden(item: WerkItem) {
  return {
    // Tenant-scope: `orgId` is de scope; `userId` blijft tot fase 6 meegeschreven
    orgId: item.orgId,
    userId: item.userId,
    type: getType(item),
    klantId: item.klantId,
    status: "gepland" as const,
    contractId: item.contractId,
    contractWerkzaamheidId: item.contractWerkzaamheidId,
    bouwsteenRegels: item.bouwsteenRegels,
    geschatteUren: item.geschatteUren,
    adres: item.adres,
    voorkeursTeamId: item.voorkeursTeamId,
    beschikbaarheidsVenster: item.beschikbaarheidsVenster,
  };
}

/**
 * Dupliceren naar een andere dag met behoud van team en tijden (expliciete
 * wens Yannick, §2.2). Maakt een NIEUW werkitem (kopie) op de doeldag; duur,
 * teamId, tijden en volgorde blijven gelijk.
 */
export const dupliceerWerkitem = mutation({
  args: {
    id: v.id("projecten"),
    doelDatum: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const item = await ctx.db.get(args.id);
    if (
      !item ||
      item.deletedAt ||
      item.orgId?.toString() !== orgId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }
    const planning = berekenDuplicaatPlanning(item, args.doelDatum);
    const now = Date.now();
    const nieuwId = await ctx.db.insert("projecten", {
      ...kopieerbareVelden(item),
      naam: item.naam,
      geplandeStart: planning.geplandeStart,
      geplandeEind: planning.geplandeEind,
      teamId: item.teamId,
      volgordeBinnenDag: item.volgordeBinnenDag,
      geplandeStartTijd: item.geplandeStartTijd,
      geplandeEindTijd: item.geplandeEindTijd,
      createdAt: now,
      updatedAt: now,
    });
    await logPlanwijziging(ctx, {
      orgId,
      userId: kantoorUser._id,
      door: kantoorUser._id,
      actie: "gedupliceerd",
      details: `${item.naam} gedupliceerd naar ${args.doelDatum} (team en tijden behouden)`,
      werkitemId: nieuwId,
      teamId: item.teamId,
    });
    const venster = await seizoensvensterVoorWerkitem(ctx, item);
    return {
      id: nieuwId,
      waarschuwing: seizoensvensterWaarschuwing(
        venster,
        planning.geplandeStart,
        item.naam
      ),
    };
  },
});

/**
 * Splitsen van een klus over meerdere dagen of teams (§2.2). Het origineel
 * wordt deel 1; voor elk volgend deel wordt een kopie aangemaakt. Namen
 * krijgen een "(deel i/n)"-suffix zodat uren en dagkaarten uit elkaar blijven.
 */
export const splitsWerkitem = mutation({
  args: {
    id: v.id("projecten"),
    delen: v.array(
      v.object({
        geplandeStart: v.string(),
        geplandeEind: v.optional(v.string()),
        teamId: v.optional(v.id("teams")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const kantoorUser = await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const item = await ctx.db.get(args.id);
    if (
      !item ||
      item.deletedAt ||
      item.orgId?.toString() !== orgId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }
    const fout = valideerSplitsDelen(args.delen);
    if (fout) throw new ConvexError(fout);
    for (const deel of args.delen) {
      if (deel.teamId) {
        const team = await ctx.db.get(deel.teamId);
        if (!team || team.orgId?.toString() !== orgId.toString()) {
          throw new ConvexError("Team niet gevonden");
        }
      }
    }

    const n = args.delen.length;
    const basisNaam = item.naam.replace(/ \(deel \d+\/\d+\)$/, "");
    const now = Date.now();
    const ids: Id<"projecten">[] = [];

    // Deel 1 = het origineel (behoudt offerte-/facturatie-koppelingen)
    const eerste = args.delen[0];
    await ctx.db.patch(item._id, {
      naam: `${basisNaam} (deel 1/${n})`,
      geplandeStart: eerste.geplandeStart,
      geplandeEind: eerste.geplandeEind ?? eerste.geplandeStart,
      teamId: eerste.teamId ?? item.teamId,
      updatedAt: now,
    });
    ids.push(item._id);

    for (let i = 1; i < n; i++) {
      const deel = args.delen[i];
      const nieuwId = await ctx.db.insert("projecten", {
        ...kopieerbareVelden(item),
        naam: `${basisNaam} (deel ${i + 1}/${n})`,
        geplandeStart: deel.geplandeStart,
        geplandeEind: deel.geplandeEind ?? deel.geplandeStart,
        teamId: deel.teamId ?? item.teamId,
        geplandeStartTijd: item.geplandeStartTijd,
        geplandeEindTijd: item.geplandeEindTijd,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(nieuwId);
    }

    await logPlanwijziging(ctx, {
      orgId,
      userId: kantoorUser._id,
      door: kantoorUser._id,
      actie: "gesplitst",
      details: `${basisNaam} gesplitst in ${n} delen (${args.delen
        .map((d) => d.geplandeStart)
        .join(", ")})`,
      werkitemId: item._id,
      teamId: item.teamId,
    });
    return { ids };
  },
});

// ============================================
// Mutations — planvoorkeuren (beschikbaarheidsvenster + voorkeursteam)
// ============================================

/** Planvoorkeuren op de klant zetten (§2.2). `null` wist een veld. */
export const setPlanvoorkeurenKlant = mutation({
  args: {
    klantId: v.id("klanten"),
    voorkeursTeamId: v.optional(v.union(v.id("teams"), v.null())),
    beschikbaarheidsVenster: v.optional(
      v.union(beschikbaarheidsVensterValidator, v.null())
    ),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const klant = await ctx.db.get(args.klantId);
    if (!klant || klant.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Klant niet gevonden");
    }
    const patch: Partial<Doc<"klanten">> = { updatedAt: Date.now() };
    if (args.voorkeursTeamId !== undefined) {
      patch.voorkeursTeamId = args.voorkeursTeamId ?? undefined;
    }
    if (args.beschikbaarheidsVenster !== undefined) {
      patch.beschikbaarheidsVenster = args.beschikbaarheidsVenster ?? undefined;
    }
    await ctx.db.patch(args.klantId, patch);
    return null;
  },
});

/** Planvoorkeuren-override op het werkitem zetten (§2.2). `null` wist. */
export const setPlanvoorkeurenWerkitem = mutation({
  args: {
    id: v.id("projecten"),
    voorkeursTeamId: v.optional(v.union(v.id("teams"), v.null())),
    beschikbaarheidsVenster: v.optional(
      v.union(beschikbaarheidsVensterValidator, v.null())
    ),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const item = await ctx.db.get(args.id);
    if (
      !item ||
      item.deletedAt ||
      item.orgId?.toString() !== orgId.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }
    const patch: Partial<WerkItem> = { updatedAt: Date.now() };
    if (args.voorkeursTeamId !== undefined) {
      patch.voorkeursTeamId = args.voorkeursTeamId ?? undefined;
    }
    if (args.beschikbaarheidsVenster !== undefined) {
      patch.beschikbaarheidsVenster = args.beschikbaarheidsVenster ?? undefined;
    }
    await ctx.db.patch(args.id, patch);
    return null;
  },
});
