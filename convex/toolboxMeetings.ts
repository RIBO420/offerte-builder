import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOrg, requireOrgId } from "./auth";
import { requireAdmin, requireNotViewer, getUserRole } from "./roles";

/** Meeting ophalen + organisatiescope afdwingen (multi-tenant). */
async function getMeetingBinnenOrg(
  ctx: QueryCtx | MutationCtx,
  id: Id<"toolboxMeetings">
): Promise<Doc<"toolboxMeetings">> {
  const orgId = await requireOrgId(ctx);
  const meeting = await ctx.db.get(id);
  if (!meeting || meeting.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Toolbox meeting niet gevonden");
  }
  return meeting;
}

export const list = query({
  args: { jaar: v.optional(v.number()), projectId: v.optional(v.id("projecten")) },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const role = await getUserRole(ctx);
    if (role === "klant") return [];

    let meetings;
    if (args.projectId) {
      // by_project is bedrijfsoverstijgend → org-postfilter
      meetings = (
        await ctx.db
          .query("toolboxMeetings")
          .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
          .collect()
      ).filter((m) => m.orgId?.toString() === orgId.toString());
    } else {
      meetings = await ctx.db
        .query("toolboxMeetings")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
    }

    if (args.jaar) {
      const jaarStr = String(args.jaar);
      meetings = meetings.filter((m) => m.datum.startsWith(jaarStr));
    }

    meetings.sort((a, b) => b.datum.localeCompare(a.datum));

    const enriched = await Promise.all(
      meetings.map(async (meeting) => {
        const aanwezigenNamen = await Promise.all(
          meeting.aanwezigen.map(async (id) => {
            const medewerker = await ctx.db.get(id);
            return medewerker?.naam ?? "Onbekend";
          })
        );
        return { ...meeting, aanwezigenNamen };
      })
    );

    return enriched;
  },
});

export const get = query({
  args: { id: v.id("toolboxMeetings") },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const meeting = await ctx.db.get(args.id);
    if (!meeting || meeting.orgId?.toString() !== orgId.toString()) return null;

    const aanwezigenNamen = await Promise.all(
      meeting.aanwezigen.map(async (id) => {
        const medewerker = await ctx.db.get(id);
        return medewerker?.naam ?? "Onbekend";
      })
    );
    return { ...meeting, aanwezigenNamen };
  },
});

export const count = query({
  args: { jaar: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const jaar = args.jaar ?? new Date().getFullYear();
    const jaarStr = String(jaar);

    const all = await ctx.db
      .query("toolboxMeetings")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();
    return all.filter((m) => m.datum.startsWith(jaarStr)).length;
  },
});

export const create = mutation({
  args: {
    datum: v.string(),
    onderwerp: v.string(),
    beschrijving: v.optional(v.string()),
    aanwezigen: v.array(v.id("medewerkers")),
    notities: v.optional(v.string()),
    projectId: v.optional(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const org = await requireOrg(ctx);

    if (!args.onderwerp.trim()) throw new ConvexError("Onderwerp is verplicht");
    if (args.aanwezigen.length === 0) throw new ConvexError("Minimaal één aanwezige is verplicht");

    const now = Date.now();
    return await ctx.db.insert("toolboxMeetings", {
      orgId: org._id,
      datum: args.datum,
      onderwerp: args.onderwerp.trim(),
      beschrijving: args.beschrijving,
      aanwezigen: args.aanwezigen,
      notities: args.notities,
      projectId: args.projectId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("toolboxMeetings"),
    datum: v.optional(v.string()),
    onderwerp: v.optional(v.string()),
    beschrijving: v.optional(v.string()),
    aanwezigen: v.optional(v.array(v.id("medewerkers"))),
    notities: v.optional(v.string()),
    projectId: v.optional(v.id("projecten")),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    // De org-grens (getMeetingBinnenOrg) plus requireNotViewer is de toegang.
    // De oude extra check leunde op `userId`, dat de bedrijfseigenaar was en
    // niet de aanmaker — die regel bestond dus feitelijk al niet.
    await getMeetingBinnenOrg(ctx, args.id);

    if (args.onderwerp !== undefined && !args.onderwerp.trim()) throw new ConvexError("Onderwerp is verplicht");
    if (args.aanwezigen !== undefined && args.aanwezigen.length === 0) throw new ConvexError("Minimaal één aanwezige is verplicht");

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.datum !== undefined) updateData.datum = args.datum;
    if (args.onderwerp !== undefined) updateData.onderwerp = args.onderwerp.trim();
    if (args.beschrijving !== undefined) updateData.beschrijving = args.beschrijving;
    if (args.aanwezigen !== undefined) updateData.aanwezigen = args.aanwezigen;
    if (args.notities !== undefined) updateData.notities = args.notities;
    if (args.projectId !== undefined) updateData.projectId = args.projectId;

    await ctx.db.patch(args.id, updateData);
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("toolboxMeetings") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await getMeetingBinnenOrg(ctx, args.id);
    await ctx.db.delete(args.id);
  },
});
