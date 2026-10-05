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
/** Includes explicit assignments outside the employee's home team or without team. */
export async function werkitemsVoorMedewerkerDag(db: QueryCtx["db"], orgId: Id<"organisaties">, medewerkerId: Id<"medewerkers">, datum: string) {
  const [items, teams, overrides] = await Promise.all([
    db.query("projecten").withIndex("by_org", q => q.eq("orgId", orgId)).collect(),
    db.query("teams").withIndex("by_org", q => q.eq("orgId", orgId)).collect(),
    db.query("teamBemanning").withIndex("by_org_datum", q => q.eq("orgId", orgId).eq("datum", datum)).collect(),
  ]);
  const leden = new Map(teams.filter(t => t.isActief !== false).map(t => [t._id, overrides.find(r => r.teamId === t._id)?.medewerkerIds ?? t.leden]));
  return items.filter(item => !item.deletedAt && !item.isArchived && item.status !== "vervallen" && werkitemOpDag(item, datum) && effectieveBezoekLeden(item, item.teamId ? leden.get(item.teamId) ?? [] : []).includes(medewerkerId))
    .sort((a, b) => (a.geplandeStartTijd ?? "99:99").localeCompare(b.geplandeStartTijd ?? "99:99") || (a.volgordeBinnenDag ?? 999) - (b.volgordeBinnenDag ?? 999) || a.naam.localeCompare(b.naam));
}
