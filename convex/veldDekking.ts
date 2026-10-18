import { effectieveBezoekLeden, werkitemsInPeriode } from "./lib/bezoekBemanning";
import { v, ConvexError } from "convex/values";
import { query, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireOrgContext } from "./auth";
import { isKantoorRol } from "./roles";
import { werkitemOpDag } from "./planbordLogica";
import { valideerUrenPeriode } from "./lib/urenTotalen";

export function indienStatus(statussen: string[], dagIngediend: boolean): "niets" | "open" | "deels" | "ingediend" {
  if (!statussen.length) return "niets";
  if (dagIngediend && statussen.every(s => s === "ingediend")) return "ingediend";
  return statussen.some(s => s === "ingediend") ? "deels" : "open";
}

/** Ondergrens voor de afwezigheidsquery: blokken die langer duren worden niet meegelezen. */
export const AFWEZIGHEID_MAX_DUUR_DAGEN = 366;

export async function leesDekking(ctx: QueryCtx | MutationCtx, orgId: Id<"organisaties">, van: string, tot: string) {
  valideerUrenPeriode(van, tot);
  if ((Date.parse(tot) - Date.parse(van)) / 86400000 > 31) throw new ConvexError("Kies maximaal een maand voor klusdekking");
  // Afwezigheidsblokken die vóór `van` begonnen kunnen nog lopen; een blok van
  // meer dan een jaar bestaat in de praktijk niet, dus dat is de ondergrens.
  const afwezigVanaf = new Date(Date.parse(van) - AFWEZIGHEID_MAX_DUUR_DAGEN * 86400000).toISOString().slice(0, 10);
  const [items, segmenten, dagen, mensen, teams, bemanning, afwezig] = await Promise.all([
    werkitemsInPeriode(ctx.db, orgId, van, tot),
    ctx.db.query("urenSegmenten").withIndex("by_org_datum", q => q.eq("orgId", orgId).gte("datum", van).lte("datum", tot)).collect(),
    ctx.db.query("urenDagen").withIndex("by_org_datum", q => q.eq("orgId", orgId).gte("datum", van).lte("datum", tot)).collect(),
    ctx.db.query("medewerkers").withIndex("by_org", q => q.eq("orgId", orgId)).collect(),
    ctx.db.query("teams").withIndex("by_org", q => q.eq("orgId", orgId)).collect(),
    ctx.db.query("teamBemanning").withIndex("by_org_datum", q => q.eq("orgId", orgId).gte("datum", van).lte("datum", tot)).collect(),
    ctx.db.query("afwezigheidsblokken").withIndex("by_org_start", q => q.eq("orgId", orgId).gte("startDatum", afwezigVanaf).lte("startDatum", tot)).collect(),
  ]);
  const personen = new Map(mensen.map(m => [m._id, m]));
  const teamMap = new Map(teams.map(t => [t._id, t]));
  const rijen = new Map<string, { datum: string; medewerkerId: Id<"medewerkers">; medewerkerNaam: string; bezoeken: Array<{ werkitemId: Id<"projecten">; naam: string; gelogd: boolean; afwezig: boolean }> }>();
  const zorg = (medewerkerId: Id<"medewerkers">, datum: string) => {
    const sleutel = `${medewerkerId}:${datum}`;
    if (!rijen.has(sleutel)) rijen.set(sleutel, { datum, medewerkerId, medewerkerNaam: personen.get(medewerkerId)?.naam ?? "Onbekend", bezoeken: [] });
    return rijen.get(sleutel)!;
  };
  const perDag = new Map<string, typeof segmenten>();
  for (const s of segmenten) {
    zorg(s.medewerkerId, s.datum);
    const sleutel = `${s.medewerkerId}:${s.datum}`;
    perDag.set(sleutel, [...perDag.get(sleutel) ?? [], s]);
  }
  for (let tijd = Date.parse(van); tijd <= Date.parse(tot); tijd += 86400000) {
    const datum = new Date(tijd).toISOString().slice(0, 10);
    for (const item of items) {
      if (item.deletedAt || item.isArchived || item.status === "vervallen" || !werkitemOpDag(item, datum)) continue;
      const ids = effectieveBezoekLeden(item, item.teamId ? bemanning.find(b => b.teamId === item.teamId && b.datum === datum)?.medewerkerIds ?? teamMap.get(item.teamId)?.leden ?? [] : []);
      for (const medewerkerId of new Set(ids)) {
        if (!personen.has(medewerkerId)) continue;
        const r = zorg(medewerkerId, datum);
        const gelogd = (perDag.get(`${medewerkerId}:${datum}`) ?? []).some(s => s.categorie === "werken" && s.werkitemId === item._id);
        const isAfwezig = afwezig.some(a => a.startDatum <= datum && a.eindDatum >= datum && (a.medewerkerId === medewerkerId || (item.teamId && a.teamId === item.teamId) || (!a.medewerkerId && !a.teamId)));
        r.bezoeken.push({ werkitemId: item._id, naam: item.naam, gelogd, afwezig: !!isAfwezig });
      }
    }
  }
  return [...rijen.values()].map(r => {
    const regels = perDag.get(`${r.medewerkerId}:${r.datum}`) ?? [];
    return { ...r, status: indienStatus(regels.map(s => s.status), dagen.some(d => d.medewerkerId === r.medewerkerId && d.datum === r.datum && d.status === "ingediend")), geregistreerdeBlokken: regels.length,
      ontbrekendeBezoeken: r.bezoeken.filter(b => !b.gelogd && !b.afwezig).length };
  }).sort((a, b) => a.datum.localeCompare(b.datum) || a.medewerkerNaam.localeCompare(b.medewerkerNaam));
}
export const getPeriode = query({
  args: { van: v.string(), tot: v.string() },
  handler: async (ctx, args) => {
    const { org, user } = await requireOrgContext(ctx);
    if (!isKantoorRol(user.role)) throw new ConvexError("Alleen kantoor kan de klusdekking bekijken");
    return leesDekking(ctx, org._id, args.van, args.tot);
  },
});
