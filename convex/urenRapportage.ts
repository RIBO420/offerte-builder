import { projectUrenBron, projectUrenVoorOrg } from "./lib/projectUrenBron";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { veldContext } from "./urenSegmenten";
import { berekenUrenTotalen, regelMinuten, valideerUrenPeriode } from "./lib/urenTotalen";

/** De nieuwe veldbron; historische projectregistraties worden nooit erbij opgeteld. */
export const getPeriode = query({
  args: {
    van: v.string(), tot: v.string(),
    bereik: v.optional(v.union(v.literal("eigen"), v.literal("organisatie"))),
    medewerkerId: v.optional(v.id("medewerkers")),
  },
  handler: async (ctx, args) => {
    try { valideerUrenPeriode(args.van, args.tot); }
    catch (e) { throw new ConvexError(e instanceof Error ? e.message : "Ongeldige periode"); }
    const veld = await veldContext(ctx);
    const kantoor = veld.rol === "kantoor";
    if (veld.rol === "klant") throw new ConvexError("Geen toegang tot uren");
    if (args.bereik === "organisatie" && !kantoor) throw new ConvexError("Alleen kantoor kan alle uren bekijken");
    const medewerkerId = args.medewerkerId ?? (args.bereik === "organisatie" ? undefined : veld.eigenMedewerker?._id);
    if (!medewerkerId && args.bereik !== "organisatie") throw new ConvexError("Je account is niet gekoppeld aan een medewerker");
    if (medewerkerId) {
      const medewerker = await ctx.db.get(medewerkerId);
      if (!medewerker || medewerker.orgId !== veld.orgId || (!kantoor && medewerkerId !== veld.eigenMedewerker?._id)) {
        throw new ConvexError("Medewerker niet gevonden");
      }
    }
    if (args.bereik === "organisatie" && (Date.parse(args.tot) - Date.parse(args.van)) / 86400000 > 31) throw new ConvexError("Lees organisatie-exports in maanddelen.");
    const alle = medewerkerId
      ? await ctx.db.query("urenSegmenten").withIndex("by_medewerker_datum", q => q.eq("medewerkerId", medewerkerId).gte("datum", args.van).lte("datum", args.tot)).collect()
      : await ctx.db.query("urenSegmenten").withIndex("by_org_datum", q => q.eq("orgId", veld.orgId).gte("datum", args.van).lte("datum", args.tot)).collect();
    const segmenten = alle.filter(s => s.orgId === veld.orgId && (!medewerkerId || s.medewerkerId === medewerkerId));
    const [medewerkers, klanten, dagstatussen] = await Promise.all([
      ctx.db.query("medewerkers").withIndex("by_org", q => q.eq("orgId", veld.orgId)).collect(),
      ctx.db.query("klanten").withIndex("by_org", q => q.eq("orgId", veld.orgId)).collect(),
      ctx.db.query("urenDagen").withIndex("by_org_datum", q => q.eq("orgId", veld.orgId).gte("datum", args.van).lte("datum", args.tot)).collect(),
    ]);
    const medewerkerNamen = new Map(medewerkers.map(m => [m._id, m.naam]));
    const klantNamen = new Map(klanten.map(k => [k._id, k.naam]));
    const projectIds = [...new Set(segmenten.flatMap(s => s.werkitemId ? [s.werkitemId] : []))];
    const projecten = await Promise.all(projectIds.map(id => ctx.db.get(id)));
    const projectMap = new Map(projecten.filter(p => p && p.orgId === veld.orgId).map(p => [p!._id, p!]));
    const actorIds = [...new Set(segmenten.flatMap(s => s.ingevoerdDoor ? [s.ingevoerdDoor] : []))];
    const actors = await Promise.all(actorIds.map(id => ctx.db.get(id)));
    const actorNamen = new Map(actors.filter(a => a && a.orgId === veld.orgId).map(a => [a!._id, a!.name]));
    const organisatie = await ctx.db.get(veld.orgId);
    const registraties = segmenten.map(s => {
      const project = s.werkitemId ? projectMap.get(s.werkitemId) : undefined;
      const klantId = s.klantId ?? project?.klantId;
      return ({
      id: s._id, medewerkerId: s.medewerkerId, medewerkerNaam: medewerkerNamen.get(s.medewerkerId) ?? "Onbekende medewerker",
      datum: s.datum, categorie: s.categorie, beginTijd: s.beginTijd, eindTijd: s.eindTijd,
      klantId: klantId ?? null, klantNaam: klantId ? klantNamen.get(klantId) ?? "Onbekende klant" : null,
      werksoort: s.werksoort ?? null,
      werkitemNaam: project?.naam ?? null, ingevoerdDoorId: s.ingevoerdDoor ?? null, ingevoerdDoorNaam: s.ingevoerdDoor ? actorNamen.get(s.ingevoerdDoor) ?? null : null,
      werkitemId: s.werkitemId ?? null, status: s.status, minuten: regelMinuten(s),
      // Notities blijven intern; klantgerichte export kiest expliciet zijn velden.
      notitie: s.notitie ?? null,
    }); }).sort((a, b) => a.datum.localeCompare(b.datum) || a.beginTijd.localeCompare(b.beginTijd) || a.id.localeCompare(b.id));
    const sleutels = [...new Set(registraties.map(r => `${r.medewerkerId}|${r.datum}`))];
    const dagen = sleutels.map(sleutel => {
      const regels = registraties.filter(r => `${r.medewerkerId}|${r.datum}` === sleutel);
      const eerste = regels[0];
      const status = dagstatussen.find(d => d.medewerkerId === eerste.medewerkerId && d.datum === eerste.datum);
      return { medewerkerId: eerste.medewerkerId, medewerkerNaam: eerste.medewerkerNaam, datum: eerste.datum,
        status: status?.status ?? "open", totalen: berekenUrenTotalen(regels), registraties: regels };
    });
    const antwoorden = kantoor ? await ctx.db.query("werkbezoekAntwoorden").withIndex("by_org_datum", q => q.eq("orgId", veld.orgId).gte("datum", args.van).lte("datum", args.tot)).collect() : [];
    const bezoeken = antwoorden.flatMap(a => {
      const project = projectMap.get(a.werkitemId);
      return project?.klantId ? [{ datum: a.datum, klantId: project.klantId, werkitemId: a.werkitemId, afgerond: a.afgerond }] : [];
    });
    const afvoerRijen = kantoor ? await ctx.db.query("werkbezoekAfvoer").withIndex("by_org_datum", q => q.eq("orgId", veld.orgId).gte("datum", args.van).lte("datum", args.tot)).collect() : [];
    const afvoer = afvoerRijen.flatMap(a => {
      const project = projectMap.get(a.werkitemId);
      return project?.klantId ? [{ id: a._id, revision: a.revision, datum: a.datum, klantId: project.klantId, werkitemId: a.werkitemId, keuze: a.keuze, bedragCent: a.bedragCent ?? null }] : [];
    });
    return { scope: { userId: veld.user.clerkId, orgId: organisatie?.clerkOrgId ?? null }, afvoer, bezoeken, bron: "urensegmenten" as const, van: args.van, tot: args.tot, registraties, dagen, totalen: berekenUrenTotalen(registraties) };
  },
});

/** Staff must explicitly resolve projects containing both historical and segment ledgers. */
export const getProjectUrenBron = query({
  args: { projectId: v.id("projecten") },
  handler: async (ctx, args) => {
    const veld = await veldContext(ctx);
    if (veld.rol !== "kantoor") throw new ConvexError("Alleen kantoor kan de projecturenbron bekijken");
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== veld.orgId) throw new ConvexError("Project niet gevonden");
    const { regels: _regels, ...resultaat } = await projectUrenBron(ctx, project);
    return resultaat;
  },
});
export const setProjectUrenBron = mutation({
  args: { projectId: v.id("projecten"), bron: v.union(v.literal("legacy"), v.literal("segmenten"), v.literal("auto")) },
  handler: async (ctx, args) => {
    const veld = await veldContext(ctx);
    if (veld.rol !== "kantoor") throw new ConvexError("Alleen kantoor kan de projecturenbron wijzigen");
    const project = await ctx.db.get(args.projectId);
    if (!project || project.orgId !== veld.orgId) throw new ConvexError("Project niet gevonden");
    await ctx.db.patch(project._id, { urenBron: args.bron === "auto" ? undefined : args.bron, urenBronGewijzigdDoor: veld.user._id, urenBronGewijzigdOp: Date.now() });
    return { opgeslagen: true };
  },
});

export const getProjectUrenConflicten = query({
  args: {},
  handler: async ctx => {
    const veld = await veldContext(ctx);
    if (veld.rol !== "kantoor") throw new ConvexError("Alleen kantoor kan urenbronnen beheren");
    // Eén scan per grootboek i.p.v. twee queries per project; zelfde beslisregel.
    return (await projectUrenVoorOrg(ctx, veld.orgId)).conflicten;
  },
});

export const getExportKeuzes = query({
  args: {},
  handler: async ctx => {
    const veld = await veldContext(ctx);
    if (veld.rol !== "kantoor") throw new ConvexError("Alleen kantoor kan organisatie-exports maken");
    const [medewerkers, klanten] = await Promise.all([
      ctx.db.query("medewerkers").withIndex("by_org", q => q.eq("orgId", veld.orgId)).collect(),
      ctx.db.query("klanten").withIndex("by_org", q => q.eq("orgId", veld.orgId)).collect(),
    ]);
    const organisatie = await ctx.db.get(veld.orgId);
    return { scope: { userId: veld.user.clerkId, orgId: organisatie?.clerkOrgId ?? null }, medewerkers: medewerkers.map(m => ({ id: m._id, naam: m.naam })), klanten: klanten.map(k => ({ id: k._id, naam: k.naam })) };
  },
});
