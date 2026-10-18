import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { werkitemOpDag } from "../planbordLogica";

/** An explicit list overrides crew even when empty. Undefined follows team/day. */
export function effectieveBezoekLeden<T>(item: { toegewezenMedewerkerIds?: T[] }, teamDagLeden: T[]): T[] {
  return item.toegewezenMedewerkerIds ?? teamDagLeden;
}
export async function bezoekLedenVoor(db: QueryCtx["db"], item: Doc<"projecten">, datum: string): Promise<Id<"medewerkers">[]> {
  if (item.toegewezenMedewerkerIds !== undefined) return item.toegewezenMedewerkerIds;
  if (!item.teamId) return [];
  return teamDagLedenVoor(db, item.orgId, item.teamId, datum);
}
export async function teamDagLedenVoor(db: QueryCtx["db"], orgId: Id<"organisaties">, teamId: Id<"teams">, datum: string): Promise<Id<"medewerkers">[]> {
  const team = await db.get(teamId);
  if (!team || team.orgId !== orgId) return [];
  const rows = await db.query("teamBemanning").withIndex("by_team_datum", q => q.eq("teamId", team._id).eq("datum", datum)).collect();
  return rows.find(r => r.orgId === orgId)?.medewerkerIds ?? team.leden;
}

/**
 * Werkitems van de organisatie die in [van, tot] gepland staan (zelfde regel als
 * `werkitemOpDag`: geplandeStart ≤ dag ≤ geplandeEind ?? geplandeStart), zonder
 * volledige projectentabel-scan:
 *  - items die in de periode starten (`by_org_geplandeStart`) — dekt ook items
 *    zonder geplandeEind;
 *  - items die op/na `van` eindigen (`by_org_geplandeEind`) en vóór/op `tot`
 *    gestart zijn — dekt lopende meerdaagse klussen, hoe lang ook.
 * De omvang groeit met de vooruitplanning, niet met de historie.
 */
export async function werkitemsInPeriode(db: QueryCtx["db"], orgId: Id<"organisaties">, van: string, tot: string): Promise<Doc<"projecten">[]> {
  const [startend, lopend] = await Promise.all([
    db.query("projecten").withIndex("by_org_geplandeStart", q => q.eq("orgId", orgId).gte("geplandeStart", van).lte("geplandeStart", tot)).collect(),
    db.query("projecten").withIndex("by_org_geplandeEind", q => q.eq("orgId", orgId).gte("geplandeEind", van)).collect(),
  ]);
  const perId = new Map<string, Doc<"projecten">>();
  for (const item of [...startend, ...lopend]) {
    if (item.orgId !== orgId || !item.geplandeStart || item.geplandeStart > tot) continue;
    const eind = item.geplandeEind ?? item.geplandeStart;
    if (eind < van) continue;
    perId.set(item._id, item);
  }
  return [...perId.values()];
}

/** Gedeelde dagdata voor de bemanningsregel: één keer laden, per medewerker filteren. */
export interface DagBemanning {
  datum: string;
  items: Doc<"projecten">[];
  teamLeden: Map<Id<"teams">, Id<"medewerkers">[]>;
}

export async function laadDagBemanning(db: QueryCtx["db"], orgId: Id<"organisaties">, datum: string): Promise<DagBemanning> {
  const [items, teams, overrides] = await Promise.all([
    werkitemsInPeriode(db, orgId, datum, datum),
    db.query("teams").withIndex("by_org", q => q.eq("orgId", orgId)).collect(),
    db.query("teamBemanning").withIndex("by_org_datum", q => q.eq("orgId", orgId).eq("datum", datum)).collect(),
  ]);
  const teamLeden = new Map(teams.filter(t => t.isActief !== false).map(t => [t._id, overrides.find(r => r.teamId === t._id)?.medewerkerIds ?? t.leden]));
  return { datum, items: items.filter(item => !item.deletedAt && !item.isArchived && item.status !== "vervallen" && werkitemOpDag(item, datum)), teamLeden };
}

/** Pure: de werkitems van één medewerker uit voorgeladen dagdata, in dagkaartvolgorde. */
export function werkitemsVoorMedewerkerUit(dag: DagBemanning, medewerkerId: Id<"medewerkers">): Doc<"projecten">[] {
  return dag.items.filter(item => effectieveBezoekLeden(item, item.teamId ? dag.teamLeden.get(item.teamId) ?? [] : []).includes(medewerkerId))
    .sort((a, b) => (a.geplandeStartTijd ?? "99:99").localeCompare(b.geplandeStartTijd ?? "99:99") || (a.volgordeBinnenDag ?? 999) - (b.volgordeBinnenDag ?? 999) || a.naam.localeCompare(b.naam));
}

/** Includes explicit assignments outside the employee's home team or without team. */
export async function werkitemsVoorMedewerkerDag(db: QueryCtx["db"], orgId: Id<"organisaties">, medewerkerId: Id<"medewerkers">, datum: string, voorgeladen?: DagBemanning) {
  const dag = voorgeladen && voorgeladen.datum === datum ? voorgeladen : await laadDagBemanning(db, orgId, datum);
  return werkitemsVoorMedewerkerUit(dag, medewerkerId);
}
