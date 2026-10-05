/** Physical trailer return observations. No stock, costing or invoice effects.
 * getDag is shared by native/web; getOverzicht is the office day inspector.
 * meld is transactional: observation + immutable audit + command receipt.
 * Existing returns require revision + reason; transport retries reuse their key.
 */
import { ConvexError, v } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOrgContext } from "./auth";
import { isKantoorRol, normalizeRole } from "./roles";
import { teamVanMedewerkerOpDag } from "./urenSegmenten";

const keuzeValidator = v.union(v.literal("geen_aanhanger"), v.literal("leeg"), v.literal("kwart"), v.literal("half"), v.literal("driekwart"), v.literal("vol"));
type Ctx = QueryCtx | MutationCtx;

function datumCheck(datum: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !Number.isFinite(Date.parse(datum)) || new Date(datum).toISOString().slice(0, 10) !== datum) {
    throw new ConvexError("Ongeldige datum");
  }
}

async function toegang(ctx: Ctx) {
  const { org, user } = await requireOrgContext(ctx);
  if (normalizeRole(user.role) === "klant") throw new ConvexError("Retourmeldingen zijn alleen voor medewerkers");
  const medewerker = user.linkedMedewerkerId ? await ctx.db.get(user.linkedMedewerkerId) : null;
  return { org, user, kantoor: isKantoorRol(user.role), medewerker: medewerker?.orgId === org._id ? medewerker : null };
}
type Toegang = Awaited<ReturnType<typeof toegang>>;

async function bemanning(ctx: Ctx, orgId: Id<"organisaties">, teamId: Id<"teams">, datum: string) {
  const team = await ctx.db.get(teamId);
  if (!team || team.orgId !== orgId) throw new ConvexError("Ploeg niet gevonden");
  const afwijkingen = await ctx.db.query("teamBemanning").withIndex("by_team_datum", q => q.eq("teamId", teamId).eq("datum", datum)).collect();
  return afwijkingen.find(r => r.orgId === orgId)?.medewerkerIds ?? team.leden;
}

async function controleerScope(ctx: Ctx, t: Toegang, datum: string, teamId: Id<"teams"> | undefined, verantwoordelijke: Id<"medewerkers">) {
  const persoon = await ctx.db.get(verantwoordelijke);
  if (!persoon || persoon.orgId !== t.org._id) throw new ConvexError("Medewerker niet gevonden");
  if (teamId) {
    const leden = await bemanning(ctx, t.org._id, teamId, datum);
    if (!leden.includes(verantwoordelijke)) throw new ConvexError("De verantwoordelijke zit deze dag niet in deze ploeg");
    if (!t.kantoor && (!t.medewerker || !leden.includes(t.medewerker._id))) throw new ConvexError("Je kunt alleen melden voor je eigen ploeg op deze dag");
  } else if (!t.kantoor && t.medewerker?._id !== verantwoordelijke) {
    throw new ConvexError("Je kunt alleen je eigen retour melden");
  }
}

async function verrijk(ctx: Ctx, retouren: Doc<"aanhangerRetouren">[]) {
  return Promise.all(retouren.map(async r => {
    const [melder, verantwoordelijke, voertuig] = await Promise.all([
      ctx.db.get(r.gemeldDoor), ctx.db.get(r.verantwoordelijkeMedewerkerId), r.voertuigId ? ctx.db.get(r.voertuigId) : null,
    ]);
    return { ...r, gemeldDoorNaam: melder?.name ?? "Onbekend", verantwoordelijkeNaam: verantwoordelijke?.naam ?? "Onbekend", voertuigNaam: voertuig ? `${voertuig.merk} ${voertuig.model} (${voertuig.kenteken})` : null };
  }));
}

export const getDag = query({
  args: { datum: v.string(), teamId: v.optional(v.id("teams")) },
  handler: async (ctx, args) => {
    datumCheck(args.datum);
    const t = await toegang(ctx);
    const teamId = args.teamId ?? (t.medewerker ? (await teamVanMedewerkerOpDag(ctx.db, t.org._id, t.medewerker._id, args.datum))?._id : undefined);
    if (teamId) {
      const leden = await bemanning(ctx, t.org._id, teamId, args.datum);
      if (!t.kantoor && (!t.medewerker || !leden.includes(t.medewerker._id))) throw new ConvexError("Geen toegang tot deze ploeg");
    }
    const rows = await ctx.db.query("aanhangerRetouren").withIndex("by_org_datum", q => q.eq("orgId", t.org._id).eq("datum", args.datum)).collect();
    const eigen = rows.filter(r => teamId ? r.teamId === teamId : !r.teamId && r.verantwoordelijkeMedewerkerId === t.medewerker?._id);
    const voertuigen = await ctx.db.query("voertuigen").withIndex("by_org", q => q.eq("orgId", t.org._id)).collect();
    const aanhangers = voertuigen.filter(r => r.type.trim().toLowerCase() === "aanhanger" && r.status !== "inactief").map(r => ({ _id: r._id, naam: `${r.merk} ${r.model}`, kenteken: r.kenteken }));
    const claims = await ctx.db.query("middelReserveringen").withIndex("by_org_datum", q => q.eq("orgId", t.org._id).eq("datum", args.datum)).collect();
    const gereserveerd = new Set<Id<"voertuigen">>();
    for (const claim of claims) {
      if (!claim.voertuigId || !aanhangers.some(a => a._id === claim.voertuigId)) continue;
      const werkitem = await ctx.db.get(claim.werkitemId);
      if (werkitem?.orgId !== t.org._id) continue;
      if (teamId ? werkitem.teamId === teamId : t.medewerker && werkitem.toegewezenMedewerkerIds?.includes(t.medewerker._id)) gereserveerd.add(claim.voertuigId);
    }
    return {
      teamId: teamId ?? null, medewerkerId: t.medewerker?._id ?? null,
      magMelden: !!t.medewerker,
      aanhangers,
      preselectedVoertuigId: gereserveerd.size === 1 ? [...gereserveerd][0] : aanhangers.length === 1 ? aanhangers[0]._id : null,
      retouren: await verrijk(ctx, eigen.sort((a, b) => a.waargenomenOp - b.waargenomenOp)),
    };
  },
});

export const getOverzicht = query({
  args: { datum: v.string() },
  handler: async (ctx, args) => {
    datumCheck(args.datum);
    const t = await toegang(ctx);
    if (!t.kantoor) throw new ConvexError("Alleen kantoor kan het retourenoverzicht bekijken");
    const rows = await ctx.db.query("aanhangerRetouren").withIndex("by_org_datum", q => q.eq("orgId", t.org._id).eq("datum", args.datum)).collect();
    return verrijk(ctx, rows.sort((a, b) => b.waargenomenOp - a.waargenomenOp));
  },
});

export const getHistorie = query({
  args: { retourId: v.string() },
  handler: async (ctx, args) => {
    const t = await toegang(ctx);
    const retour = await ctx.db.query("aanhangerRetouren").withIndex("by_org_retour", q => q.eq("orgId", t.org._id).eq("retourId", args.retourId)).unique();
    if (!retour) return [];
    await controleerScope(ctx, t, retour.datum, retour.teamId, retour.verantwoordelijkeMedewerkerId);
    return (await ctx.db.query("aanhangerRetourHistorie").withIndex("by_retour", q => q.eq("retourId", retour._id)).collect()).filter(r => r.orgId === t.org._id).sort((a, b) => a.revision - b.revision);
  },
});

export const meld = mutation({
  args: {
    retourId: v.string(), datum: v.string(), teamId: v.optional(v.id("teams")),
    verantwoordelijkeMedewerkerId: v.optional(v.id("medewerkers")), voertuigId: v.optional(v.id("voertuigen")),
    keuze: keuzeValidator, waargenomenOp: v.number(), idempotencyKey: v.string(), expectedRevision: v.optional(v.number()),
    notitie: v.optional(v.string()), correctieReden: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    datumCheck(args.datum);
    const t = await toegang(ctx);
    if (!args.retourId.trim() || args.retourId.length > 200 || !args.idempotencyKey.trim() || args.idempotencyKey.length > 200) throw new ConvexError("Een geldige retour- en opdrachtsleutel zijn verplicht");
    if ((args.notitie?.length ?? 0) > 1000 || (args.correctieReden?.length ?? 0) > 1000) throw new ConvexError("De toelichting is te lang (maximaal 1000 tekens)");
    if (!Number.isFinite(args.waargenomenOp) || args.waargenomenOp < 0 || args.waargenomenOp > Date.now() + 300000) throw new ConvexError("Ongeldig waarnemingstijdstip");
    const waargenomenDatum = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(args.waargenomenOp);
    if (waargenomenDatum !== args.datum) throw new ConvexError("Het waarnemingstijdstip hoort niet bij deze werkdag");
    const bestaand = await ctx.db.query("aanhangerRetouren").withIndex("by_org_retour", q => q.eq("orgId", t.org._id).eq("retourId", args.retourId)).unique();
    const verantwoordelijke = args.verantwoordelijkeMedewerkerId ?? bestaand?.verantwoordelijkeMedewerkerId ?? t.medewerker?._id;
    if (!verantwoordelijke) throw new ConvexError("Koppel een medewerker of selecteer een verantwoordelijke");
    await controleerScope(ctx, t, args.datum, args.teamId, verantwoordelijke);
    if (bestaand && (bestaand.datum !== args.datum || bestaand.teamId !== args.teamId || bestaand.verantwoordelijkeMedewerkerId !== verantwoordelijke)) throw new ConvexError("De retour hoort bij een andere dag, ploeg of verantwoordelijke");

    const payload = JSON.stringify(Object.fromEntries(Object.entries(args).sort(([a], [b]) => a.localeCompare(b))));
    const receipt = await ctx.db.query("aanhangerRetourOpdrachten").withIndex("by_org_user_sleutel", q => q.eq("orgId", t.org._id).eq("userId", t.user._id).eq("sleutel", args.idempotencyKey)).unique();
    if (receipt) {
      if (receipt.payload !== payload) throw new ConvexError("Deze opdrachtsleutel is al gebruikt voor een andere melding");
      return { id: receipt.retourId, revision: receipt.revision, replayed: true };
    }
    if (args.keuze === "geen_aanhanger") {
      if (args.voertuigId) throw new ConvexError("Geen aanhanger kan niet aan een voertuig worden gekoppeld");
    } else {
      const voertuig = args.voertuigId ? await ctx.db.get(args.voertuigId) : null;
      if (!voertuig || voertuig.orgId !== t.org._id || voertuig.type.trim().toLowerCase() !== "aanhanger") throw new ConvexError("Selecteer een aanhanger uit je eigen bedrijf");
    }
    if (bestaand) {
      if (args.expectedRevision !== bestaand.revision) throw new ConvexError("De retourmelding is intussen gewijzigd. Vernieuw en controleer het antwoord.");
      if (!args.correctieReden?.trim()) throw new ConvexError("Vul een reden voor de correctie in");
    } else if (args.expectedRevision !== undefined && args.expectedRevision !== 0) {
      throw new ConvexError("De retourmelding bestaat nog niet. Vernieuw het overzicht.");
    }
    const now = Date.now();
    const revision = (bestaand?.revision ?? 0) + 1;
    const voor = bestaand ? JSON.stringify(bestaand) : undefined;
    const waarden = { orgId: t.org._id, retourId: args.retourId, datum: args.datum, teamId: args.teamId, verantwoordelijkeMedewerkerId: verantwoordelijke, voertuigId: args.voertuigId, keuze: args.keuze, waargenomenOp: args.waargenomenOp, gemeldDoor: bestaand?.gemeldDoor ?? t.user._id, laatstGewijzigdDoor: t.user._id, notitie: args.notitie?.trim() || undefined, revision, createdAt: bestaand?.createdAt ?? now, updatedAt: now };
    const id = bestaand?._id ?? await ctx.db.insert("aanhangerRetouren", waarden);
    if (bestaand) await ctx.db.patch(id, waarden);
    await ctx.db.insert("aanhangerRetourHistorie", { orgId: t.org._id, retourId: id, revision, door: t.user._id, reden: bestaand ? args.correctieReden!.trim() : "Retour gemeld", voor, na: JSON.stringify(waarden), createdAt: now });
    await ctx.db.insert("aanhangerRetourOpdrachten", { orgId: t.org._id, userId: t.user._id, sleutel: args.idempotencyKey, payload, retourId: id, revision, createdAt: now });
    return { id, revision, replayed: false };
  },
});
