/** Versioned company instructions. Client caches may retain updatedAt/revision;
 * only the current authorized server result is authoritative for publication. */
import { v, ConvexError } from "convex/values";
import { mutation, query, type QueryCtx, type MutationCtx } from "./_generated/server";
import { requireOrgContext } from "./auth";
import { isKantoorRol, normalizeRole } from "./roles";
import { userRoleValidator } from "./validators";

async function toegang(ctx: QueryCtx | MutationCtx, schrijven = false) {
  const t = await requireOrgContext(ctx);
  if (normalizeRole(t.user.role) === "klant" || (schrijven && !isKantoorRol(t.user.role))) throw new ConvexError("Geen toegang tot deze protocollen");
  return t;
}

export const list = query({
  args: {},
  handler: async ctx => {
    const { org, user } = await toegang(ctx);
    const rows = await ctx.db.query("protocollen").withIndex("by_org", q => q.eq("orgId", org._id)).collect();
    return rows.filter(r => isKantoorRol(user.role) || (r.actief && (r.doelgroepen.length === 0 || r.doelgroepen.includes(normalizeRole(user.role))))).sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0) || a.titel.localeCompare(b.titel, "nl"));
  },
});
export const get = query({
  args: { id: v.id("protocollen") },
  handler: async (ctx, args) => {
    const { org, user } = await toegang(ctx);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== org._id || (!isKantoorRol(user.role) && (!row.actief || (row.doelgroepen.length > 0 && !row.doelgroepen.includes(normalizeRole(user.role)))))) throw new ConvexError("Protocol niet gevonden");
    return row;
  },
});

export const opslaan = mutation({
  args: { id: v.optional(v.id("protocollen")), titel: v.string(), wanneer: v.string(), stappen: v.array(v.string()), waarschuwing: v.optional(v.string()), doelgroepen: v.array(userRoleValidator), contactNaam: v.optional(v.string()), contactTelefoon: v.optional(v.string()), actief: v.boolean(), expectedRevision: v.optional(v.number()), icoon: v.optional(v.string()), spoed: v.optional(v.boolean()), volgorde: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { org, user } = await toegang(ctx, true);
    const bestaand = args.id ? await ctx.db.get(args.id) : null;
    if (args.id && (!bestaand || bestaand.orgId !== org._id)) throw new ConvexError("Protocol niet gevonden");
    if (bestaand && bestaand.revision !== args.expectedRevision) throw new ConvexError("Het protocol is intussen gewijzigd. Vernieuw eerst.");
    const titel = args.titel.trim(), wanneer = args.wanneer.trim(), stappen = args.stappen.map(s => s.trim()).filter(Boolean);
    if (!titel || titel.length > 120 || !wanneer || wanneer.length > 2000 || stappen.length === 0 || stappen.length > 30 || stappen.some(s => s.length > 2000)) throw new ConvexError("Vul een titel, toepassingsmoment en maximaal 30 duidelijke stappen in");
    if ((args.waarschuwing?.length ?? 0) > 2000 || (args.contactNaam?.length ?? 0) > 120 || (args.contactTelefoon?.length ?? 0) > 40 || args.doelgroepen.includes("klant")) throw new ConvexError("Ongeldige waarschuwing, contactgegevens of doelgroep");
    if ((args.icoon?.length ?? 0) > 60 || (args.volgorde !== undefined && (!Number.isInteger(args.volgorde) || Math.abs(args.volgorde) > 10000))) throw new ConvexError("Ongeldig icoon of volgorde");
    const now = Date.now();
    const waarden = { orgId: org._id, titel, wanneer, stappen, waarschuwing: args.waarschuwing?.trim() || undefined, doelgroepen: [...new Set(args.doelgroepen)], contactNaam: args.contactNaam?.trim() || undefined, contactTelefoon: args.contactTelefoon?.trim() || undefined, icoon: args.icoon?.trim() || undefined, spoed: args.spoed ?? false, volgorde: args.volgorde ?? 0, actief: args.actief, revision: (bestaand?.revision ?? 0) + 1, door: user._id, createdAt: bestaand?.createdAt ?? now, updatedAt: now };
    const id = args.id ?? await ctx.db.insert("protocollen", waarden);
    if (args.id) await ctx.db.patch(id, waarden);
    await ctx.db.insert("protocolHistorie", { orgId: org._id, protocolId: id, revision: waarden.revision, door: user._id, snapshot: JSON.stringify(waarden), createdAt: now });
    return { id, revision: waarden.revision };
  },
});
export const archiveer = mutation({
  args: { id: v.id("protocollen"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { org, user } = await toegang(ctx, true);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== org._id) throw new ConvexError("Protocol niet gevonden");
    if (row.revision !== args.expectedRevision) throw new ConvexError("Het protocol is intussen gewijzigd. Vernieuw eerst.");
    const revision = row.revision + 1, now = Date.now();
    const snapshot = { ...row, actief: false, revision, door: user._id, updatedAt: now };
    await ctx.db.patch(row._id, { actief: false, revision, door: user._id, updatedAt: now });
    await ctx.db.insert("protocolHistorie", { orgId: org._id, protocolId: row._id, revision, door: user._id, snapshot: JSON.stringify(snapshot), createdAt: now });
    return { id: row._id, revision };
  },
});

export const listContacten = query({
  args: {},
  handler: async ctx => {
    const { org, user } = await toegang(ctx);
    const rows = await ctx.db.query("protocolContacten").withIndex("by_org", q => q.eq("orgId", org._id)).collect();
    return rows.filter(r => r.actief || isKantoorRol(user.role)).sort((a, b) => a.volgorde - b.volgorde || a.naam.localeCompare(b.naam, "nl"));
  },
});
export const opslaanContact = mutation({
  args: { id: v.optional(v.id("protocolContacten")), naam: v.string(), telefoon: v.string(), spoed: v.boolean(), volgorde: v.number(), actief: v.boolean(), expectedRevision: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { org, user } = await toegang(ctx, true);
    const row = args.id ? await ctx.db.get(args.id) : null;
    if (args.id && (!row || row.orgId !== org._id)) throw new ConvexError("Contact niet gevonden");
    if (row && args.expectedRevision !== row.revision) throw new ConvexError("Het contact is intussen gewijzigd. Vernieuw eerst.");
    const naam = args.naam.trim(), telefoon = args.telefoon.trim();
    if (!naam || naam.length > 120 || !/^[+\d][\d\s().-]{1,39}$/.test(telefoon) || !Number.isInteger(args.volgorde) || Math.abs(args.volgorde) > 10000) throw new ConvexError("Vul een naam, geldig telefoonnummer en volgorde in");
    const now = Date.now(), revision = (row?.revision ?? 0) + 1;
    const waarden = { orgId: org._id, naam, telefoon, spoed: args.spoed, volgorde: args.volgorde, actief: args.actief, revision, door: user._id, createdAt: row?.createdAt ?? now, updatedAt: now };
    const id = args.id ?? await ctx.db.insert("protocolContacten", waarden);
    if (args.id) await ctx.db.patch(id, waarden);
    return { id, revision };
  },
});
export const archiveerContact = mutation({
  args: { id: v.id("protocolContacten"), expectedRevision: v.number() },
  handler: async (ctx, args) => {
    const { org, user } = await toegang(ctx, true);
    const row = await ctx.db.get(args.id);
    if (!row || row.orgId !== org._id) throw new ConvexError("Contact niet gevonden");
    if (row.revision !== args.expectedRevision) throw new ConvexError("Het contact is intussen gewijzigd. Vernieuw eerst.");
    await ctx.db.patch(row._id, { actief: false, revision: row.revision + 1, door: user._id, updatedAt: Date.now() });
    return { id: row._id, revision: row.revision + 1 };
  },
});
