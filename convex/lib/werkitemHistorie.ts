import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Execution evidence is never erased by planning cleanup. */
export async function heeftWerkitemHistorie(ctx: MutationCtx | QueryCtx, id: Id<"projecten">) {
  const bewijs = await Promise.all([
    ctx.db.query("urenSegmenten").withIndex("by_werkitem", q => q.eq("werkitemId", id)).first(),
    ctx.db.query("urenRegistraties").withIndex("by_project", q => q.eq("projectId", id)).first(),
    ctx.db.query("machineGebruik").withIndex("by_project", q => q.eq("projectId", id)).first(),
    ctx.db.query("werkbezoekAntwoorden").withIndex("by_werkitem_datum", q => q.eq("werkitemId", id)).first(),
    ctx.db.query("werkbezoekFotos").withIndex("by_werkitem_datum", q => q.eq("werkitemId", id)).first(),
    ctx.db.query("werkbezoekAfvoer").withIndex("by_werkitem_datum", q => q.eq("werkitemId", id)).first(),
    ctx.db.query("werkbezoekDelegaties").withIndex("by_werkitem_datum", q => q.eq("werkitemId", id)).first(),
    ctx.db.query("materiaalChecks").withIndex("by_werkitem_datum", q => q.eq("werkitemId", id)).first(),
  ]);
  return bewijs.some(Boolean);
}
