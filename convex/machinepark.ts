/**
 * Machinepark — module-backend (PRD §3.3, fase 2 stap 3).
 *
 * Machines én bussen/voertuigen in één overzicht: naam, soort, kleurcode
 * per team, status (beschikbaar / in onderhoud / kapot), schaars-vlag en
 * standaardinventaris per bus (voertuigUitrusting — voedt de bestaande
 * delta-checklist §2.6, convex/materiaalDelta.ts).
 *
 * - Status "kapot" → weekbord-waarschuwing op team-dagen waaraan het middel
 *   gekoppeld is (convex/planbord.ts → berekenMaterieelWaarschuwingen).
 * - Bus-per-team-dag: teams.standaardVoertuigId + teamBusOverrides
 *   (dag-override). Delta-keten: dag-override → standaardbus → fallback
 *   eerste toegewezen voertuig (fase 1-vangnet).
 * - Middelen als planbare resource: schaarse middelen reserveren per
 *   werkitem-dag; dubbel claimen = WAARSCHUWING, geen blokkade.
 *
 * Rollen: kantoor beheert (requireKantoor), voorman/staf leest
 * (requireInterneRol). Deze module verstuurt NOOIT e-mail.
 */

import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requireOrg, requireOrgId } from "./auth";
import { requireKantoor } from "./roles";
import { requireInterneRol } from "./tijdlijn";
import {
  dubbelClaimWaarschuwing,
  kapotWaarschuwing,
  machineStatusNaarMiddelStatus,
  maakMiddelSleutel,
  middelStatusNaarVoertuigStatus,
  voertuigStatusNaarMiddelStatus,
  type MiddelStatus,
} from "./machineparkLogica";
import { vandaagIso } from "./beurtgenerator";
import { laadDocsMap } from "./lib/batchLoad";
import { vervalTaakNodig } from "./vervalLogica";

const DATUM_PATROON = /^\d{4}-\d{2}-\d{2}$/;

const middelStatusValidator = v.union(
  v.literal("beschikbaar"),
  v.literal("onderhoud"),
  v.literal("kapot")
);

// ============================================
// Queries (staf leest)
// ============================================

/**
 * Eén overzicht over voertuigen én machines: uniforme status, team
 * (+ kleurcode), schaars-vlag en eerstvolgende vervaldatum per middel.
 */
export const getOverzicht = query({
  args: {},
  handler: async (ctx) => {
    await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);
    const vandaag = vandaagIso();

    const [voertuigen, machines, teams, vervalItems] = await Promise.all([
      ctx.db
        .query("voertuigen")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
      ctx.db
        .query("machines")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
      ctx.db
        .query("teams")
        .withIndex("by_org_actief", (q) =>
          q.eq("orgId", orgId).eq("isActief", true)
        )
        .collect(),
      ctx.db
        .query("vervalItems")
        .withIndex("by_org_actief", (q) =>
          q.eq("orgId", orgId).eq("actief", true)
        )
        .collect(),
    ]);

    const teamInfo = new Map(
      teams.map((t) => [
        t._id.toString(),
        { naam: t.naam, kleur: t.kleur ?? null },
      ])
    );
    const vervalPerMiddel = new Map<
      string,
      { eerstvolgende: string; binnenTermijn: number }
    >();
    for (const item of vervalItems) {
      const sleutel =
        item.objectType === "voertuig" && item.voertuigId
          ? maakMiddelSleutel("voertuig", item.voertuigId.toString())
          : item.objectType === "machine" && item.machineId
            ? maakMiddelSleutel("machine", item.machineId.toString())
            : null;
      if (!sleutel) continue;
      const huidig = vervalPerMiddel.get(sleutel);
      vervalPerMiddel.set(sleutel, {
        eerstvolgende:
          huidig && huidig.eerstvolgende < item.vervaldatum
            ? huidig.eerstvolgende
            : item.vervaldatum,
        binnenTermijn:
          (huidig?.binnenTermijn ?? 0) +
          (vervalTaakNodig(item, vandaag) ? 1 : 0),
      });
    }

    const naarRij = (opties: {
      soort: "voertuig" | "machine";
      id: string;
      naam: string;
      subtitel: string | null;
      status: MiddelStatus;
      schaars: boolean;
      teamId: string | null;
    }) => {
      const team = opties.teamId ? (teamInfo.get(opties.teamId) ?? null) : null;
      const verval =
        vervalPerMiddel.get(maakMiddelSleutel(opties.soort, opties.id)) ?? null;
      return {
        ...opties,
        teamNaam: team?.naam ?? null,
        teamKleur: team?.kleur ?? null,
        eerstvolgendeVervaldatum: verval?.eerstvolgende ?? null,
        vervalBinnenTermijn: verval?.binnenTermijn ?? 0,
      };
    };

    return [
      ...voertuigen.map((vt) =>
        naarRij({
          soort: "voertuig" as const,
          id: vt._id.toString(),
          naam: `${vt.merk} ${vt.model}`,
          subtitel: vt.kenteken,
          status: voertuigStatusNaarMiddelStatus(vt.status),
          schaars: vt.schaars === true,
          teamId: vt.teamId?.toString() ?? null,
        })
      ),
      ...machines.map((m) =>
        naarRij({
          soort: "machine" as const,
          id: m._id.toString(),
          naam: m.naam,
          subtitel: m.type === "extern" ? "Gehuurd" : null,
          status: machineStatusNaarMiddelStatus(m.status, m.isActief),
          schaars: m.schaars === true,
          teamId: m.teamId?.toString() ?? null,
        })
      ),
    ].sort((a, b) => a.naam.localeCompare(b.naam));
  },
});

/** Teams met standaardbus en kleur (beheerpaneel bus-per-team). */
export const getTeamBussen = query({
  args: {},
  handler: async (ctx) => {
    await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_org_actief", (q) =>
        q.eq("orgId", orgId).eq("isActief", true)
      )
      .collect();
    // N+1 weg (audit §5): de standaardbussen in één ronde ophalen; teams
    // delen vaak dezelfde bus.
    const busMap = await laadDocsMap(
      ctx,
      teams.map((t) => t.standaardVoertuigId)
    );

    return teams.map((team) => {
      const bus = team.standaardVoertuigId
        ? busMap.get(team.standaardVoertuigId.toString())
        : undefined;
      return {
        teamId: team._id,
        naam: team.naam,
        kleur: team.kleur ?? null,
        standaardVoertuigId: team.standaardVoertuigId ?? null,
        standaardBusNaam: bus ? `${bus.merk} ${bus.model} (${bus.kenteken})` : null,
      };
    });
  },
});

/** Reserveringen van een werkitem (koppel-UI op de werkitem-/plandialoog). */
export const getReserveringenVoorWerkitem = query({
  args: { werkitemId: v.id("projecten") },
  handler: async (ctx, args) => {
    await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);
    const reserveringen = await ctx.db
      .query("middelReserveringen")
      .withIndex("by_werkitem", (q) => q.eq("werkitemId", args.werkitemId))
      .collect();
    // by_werkitem is bedrijfsoverstijgend: belt & braces op de organisatie.
    const relevant = reserveringen.filter(
      (r) => r.orgId?.toString() === orgId.toString()
    );
    // N+1 weg (audit §5): voertuigen en machines vooraf in twee rondes; een
    // werkitem reserveert hetzelfde middel vaak op meerdere dagen.
    const [voertuigMap, machineMap] = await Promise.all([
      laadDocsMap(
        ctx,
        relevant.map((r) => (r.middelType === "voertuig" ? r.voertuigId : undefined))
      ),
      laadDocsMap(
        ctx,
        relevant.map((r) => (r.middelType === "machine" ? r.machineId : undefined))
      ),
    ]);

    const verrijkt = relevant.map((r) => {
      let naam = "Onbekend middel";
      if (r.middelType === "voertuig" && r.voertuigId) {
        const vt = voertuigMap.get(r.voertuigId.toString());
        if (vt) naam = `${vt.merk} ${vt.model} (${vt.kenteken})`;
      } else if (r.middelType === "machine" && r.machineId) {
        const m = machineMap.get(r.machineId.toString());
        if (m) naam = m.naam;
      }
      return { ...r, middelNaam: naam };
    });
    return verrijkt.sort((a, b) => a.datum.localeCompare(b.datum));
  },
});

/** Schaarse middelen (koppel-dropdown "middel reserveren"). */
export const getSchaarseMiddelen = query({
  args: {},
  handler: async (ctx) => {
    await requireInterneRol(ctx);
    const orgId = await requireOrgId(ctx);
    const [voertuigen, machines] = await Promise.all([
      ctx.db
        .query("voertuigen")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
      ctx.db
        .query("machines")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect(),
    ]);
    return [
      ...voertuigen
        .filter((vt) => vt.schaars === true)
        .map((vt) => ({
          soort: "voertuig" as const,
          id: vt._id,
          naam: `${vt.merk} ${vt.model} (${vt.kenteken})`,
          status: voertuigStatusNaarMiddelStatus(vt.status),
        })),
      ...machines
        .filter((m) => m.schaars === true)
        .map((m) => ({
          soort: "machine" as const,
          id: m._id,
          naam: m.naam,
          status: machineStatusNaarMiddelStatus(m.status, m.isActief),
        })),
    ].sort((a, b) => a.naam.localeCompare(b.naam));
  },
});

// ============================================
// Mutations (kantoor beheert)
// ============================================

async function eigenVoertuig(
  ctx: { db: { get: (id: Id<"voertuigen">) => Promise<Doc<"voertuigen"> | null> } },
  orgId: Id<"organisaties">,
  voertuigId: Id<"voertuigen">
): Promise<Doc<"voertuigen">> {
  const voertuig = await ctx.db.get(voertuigId);
  if (!voertuig || voertuig.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Voertuig niet gevonden");
  }
  return voertuig;
}

async function eigenMachine(
  ctx: { db: { get: (id: Id<"machines">) => Promise<Doc<"machines"> | null> } },
  orgId: Id<"organisaties">,
  machineId: Id<"machines">
): Promise<Doc<"machines">> {
  const machine = await ctx.db.get(machineId);
  if (!machine || machine.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Machine niet gevonden");
  }
  return machine;
}

/** Uniforme status zetten (beschikbaar / onderhoud / kapot). */
export const setStatus = mutation({
  args: {
    voertuigId: v.optional(v.id("voertuigen")),
    machineId: v.optional(v.id("machines")),
    status: middelStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    if (args.voertuigId) {
      await eigenVoertuig(ctx, orgId, args.voertuigId);
      await ctx.db.patch(args.voertuigId, {
        status: middelStatusNaarVoertuigStatus(args.status),
        updatedAt: Date.now(),
      });
      return args.voertuigId;
    }
    if (args.machineId) {
      await eigenMachine(ctx, orgId, args.machineId);
      await ctx.db.patch(args.machineId, { status: args.status });
      return args.machineId;
    }
    throw new ConvexError("voertuigId of machineId is verplicht");
  },
});

/** Team-koppeling (kleurcode) en schaars-vlag beheren. */
export const setEigenschappen = mutation({
  args: {
    voertuigId: v.optional(v.id("voertuigen")),
    machineId: v.optional(v.id("machines")),
    teamId: v.optional(v.union(v.id("teams"), v.null())),
    schaars: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    if (args.teamId) {
      const team = await ctx.db.get(args.teamId);
      if (!team || team.orgId?.toString() !== orgId.toString()) {
        throw new ConvexError("Team niet gevonden");
      }
    }
    const updates: {
      teamId?: Id<"teams"> | undefined;
      schaars?: boolean;
      updatedAt?: number;
    } = {};
    if (args.teamId !== undefined) updates.teamId = args.teamId ?? undefined;
    if (args.schaars !== undefined) updates.schaars = args.schaars;

    if (args.voertuigId) {
      await eigenVoertuig(ctx, orgId, args.voertuigId);
      await ctx.db.patch(args.voertuigId, { ...updates, updatedAt: Date.now() });
      return args.voertuigId;
    }
    if (args.machineId) {
      await eigenMachine(ctx, orgId, args.machineId);
      await ctx.db.patch(args.machineId, updates);
      return args.machineId;
    }
    throw new ConvexError("voertuigId of machineId is verplicht");
  },
});

/** Vaste standaardbus van een team zetten (of wissen met null). */
export const setTeamStandaardBus = mutation({
  args: {
    teamId: v.id("teams"),
    voertuigId: v.union(v.id("voertuigen"), v.null()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team || team.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Team niet gevonden");
    }
    if (args.voertuigId) {
      await eigenVoertuig(ctx, orgId, args.voertuigId);
    }
    await ctx.db.patch(args.teamId, {
      standaardVoertuigId: args.voertuigId ?? undefined,
      updatedAt: Date.now(),
    });
    return args.teamId;
  },
});

/** Teamkleur (kleurcode in het machinepark-overzicht) zetten. */
export const setTeamKleur = mutation({
  args: { teamId: v.id("teams"), kleur: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const team = await ctx.db.get(args.teamId);
    if (!team || team.orgId?.toString() !== orgId.toString()) {
      throw new ConvexError("Team niet gevonden");
    }
    await ctx.db.patch(args.teamId, {
      kleur: args.kleur?.trim() || undefined,
      updatedAt: Date.now(),
    });
    return args.teamId;
  },
});

/**
 * Bus-override voor één team-dag (upsert; voertuigId null = override wissen,
 * terug naar de standaardbus). Zelfde patroon als teamBemanning: alleen
 * afwijkingen krijgen een rij.
 */
export const setDagBus = mutation({
  args: {
    teamId: v.id("teams"),
    datum: v.string(), // YYYY-MM-DD
    voertuigId: v.union(v.id("voertuigen"), v.null()),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const org = await requireOrg(ctx);
    if (!DATUM_PATROON.test(args.datum)) {
      throw new ConvexError("Ongeldige datum (verwacht YYYY-MM-DD)");
    }
    const team = await ctx.db.get(args.teamId);
    if (!team || team.orgId?.toString() !== org._id.toString()) {
      throw new ConvexError("Team niet gevonden");
    }
    const bestaande = await ctx.db
      .query("teamBusOverrides")
      .withIndex("by_team_datum", (q) =>
        q.eq("teamId", args.teamId).eq("datum", args.datum)
      )
      .collect();
    const rij = bestaande.find(
      (r) => r.orgId?.toString() === org._id.toString()
    );

    if (!args.voertuigId) {
      if (rij) await ctx.db.delete(rij._id);
      return null;
    }
    await eigenVoertuig(ctx, org._id, args.voertuigId);
    const now = Date.now();
    if (rij) {
      await ctx.db.patch(rij._id, { voertuigId: args.voertuigId, updatedAt: now });
      return rij._id;
    }
    return await ctx.db.insert("teamBusOverrides", {
      orgId: org._id,
      teamId: args.teamId,
      datum: args.datum,
      voertuigId: args.voertuigId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Middel reserveren op een werkitem-dag (idempotent per middel+werkitem+dag).
 * Dubbel claimen van hetzelfde middel op dezelfde dag door een ANDER
 * werkitem → WAARSCHUWING in het resultaat (geen blokkade, consistent met
 * de seizoenswaarschuwing); een kapot middel geeft ook een waarschuwing.
 */
export const reserveerMiddel = mutation({
  args: {
    werkitemId: v.id("projecten"),
    datum: v.string(), // YYYY-MM-DD
    voertuigId: v.optional(v.id("voertuigen")),
    machineId: v.optional(v.id("machines")),
  },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const org = await requireOrg(ctx);
    if (!DATUM_PATROON.test(args.datum)) {
      throw new ConvexError("Ongeldige datum (verwacht YYYY-MM-DD)");
    }
    const werkitem = await ctx.db.get(args.werkitemId);
    if (
      !werkitem ||
      werkitem.deletedAt ||
      werkitem.orgId?.toString() !== org._id.toString()
    ) {
      throw new ConvexError("Werkitem niet gevonden");
    }

    let middelNaam: string;
    let status: MiddelStatus;
    let middelSleutel: string;
    if (args.voertuigId) {
      const voertuig = await eigenVoertuig(ctx, org._id, args.voertuigId);
      middelNaam = `${voertuig.merk} ${voertuig.model} (${voertuig.kenteken})`;
      status = voertuigStatusNaarMiddelStatus(voertuig.status);
      middelSleutel = maakMiddelSleutel("voertuig", args.voertuigId.toString());
    } else if (args.machineId) {
      const machine = await eigenMachine(ctx, org._id, args.machineId);
      middelNaam = machine.naam;
      status = machineStatusNaarMiddelStatus(machine.status, machine.isActief);
      middelSleutel = maakMiddelSleutel("machine", args.machineId.toString());
    } else {
      throw new ConvexError("voertuigId of machineId is verplicht");
    }

    const bestaandeClaims = await ctx.db
      .query("middelReserveringen")
      .withIndex("by_sleutel_datum", (q) =>
        q.eq("middelSleutel", middelSleutel).eq("datum", args.datum)
      )
      .collect();
    const eigen = bestaandeClaims.find(
      (r) =>
        r.werkitemId.toString() === args.werkitemId.toString() &&
        r.orgId?.toString() === org._id.toString()
    );
    if (eigen) {
      return { id: eigen._id, waarschuwing: null }; // idempotent
    }

    const waarschuwingen: string[] = [];
    const ander = bestaandeClaims.find(
      (r) => r.orgId?.toString() === org._id.toString()
    );
    if (ander) {
      const anderWerkitem = await ctx.db.get(ander.werkitemId);
      waarschuwingen.push(
        dubbelClaimWaarschuwing(middelNaam, args.datum, anderWerkitem?.naam)
      );
    }
    if (status === "kapot") {
      waarschuwingen.push(
        kapotWaarschuwing(
          middelNaam,
          args.voertuigId ? "voertuig" : "machine",
          "reserveren kan, maar plan een alternatief"
        )
      );
    }

    const id = await ctx.db.insert("middelReserveringen", {
      orgId: org._id,
      middelType: args.voertuigId ? "voertuig" : "machine",
      voertuigId: args.voertuigId,
      machineId: args.machineId,
      middelSleutel,
      werkitemId: args.werkitemId,
      datum: args.datum,
      createdAt: Date.now(),
    });
    return {
      id,
      waarschuwing: waarschuwingen.length > 0 ? waarschuwingen.join(" ") : null,
    };
  },
});

export const verwijderReservering = mutation({
  args: { id: v.id("middelReserveringen") },
  handler: async (ctx, args) => {
    await requireKantoor(ctx);
    const orgId = await requireOrgId(ctx);
    const reservering = await ctx.db.get(args.id);
    if (
      !reservering ||
      reservering.orgId?.toString() !== orgId.toString()
    ) {
      throw new ConvexError("Reservering niet gevonden");
    }
    await ctx.db.delete(args.id);
    return args.id;
  },
});
