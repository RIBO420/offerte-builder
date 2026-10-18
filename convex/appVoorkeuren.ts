import { v, ConvexError } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOrgContext } from "./auth";
import { normalizeRole } from "./roles";

async function eigenIntro(ctx: QueryCtx | MutationCtx) {
  const t = await requireOrgContext(ctx);
  if (normalizeRole(t.user.role) === "klant") throw new ConvexError("De medewerkersintro is intern");
  const row = await ctx.db.query("appIntroVoorkeuren").withIndex("by_org_user", q => q.eq("orgId", t.org._id).eq("userId", t.user._id)).unique();
  return { ...t, row };
}
/**
 * Wie de app al gebruikt heeft (vóór de introvoorkeur bestond, op een ander
 * toestel, of terwijl de markering nog in de wachtrij stond) krijgt de intro niet
 * opnieuw. Bewust maximaal drie goedkope `.first()`-lookups op eigen sporen.
 */
async function heeftVeldActiviteit(ctx: QueryCtx, orgId: Id<"organisaties">, user: Doc<"users">) {
  const uren = await ctx.db.query("urenOpdrachten").withIndex("by_org_user_sleutel", q => q.eq("orgId", orgId).eq("userId", user._id)).first();
  if (uren) return true;
  const bezoek = await ctx.db.query("werkbezoekOpdrachten").withIndex("by_org_user_sleutel", q => q.eq("orgId", orgId).eq("userId", user._id)).first();
  if (bezoek) return true;
  const medewerkerId = user.linkedMedewerkerId;
  if (!medewerkerId) return false;
  const dag = await ctx.db.query("urenDagen").withIndex("by_medewerker_datum", q => q.eq("medewerkerId", medewerkerId)).first();
  return dag !== null && dag.orgId === orgId;
}

export const getIntro = query({
  args: {},
  handler: async ctx => {
    const { org, user, row } = await eigenIntro(ctx);
    if (row) return { gezien: true, overgeslagen: row.overgeslagen, gezienOp: row.gezienOp };
    return { gezien: await heeftVeldActiviteit(ctx, org._id, user), overgeslagen: false, gezienOp: null };
  },
});
export const markeerIntro = mutation({
  args: { overgeslagen: v.boolean() },
  handler: async (ctx, args) => {
    const { org, user, row } = await eigenIntro(ctx);
    // Completion replaces a prior skip. Repeating the same outcome is idempotent.
    if (row && (!row.overgeslagen || args.overgeslagen)) return { gezienOp: row.gezienOp };
    const gezienOp = Date.now();
    if (row) await ctx.db.patch(row._id, { overgeslagen: false, gezienOp });
    else await ctx.db.insert("appIntroVoorkeuren", { orgId: org._id, userId: user._id, overgeslagen: args.overgeslagen, gezienOp });
    return { gezienOp };
  },
});
