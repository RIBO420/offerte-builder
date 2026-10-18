import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { regelMinuten } from "./urenTotalen";

type Ctx = QueryCtx | MutationCtx;

export interface ProjectUrenRegel { id: string; datum: string; minuten: number; scope?: string; medewerkerId?: string; medewerker?: string; medewerkerClerkId?: string; notities?: string; taakId?: Id<"planningTaken">; bron: string }
export type ProjectUrenBron = "legacy" | "segmenten";

/** Two ledgers can contain the same labour. Never add them or silently prefer one. */
export function kiesProjectUrenBron(keuze: ProjectUrenBron | undefined, legacyAantal: number, segmentAantal: number) {
  if (keuze) return { status: "ok" as const, bron: keuze };
  if (legacyAantal > 0 && segmentAantal > 0) return { status: "conflict" as const, bron: null };
  return { status: "ok" as const, bron: segmentAantal > 0 ? "segmenten" as const : "legacy" as const };
}

// ── Telregels: gedeeld door het per-projectpad en de org-brede scan ─────────

type LegacyRij = Pick<Doc<"urenRegistraties">, "_id" | "orgId" | "projectId" | "datum" | "uren" | "scope" | "medewerkerId" | "medewerker" | "medewerkerClerkId" | "notities" | "taakId" | "bron">;
type SegmentRij = Pick<Doc<"urenSegmenten">, "_id" | "orgId" | "werkitemId" | "datum" | "beginTijd" | "eindTijd" | "categorie" | "status" | "medewerkerId" | "notitie">;
type ProjectBronVelden = Pick<Doc<"projecten">, "orgId" | "urenBron">;

export function telbareLegacyRij(r: Pick<LegacyRij, "orgId">, orgId: Id<"organisaties">): boolean {
  return !r.orgId || r.orgId === orgId;
}
/** Pause is unpaid and concepts are not yet labour. Explicitly linked travel/loading/internal work is a project labour cost. */
export function telbaarSegment(s: Pick<SegmentRij, "orgId" | "categorie" | "status">, orgId: Id<"organisaties">): boolean {
  return s.orgId === orgId && s.categorie !== "pauze" && s.status !== "concept";
}

export interface ProjectUrenSelectie {
  status: "ok" | "conflict";
  bron: ProjectUrenBron | null;
  explicieteKeuze: ProjectUrenBron | null;
  legacyAantal: number;
  segmentAantal: number;
  legacyMinuten: number;
  segmentMinuten: number;
  minuten: number | null;
  regels: ProjectUrenRegel[];
}

/**
 * Pure selectie voor één project: filtert de telbare rijen, past de beslisregel
 * toe en levert de regels van het gekozen grootboek. `elders` zegt dat er van
 * een grootboek telbare rijen bestaan búíten de aangeleverde set (bv. buiten
 * een scanperiode) — die tellen alleen mee voor de bronkeuze, niet in de regels.
 */
export function selecteerProjectUren(
  project: ProjectBronVelden,
  legacyRijen: readonly LegacyRij[],
  segmentRijen: readonly SegmentRij[],
  elders: { legacy?: boolean; segmenten?: boolean } = {},
): ProjectUrenSelectie {
  const legacy = legacyRijen.filter(r => telbareLegacyRij(r, project.orgId));
  const segmenten = segmentRijen.filter(s => telbaarSegment(s, project.orgId));
  const keuze = kiesProjectUrenBron(
    project.urenBron,
    legacy.length + (elders.legacy ? 1 : 0),
    segmenten.length + (elders.segmenten ? 1 : 0),
  );
  const legacyMinuten = legacy.reduce((n, r) => n + Math.round(r.uren * 60), 0);
  const segmentMinuten = segmenten.reduce((n, r) => n + regelMinuten(r), 0);
  const regels: ProjectUrenRegel[] = keuze.bron === "segmenten"
    ? segmenten.map(s => ({ id: s._id as string, datum: s.datum, minuten: regelMinuten(s), scope: undefined, medewerkerId: s.medewerkerId as string, medewerker: undefined, medewerkerClerkId: undefined, notities: s.notitie, taakId: undefined, bron: "segmenten" }))
    : keuze.bron === "legacy" ? legacy.map(r => ({ id: r._id as string, datum: r.datum, minuten: Math.round(r.uren * 60), scope: r.scope, medewerkerId: r.medewerkerId as string | undefined, medewerker: r.medewerker, medewerkerClerkId: r.medewerkerClerkId, notities: r.notities, taakId: r.taakId, bron: r.bron })) : [];
  return { ...keuze, explicieteKeuze: project.urenBron ?? null, legacyAantal: legacy.length, segmentAantal: segmenten.length,
    legacyMinuten, segmentMinuten, minuten: keuze.status === "conflict" ? null : regels.reduce((n, r) => n + r.minuten, 0), regels };
}

/** Adapter naar het registratiecontract van de bestaande rapportages; stabiele
 * medewerker-ID's gaan voor, namen zijn alleen een legacy-terugval. */
export function naarRegistraties(project: Pick<Doc<"projecten">, "_id" | "orgId">, selectie: ProjectUrenSelectie, namen: ReadonlyMap<string, string>) {
  return selectie.regels.map(r => ({
    ...r, _id: r.id, projectId: project._id, orgId: project.orgId,
    uren: r.minuten / 60, medewerker: r.medewerker ?? (r.medewerkerId ? namen.get(r.medewerkerId) : undefined) ?? "Onbekende medewerker",
    bronTabel: selectie.bron === "segmenten" ? "urenSegmenten" as const : "urenRegistraties" as const,
  }));
}
export type ProjectUrenRegistratie = ReturnType<typeof naarRegistraties>[number];

async function medewerkerNamen(ctx: Ctx, orgId: Id<"organisaties">, regels: readonly ProjectUrenRegel[]) {
  const ids = [...new Set(regels.flatMap(r => r.medewerkerId && !r.medewerker ? [r.medewerkerId] : []))];
  const medewerkers = await Promise.all(ids.map(id => ctx.db.get(id as Id<"medewerkers">)));
  return new Map(medewerkers.filter((m): m is Doc<"medewerkers"> => !!m && m.orgId === orgId).map(m => [m._id as string, m.naam]));
}

// ── Per project (detailschermen) ─────────────────────────────────────────────

export async function projectUrenBron(ctx: Ctx, project: Doc<"projecten">) {
  const [legacyRijen, alleSegmenten] = await Promise.all([
    ctx.db.query("urenRegistraties").withIndex("by_project", q => q.eq("projectId", project._id)).collect(),
    ctx.db.query("urenSegmenten").withIndex("by_werkitem", q => q.eq("werkitemId", project._id)).collect(),
  ]);
  return selecteerProjectUren(project, legacyRijen, alleSegmenten);
}

export async function projectUrenRegistraties(ctx: Ctx, project: Doc<"projecten">) {
  const selectie = await projectUrenBron(ctx, project);
  const namen = await medewerkerNamen(ctx, project.orgId, selectie.regels);
  return { ...selectie, registraties: naarRegistraties(project, selectie, namen) };
}

export function urenBronConflictFout(project: Pick<Doc<"projecten">, "_id" | "naam">) {
  return { code: "URENBRON_CONFLICT" as const, projectId: project._id, projectNaam: project.naam,
    message: `Kies de urenbron voor ${project.naam} bij Project → Nacalculatie. Dit project bevat zowel projectregistraties als dagsegmenten.` };
}

/** Legacy report contracts cannot encode an unknown numeric total. Fail visibly
 * instead of presenting partial totals — ALLEEN voor schermen over één project.
 * Lijsten en aggregaties gebruiken `projectUrenVoorOrg`, dat conflicten markeert. */
export async function vereisProjectUrenRegistraties(ctx: Ctx, project: Doc<"projecten">) {
  const result = await projectUrenRegistraties(ctx, project);
  if (result.status === "conflict") {
    const { ConvexError } = await import("convex/values");
    throw new ConvexError(urenBronConflictFout(project));
  }
  return result.registraties;
}

export async function vereisProjectUrenViaId(ctx: Ctx, projectId: Id<"projecten">) {
  const project = await ctx.db.get(projectId);
  if (!project) return [];
  return vereisProjectUrenRegistraties(ctx, project);
}

// ── Org-breed (lijsten en aggregaties): één scan, nooit gooien ──────────────

/** Leest in kleine happen tot er een telbare rij is; alleen bij veel niet-telbare rijen alles. */
async function bestaatTelbaar<T>(maakQuery: () => { take(n: number): Promise<T[]>; collect(): Promise<T[]> }, telbaar: (rij: T) => boolean) {
  const eerste = await maakQuery().take(25);
  if (eerste.some(telbaar)) return true;
  if (eerste.length < 25) return false;
  return (await maakQuery().collect()).some(telbaar);
}

export interface OrgUrenScan {
  /** Selectie per projectId (alleen projecten met rijen in de scan of in `ookProjectIds`). */
  perProject: Map<string, ProjectUrenSelectie>;
  /** Registraties van projecten zonder conflict, uit het gekozen grootboek. */
  registraties: ProjectUrenRegistratie[];
  conflicten: Array<{ projectId: Id<"projecten">; naam: string; legacyMinuten: number; segmentMinuten: number }>;
  /** Medewerkers met (telbare) rijen op een conflictproject — hun totalen zijn onvolledig. */
  conflictMedewerkers: { ids: Set<string>; namen: Set<string> };
}

/**
 * Org-brede urenselectie met precies dezelfde beslisregel als `projectUrenBron`,
 * maar met één indexscan per grootboek (`by_org_datum`, desgewenst begrensd tot
 * een periode) in plaats van twee queries per project. Gooit nooit: een project
 * met beide grootboeken en zonder expliciete keuze komt in `conflicten` en telt
 * niet mee in `registraties`.
 *
 * Bij een begrensde periode is de bronkeuze toch project-breed: heeft een project
 * in de periode rijen uit één grootboek, dan wordt met een goedkope
 * bestaanscheck gekeken of het andere grootboek elders rijen heeft.
 *
 * @param projecten optioneel voorgeladen projecten; dan tellen alleen deze mee.
 * @param ookProjectIds projecten waarvan de bron ook zonder rijen in de periode bepaald moet worden.
 */
export async function projectUrenVoorOrg(
  ctx: Ctx,
  orgId: Id<"organisaties">,
  opties: { vanaf?: string; tot?: string; projecten?: readonly Doc<"projecten">[]; ookProjectIds?: readonly Id<"projecten">[] } = {},
): Promise<OrgUrenScan> {
  const { vanaf, tot } = opties;
  const [legacyRijen, segmentRijen] = await Promise.all([
    ctx.db.query("urenRegistraties").withIndex("by_org_datum", q => {
      const b = q.eq("orgId", orgId);
      if (vanaf && tot) return b.gte("datum", vanaf).lte("datum", tot);
      if (vanaf) return b.gte("datum", vanaf);
      if (tot) return b.lte("datum", tot);
      return b;
    }).collect(),
    ctx.db.query("urenSegmenten").withIndex("by_org_datum", q => {
      const b = q.eq("orgId", orgId);
      if (vanaf && tot) return b.gte("datum", vanaf).lte("datum", tot);
      if (vanaf) return b.gte("datum", vanaf);
      if (tot) return b.lte("datum", tot);
      return b;
    }).collect(),
  ]);
  return projectUrenUitRijen(ctx, orgId, legacyRijen, segmentRijen, { volledig: !vanaf && !tot, projecten: opties.projecten, ookProjectIds: opties.ookProjectIds });
}

/**
 * Kern van `projectUrenVoorOrg` voor een al opgehaalde set rijen (bv. alle rijen
 * van één medewerker). `volledig: false` betekent dat de set niet alle rijen van
 * de betrokken projecten bevat; de bronkeuze doet dan een bestaanscheck op het
 * ontbrekende grootboek.
 */
export async function projectUrenUitRijen(
  ctx: Ctx,
  orgId: Id<"organisaties">,
  legacyRijen: readonly LegacyRij[],
  segmentRijen: readonly SegmentRij[],
  opties: { volledig: boolean; projecten?: readonly Doc<"projecten">[]; ookProjectIds?: readonly Id<"projecten">[] },
): Promise<OrgUrenScan> {
  const legacyPerProject = new Map<string, LegacyRij[]>();
  for (const r of legacyRijen) legacyPerProject.set(r.projectId, [...legacyPerProject.get(r.projectId) ?? [], r]);
  const segmentenPerProject = new Map<string, SegmentRij[]>();
  for (const s of segmentRijen) if (s.werkitemId) segmentenPerProject.set(s.werkitemId, [...segmentenPerProject.get(s.werkitemId) ?? [], s]);

  const kandidaatIds = new Set<string>([...legacyPerProject.keys(), ...segmentenPerProject.keys(), ...(opties.ookProjectIds ?? []).map(String)]);
  const projectMap = new Map<string, Doc<"projecten">>();
  if (opties.projecten) {
    for (const p of opties.projecten) if (p.orgId === orgId && kandidaatIds.has(p._id)) projectMap.set(p._id, p);
  } else {
    const docs = await Promise.all([...kandidaatIds].map(id => ctx.db.get(id as Id<"projecten">)));
    for (const p of docs) if (p && p.orgId === orgId) projectMap.set(p._id, p);
  }

  const { volledig } = opties;
  const perProject = new Map<string, ProjectUrenSelectie>();
  const registraties: ProjectUrenRegistratie[] = [];
  const conflicten: OrgUrenScan["conflicten"] = [];
  const conflictMedewerkers = { ids: new Set<string>(), namen: new Set<string>() };
  const selecties: Array<{ project: Doc<"projecten">; selectie: ProjectUrenSelectie }> = [];

  await Promise.all([...projectMap.values()].map(async project => {
    const legacy = legacyPerProject.get(project._id) ?? [];
    const segmenten = segmentenPerProject.get(project._id) ?? [];
    const elders: { legacy?: boolean; segmenten?: boolean } = {};
    if (!volledig && !project.urenBron) {
      let heeftLegacy = legacy.some(r => telbareLegacyRij(r, project.orgId));
      const heeftSegment = segmenten.some(s => telbaarSegment(s, project.orgId));
      if (!heeftLegacy) {
        heeftLegacy = elders.legacy = await bestaatTelbaar(
          () => ctx.db.query("urenRegistraties").withIndex("by_project", q => q.eq("projectId", project._id)),
          r => telbareLegacyRij(r, project.orgId));
      }
      if (!heeftSegment && heeftLegacy) {
        elders.segmenten = await bestaatTelbaar(
          () => ctx.db.query("urenSegmenten").withIndex("by_werkitem", q => q.eq("werkitemId", project._id)),
          s => telbaarSegment(s, project.orgId));
      }
    }
    const selectie = selecteerProjectUren(project, legacy, segmenten, elders);
    perProject.set(project._id, selectie);
    selecties.push({ project, selectie });
    if (selectie.status === "conflict") {
      conflicten.push({ projectId: project._id, naam: project.naam, legacyMinuten: selectie.legacyMinuten, segmentMinuten: selectie.segmentMinuten });
      for (const r of legacy) if (telbareLegacyRij(r, project.orgId)) {
        if (r.medewerkerId) conflictMedewerkers.ids.add(r.medewerkerId); else conflictMedewerkers.namen.add(r.medewerker);
      }
      for (const s of segmenten) if (telbaarSegment(s, project.orgId)) conflictMedewerkers.ids.add(s.medewerkerId);
    }
  }));

  const namen = await medewerkerNamen(ctx, orgId, selecties.flatMap(s => s.selectie.regels));
  for (const { project, selectie } of selecties) {
    if (selectie.status === "ok") registraties.push(...naarRegistraties(project, selectie, namen));
  }
  conflicten.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  return { perProject, registraties, conflicten, conflictMedewerkers };
}

/** Hoort deze registratie bij deze medewerker? Zelfde regel als de rapportages: ID eerst, naam als terugval. */
export function registratieVanMedewerker(r: { medewerkerId?: string; medewerker: string }, medewerker: Pick<Doc<"medewerkers">, "_id" | "naam">) {
  return r.medewerkerId ? r.medewerkerId === medewerker._id : r.medewerker === medewerker.naam;
}
export function medewerkerInConflict(scan: Pick<OrgUrenScan, "conflictMedewerkers">, medewerker: Pick<Doc<"medewerkers">, "_id" | "naam">) {
  return scan.conflictMedewerkers.ids.has(medewerker._id) || scan.conflictMedewerkers.namen.has(medewerker.naam);
}
