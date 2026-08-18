import { v, ConvexError } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireOrgContext, requireOrgId } from "./auth";
import {
  requireAdmin,
  requireNotViewer,
  getUserRole,
  getLinkedMedewerker,
} from "./roles";

/**
 * Verzuimregistratie ophalen + organisatiescope afdwingen. Medewerker-
 * gebonden data, maar de tenant is de organisatie: de registratie draagt hem
 * zelf (gezet bij ziekmelden vanaf de medewerker-rij).
 */
async function getRegistratieBinnenOrg(
  ctx: QueryCtx | MutationCtx,
  id: Id<"verzuimregistraties">
): Promise<Doc<"verzuimregistraties">> {
  const orgId = await requireOrgId(ctx);
  const registratie = await ctx.db.get(id);
  if (!registratie || registratie.orgId?.toString() !== orgId.toString()) {
    throw new ConvexError("Verzuimregistratie niet gevonden");
  }
  return registratie;
}

// ============================================
// VERZUIMREGISTRATIES — Sick Leave Tracking
// ============================================

export const list = query({
  args: {
    medewerkerId: v.optional(v.id("medewerkers")),
    alleenActief: v.optional(v.boolean()),
    jaar: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const role = await getUserRole(ctx);

    let registraties;

    if (role === "directie") {
      registraties = await ctx.db
        .query("verzuimregistraties")
        .withIndex("by_org", (q) => q.eq("orgId", orgId))
        .collect();
    } else if (role === "medewerker") {
      const linked = await getLinkedMedewerker(ctx);
      if (!linked) return [];
      // by_medewerker is bedrijfsoverstijgend → org-postfilter
      registraties = (
        await ctx.db
          .query("verzuimregistraties")
          .withIndex("by_medewerker", (q) => q.eq("medewerkerId", linked._id))
          .collect()
      ).filter((r) => r.orgId?.toString() === orgId.toString());
    } else {
      return [];
    }

    if (args.medewerkerId) {
      registraties = registraties.filter(
        (r) => r.medewerkerId.toString() === args.medewerkerId!.toString()
      );
    }
    if (args.alleenActief) {
      registraties = registraties.filter((r) => !r.herstelDatum);
    }
    if (args.jaar) {
      const jaarStr = String(args.jaar);
      registraties = registraties.filter((r) => r.startDatum.startsWith(jaarStr));
    }

    registraties.sort((a, b) => b.startDatum.localeCompare(a.startDatum));

    const enriched = await Promise.all(
      registraties.map(async (reg) => {
        const medewerker = await ctx.db.get(reg.medewerkerId);
        const start = new Date(reg.startDatum);
        const end = reg.herstelDatum ? new Date(reg.herstelDatum) : new Date();
        const dagen = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return {
          ...reg,
          medewerkerNaam: medewerker?.naam ?? "Onbekend",
          dagen,
          isActief: !reg.herstelDatum,
        };
      })
    );

    return enriched;
  },
});

export const countActief = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    const role = await getUserRole(ctx);
    if (role !== "directie") return 0;

    const all = await ctx.db
      .query("verzuimregistraties")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    return all.filter((r) => !r.herstelDatum).length;
  },
});

export const getStats = query({
  args: { jaar: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const orgId = await requireOrgId(ctx);
    const role = await getUserRole(ctx);
    if (role !== "directie") return null;

    const jaar = args.jaar ?? new Date().getFullYear();
    const jaarStr = String(jaar);

    const all = await ctx.db
      .query("verzuimregistraties")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const jaarRegistraties = all.filter((r) => r.startDatum.startsWith(jaarStr));

    const totaalDagen = jaarRegistraties.reduce((sum, r) => {
      const start = new Date(r.startDatum);
      const end = r.herstelDatum ? new Date(r.herstelDatum) : new Date();
      const endCapped = end.getFullYear() > jaar ? new Date(jaar, 11, 31) : end;
      return sum + Math.ceil((endCapped.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);

    const uniekeMedewerkers = new Set(
      jaarRegistraties.map((r) => r.medewerkerId.toString())
    ).size;

    const huidigZiek = all.filter((r) => !r.herstelDatum).length;

    const afgerond = jaarRegistraties.filter((r) => r.herstelDatum);
    const gemiddeldeDuur =
      afgerond.length > 0
        ? Math.round(
            afgerond.reduce((sum, r) => {
              const start = new Date(r.startDatum);
              const end = new Date(r.herstelDatum!);
              return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            }, 0) / afgerond.length
          )
        : 0;

    const medewerkers = await ctx.db
      .query("medewerkers")
      .withIndex("by_org_actief", (q) =>
        q.eq("orgId", orgId).eq("isActief", true)
      )
      .collect();
    const totaalWerkdagen = medewerkers.length * 260;
    const verzuimpercentage =
      totaalWerkdagen > 0 ? Math.round((totaalDagen / totaalWerkdagen) * 1000) / 10 : 0;

    return {
      jaar,
      aantalMeldingen: jaarRegistraties.length,
      totaalDagen,
      uniekeMedewerkers,
      huidigZiek,
      gemiddeldeDuur,
      verzuimpercentage,
    };
  },
});

export const checkFrequentVerzuim = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await requireOrgId(ctx);
    const role = await getUserRole(ctx);
    if (role !== "directie") return [];

    const drieMandenGeleden = new Date();
    drieMandenGeleden.setMonth(drieMandenGeleden.getMonth() - 3);
    const cutoff = drieMandenGeleden.toISOString().split("T")[0];

    const recent = await ctx.db
      .query("verzuimregistraties")
      .withIndex("by_org", (q) => q.eq("orgId", orgId))
      .collect();

    const recentMeldingen = recent.filter((r) => r.startDatum >= cutoff);

    const perMedewerker: Record<string, number> = {};
    for (const r of recentMeldingen) {
      const key = r.medewerkerId.toString();
      perMedewerker[key] = (perMedewerker[key] ?? 0) + 1;
    }

    const frequentIds = Object.entries(perMedewerker)
      .filter(([, count]) => count >= 3)
      .map(([id]) => id);

    const result = await Promise.all(
      frequentIds.map(async (id) => {
        const medewerker = await ctx.db.get(id as Id<"medewerkers">);
        return {
          medewerkerId: id,
          medewerkerNaam: medewerker?.naam ?? "Onbekend",
          aantalMeldingen: perMedewerker[id],
        };
      })
    );

    return result;
  },
});

// ============================================
// MUTATIONS
// ============================================

export const ziekmelden = mutation({
  args: {
    medewerkerId: v.id("medewerkers"),
    startDatum: v.string(),
    reden: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);
    const { org } = await requireOrgContext(ctx);

    const medewerker = await ctx.db.get(args.medewerkerId);
    if (!medewerker || medewerker.orgId?.toString() !== org._id.toString()) {
      throw new ConvexError("Medewerker niet gevonden");
    }

    const bestaand = await ctx.db
      .query("verzuimregistraties")
      .withIndex("by_medewerker", (q) => q.eq("medewerkerId", args.medewerkerId))
      .collect();

    const actief = bestaand.find((r) => !r.herstelDatum);
    if (actief) {
      throw new ConvexError("Deze medewerker heeft al een actieve ziekmelding");
    }

    const now = Date.now();
    return await ctx.db.insert("verzuimregistraties", {
      orgId: org._id,
      // `userId` blijft tot fase 6 verplicht in het schema.
      userId: medewerker.userId,
      medewerkerId: args.medewerkerId,
      startDatum: args.startDatum,
      reden: args.reden,
      notities: args.notities,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const herstelmelden = mutation({
  args: {
    id: v.id("verzuimregistraties"),
    herstelDatum: v.string(),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    const registratie = await getRegistratieBinnenOrg(ctx, args.id);
    if (registratie.herstelDatum) throw new ConvexError("Deze medewerker is al hersteld gemeld");
    if (args.herstelDatum < registratie.startDatum) throw new ConvexError("Hersteldatum moet na startdatum liggen");

    const updateData: Record<string, unknown> = {
      herstelDatum: args.herstelDatum,
      updatedAt: Date.now(),
    };

    if (args.notities) {
      updateData.notities = registratie.notities
        ? `${registratie.notities}\n---\nHerstelmelding: ${args.notities}`
        : args.notities;
    }

    await ctx.db.patch(args.id, updateData);
    return args.id;
  },
});

export const addVerzuimgesprek = mutation({
  args: {
    id: v.id("verzuimregistraties"),
    datum: v.string(),
    notities: v.string(),
    afspraken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    await getRegistratieBinnenOrg(ctx, args.id);

    await ctx.db.patch(args.id, {
      verzuimgesprek: {
        datum: args.datum,
        notities: args.notities,
        afspraken: args.afspraken,
      },
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const update = mutation({
  args: {
    id: v.id("verzuimregistraties"),
    reden: v.optional(v.string()),
    notities: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNotViewer(ctx);

    await getRegistratieBinnenOrg(ctx, args.id);

    const updateData: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.reden !== undefined) updateData.reden = args.reden;
    if (args.notities !== undefined) updateData.notities = args.notities;

    await ctx.db.patch(args.id, updateData);
    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id("verzuimregistraties") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await getRegistratieBinnenOrg(ctx, args.id);
    await ctx.db.delete(args.id);
  },
});
