import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { AuthError, requireAuth } from "./auth";
import { requireAdmin, requireNotViewer, getUserRole, isAdmin } from "./roles";

export const list = query({
  args: { jaar: v.optional(v.number()), projectId: v.optional(v.id("projecten")) },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const role = await getUserRole(ctx);
    if (role === "viewer") return [];

    let meetings;
    if (args.projectId) {
      meetings = await ctx.db.query("toolboxMeetings").withIndex("by_project", (q) => q.eq("projectId", args.projectId)).collect();
    } else {
      meetings = await ctx.db.query("toolboxMeetings").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
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
    await requireAuth(ctx);
    const meeting = await ctx.db.get(args.id);
    if (!meeting) return null;

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
    const user = await requireAuth(ctx);
    const jaar = args.jaar ?? new Date().getFullYear();
    const jaarStr = String(jaar);

    const all = await ctx.db.query("toolboxMeetings").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
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
    const user = await requireNotViewer(ctx);

    if (!args.onderwerp.trim()) throw new Error("Onderwerp is verplicht");
    if (args.aanwezigen.length === 0) throw new Error("Minimaal één aanwezige is verplicht");

    const now = Date.now();
    return await ctx.db.insert("toolboxMeetings", {
      userId: user._id,
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
    const user = await requireNotViewer(ctx);
    const meeting = await ctx.db.get(args.id);
    if (!meeting) throw new Error("Toolbox meeting niet gevonden");

    // Verify ownership: only the creator or an admin can update
    const userIsAdmin = await isAdmin(ctx);
    if (!userIsAdmin && meeting.userId.toString() !== user._id.toString()) {
      throw new AuthError("Je hebt geen toegang om deze meeting te wijzigen");
    }

    if (args.onderwerp !== undefined && !args.onderwerp.trim()) throw new Error("Onderwerp is verplicht");
    if (args.aanwezigen !== undefined && args.aanwezigen.length === 0) throw new Error("Minimaal één aanwezige is verplicht");

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
    const meeting = await ctx.db.get(args.id);
    if (!meeting) throw new Error("Toolbox meeting niet gevonden");
    await ctx.db.delete(args.id);
  },
});
