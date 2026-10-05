import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import { regelMinuten } from "./urenTotalen";

export interface ProjectUrenRegel { id: string; datum: string; minuten: number; scope?: string; medewerkerId?: string; medewerker?: string; medewerkerClerkId?: string; notities?: string; taakId?: Id<"planningTaken">; bron: string }
export type ProjectUrenBron = "legacy" | "segmenten";
/** Two ledgers can contain the same labour. Never add them or silently prefer one. */
export function kiesProjectUrenBron(keuze: ProjectUrenBron | undefined, legacyAantal: number, segmentAantal: number) {
  if (keuze) return { status: "ok" as const, bron: keuze };
  if (legacyAantal > 0 && segmentAantal > 0) return { status: "conflict" as const, bron: null };
  return { status: "ok" as const, bron: segmentAantal > 0 ? "segmenten" as const : "legacy" as const };
}

export async function projectUrenBron(ctx: QueryCtx | MutationCtx, project: Doc<"projecten">) {
  const [legacyRijen, alleSegmenten] = await Promise.all([
    ctx.db.query("urenRegistraties").withIndex("by_project", q => q.eq("projectId", project._id)).collect(),
    ctx.db.query("urenSegmenten").withIndex("by_werkitem", q => q.eq("werkitemId", project._id)).collect(),
  ]);
  const legacy = legacyRijen.filter(r => !r.orgId || r.orgId === project.orgId);
  // Pause is unpaid. Explicitly linked travel/loading/internal work is a project labour cost.
  const segmenten = alleSegmenten.filter(s => s.orgId === project.orgId && s.categorie !== "pauze" && s.status !== "concept");
  const keuze = kiesProjectUrenBron(project.urenBron, legacy.length, segmenten.length);
  const legacyMinuten = legacy.reduce((n, r) => n + Math.round(r.uren * 60), 0);
  const segmentMinuten = segmenten.reduce((n, r) => n + regelMinuten(r), 0);
  const regels: ProjectUrenRegel[] = keuze.bron === "segmenten"
    ? segmenten.map(s => ({ id: s._id as string, datum: s.datum, minuten: regelMinuten(s), scope: undefined as string | undefined, medewerkerId: s.medewerkerId as string, medewerker: undefined as string | undefined, medewerkerClerkId: undefined as string | undefined, notities: s.notitie, taakId: undefined, bron: "segmenten" }))
    : keuze.bron === "legacy" ? legacy.map(r => ({ id: r._id as string, datum: r.datum, minuten: Math.round(r.uren * 60), scope: r.scope, medewerkerId: r.medewerkerId as string | undefined, medewerker: r.medewerker, medewerkerClerkId: r.medewerkerClerkId, notities: r.notities, taakId: r.taakId, bron: r.bron })) : [];
  return { ...keuze, explicieteKeuze: project.urenBron ?? null, legacyAantal: legacy.length, segmentAantal: segmenten.length,
    legacyMinuten, segmentMinuten, minuten: keuze.status === "conflict" ? null : regels.reduce((n, r) => n + r.minuten, 0), regels };
}

/** Adapt either selected ledger for existing project reports; stable employee IDs
 * remain authoritative, names only serve as a legacy fallback. */
export async function projectUrenRegistraties(ctx: QueryCtx | MutationCtx, project: Doc<"projecten">) {
  const selectie = await projectUrenBron(ctx, project);
  const ids = [...new Set(selectie.regels.flatMap(r => r.medewerkerId ? [r.medewerkerId] : []))];
  const medewerkers = await Promise.all(ids.map(id => ctx.db.get(id as import("../_generated/dataModel").Id<"medewerkers">)));
  const namen = new Map(medewerkers.filter(m => m && m.orgId === project.orgId).map(m => [m!._id as string, m!.naam]));
  return { ...selectie, registraties: selectie.regels.map(r => ({
    ...r, _id: r.id, projectId: project._id, orgId: project.orgId,
    uren: r.minuten / 60, medewerker: r.medewerker ?? (r.medewerkerId ? namen.get(r.medewerkerId) : undefined) ?? "Onbekende medewerker",
    bronTabel: selectie.bron === "segmenten" ? "urenSegmenten" as const : "urenRegistraties" as const,
  })) };
}

/** Legacy report contracts cannot encode an unknown numeric total. Fail visibly
 * instead of presenting partial totals; the independent source selector remains usable. */
export async function vereisProjectUrenRegistraties(ctx: QueryCtx | MutationCtx, project: Doc<"projecten">) {
  const result = await projectUrenRegistraties(ctx, project);
  if (result.status === "conflict") {
    const { ConvexError } = await import("convex/values");
    throw new ConvexError({ code: "URENBRON_CONFLICT", projectId: project._id, projectNaam: project.naam,
      message: `Kies de urenbron voor ${project.naam} bij Project → Nacalculatie. Dit project bevat zowel projectregistraties als dagsegmenten.` });
  }
  return result.registraties;
}

export async function vereisProjectUrenViaId(ctx: QueryCtx | MutationCtx, projectId: import("../_generated/dataModel").Id<"projecten">) {
  const project = await ctx.db.get(projectId);
  if (!project) return [];
  return vereisProjectUrenRegistraties(ctx, project);
}
