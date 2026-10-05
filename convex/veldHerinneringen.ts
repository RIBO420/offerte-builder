import { v, ConvexError } from "convex/values";
import { query, mutation, internalMutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireOrgContext } from "./auth";
import { isKantoorRol } from "./roles";
import { leesDekking } from "./veldDekking";
import { internal } from "./_generated/api";

async function kantoor(ctx: QueryCtx | MutationCtx) {
  const t = await requireOrgContext(ctx);
  if (!isKantoorRol(t.user.role)) throw new ConvexError("Alleen kantoor kan herinneringen beheren");
  return t;
}
export function herinnerMoment(nu: number, offset: 0 | -1) {
  const parts = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(nu);
  const p = (type: string) => parts.find(p => p.type === type)!.value;
  const vandaag = `${p("year")}-${p("month")}-${p("day")}`;
  const datum = new Date(Date.parse(vandaag) + offset * 86400000).toISOString().slice(0, 10);
  return { vandaag, datum, uur: Number(p("hour")), weekdag: new Date(`${vandaag}T12:00:00Z`).getUTCDay() };
}
export const getInstellingen = query({
  args: {}, handler: async ctx => {
    const { org } = await kantoor(ctx);
    const [instellingen, users, runs] = await Promise.all([
      ctx.db.query("veldHerinnerInstellingen").withIndex("by_org", q => q.eq("orgId", org._id)).unique(),
      ctx.db.query("users").withIndex("by_org", q => q.eq("orgId", org._id)).collect(),
      ctx.db.query("veldHerinnerRuns").withIndex("by_org_sleutel", q => q.eq("orgId", org._id)).collect(),
    ]);
    return { instellingen, ontvangers: users.filter(u => isKantoorRol(u.role)).map(u => ({ id: u._id, naam: u.name })), runs: runs.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20) };
  },
});
export const opslaan = mutation({
  args: { actief: v.boolean(), ookEmail: v.optional(v.boolean()), uurAmsterdam: v.number(), dagOffset: v.union(v.literal(0), v.literal(-1)), weekdagen: v.array(v.number()), ontvangerIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const { org, user } = await kantoor(ctx);
    if (!Number.isInteger(args.uurAmsterdam) || args.uurAmsterdam < 0 || args.uurAmsterdam > 23 || args.weekdagen.some(d => !Number.isInteger(d) || d < 0 || d > 6) || (args.actief && (!args.weekdagen.length || !args.ontvangerIds.length))) throw new ConvexError("Kies een geldig tijdstip, dagen en ontvangers");
    for (const id of args.ontvangerIds) {
      const ontvanger = await ctx.db.get(id);
      if (!ontvanger || ontvanger.orgId !== org._id || !isKantoorRol(ontvanger.role)) throw new ConvexError("De ontvanger hoort niet bij kantoor in deze organisatie");
    }
    const bestaand = await ctx.db.query("veldHerinnerInstellingen").withIndex("by_org", q => q.eq("orgId", org._id)).unique();
    const waarden = { ...args, weekdagen: [...new Set(args.weekdagen)], ontvangerIds: [...new Set(args.ontvangerIds)], orgId: org._id, door: user._id, updatedAt: Date.now() };
    if (bestaand) await ctx.db.patch(bestaand._id, waarden); else await ctx.db.insert("veldHerinnerInstellingen", waarden);
  },
});
export const voorbeeld = query({
  args: { datum: v.string() }, handler: async (ctx, args) => {
    const { org } = await kantoor(ctx);
    const rijen = await leesDekking(ctx, org._id, args.datum, args.datum);
    return rijen.filter(r => r.status === "open" || r.status === "deels");
  },
});
/** Opt-in. In-app meldingen en de eventuele mailopdracht committen atomair. */
export const verwerk = internalMutation({
  args: {}, handler: async ctx => {
    const instellingen = await ctx.db.query("veldHerinnerInstellingen").collect();
    for (const config of instellingen) {
      if (!config.actief) continue;
      const org = await ctx.db.get(config.orgId);
      if (!org?.actief) continue;
      const moment = herinnerMoment(Date.now(), config.dagOffset);
      if (moment.uur !== config.uurAmsterdam || !config.weekdagen.includes(moment.weekdag)) continue;
      const sleutel = `velduren:${moment.datum}`;
      if (await ctx.db.query("veldHerinnerRuns").withIndex("by_org_sleutel", q => q.eq("orgId", config.orgId).eq("sleutel", sleutel)).first()) continue;
      const open = (await leesDekking(ctx, config.orgId, moment.datum, moment.datum)).filter(r => r.status === "open" || r.status === "deels");
      if (!open.length) continue;
      let ontvangers = 0;
      for (const id of new Set(config.ontvangerIds)) {
        const user = await ctx.db.get(id);
        if (!user || user.orgId !== config.orgId || !isKantoorRol(user.role)) continue;
        await ctx.db.insert("notifications", { orgId: config.orgId, userId: user._id, type: "system_reminder", title: `Open velduren · ${moment.datum}`, message: `${open.length} medewerkerdagen zijn nog niet volledig ingediend. Bekijk de urencontrole.`, metadata: { route: "/uren", datum: moment.datum, openDagen: open.length }, isRead: false, isDismissed: false, createdAt: Date.now() });
        ontvangers++;
      }
      if (ontvangers) {
        const runId = await ctx.db.insert("veldHerinnerRuns", { orgId: config.orgId, datum: moment.datum, sleutel, ontvangers, openDagen: open.length, createdAt: Date.now(), ...(config.ookEmail ? { emailStatus: "gepland" as const } : {}) });
        if (config.ookEmail) await ctx.scheduler.runAfter(0, internal.veldHerinnerEmail.verstuur, { runId });
      }
    }
  },
});
