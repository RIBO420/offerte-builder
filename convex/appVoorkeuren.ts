import { v, ConvexError } from "convex/values";
import { query, mutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireOrgContext } from "./auth";
import { normalizeRole } from "./roles";

async function eigenIntro(ctx: QueryCtx | MutationCtx) {
  const t = await requireOrgContext(ctx);
  if (normalizeRole(t.user.role) === "klant") throw new ConvexError("De medewerkersintro is intern");
  const row = await ctx.db.query("appIntroVoorkeuren").withIndex("by_org_user", q => q.eq("orgId", t.org._id).eq("userId", t.user._id)).unique();
  return { ...t, row };
}
export const getIntro = query({
  args: {},
  handler: async ctx => {
    const { row } = await eigenIntro(ctx);
    return { gezien: !!row, overgeslagen: row?.overgeslagen ?? false, gezienOp: row?.gezienOp ?? null };
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
