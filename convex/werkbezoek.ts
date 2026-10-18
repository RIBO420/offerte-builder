import { bezoekLedenVoor, teamDagLedenVoor, werkitemsInPeriode } from "./lib/bezoekBemanning";
/** Shared visit responses are operational evidence, never job completion or
 * billing commands. Visit identity is workitem + original execution date. */
import { ConvexError, v } from "convex/values";
import { fotoHashGelijk } from "./lib/fotoHash";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOrgContext } from "./auth";
import { isKantoorRol, normalizeRole } from "./roles";
import { werkitemOpDag } from "./planbordLogica";
import { logTijdlijnEvent } from "./tijdlijn";
import { heeftWerkitemHistorie } from "./lib/werkitemHistorie";
import { hoortInKlantenLijst } from "./leadsKlantenHelpers";

type Ctx = QueryCtx | MutationCtx;
const bezoekArgs = { werkitemId: v.id("projecten"), datum: v.string() };
const onderdeelValidator = v.union(v.literal("foto"), v.literal("afronding"), v.literal("aanhanger"), v.literal("afvoer"));

async function relatieBescherming(ctx: Ctx, item: Doc<"projecten">) {
  const [bezoekHistorie, nacalculatie, meerwerk, kosten, factuur] = await Promise.all([
    heeftWerkitemHistorie(ctx, item._id),
    ctx.db.query("nacalculaties").withIndex("by_project", q => q.eq("projectId", item._id)).first(),
    ctx.db.query("meerwerk").withIndex("by_project", q => q.eq("projectId", item._id)).first(),
    ctx.db.query("projectKosten").withIndex("by_project", q => q.eq("projectId", item._id)).first(),
    ctx.db.query("facturen").withIndex("by_project", q => q.eq("projectId", item._id)).first(),
  ]);
  const uitgevoerd = bezoekHistorie || !!nacalculatie || !!meerwerk || !!kosten;
  const afgerond = ["afgerond", "uitgevoerd", "nacalculatie_compleet", "gefactureerd"].includes(item.status);
  const historieReden = uitgevoerd || afgerond ? "Deze klus heeft uitvoeringshistorie. Maak een nieuwe klus voor een andere klant of locatie; eerdere registraties blijven behouden." : null;
  const financieel = !!item.factuurId || !!factuur || item.status === "gefactureerd";
  return {
    klant: historieReden ?? (item.offerteId || item.contractId || item.contractWerkzaamheidId || financieel ? "De klant hoort bij een gekoppelde offerte, contract of factuur. Maak voor een andere klant een nieuwe klus." : null),
    locatie: historieReden ?? (financieel ? "De uitvoerlocatie hoort bij een gefactureerde klus." : null),
  };
}

function datumCheck(datum: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || !Number.isFinite(Date.parse(datum)) || new Date(datum).toISOString().slice(0, 10) !== datum) throw new ConvexError("Ongeldige datum");
}
async function toegang(ctx: Ctx) {
  const t = await requireOrgContext(ctx);
  if (normalizeRole(t.user.role) === "klant") throw new ConvexError("Werkbezoeken zijn alleen voor medewerkers");
  const medewerker = t.user.linkedMedewerkerId ? await ctx.db.get(t.user.linkedMedewerkerId) : null;
  return { ...t, kantoor: isKantoorRol(t.user.role), medewerker: medewerker?.orgId === t.org._id ? medewerker : null };
}

async function ledenVoor(ctx: Ctx, item: Doc<"projecten">, datum: string): Promise<Id<"medewerkers">[]> {
  return bezoekLedenVoor(ctx.db, item, datum);
}

async function heeftRegistratie(ctx: Ctx, orgId: Id<"organisaties">, medewerkerId: Id<"medewerkers">, werkitemId: Id<"projecten">, datum: string) {
  const rows = await ctx.db.query("urenSegmenten").withIndex("by_medewerker_datum", q => q.eq("medewerkerId", medewerkerId).eq("datum", datum)).collect();
  return rows.some(r => r.orgId === orgId && r.werkitemId === werkitemId && r.categorie === "werken");
}

async function bezoekToegang(ctx: Ctx, args: { werkitemId: Id<"projecten">; datum: string }) {
  datumCheck(args.datum);
  const t = await toegang(ctx);
  const item = await ctx.db.get(args.werkitemId);
  if (!item || item.orgId !== t.org._id || item.deletedAt) throw new ConvexError("Werkbezoek niet gevonden");
  const leden = await ledenVoor(ctx, item, args.datum);
  const gepland = werkitemOpDag(item, args.datum) && !!t.medewerker && leden.includes(t.medewerker._id);
  // Existing actual work retains access if office subsequently moves planning.
  const historisch = t.medewerker && await heeftRegistratie(ctx, t.org._id, t.medewerker._id, item._id, args.datum);
  const eigenBewijs = !t.kantoor && !gepland && !historisch && t.medewerker ? await heeftEigenBewijs(ctx, item, args.datum, t.user._id, t.medewerker._id) : false;
  if (!t.kantoor && !gepland && !historisch && !eigenBewijs) throw new ConvexError("Je bent niet toegewezen aan dit bezoek");
  return { ...t, item, leden };
}

async function gegevens(ctx: Ctx, item: Doc<"projecten">, datum: string) {
  const [antwoorden, fotos, delegaties, afvoer] = await Promise.all([
    ctx.db.query("werkbezoekAntwoorden").withIndex("by_werkitem_datum", q => q.eq("werkitemId", item._id).eq("datum", datum)).collect(),
    ctx.db.query("werkbezoekFotos").withIndex("by_werkitem_datum", q => q.eq("werkitemId", item._id).eq("datum", datum)).collect(),
    ctx.db.query("werkbezoekDelegaties").withIndex("by_werkitem_datum", q => q.eq("werkitemId", item._id).eq("datum", datum)).collect(),
    ctx.db.query("werkbezoekAfvoer").withIndex("by_werkitem_datum", q => q.eq("werkitemId", item._id).eq("datum", datum)).collect(),
  ]);
  return { afronding: antwoorden.find(r => r.orgId === item.orgId) ?? null, afvoer: afvoer.find(r => r.orgId === item.orgId) ?? null, fotos: fotos.filter(r => r.orgId === item.orgId && !r.verwijderdOp), delegaties: delegaties.filter(r => r.orgId === item.orgId) };
}

/** A worker who already supplied evidence retains access to that original
 * visit after a planning move. This does not grant access to other crew visits. */
async function heeftEigenBewijs(ctx: Ctx, item: Doc<"projecten">, datum: string, userId: Id<"users">, medewerkerId: Id<"medewerkers">) {
  const data = await gegevens(ctx, item, datum);
  return data.fotos.some(f => f.door === userId) || data.afronding?.door === userId || data.afvoer?.door === userId || data.delegaties.some(d => d.medewerkerId === medewerkerId);
}
async function bewijsOpDag(ctx: Ctx, orgId: Id<"organisaties">, datum: string) {
  const [fotos, afvoer, delegaties, antwoorden] = await Promise.all([
    ctx.db.query("werkbezoekFotos").withIndex("by_org_datum", q => q.eq("orgId", orgId).eq("datum", datum)).collect(),
    ctx.db.query("werkbezoekAfvoer").withIndex("by_org_datum", q => q.eq("orgId", orgId).eq("datum", datum)).collect(),
    ctx.db.query("werkbezoekDelegaties").withIndex("by_org_datum", q => q.eq("orgId", orgId).eq("datum", datum)).collect(),
    ctx.db.query("werkbezoekAntwoorden").withIndex("by_org_datum", q => q.eq("orgId", orgId).eq("datum", datum)).collect(),
  ]);
  return { fotos: fotos.filter(f => !f.verwijderdOp), afvoer, delegaties, antwoorden };
}

async function ontbreektVoor(ctx: Ctx, item: Doc<"projecten">, datum: string, medewerkerId?: Id<"medewerkers">) {
  const data = await gegevens(ctx, item, datum);
  const retouren = await ctx.db.query("aanhangerRetouren").withIndex("by_org_datum", q => q.eq("orgId", item.orgId).eq("datum", datum)).collect();
  const relevanteLeden = medewerkerId ? [medewerkerId] : await ledenVoor(ctx, item, datum);
  let retour = false;
  for (const r of retouren) {
    if (item.teamId && r.teamId === item.teamId) { retour = true; break; }
    if (relevanteLeden.includes(r.verantwoordelijkeMedewerkerId)) { retour = true; break; }
    if (r.teamId && (await teamDagLedenVoor(ctx.db, item.orgId, r.teamId, datum)).some(id => relevanteLeden.includes(id))) { retour = true; break; }
  }
  const ontbreekt: Array<"foto" | "afronding" | "aanhanger" | "afvoer"> = [];
  if (data.fotos.length === 0) ontbreekt.push("foto");
  if (!data.afronding) ontbreekt.push("afronding");
  if (!retour) ontbreekt.push("aanhanger");
  if (!data.afvoer) ontbreekt.push("afvoer");
  const persoonlijk = ontbreekt.filter(o => !data.delegaties.some(d => d.medewerkerId === medewerkerId && d.onderdeel === o));
  return { ...data, ontbreekt, persoonlijk };
}

/** Call inside the SAME submission mutation, before changing urenDagen.
 * Only customer visits with actual work require answers. A personal delegation
 * satisfies that person's check, while shared missing evidence remains visible. */
export async function assertDagGereed(ctx: Ctx, args: { orgId: Id<"organisaties">; medewerkerId: Id<"medewerkers">; datum: string }) {
  const rows = await ctx.db.query("urenSegmenten").withIndex("by_medewerker_datum", q => q.eq("medewerkerId", args.medewerkerId).eq("datum", args.datum)).collect();
  const ids = [...new Set(rows.filter(r => r.orgId === args.orgId && r.categorie === "werken" && r.werkitemId).map(r => r.werkitemId!))];
  for (const id of ids) {
    const item = await ctx.db.get(id);
    if (!item || item.orgId !== args.orgId || !item.klantId) continue;
    const result = await ontbreektVoor(ctx, item, args.datum, args.medewerkerId);
    if (result.persoonlijk.length) throw new ConvexError(`Maak de bezoekmelding compleet bij ${item.naam}: ${result.persoonlijk.join(", ")}`);
  }
}

export const getVoorDag = query({
  args: { datum: v.string() },
  handler: async (ctx, args) => {
    datumCheck(args.datum);
    const t = await toegang(ctx);
    if (!t.medewerker) return { bezoeken: [], gereed: true };
    const geplandOpDag = await werkitemsInPeriode(ctx.db, t.org._id, args.datum, args.datum);
    const segmenten = await ctx.db.query("urenSegmenten").withIndex("by_medewerker_datum", q => q.eq("medewerkerId", t.medewerker!._id).eq("datum", args.datum)).collect();
    const bewijs = await bewijsOpDag(ctx, t.org._id, args.datum);
    const eigenHistorie = new Set([...bewijs.fotos.filter(r => r.door === t.user._id), ...bewijs.afvoer.filter(r => r.door === t.user._id), ...bewijs.antwoorden.filter(r => r.door === t.user._id), ...bewijs.delegaties.filter(r => r.medewerkerId === t.medewerker!._id)].map(r => r.werkitemId));
    const gewerkt = new Set(segmenten.filter(r => r.orgId === t.org._id && r.categorie === "werken").map(r => r.werkitemId));
    // Kandidaten: wat op de dag gepland staat (begrensde indexquery) plus waar
    // vandaag aan gewerkt is of eigen bewijs voor bestaat — i.p.v. alle projecten.
    const geplandIds = new Set<string>(geplandOpDag.map(p => p._id));
    const extraIds = [...new Set([...gewerkt, ...eigenHistorie])].filter((id): id is Id<"projecten"> => !!id && !geplandIds.has(id));
    const extra = (await Promise.all(extraIds.map(id => ctx.db.get(id)))).filter((p): p is Doc<"projecten"> => !!p && p.orgId === t.org._id);
    const rows = [...geplandOpDag, ...extra].sort((a, b) => a._creationTime - b._creationTime);
    const bezoeken = [];
    for (const item of rows) {
      if (item.deletedAt) continue;
      if (!gewerkt.has(item._id) && !eigenHistorie.has(item._id) && (!werkitemOpDag(item, args.datum) || !(await ledenVoor(ctx, item, args.datum)).includes(t.medewerker._id))) continue;
      const data = await ontbreektVoor(ctx, item, args.datum, t.medewerker._id);
      const klant = item.klantId ? await ctx.db.get(item.klantId) : null;
      const naamVoor = async (id: Id<"users">) => (await ctx.db.get(id))?.name ?? "Onbekend";
      const verplicht = gewerkt.has(item._id) && !!item.klantId;
      bezoeken.push({
        werkitemId: item._id, bezoekSleutel: `${item._id}:${args.datum}`, datum: args.datum, naam: item.naam, instructie: item.uitvoeringsInstructie ?? null,
        klantNaam: klant?.orgId === t.org._id ? klant.naam : null,
        afronding: data.afronding ? { ...data.afronding, doorNaam: await naamVoor(data.afronding.door) } : null,
        afvoer: data.afvoer ? { _id: data.afvoer._id, keuze: data.afvoer.keuze, revision: data.afvoer.revision, door: data.afvoer.door, createdAt: data.afvoer.createdAt, updatedAt: data.afvoer.updatedAt, doorNaam: await naamVoor(data.afvoer.door) } : null,
        fotos: await Promise.all(data.fotos.map(async f => ({ id: f._id, fase: f.fase, createdAt: f.createdAt, url: await ctx.storage.getUrl(f.storageId), doorNaam: await naamVoor(f.door), magVerwijderen: t.kantoor || f.door === t.user._id }))),
        delegaties: await Promise.all(data.delegaties.map(async d => ({ ...d, doorNaam: await naamVoor(d.door) }))),
        ontbreekt: data.ontbreekt, verplicht, gereed: !verplicht || data.persoonlijk.length === 0, gedeeldGereed: data.ontbreekt.length === 0,
      });
    }
    return { bezoeken, gereed: bezoeken.every(b => b.gereed) };
  },
});

/** Office review includes scheduled visits, recorded work and historical
 * answers, even when today's planning fields have since been moved. */
export const getKantoorDag = query({
  args: { datum: v.string() },
  handler: async (ctx, args) => {
    datumCheck(args.datum);
    const t = await toegang(ctx);
    if (!t.kantoor) throw new ConvexError("Alleen kantoor kan alle bezoekmeldingen bekijken");
    const [items, uren, bewijs, medewerkers] = await Promise.all([
      ctx.db.query("projecten").withIndex("by_org", q => q.eq("orgId", t.org._id)).collect(),
      ctx.db.query("urenSegmenten").withIndex("by_org_datum", q => q.eq("orgId", t.org._id).eq("datum", args.datum)).collect(),
      bewijsOpDag(ctx, t.org._id, args.datum),
      ctx.db.query("medewerkers").withIndex("by_org", q => q.eq("orgId", t.org._id)).collect(),
    ]);
    const historisch = new Set([...uren.map(r => r.werkitemId), ...[...bewijs.antwoorden, ...bewijs.fotos, ...bewijs.afvoer, ...bewijs.delegaties].map(r => r.werkitemId)]);
    const bezoeken = [];
    for (const item of items) {
      if (item.deletedAt || (!werkitemOpDag(item, args.datum) && !historisch.has(item._id))) continue;
      const data = await ontbreektVoor(ctx, item, args.datum);
      const klant = item.klantId ? await ctx.db.get(item.klantId) : null;
      const doorNaam = async (id: Id<"users">) => (await ctx.db.get(id))?.name ?? "Onbekend";
      bezoeken.push({
        werkitemId: item._id, bezoekSleutel: `${item._id}:${args.datum}`, datum: args.datum, naam: item.naam, instructie: item.uitvoeringsInstructie ?? null,
        uitvoeringCategorie: item.uitvoeringCategorie ?? null, werkitemUpdatedAt: item.updatedAt,
        klantId: item.klantId ?? null, eigenAdres: item.adres ?? null, relatieBescherming: await relatieBescherming(ctx, item),
        toegewezenMedewerkerIds: item.toegewezenMedewerkerIds ?? null, bemanningIds: await ledenVoor(ctx, item, args.datum),
        klantNaam: klant?.orgId === t.org._id ? klant.naam : null,
        afronding: data.afronding ? { ...data.afronding, doorNaam: await doorNaam(data.afronding.door) } : null,
        afvoer: data.afvoer ? { ...data.afvoer, doorNaam: await doorNaam(data.afvoer.door) } : null,
        fotos: await Promise.all(data.fotos.map(async f => ({ id: f._id, fase: f.fase, createdAt: f.createdAt, url: await ctx.storage.getUrl(f.storageId), doorNaam: await doorNaam(f.door), magVerwijderen: true }))),
        delegaties: await Promise.all(data.delegaties.map(async d => ({ ...d, doorNaam: await doorNaam(d.door) }))),
        ontbreekt: data.ontbreekt, gereed: data.ontbreekt.length === 0, gedeeldGereed: data.ontbreekt.length === 0,
      });
    }
    return { bezoeken, gereed: bezoeken.every(b => b.gereed), medewerkers: medewerkers.filter(m => m.isActief).map(m => ({ id: m._id, naam: m.naam })) };
  },
});

/** Office edits execution details with optimistic concurrency. Customer and
 * location edits stop once evidence exists; historical visits resolve these
 * fields through their workitem and must never silently change ownership. */
export const wijzigKlusInstructie = mutation({
  args: { ...bezoekArgs, naam: v.string(), categorie: v.optional(v.union(v.literal("aanleg"), v.literal("onderhoud"))), instructie: v.string(), expectedUpdatedAt: v.number(), klantId: v.optional(v.id("klanten")), adres: v.optional(v.union(v.string(), v.null())) },
  handler: async (ctx, args) => {
    const t = await bezoekToegang(ctx, args);
    if (!t.kantoor) throw new ConvexError("Alleen kantoor kan de klusomschrijving aanpassen");
    const naam = args.naam.trim(), instructie = args.instructie.trim();
    if (!naam || naam.length > 300 || instructie.length > 10000) throw new ConvexError("Vul een omschrijving in van maximaal 300 tekens en instructies van maximaal 10000 tekens");
    const klantId = args.klantId ?? t.item.klantId;
    const klantWijzigt = klantId !== t.item.klantId;
    // A new customer must not inherit the previous customer's address override.
    const adres = args.adres !== undefined ? args.adres?.trim() || undefined : klantWijzigt ? undefined : t.item.adres;
    if (adres && (adres.length > 500 || /[\r\n]/.test(adres))) throw new ConvexError("Vul een uitvoerlocatie in op één regel van maximaal 500 tekens");
    if (klantWijzigt) {
      const klant = klantId ? await ctx.db.get(klantId) : null;
      if (!klant || klant.orgId !== t.org._id || !hoortInKlantenLijst(klant)) throw new ConvexError("Kies een actieve klant uit deze organisatie");
    }
    const adresWijzigt = adres !== t.item.adres;
    if (klantWijzigt || adresWijzigt) {
      const bescherming = await relatieBescherming(ctx, t.item);
      if (klantWijzigt && bescherming.klant) throw new ConvexError(bescherming.klant);
      if (adresWijzigt && bescherming.locatie) throw new ConvexError(bescherming.locatie);
    }
    const waarden = { naam, uitvoeringCategorie: args.categorie, uitvoeringsInstructie: instructie || undefined, klantId, adres };
    if (t.item.naam === naam && t.item.uitvoeringCategorie === args.categorie && (t.item.uitvoeringsInstructie ?? "") === instructie && !klantWijzigt && !adresWijzigt) return { updatedAt: t.item.updatedAt };
    if (args.expectedUpdatedAt !== t.item.updatedAt) throw new ConvexError("De klus is intussen gewijzigd. Sluit de bewerking en controleer de nieuwste gegevens.");
    const updatedAt = Math.max(Date.now(), t.item.updatedAt + 1);
    await ctx.db.patch(t.item._id, { ...waarden, updatedAt });
    await ctx.db.insert("werkbezoekHistorie", { orgId: t.org._id, werkitemId: t.item._id, datum: args.datum, actie: "klus_instructie", door: t.user._id, voor: JSON.stringify({ naam: t.item.naam, uitvoeringCategorie: t.item.uitvoeringCategorie, uitvoeringsInstructie: t.item.uitvoeringsInstructie, klantId: t.item.klantId, adres: t.item.adres }), na: JSON.stringify(waarden), createdAt: updatedAt });
    return { updatedAt };
  },
});

/** The override belongs to the complete workitem, including all planned days. */
export const stelBemanningIn = mutation({
  args: { ...bezoekArgs, medewerkerIds: v.optional(v.array(v.id("medewerkers"))), verwachteMedewerkerIds: v.union(v.array(v.id("medewerkers")), v.null()) },
  handler: async (ctx, args) => {
    const t = await bezoekToegang(ctx, args);
    if (!t.kantoor) throw new ConvexError("Alleen kantoor kan de bezoekbezetting veranderen");
    if ((args.medewerkerIds?.length ?? 0) > 100) throw new ConvexError("Maximaal 100 medewerkers per klus");
    const ids = args.medewerkerIds === undefined ? undefined : [...new Set(args.medewerkerIds)];
    for (const id of ids ?? []) {
      const m = await ctx.db.get(id);
      if (!m || m.orgId !== t.org._id || !m.isActief) throw new ConvexError("Medewerker niet beschikbaar in dit bedrijf");
    }
    const snap = (waarden: Id<"medewerkers">[] | null | undefined) => waarden == null ? "teamdag" : JSON.stringify([...waarden].sort());
    if (snap(ids) === snap(t.item.toegewezenMedewerkerIds)) return { medewerkerIds: ids ?? null };
    if (snap(args.verwachteMedewerkerIds) !== snap(t.item.toegewezenMedewerkerIds)) throw new ConvexError("De bezoekbezetting is intussen gewijzigd. Vernieuw en controleer eerst.");
    await ctx.db.patch(t.item._id, { toegewezenMedewerkerIds: ids, updatedAt: Date.now() });
    await ctx.db.insert("werkbezoekHistorie", { orgId: t.org._id, werkitemId: t.item._id, datum: args.datum, actie: "bemanning_alle_geplande_dagen", door: t.user._id, voor: snap(t.item.toegewezenMedewerkerIds), na: snap(ids), createdAt: Date.now() });
    return { medewerkerIds: ids ?? null };
  },
});

function commandPayload(actie: string, args: object) { return JSON.stringify([actie, Object.fromEntries(Object.entries(args).sort(([a], [b]) => a.localeCompare(b)))]); }
async function receipt(ctx: MutationCtx, orgId: Id<"organisaties">, userId: Id<"users">, sleutel: string, payload: string) {
  if (!sleutel.trim() || sleutel.length > 200) throw new ConvexError("Een geldige opdrachtsleutel is verplicht");
  const row = await ctx.db.query("werkbezoekOpdrachten").withIndex("by_org_user_sleutel", q => q.eq("orgId", orgId).eq("userId", userId).eq("sleutel", sleutel)).unique();
  if (row && row.payload !== payload) throw new ConvexError("De opdrachtsleutel is al gebruikt voor een ander antwoord");
  return row;
}
async function slaReceiptOp(ctx: MutationCtx, orgId: Id<"organisaties">, userId: Id<"users">, sleutel: string, payload: string, resultaat: object) {
  await ctx.db.insert("werkbezoekOpdrachten", { orgId, userId, sleutel, payload, resultaat: JSON.stringify(resultaat), createdAt: Date.now() });
}

export const meldAfronding = mutation({
  args: { ...bezoekArgs, afgerond: v.boolean(), reden: v.optional(v.string()), resterendMinuten: v.optional(v.number()), expectedRevision: v.optional(v.number()), sleutel: v.string() },
  handler: async (ctx, args): Promise<{ id: Id<"werkbezoekAntwoorden">; revision: number }> => {
    const t = await bezoekToegang(ctx, args), payload = commandPayload("afronding", args);
    const oud = await receipt(ctx, t.org._id, t.user._id, args.sleutel, payload);
    if (oud) return JSON.parse(oud.resultaat);
    if (!args.afgerond && !args.reden?.trim()) throw new ConvexError("Vertel waarom het werk nog niet af is");
    if ((args.reden?.length ?? 0) > 2000 || (args.resterendMinuten !== undefined && (!Number.isInteger(args.resterendMinuten) || args.resterendMinuten < 0 || args.resterendMinuten > 100000))) throw new ConvexError("Ongeldige reden of resterende werktijd");
    const bestaand = (await gegevens(ctx, t.item, args.datum)).afronding;
    if (bestaand && args.expectedRevision !== bestaand.revision) throw new ConvexError("Een collega heeft de afronding gewijzigd. Vernieuw eerst.");
    if (!bestaand && args.expectedRevision !== undefined && args.expectedRevision !== 0) throw new ConvexError("Deze afronding bestaat nog niet");
    const voor = bestaand ? JSON.stringify(bestaand) : undefined, now = Date.now();
    const waarden = { orgId: t.org._id, werkitemId: t.item._id, datum: args.datum, afgerond: args.afgerond, reden: args.afgerond ? undefined : args.reden?.trim(), resterendMinuten: args.afgerond ? undefined : args.resterendMinuten, revision: (bestaand?.revision ?? 0) + 1, door: t.user._id, createdAt: bestaand?.createdAt ?? now, updatedAt: now };
    const id = bestaand?._id ?? await ctx.db.insert("werkbezoekAntwoorden", waarden);
    if (bestaand) await ctx.db.patch(id, waarden);
    await ctx.db.insert("werkbezoekHistorie", { orgId: t.org._id, werkitemId: t.item._id, datum: args.datum, actie: "afronding", door: t.user._id, voor, na: JSON.stringify(waarden), createdAt: now });
    const result = { id, revision: waarden.revision };
    await slaReceiptOp(ctx, t.org._id, t.user._id, args.sleutel, payload, result);
    return result;
  },
});

export const getAfvoerTarieven = query({
  args: {},
  handler: async ctx => {
    const t = await toegang(ctx);
    if (!t.kantoor) throw new ConvexError("Afvoertarieven zijn alleen voor kantoor");
    return ctx.db.query("afvoerTarieven").withIndex("by_org_geldigVanaf", q => q.eq("orgId", t.org._id)).order("desc").collect();
  },
});
export const stelAfvoerTariefIn = mutation({
  args: { geldigVanaf: v.string(), volTariefCent: v.number() },
  handler: async (ctx, args) => {
    const t = await toegang(ctx);
    if (!t.kantoor) throw new ConvexError("Alleen kantoor kan afvoertarieven instellen");
    datumCheck(args.geldigVanaf);
    if (!Number.isSafeInteger(args.volTariefCent) || args.volTariefCent < 0 || args.volTariefCent > 10000000) throw new ConvexError("Vul een geldig tarief in centen in");
    const bestaand = await ctx.db.query("afvoerTarieven").withIndex("by_org_geldigVanaf", q => q.eq("orgId", t.org._id).eq("geldigVanaf", args.geldigVanaf)).unique();
    if (bestaand) {
      if (bestaand.volTariefCent === args.volTariefCent) return bestaand._id;
      throw new ConvexError("Er is al een tarief vanaf deze datum. Kies een nieuwe ingangsdatum; bestaande snapshots blijven behouden.");
    }
    return ctx.db.insert("afvoerTarieven", { orgId: t.org._id, ...args, door: t.user._id, createdAt: Date.now() });
  },
});

/** Per-visit waste allocation, independent from return fullness. The amount is
 * a reviewable snapshot, never an instruction to generate an invoice. */
export const meldAfvoer = mutation({
  args: { ...bezoekArgs, keuze: v.union(v.literal("geen"), v.literal("kwart"), v.literal("half"), v.literal("driekwart"), v.literal("vol")), expectedRevision: v.optional(v.number()), sleutel: v.string(), bedragCent: v.optional(v.number()) },
  handler: async (ctx, args): Promise<{ id: Id<"werkbezoekAfvoer">; revision: number }> => {
    const t = await bezoekToegang(ctx, args), payload = commandPayload("afvoer", args);
    if (args.bedragCent !== undefined && (!t.kantoor || !Number.isSafeInteger(args.bedragCent) || args.bedragCent < 0 || args.bedragCent > 10000000)) throw new ConvexError("Alleen kantoor kan een geldig afvoerbedrag in centen vastleggen");
    const oud = await receipt(ctx, t.org._id, t.user._id, args.sleutel, payload);
    if (oud) return JSON.parse(oud.resultaat);
    const bestaand = (await gegevens(ctx, t.item, args.datum)).afvoer;
    if (bestaand && bestaand.revision !== args.expectedRevision) throw new ConvexError("Een collega heeft de afvoer gewijzigd. Vernieuw eerst.");
    if (!bestaand && args.expectedRevision !== undefined && args.expectedRevision !== 0) throw new ConvexError("Deze afvoermelding bestaat nog niet");
    const tarieven = await ctx.db.query("afvoerTarieven").withIndex("by_org_geldigVanaf", q => q.eq("orgId", t.org._id).lte("geldigVanaf", args.datum)).collect();
    const tarief = tarieven.sort((a, b) => b.geldigVanaf.localeCompare(a.geldigVanaf))[0];
    const delen = { geen: 0, kwart: 1, half: 2, driekwart: 3, vol: 4 }[args.keuze];
    const bedragCent = args.keuze === "geen" ? 0 : args.bedragCent ?? (tarief ? Math.round(tarief.volTariefCent * delen / 4) : undefined);
    const now = Date.now(), voor = bestaand ? JSON.stringify(bestaand) : undefined;
    const waarden = { orgId: t.org._id, werkitemId: t.item._id, datum: args.datum, keuze: args.keuze, bedragCent, volTariefCent: tarief?.volTariefCent, tariefId: tarief?._id, bedragDoor: args.bedragCent !== undefined ? t.user._id : undefined, revision: (bestaand?.revision ?? 0) + 1, door: t.user._id, createdAt: bestaand?.createdAt ?? now, updatedAt: now };
    const id = bestaand?._id ?? await ctx.db.insert("werkbezoekAfvoer", waarden);
    if (bestaand) await ctx.db.patch(id, waarden);
    await ctx.db.insert("werkbezoekHistorie", { orgId: t.org._id, werkitemId: t.item._id, datum: args.datum, actie: "afvoer", door: t.user._id, voor, na: JSON.stringify(waarden), createdAt: now });
    const result = { id, revision: waarden.revision };
    await slaReceiptOp(ctx, t.org._id, t.user._id, args.sleutel, payload, result);
    return result;
  },
});

export const delegeer = mutation({
  args: { ...bezoekArgs, onderdeel: onderdeelValidator, naarMedewerkerId: v.optional(v.id("medewerkers")), sleutel: v.string() },
  handler: async (ctx, args): Promise<{ id: Id<"werkbezoekDelegaties"> }> => {
    const t = await bezoekToegang(ctx, args);
    if (!t.medewerker) throw new ConvexError("Koppel eerst je medewerkerprofiel");
    if (args.naarMedewerkerId) {
      const naar = await ctx.db.get(args.naarMedewerkerId);
      if (!naar || naar.orgId !== t.org._id || !t.leden.includes(naar._id) || naar._id === t.medewerker._id) throw new ConvexError("Kies een andere collega van dit bezoek");
    }
    const payload = commandPayload("delegeer", args), oud = await receipt(ctx, t.org._id, t.user._id, args.sleutel, payload);
    if (oud) return JSON.parse(oud.resultaat);
    const bestaand = (await gegevens(ctx, t.item, args.datum)).delegaties.find(d => d.medewerkerId === t.medewerker!._id && d.onderdeel === args.onderdeel);
    const waarden = { orgId: t.org._id, werkitemId: t.item._id, datum: args.datum, onderdeel: args.onderdeel, medewerkerId: t.medewerker._id, naarMedewerkerId: args.naarMedewerkerId, door: t.user._id, createdAt: Date.now() };
    const id = bestaand?._id ?? await ctx.db.insert("werkbezoekDelegaties", waarden);
    if (bestaand) await ctx.db.patch(id, waarden);
    await ctx.db.insert("werkbezoekHistorie", { orgId: t.org._id, werkitemId: t.item._id, datum: args.datum, actie: "delegatie", door: t.user._id, na: JSON.stringify(waarden), createdAt: Date.now() });
    await slaReceiptOp(ctx, t.org._id, t.user._id, args.sleutel, payload, { id });
    return { id };
  },
});

export const trekDelegatieIn = mutation({
  args: { id: v.id("werkbezoekDelegaties") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return;
    const t = await bezoekToegang(ctx, row);
    if (row.orgId !== t.org._id || (!t.kantoor && row.medewerkerId !== t.medewerker?._id)) throw new ConvexError("Je kunt alleen je eigen delegatie intrekken");
    await ctx.db.delete(row._id);
    await ctx.db.insert("werkbezoekHistorie", { orgId: t.org._id, werkitemId: row.werkitemId, datum: row.datum, actie: "delegatie_ingetrokken", door: t.user._id, voor: JSON.stringify(row), na: "null", createdAt: Date.now() });
  },
});

/** Binding to the hash of intended bytes prevents attaching an arbitrary
 * storage ID from another upload. Tickets are actor/visit scoped and single use. */
export const uploadUrl = mutation({
  args: { ...bezoekArgs, sha256: v.string() },
  handler: async (ctx, args) => {
    const t = await bezoekToegang(ctx, args);
    if (!/^[a-f0-9]{64}$/i.test(args.sha256)) throw new ConvexError("Ongeldige bestandscontrole");
    const ticketId = await ctx.db.insert("werkbezoekUploads", { orgId: t.org._id, werkitemId: t.item._id, datum: args.datum, userId: t.user._id, sha256: args.sha256.toLowerCase(), createdAt: Date.now() });
    return { url: await ctx.storage.generateUploadUrl(), ticketId };
  },
});

export const voegFotoToe = mutation({
  args: { ...bezoekArgs, fase: v.union(v.literal("voor"), v.literal("na")), storageId: v.id("_storage"), ticketId: v.id("werkbezoekUploads"), sleutel: v.string() },
  handler: async (ctx, args): Promise<{ id: Id<"werkbezoekFotos"> }> => {
    const t = await bezoekToegang(ctx, args), payload = commandPayload("foto", args);
    const oud = await receipt(ctx, t.org._id, t.user._id, args.sleutel, payload);
    if (oud) return JSON.parse(oud.resultaat);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.orgId !== t.org._id || ticket.userId !== t.user._id || ticket.werkitemId !== args.werkitemId || ticket.datum !== args.datum || (ticket.storageId && ticket.storageId !== args.storageId)) throw new ConvexError("Deze upload hoort niet bij dit bezoek of account");
    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata) throw new ConvexError("De geüploade foto ontbreekt. Probeer de foto opnieuw te uploaden.");
    if (!fotoHashGelijk(metadata.sha256, ticket.sha256)) throw new ConvexError("De inhoud van de foto wijkt af van het uploadticket. Kies de foto opnieuw.");
    if (!metadata.contentType?.startsWith("image/")) throw new ConvexError("Het opgeslagen bestandstype is geen afbeelding.");
    if (metadata.size > 15 * 1024 * 1024) throw new ConvexError("Deze foto is groter dan 15 MB. Kies een kleinere foto.");
    const existing = await ctx.db.query("werkbezoekFotos").withIndex("by_storage", q => q.eq("storageId", args.storageId)).collect();
    if (existing.length) {
      const same = existing.find(f => f.orgId === t.org._id && f.werkitemId === args.werkitemId && f.datum === args.datum && f.fase === args.fase && !f.verwijderdOp);
      if (!same) throw new ConvexError("Deze foto is al aan een ander bezoek gekoppeld");
      await slaReceiptOp(ctx, t.org._id, t.user._id, args.sleutel, payload, { id: same._id });
      return { id: same._id };
    }
    let tijdlijnId: Id<"klantTijdlijn"> | undefined;
    if (t.item.klantId) {
      const klant = await ctx.db.get(t.item.klantId);
      if (!klant || klant.orgId !== t.org._id) throw new ConvexError("Klant niet gevonden");
      tijdlijnId = await logTijdlijnEvent(ctx, { orgId: t.org._id, klantId: klant._id, werkitemId: t.item._id, eventType: "handmatig", tekst: `${args.fase === "voor" ? "Voorfoto" : "Nafoto"} bij ${t.item.naam} · ${args.datum}`, auteurId: t.user._id, auteurNaam: t.user.name, bijlagen: [args.storageId] }) ?? undefined;
      if (!tijdlijnId) throw new ConvexError("Foto kon niet aan het klantdossier worden toegevoegd");
    }
    const id = await ctx.db.insert("werkbezoekFotos", { orgId: t.org._id, werkitemId: t.item._id, datum: args.datum, fase: args.fase, storageId: args.storageId, door: t.user._id, tijdlijnId, createdAt: Date.now() });
    await ctx.db.patch(ticket._id, { storageId: args.storageId });
    await slaReceiptOp(ctx, t.org._id, t.user._id, args.sleutel, payload, { id });
    return { id };
  },
});

export const verwijderFoto = mutation({
  args: { id: v.id("werkbezoekFotos") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return;
    const t = await bezoekToegang(ctx, row);
    if (row.orgId !== t.org._id || (!t.kantoor && row.door !== t.user._id)) throw new ConvexError("Je kunt alleen je eigen foto verwijderen");
    if (row.verwijderdOp) return;
    await ctx.db.patch(row._id, { verwijderdOp: Date.now(), verwijderdDoor: t.user._id });
    if (row.tijdlijnId) {
      const entry = await ctx.db.get(row.tijdlijnId);
      if (entry?.orgId === t.org._id) await ctx.db.patch(entry._id, { bijlagen: (entry.bijlagen ?? []).filter(id => id !== row.storageId) });
    }
    await ctx.db.insert("werkbezoekHistorie", { orgId: t.org._id, werkitemId: row.werkitemId, datum: row.datum, actie: "foto_verwijderd", door: t.user._id, voor: JSON.stringify(row), na: "null", createdAt: Date.now() });
    // Keep the blob for audit/retention; never destroy a potentially shared file.
  },
});
